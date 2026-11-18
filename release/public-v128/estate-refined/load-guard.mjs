/** Bounded, abortable idle and phase-deadline guard for one asynchronous load.
 *
 * This guard bounds how long its returned promise waits, even if the executor
 * ignores abort. It cannot forcibly stop noncooperative JS or undo its side
 * effects: keep admission, GPU uploads and success accounting after the guarded
 * await, or call throwIfAborted immediately before every such side effect.
 */
const MAX_TIMER_MS = 2_147_483_647;
export const DEFAULT_IDLE_MS = 45_000;
export const DEFAULT_PHASE_DEADLINE_MS = 60_000;

const systemClock = {
  now: () => globalThis.performance?.now() ?? Date.now(),
  setTimeout: (fn, delay) => globalThis.setTimeout(fn, delay),
  clearTimeout: id => globalThis.clearTimeout(id),
};

function abortError() {
  if (typeof DOMException === 'function') return new DOMException('Request cancelled', 'AbortError');
  const error = new Error('Request cancelled');
  error.name = 'AbortError';
  return error;
}

function positiveMs(value, label) {
  if (!Number.isFinite(value) || value <= 0 || value > MAX_TIMER_MS)
    throw new RangeError(`${label} must be a positive finite number no greater than ${MAX_TIMER_MS}`);
  return value;
}
function phaseLabel(value) {
  // Keep diagnostics useful but prevent accidental URLs, paths or user data.
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,47}$/.test(value))
    throw new TypeError('phase must be a lowercase, non-sensitive label');
  return value;
}

export class LoadTimeoutError extends Error {
  constructor({ phase, kind, limitMs, phaseElapsedMs, totalElapsedMs }) {
    super(`Loading timed out during ${phase} (${kind} limit ${Math.round(limitMs)} ms).`);
    this.name = 'LoadTimeoutError';
    Object.assign(this, { phase, kind, limitMs, phaseElapsedMs, totalElapsedMs });
  }
}

/**
 * @param {(context: {signal: AbortSignal, phase: Function, touch: Function,
 *                    throwIfAborted: Function}) => Promise<any>|any} executor
 * @param {{signal?: AbortSignal, idleMs?: number, phaseDeadlineMs?: number,
 *          initialPhase?: string, onDiagnostic?: Function, clock?: object}} options
 * `phase(label, {idleMs?, deadlineMs?})` advances and resets both clocks.
 * `touch()` resets only the idle clock. A deadline always bounds each phase.
 * Callbacks are made for phase changes and settlement, never for each touch.
 */
