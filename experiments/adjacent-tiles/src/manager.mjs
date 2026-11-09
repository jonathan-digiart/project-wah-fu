import { heightOnTile } from "./geometry.mjs";
export const tileKey = (x, z) => `${x},${z}`;
/** Owns complete geometry/collider bundles. Renderer adapters must release GPU handles in dispose.
 * Max residency excludes transient worker results, bounded independently by concurrency and tile size.
 */
export class TileManager {
  constructor({
    loader,
    heightQuery = heightOnTile,
    config,
    maxActive = 10,
    maxCached = 4,
    maxBytes = 32 * 1024 * 1024,
    concurrency = 2,
    onChange = () => {},
    dispose = () => {},
    prepare = async () => null,
    install = () => {},
    detach = () => {},
  }) {
    if (
      typeof loader !== "function" ||
      typeof heightQuery !== "function" ||
      !config ||
      ![maxActive, maxCached, maxBytes, concurrency].every(Number.isInteger) ||
      maxActive < 1 ||
      maxCached < 0 ||
      maxBytes < 1 ||
      concurrency < 1
    )
      throw Error("Invalid manager configuration");
    this.loader = loader;
    this.heightQuery = heightQuery;
    this.config = structuredClone(config);
    Object.assign(this, {
      maxActive,
      maxCached,
      maxBytes,
      concurrency,
      onChange,
      dispose,
      prepare,
      install,
      detach,
    });
    this.active = new Map();
    this.cache = new Map();
    this.jobs = new Set();
    this.wanted = new Map();
    this.failed = new Set();
    this.generation = 0;
    this.closed = false;
    this.lifecycleErrors = [];
    this.waiters = [];
    this.stats = {
      created: 0,
      disposed: 0,
      stale: 0,
      cancelled: 0,
      peakResident: 0,
      peakBytes: 0,
      peakInflight: 0,
      callbackErrors: 0,
    };
  }
  request(tiles, { anchor = null } = {}) {
    if (this.closed) throw Error("Manager closed");
    const wanted = new Map();
    for (const t of tiles) {
      if (
        !Number.isSafeInteger(t.x) ||
        !Number.isSafeInteger(t.z) ||
        !["coarse", "fine"].includes(t.lod)
      )
        throw Error("Invalid tile request");
      wanted.set(tileKey(t.x, t.z), { ...t });
    }
    // Explicit anchor retains the current safe tile while a destination is pending.
    if (
      anchor &&
      this.active.has(tileKey(anchor.x, anchor.z)) &&
      !wanted.has(tileKey(anchor.x, anchor.z))
    )
      wanted.set(tileKey(anchor.x, anchor.z), { ...anchor, lod: "coarse" });
    if (wanted.size > this.maxActive)
      throw Error("Active tile budget exceeded");
    this.generation++;
    this.wanted = wanted;
    this.failed.clear();
    for (const job of this.jobs) {
      job.abort.abort();
      this.stats.cancelled++;
    }
    for (const [key, bundle] of this.active)
      if (!wanted.has(key)) {
        try {
          this.detach(bundle);
        } catch (error) {
          this.lifecycleErrors.push(`detach ${key}: ${error}`);
          throw error;
        }
        this.active.delete(key);
        this.stash(bundle);
      }
    for (const [key, t] of wanted)
      if (!this.active.has(key)) {
        const id = `${key}/${t.lod}`,
          coarse = `${key}/coarse`,
          found = this.cache.get(id) || this.cache.get(coarse);
        if (found) {
          try {
            this.install(found, null);
            this.cache.delete(found.id);
            this.active.set(key, found);
          } catch {
            this.cache.delete(found.id);
            this.release(
              found,
            ); /* Rebuild through the ordinary guarded install path. */
          }
        }
      }
    this.trim();
    this.emit();
    this.pump();
    return this.generation;
  }
  emit() {
    this.measure();
    try {
      this.onChange(this.snapshot());
    } catch {
      this.stats.callbackErrors++; /* Observers cannot break ownership. */
    }
  }
  snapshot() {
    return {
      closeState: !this.closed
        ? "open"
        : this.active.size
          ? "blocked"
          : this.jobs.size
            ? "draining"
            : "complete",
      closed: this.closed,
      lifecycleErrors: [...this.lifecycleErrors],
      generation: this.generation,
      active: this.active.size,
      cached: this.cache.size,
      inflight: this.jobs.size,
      bytes: this.bytes(),
      geometryBytes: this.bytes(),
      geometryBudgetBytes: this.maxBytes,
      transientJobCount: this.jobs.size,
      stats: { ...this.stats },
      tiles: [...this.active].map(([key, b]) => ({
        key,
        lod: b.lod,
        generation: b.generation,
      })),
      failed: [...this.failed],
    };
  }
  bytes() {
    let b = 0;
    for (const v of [...this.active.values(), ...this.cache.values()])
      b += v.data.bytes;
    return b;
  }
  measure() {
    this.stats.peakResident = Math.max(
      this.stats.peakResident,
      this.active.size + this.cache.size,
    );
    this.stats.peakBytes = Math.max(this.stats.peakBytes, this.bytes());
    this.stats.peakInflight = Math.max(this.stats.peakInflight, this.jobs.size);
  }
  release(bundle) {
    if (bundle.disposed) throw Error("Double disposal");
    bundle.disposed = true;
    this.stats.disposed++;
    try {
      this.dispose(bundle);
    } catch {
      this.stats.callbackErrors++;
    }
  }
  stash(bundle) {
    if (this.cache.has(bundle.id)) this.release(this.cache.get(bundle.id));
    this.cache.delete(bundle.id);
    this.cache.set(bundle.id, bundle);
    this.trim();
  }
  trim() {
    while (
      this.cache.size > this.maxCached ||
      (this.bytes() > this.maxBytes && this.cache.size)
    ) {
      const key = this.cache.keys().next().value,
        b = this.cache.get(key);
      this.cache.delete(key);
      this.release(b);
    }
  }
  next() {
    const overviewReady = [...this.wanted.keys()].every((key) =>
      this.active.has(key),
    );
    for (const [key, t] of this.wanted) {
      const existing = this.active.get(key);
      const lod =
        !existing || (t.lod === "coarse" && existing.lod !== "coarse")
          ? "coarse"
          : overviewReady && t.lod === "fine" && existing.lod !== "fine"
            ? "fine"
            : null;
      if (!lod) continue;
      const id = `${key}/${lod}`;
      if (
        !this.failed.has(id) &&
        ![...this.jobs].some(
          (j) => j.generation === this.generation && j.id === id,
        )
      )
        return { key, id, t, lod };
    }
    return null;
  }
  pump() {
    if (!this.closed)
      while (this.jobs.size < this.concurrency) {
        const next = this.next();
        if (!next) break;
        const job = {
          ...next,
          generation: this.generation,
          abort: new AbortController(),
        };
        this.jobs.add(job);
        this.measure();
        const interiorSegments =
          job.lod === "fine"
            ? this.config.fineSegments
            : this.config.coarseSegments;
        Promise.resolve()
          .then(() =>
            this.loader(
              { ...this.config, x: job.t.x, z: job.t.z, interiorSegments },
              {
                signal: job.abort.signal,
                generation: job.generation,
                lod: job.lod,
              },
            ),
          )
          .then(async (data) => {
            const bundle = { data, resources: null };
            try {
              if (!job.abort.signal.aborted)
                bundle.resources = await this.prepare(data, {
                  signal: job.abort.signal,
                  generation: job.generation,
                  lod: job.lod,
                });
            } catch (error) {
              this.stats.created++;
              this.release({
                ...bundle,
                id: job.id,
                key: job.key,
                lod: job.lod,
                disposed: false,
              });
              throw error;
            }
            this.accept(job, bundle);
          })
          .catch((error) => {
            if (job.generation === this.generation && !this.closed) {
              this.failed.add(job.id);
              job.error = String(error);
            }
          })
          .finally(() => {
            this.jobs.delete(job);
            this.emit();
            this.pump();
          });
      }
    if (!this.jobs.size && (this.closed || !this.next())) {
      for (const done of this.waiters.splice(0)) done(this.snapshot());
    }
  }
  accept(job, { data, resources }) {
    this.stats.created++;
    const bundle = {
      id: job.id,
      key: job.key,
      lod: job.lod,
      data,
      resources,
      generation: job.generation,
      disposed: false,
    };
    if (
      this.closed ||
      job.generation !== this.generation ||
      job.abort.signal.aborted
    ) {
      this.stats.stale++;
      this.release(bundle);
      return;
    }
    const old = this.active.get(job.key);
    // Evict cached data before deciding if an atomic replacement fits the hard resident budget.
    while (
      this.cache.size &&
      this.bytes() - (old?.data.bytes || 0) + data.bytes > this.maxBytes
    ) {
      const key = this.cache.keys().next().value,
        b = this.cache.get(key);
      this.cache.delete(key);
      this.release(b);
    }
    if (
      !Number.isFinite(data.bytes) ||
      this.bytes() - (old?.data.bytes || 0) + data.bytes > this.maxBytes
    ) {
      this.failed.add(job.id);
      this.release(bundle);
      return;
    }
    try {
      this.install(bundle, old || null);
    } catch {
      this.failed.add(job.id);
      this.release(bundle);
      return;
    }
    this.active.set(job.key, bundle); // collision reads the same bundle as rendering, in this synchronous commit.
    if (old) this.release(old); // transactional install succeeded before old handles are released.
    this.emit();
  }
  idle() {
    if (!this.jobs.size && !this.next())
      return Promise.resolve(this.snapshot());
    return new Promise((resolve) => this.waiters.push(resolve));
  }
  owner(x, z) {
    const S = this.config.tileSize,
      [ox, oz] = this.config.origin || [0, 0];
    return tileKey(Math.floor((x - ox) / S), Math.floor((z - oz) / S));
  }
  heightAt(x, z) {
    const key = this.owner(x, z),
      b = this.active.get(key);
    if (!b || !Number.isFinite(x) || !Number.isFinite(z)) return null;
    try {
      const y = this.heightQuery(b.data, x, z);
      return Number.isFinite(y) ? y : null;
    } catch {
      return null;
    }
  }
  /** Conservatively reject any segment crossing an unavailable tile, even with large camera jumps.
   * Terrain clearance uses vertex maximum: conservative for every triangle, no under-surface tunnelling.
   * Building/interior collision remains an external responsibility.
   */
  moveFixtureTerrainOnly(from, to, clearance = 1) {
    if (![...from, ...to, clearance].every(Number.isFinite) || clearance < 0)
      throw Error("Invalid movement");
    const S = this.config.tileSize,
      origin = this.config.origin || [0, 0],
      cuts = [0, 1];
    for (const axis of [0, 2]) {
      const o = origin[axis === 0 ? 0 : 1],
        lo = Math.min(from[axis], to[axis]) - o,
        hi = Math.max(from[axis], to[axis]) - o;
      if ((hi - lo) / S > 10000)
        return { position: from, blocked: true, reason: "movement-too-large" };
      for (let k = Math.floor(lo / S) + 1; k * S < hi; k++)
        cuts.push((o + k * S - from[axis]) / (to[axis] - from[axis]));
    }
    cuts.sort((a, b) => a - b);
    let max = -Infinity;
    const times = [...cuts, ...cuts.slice(1).map((v, i) => (v + cuts[i]) / 2)];
    for (const t of times) {
      const x = from[0] + (to[0] - from[0]) * t,
        z = from[2] + (to[2] - from[2]) * t,
        b = this.active.get(this.owner(x, z));
      if (!b)
        return { position: [...from], blocked: true, reason: "tile-pending" };
      if (b.data.geometryKind !== undefined)
        return {
          position: [...from],
          blocked: true,
          reason: "coverage-policy-required",
        };
      if (this.heightAt(x, z) === null)
        return {
          position: [...from],
          blocked: true,
          reason: "ground-unavailable",
        };
      for (let i = 1; i < b.data.positions.length; i += 3)
        max = Math.max(max, b.data.positions[i]);
    }
    return {
      position: [to[0], Math.max(to[1], max + clearance), to[2]],
      blocked: false,
    };
  }
  close() {
    this.closed = true;
    this.generation++;
    this.wanted.clear();
    for (const j of this.jobs) j.abort.abort();
    for (const [key, b] of this.active) {
      try {
        this.detach(b);
      } catch (error) {
        this.lifecycleErrors.push(`close detach ${key}: ${error}`);
        continue;
      }
      this.active.delete(key);
      this.release(b);
    }
    const cached = [...this.cache.values()];
    this.cache.clear();
    for (const b of cached) this.release(b);
    // A failed detach remains owned and undisposed. Correct adapter and call close() again.
    this.emit();
    this.pump();
    return this.snapshot();
  }
}
