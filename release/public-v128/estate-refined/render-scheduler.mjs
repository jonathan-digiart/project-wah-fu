/** One-shot, foreground-only render requests. minIntervalMs may be a function. */
export function createRenderScheduler({
  draw, isRunnable = () => true, minIntervalMs = 0,
  now = () => globalThis.performance.now(),
  requestFrame = callback => globalThis.requestAnimationFrame(callback),
  cancelFrame = id => globalThis.cancelAnimationFrame(id),
  setTimer = (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimer = id => globalThis.clearTimeout(id), fallbackMs = 250,
}) {
  let pending = false, generation = 0, frame = null, fallback = null, throttle = null;
  let lastDrawAt = -Infinity;
  const interval = () => {
    const value = Number(typeof minIntervalMs === 'function' ? minIntervalMs() : minIntervalMs);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  };
  function clearHandles() {
    if (frame !== null) cancelFrame(frame);
    if (fallback !== null) clearTimer(fallback);
    if (throttle !== null) clearTimer(throttle);
    frame = fallback = throttle = null;
  }
  function cancel() { generation++; pending = false; clearHandles(); }
  function valid(token) {
    if (!pending || token !== generation) return false;
    if (!isRunnable()) { cancel(); return false; }
    return true;
  }
  function attempt(token, trigger) {
    if (!valid(token)) return;
    clearHandles();
    const remaining = lastDrawAt + interval() - now();
    if (remaining > 0) {
      throttle = setTimer(() => { if (valid(token)) { throttle = null; arm(token); } }, remaining);
      return;
    }
    // Invalidate both racing callbacks before user code; a reentrant request is new work.
    pending = false; generation++; lastDrawAt = now();
    draw(trigger);
  }
  function arm(token) {
    if (!valid(token)) return;
    const remaining = lastDrawAt + interval() - now();
    if (remaining > 0) {
      throttle = setTimer(() => { if (valid(token)) { throttle = null; arm(token); } }, remaining);
      return;
    }
    // If frame registration itself throws, still arm the bounded fallback.
    try { frame = requestFrame(() => attempt(token, 'render-frame')); } catch { frame = null; }
    fallback = setTimer(() => attempt(token, 'timer-fallback'), Math.max(0, fallbackMs));
  }
  function request() {
    if (!isRunnable()) { cancel(); return false; }
    if (pending) return false;
    pending = true; const token = ++generation; arm(token); return true;
  }
  return { request, cancel, state: () => ({ pending, framePending: frame !== null,
    fallbackPending: fallback !== null, throttlePending: throttle !== null, lastDrawAt }) };
}

/** Independent one-shot status updates; never tied to requestAnimationFrame. */
export function createStatusScheduler({ refresh, isRunnable = () => true,
  setTimer = (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimer = id => globalThis.clearTimeout(id), delayMs = 100,
}) {
  let timer = null, generation = 0;
  function cancel() { generation++; if (timer !== null) clearTimer(timer); timer = null; }
  function request() {
    if (!isRunnable()) { cancel(); return false; }
    if (timer !== null) return false;
    const token = ++generation;
    timer = setTimer(() => {
      if (token !== generation || timer === null) return;
      timer = null; generation++;
      if (isRunnable()) refresh();
    }, Math.max(0, delayMs));
    return true;
  }
  return { request, cancel, state: () => ({ pending: timer !== null }) };
}