export function runLoadGuard(executor, options = {}) {
  if (typeof executor !== 'function') throw new TypeError('executor must be a function');
  const { signal: parent, onDiagnostic = () => {}, clock = systemClock } = options;
  if (typeof onDiagnostic !== 'function') throw new TypeError('onDiagnostic must be a function');
  if (!clock || typeof clock.now !== 'function' || typeof clock.setTimeout !== 'function' || typeof clock.clearTimeout !== 'function')
    throw new TypeError('clock must provide now, setTimeout and clearTimeout');
  const defaultIdle = positiveMs(options.idleMs ?? DEFAULT_IDLE_MS, 'idleMs');
  const defaultDeadline = positiveMs(options.phaseDeadlineMs ?? DEFAULT_PHASE_DEADLINE_MS, 'phaseDeadlineMs');
  let currentPhase = phaseLabel(options.initialPhase ?? 'starting');
  const child = new AbortController();

  return new Promise((resolve, reject) => {
    const startedAt = clock.now();
    let phaseStartedAt = startedAt, lastProgressAt = startedAt;
    let idleLimit = defaultIdle, phaseLimit = defaultDeadline;
    let timer = null, settled = false, terminalError = null;

    function diagnostic(event, extra = {}) {
      const now = clock.now();
      // No URLs, IDs, content, byte sequences or personal data are collected.
      try { onDiagnostic({ event, phase: currentPhase,
        phaseElapsedMs: Math.max(0, now - phaseStartedAt),
        totalElapsedMs: Math.max(0, now - startedAt), ...extra }); } catch { /* diagnostics must not break loading */ }
    }
    function clearTimer() {
      if (timer !== null) { clock.clearTimeout(timer); timer = null; }
    }
    function cleanup() {
      clearTimer();
      parent?.removeEventListener('abort', onParentAbort);
    }
    function fail(error, event) {
      if (settled) return;
      settled = true;
      terminalError = error;
      cleanup();
      // Mark the outer guard settled before abort handlers can reject worker or
      // reader promises, so a timeout cannot be mistaken for cancellation.
      child.abort(error);
      diagnostic(event, error instanceof LoadTimeoutError ? { kind: error.kind, limitMs: error.limitMs } : {});
      reject(error);
    }
    function onParentAbort() { fail(abortError(), 'abort'); }
    function checkDeadline() {
      if (settled) return terminalError;
      const now = clock.now();
      const idleAt = lastProgressAt + idleLimit, phaseAt = phaseStartedAt + phaseLimit;
      if (now < idleAt && now < phaseAt) return null;
      const idleWon = idleAt <= phaseAt;
      const error = new LoadTimeoutError({ phase: currentPhase,
        kind: idleWon ? 'idle' : 'deadline', limitMs: idleWon ? idleLimit : phaseLimit,
        phaseElapsedMs: Math.max(0, now - phaseStartedAt), totalElapsedMs: Math.max(0, now - startedAt) });
      fail(error, 'timeout');
      return error;
    }
    function schedule() {
      clearTimer();
      if (settled) return;
      const due = Math.min(lastProgressAt + idleLimit, phaseStartedAt + phaseLimit);
      timer = clock.setTimeout(() => {
        timer = null;
        if (!checkDeadline() && !settled) schedule(); // tolerate an early timer
      }, Math.max(0, Math.ceil(due - clock.now())));
    }
    function throwIfAborted() {
      if (!settled) checkDeadline(); // also catches delayed event-loop timers
      if (terminalError) throw terminalError;
      if (settled || child.signal.aborted) throw abortError();
    }
    const context = Object.freeze({
      signal: child.signal,
      phase(label, limits = {}) {
        throwIfAborted();
        const name = phaseLabel(label);
        const nextIdle = positiveMs(limits.idleMs ?? defaultIdle, 'idleMs');
        const nextDeadline = positiveMs(limits.deadlineMs ?? defaultDeadline, 'deadlineMs');
        currentPhase = name;
        idleLimit = nextIdle;
        phaseLimit = nextDeadline;
        phaseStartedAt = lastProgressAt = clock.now();
        schedule();
        diagnostic('phase');
        throwIfAborted(); // diagnostics may synchronously trigger outer abort
      },
      touch() {
        throwIfAborted();
        lastProgressAt = clock.now();
        schedule();
      },
      throwIfAborted,
    });

    if (parent?.aborted) { onParentAbort(); return; }
    parent?.addEventListener('abort', onParentAbort, { once: true });
    if (parent?.aborted) { onParentAbort(); return; }
    schedule();
    diagnostic('phase');
    Promise.resolve().then(() => {
      throwIfAborted();
      return executor(context);
    }).then(value => {
      if (settled || checkDeadline()) return;
      settled = true;
      cleanup();
      diagnostic('complete');
      resolve(value);
    }, error => {
      if (settled || checkDeadline()) return;
      fail(error, 'error');
    });
  });
}

/** Read a response body while signalling actual nonempty chunk progress.
 * expectedBytes is a trusted catalogue size, not an HTTP Content-Length.
 * The enclosing runLoadGuard settles even if the reader ignores cancellation.
 */
export async function readResponseBytes(response, { signal, touch, throwIfAborted, expectedBytes, onProgress } = {}) {
  if (!signal || typeof touch !== 'function' || typeof throwIfAborted !== 'function' || (onProgress !== undefined && typeof onProgress !== 'function'))
    throw new TypeError('signal, touch and throwIfAborted are required');
  if (expectedBytes !== undefined && (!Number.isSafeInteger(expectedBytes) || expectedBytes < 0))
    throw new RangeError('expectedBytes must be a non-negative safe integer');
  throwIfAborted();
  if (!response.body?.getReader) {
    const bytes = await response.arrayBuffer();
    throwIfAborted();
    if (expectedBytes !== undefined && bytes.byteLength !== expectedBytes) throw Error('Geometry byte count mismatch');
    // Fallback provides only completed-body progress, not streaming detail.
    try { onProgress?.(bytes.byteLength); } catch { /* diagnostics must not affect loading */ }
    return bytes;
  }
  // Allocate before installing the reader's abort listener so allocation
  // failure cannot leak a listener or acquire a stream lock.
  const target = expectedBytes === undefined ? null : new Uint8Array(expectedBytes);
  const chunks = target ? null : [];
  const reader = response.body.getReader();
  const cancel = () => {
    try { Promise.resolve(reader.cancel()).catch(() => {}); } catch { /* outer guard already settles */ }
  };
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  let length = 0;
  try {
    while (true) {
      throwIfAborted();
      const { done, value } = await reader.read();
      throwIfAborted();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new TypeError('Response body yielded a non-byte chunk');
      if (!value.byteLength) continue;
      if (target && value.byteLength > target.length - length) throw Error('Geometry byte count mismatch');
      if (target) target.set(value, length); else chunks.push(value);
      length += value.byteLength;
      touch();
      try { onProgress?.(length); } catch { /* diagnostics must not affect loading */ }
    }
    if (target && length !== target.length) throw Error('Geometry byte count mismatch');
    if (target) return target.buffer;
    const joined = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.byteLength; }
    return joined.buffer;
  } finally {
    signal.removeEventListener('abort', cancel);
    try { reader.releaseLock(); } catch { /* a noncooperative pending read may retain it */ }
  }
}
