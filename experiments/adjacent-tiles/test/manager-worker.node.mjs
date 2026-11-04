import test from "node:test";
import assert from "node:assert/strict";
import { buildTile, heightOnTile } from "../src/geometry.mjs";
import { TileManager } from "../src/manager.mjs";
import { nodeWorkerLoader } from "../src/worker-loader.mjs";
const config = {
  tileSize: 64,
  origin: [0, 0],
  latticeSegments: 64,
  coarseSegments: 8,
  fineSegments: 64,
  sampler: {
    kind: "analytic-fixture",
    fixture: "wave",
    domain: { minX: 0, maxX: 640, minZ: 0, maxZ: 640 },
  },
};
const local = async (job) => buildTile(job);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("coarse overview installs before any fine load; real worker transferable roundtrip", async () => {
  const sequence = [];
  const manager = new TileManager({
    config,
    loader: async (job, o) => {
      sequence.push([o.lod, manager.active.size]);
      return nodeWorkerLoader(job, o);
    },
  });
  manager.request(
    Array.from({ length: 9 }, (_, i) => ({
      x: i % 3,
      z: Math.floor(i / 3),
      lod: "fine",
    })),
  );
  await manager.idle();
  assert.equal(manager.active.size, 9);
  assert(
    sequence
      .filter(([lod]) => lod === "fine")
      .every(([, count]) => count === 9),
  );
  assert.equal(manager.snapshot().failed.length, 0);
  assert(manager.stats.peakInflight <= 2);
  manager.close();
  assert.equal(manager.stats.created, manager.stats.disposed);
  assert.equal(manager.stats.callbackErrors, 0);
});
test("out of order ignored even when loader ignores abort; latest collider wins", async () => {
  const manager = new TileManager({
    config,
    loader: async (job, o) => {
      await wait(o.generation === 1 ? 50 : 2);
      return buildTile(job);
    },
  });
  manager.request([{ x: 0, z: 0, lod: "fine" }]);
  await wait(1);
  manager.request([{ x: 1, z: 0, lod: "coarse" }]);
  await manager.idle();
  assert.deepEqual([...manager.active.keys()], ["1,0"]);
  assert(manager.stats.stale > 0);
  assert.equal(manager.heightAt(10, 12), null);
  assert(Number.isFinite(manager.heightAt(70, 12)));
  manager.close();
});
test("rapid moves bounded, active data never disposed, recycling and pending movement safe", async () => {
  let manager;
  manager = new TileManager({
    config,
    loader: local,
    maxActive: 3,
    maxCached: 2,
    dispose: (b) => assert(![...manager.active.values()].includes(b)),
  });
  for (let x = 0; x < 9; x++) {
    manager.request([{ x, z: 0, lod: "fine" }]);
    await manager.idle();
    assert(manager.active.size + manager.cache.size <= 5);
    assert(manager.bytes() <= manager.maxBytes);
  }
  const before = manager.active.get("8,0");
  manager.request([{ x: 9, z: 0, lod: "fine" }], { anchor: { x: 8, z: 0 } });
  assert.equal(before.disposed, false);
  const blocked = manager.moveFixtureTerrainOnly([520, 10, 12], [590, 10, 12]);
  assert(blocked.blocked);
  await manager.idle();
  assert(!manager.moveFixtureTerrainOnly([520, 10, 12], [590, 10, 12]).blocked);
  manager.close();
  assert.equal(manager.stats.created, manager.stats.disposed);
  assert.equal(manager.stats.callbackErrors, 0);
});
test("async adapter prepare cannot install stale resources; rejection preserves safe coarse", async () => {
  let prepared = 0,
    disposed = 0;
  const manager = new TileManager({
    config,
    loader: local,
    prepare: async (d, o) => {
      prepared++;
      await wait(5);
      if (o.lod === "fine") throw Error("fixture adapter failure");
      return { collider: "ready" };
    },
    dispose: (b) => {
      if (b.resources) disposed++;
    },
  });
  manager.request([{ x: 0, z: 0, lod: "fine" }]);
  await wait(1);
  manager.request([{ x: 1, z: 0, lod: "fine" }]);
  await manager.idle();
  assert.equal(manager.active.get("1,0").lod, "coarse");
  assert(manager.failed.has("1,0/fine"));
  assert(manager.stats.stale > 0);
  manager.close();
  assert(prepared >= 3);
  assert(disposed >= 2);
});
test("resource budget rejects fine atomically without discarding usable coarse", async () => {
  const manager = new TileManager({
    config,
    loader: local,
    maxBytes: 30000,
    maxCached: 0,
  });
  manager.request([{ x: 0, z: 0, lod: "fine" }]);
  await manager.idle();
  assert.equal(manager.active.get("0,0").lod, "coarse");
  assert(manager.bytes() <= 30000);
  assert(manager.failed.has("0,0/fine"));
  manager.close();
});
test("failed renderer install leaves old render and collision bundle undisposed", async () => {
  let installed = null;
  const manager = new TileManager({
    config,
    loader: local,
    install: (next) => {
      if (next.lod === "fine") throw Error("GPU install failed before swap");
      installed = next;
    },
    dispose: (b) => assert.notEqual(b, installed),
    detach: (b) => {
      if (installed === b) installed = null;
    },
  });
  manager.request([{ x: 0, z: 0, lod: "fine" }]);
  await manager.idle();
  assert.equal(installed, manager.active.get("0,0"));
  assert.equal(installed.lod, "coarse");
  assert.equal(installed.disposed, false);
  assert(manager.failed.has("0,0/fine"));
  manager.close();
  assert.equal(manager.stats.callbackErrors, 0);
});
test("fine tile downgrades on coarse request and outer boundary is intentionally closed to navigation", async () => {
  const manager = new TileManager({ config, loader: local });
  manager.request([{ x: 0, z: 0, lod: "fine" }]);
  await manager.idle();
  const old = manager.active.get("0,0");
  manager.request([{ x: 0, z: 0, lod: "coarse" }]);
  await manager.idle();
  assert.equal(manager.active.get("0,0").lod, "coarse");
  assert(old.disposed);
  assert.equal(manager.heightAt(64, 12), null);
  assert(Number.isFinite(heightOnTile(manager.active.get("0,0").data, 64, 12)));
  manager.close();
});
test("failed cached restore falls back to a guarded rebuild without stopping the queue", async () => {
  let failOnce = false;
  const manager = new TileManager({
    config,
    loader: local,
    install: () => {
      if (failOnce) {
        failOnce = false;
        throw Error("cached resource expired");
      }
    },
  });
  manager.request([{ x: 0, z: 0, lod: "coarse" }]);
  await manager.idle();
  manager.request([{ x: 1, z: 0, lod: "coarse" }]);
  await manager.idle();
  failOnce = true;
  assert.doesNotThrow(() => manager.request([{ x: 0, z: 0, lod: "coarse" }]));
  await manager.idle();
  assert(manager.active.has("0,0"));
  manager.close();
  assert.equal(manager.stats.created, manager.stats.disposed);
});
test("detach failure during close remains visible and owned until safe retry", async () => {
  let fail = true;
  const manager = new TileManager({
    config,
    loader: local,
    detach: () => {
      if (fail) throw Error("renderer busy");
    },
  });
  manager.request([{ x: 0, z: 0, lod: "coarse" }]);
  await manager.idle();
  const b = manager.active.get("0,0");
  const blocked = manager.close();
  assert.equal(blocked.closed, true);
  assert.equal(blocked.active, 1);
  assert.equal(blocked.lifecycleErrors.length, 1);
  assert.equal(b.disposed, false);
  fail = false;
  manager.close();
  assert.equal(manager.active.size, 0);
  assert(b.disposed);
  assert.equal(manager.stats.created, manager.stats.disposed);
});
test("partial close detaches safe tiles, retains failed tile, drains late preparation and retries", async () => {
  let failKey = "1,0",
    unblock;
  const gate = new Promise((r) => (unblock = r));
  const manager = new TileManager({
    config,
    loader: local,
    prepare: async (d) => {
      if (d.x === 2) await gate;
      return { ready: true };
    },
    detach: (b) => {
      if (b.key === failKey) throw Error("detach blocked");
    },
  });
  manager.request([
    { x: 0, z: 0, lod: "coarse" },
    { x: 1, z: 0, lod: "coarse" },
  ]);
  await manager.idle();
  manager.request([
    { x: 0, z: 0, lod: "coarse" },
    { x: 1, z: 0, lod: "coarse" },
    { x: 2, z: 0, lod: "coarse" },
  ]);
  await wait(1);
  const result = manager.close();
  assert.equal(result.closeState, "blocked");
  assert.deepEqual([...manager.active.keys()], ["1,0"]);
  unblock();
  await manager.idle();
  assert.equal(manager.active.size, 1);
  assert(manager.stats.stale > 0);
  failKey = null;
  assert.equal(manager.close().closeState, "complete");
  assert.equal(manager.stats.created, manager.stats.disposed);
});
