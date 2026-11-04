import test from "node:test";
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import {
  BufferGeometry,
  BufferAttribute,
  Mesh,
  BoxGeometry,
  Vector3,
} from "three";
import { createExteriorCollider as original } from "../../../src/exterior-camera-collision.mjs";
import { buildTile } from "../src/geometry.mjs";
import { TileManager } from "../src/manager.mjs";
import {
  createExteriorCollider,
  compileExteriorRoots,
} from "./compiled-collider.mjs";
import { compileInWorker } from "./collider-loader.mjs";
import { serializeSolids, hydrateSolids } from "./collider-serialization.mjs";
import { validateGeometry, validateCompiled, LIMITS } from "./validation.mjs";
const config = {
  origin: [0, 0],
  tileSize: 64,
  latticeSegments: 64,
  coarseSegments: 8,
  fineSegments: 64,
  sampler: {
    kind: "analytic-fixture",
    fixture: "wave",
    domain: { minX: 0, maxX: 192, minZ: 0, maxZ: 192 },
  },
};
const data = (x = 0, z = 0, n = 8) =>
  buildTile({ ...config, x, z, interiorSegments: n });
function mesh(d) {
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(d.positions, 3));
  g.setIndex(new BufferAttribute(d.indices, 1));
  return new Mesh(g);
}
function dispose(root) {
  root.geometry.dispose();
  root.material.dispose();
}
const load = (d, generation = 0, signal = new AbortController().signal) =>
  compileInWorker(d, { generation, signal }, Worker, true);
test("actual workers transfer geometry; hydrated sweeps match original public collider", async () => {
  const roots = [],
    solids = [];
  try {
    for (let i = 0; i < 9; i += 2) {
      const results = await Promise.all(
        Array.from({ length: Math.min(2, 9 - i) }, async (_, k) => {
          const j = i + k,
            d = data(j % 3, Math.floor(j / 3), j === 4 ? 64 : 8),
            pending = load(d, j);
          assert.equal(d.positions.byteLength, 0);
          const result = await pending;
          const expected = data(j % 3, Math.floor(j / 3), j === 4 ? 64 : 8);
          assert.deepEqual(
            result.data,
            expected,
            "Trusted worker geometry roundtrip",
          );
          return result;
        }),
      );
      for (const r of results) {
        const root = mesh(r.data);
        roots.push(root);
        solids.push(...hydrateSolids(r.solids, root));
      }
    }
    const box = new Mesh(new BoxGeometry(12, 24, 12));
    box.position.set(96, 16, 96);
    roots.push(box);
    solids.push(...compileExteriorRoots([box]));
    const before = original(roots, { completeSurfaces: true }),
      after = createExteriorCollider(roots, {
        completeSurfaces: true,
        compiledSolids: solids,
      });
    assert.deepEqual(after.stats(), before.stats());
    const paths = [];
    for (const [x, z] of [
      [30, 30],
      [63.9, 31],
      [64, 31],
      [64.1, 31],
      [96, 64],
      [128, 128],
      [150, 150],
    ])
      paths.push([
        [x, 50, z],
        [x, -30, z],
      ]);
    for (const z of [91, 96, 101])
      paths.push([
        [70, 16, z],
        [120, 16, z],
      ]);
    paths.push(
      [
        [30, 20, 30],
        [170, -10, 170],
      ],
      [
        [70, 16, 96],
        [89, 16, 110],
      ],
      [
        [96, 16, 96],
        [120, 16, 96],
      ],
    );
    for (const [a, b] of paths)
      for (const slide of [false, true])
        assert.ok(
          before
            .move(new Vector3(...a), new Vector3(...b), 1, slide)
            .distanceTo(
              after.move(new Vector3(...a), new Vector3(...b), 1, slide),
            ) < 1e-9,
        );
  } finally {
    roots.forEach(dispose);
  }
});
test("cancel active and already-aborted worker requests", async () => {
  const abort = new AbortController(),
    pending = load(data(1, 1, 64), 5, abort.signal);
  abort.abort();
  await assert.rejects(pending, /Aborted/);
  await assert.rejects(load(data(), 6, abort.signal), /Aborted/);
});
test("reject malformed geometry and compiled bundles before hydration", async () => {
  for (const change of [
    (d) => {
      const padded = new Float32Array(d.positions.length + 1);
      padded.set(d.positions);
      d.positions = padded.subarray(0, d.positions.length);
    },

    (d) => (d.cells = new Uint32Array(0)),
    (d) => (d.cells[0] = 3),
    (d) => (d.cells[1] = d.indices.length + 3),
    (d) => (d.cells[1] = 1),
    (d) => (d.edges.west[0] = d.positions.length),
    (d) => (d.edges.west = new Uint32Array(0)),
    (d) => (d.bytes = -1000),
    (d) => (d.bytes += 4),
    (d) => (d.tileSize = 0),
    (d) => (d.origin = [NaN, 0]),
    (d) => (d.x = 0.5),
    (d) => (d.interiorSegments = 3),

    (d) => (d.positions[0] = NaN),
    (d) => (d.indices[0] = 1000000),
    (d) => (d.positions = new Float64Array(3)),
    (d) => (d.indices = new Uint32Array((LIMITS.triangles + 1) * 3)),
    (d) => (d.edges.extra = new Uint32Array(1)),
  ]) {
    const d = data();
    change(d);
    assert.throws(() => validateGeometry(d));
    await assert.rejects(load(d));
  }
  const root = mesh(data());
  try {
    const good = serializeSolids(compileExteriorRoots([root]));
    validateCompiled(good);
    for (const change of [
      (s) => (s[0].data.positions[0] = Infinity),
      (s) => (s[0].tree.box.min.x = NaN),
      (s) => (s[0].tree.left = s[0].tree),
      (s) => (s[0].tree.left = null),
      (s) => s.push(s[0]),
    ]) {
      const bad = structuredClone(good);
      change(bad);
      assert.throws(() => hydrateSolids(bad, root));
    }
    assert.throws(() => hydrateSolids(good, null));
  } finally {
    dispose(root);
  }
});
test("generation mismatch and failed worker responses are rejected and terminated", async () => {
  for (const value of [
    { generation: 999 },
    { error: "Injected compile failure" },
  ]) {
    let terminated = 0;
    class FakeWorker {
      postMessage() {
        globalThis.queueMicrotask(() => this.onmessage({ data: value }));
      }
      terminate() {
        terminated++;
      }
    }
    await assert.rejects(
      compileInWorker(
        data(),
        { generation: 2, signal: new AbortController().signal },
        FakeWorker,
      ),
    );
    assert.equal(terminated, 1);
  }
});
test("concurrent prepared roots, stale result, cached detach/restore and final disposal", async () => {
  let live = new Map(),
    snapshot = [],
    created = 0,
    freed = 0,
    delay = false,
    entered;
  const ready = new Promise((r) => (entered = r));
  const manager = new TileManager({
    config,
    maxCached: 4,
    loader: async (j) => buildTile(j),
    prepare: async (d, ctx) => {
      const r = await load(d, ctx.generation, ctx.signal);
      Object.assign(d, r.data);
      const root = mesh(d),
        resource = { root, solids: hydrateSolids(r.solids, root), dead: false };
      created++;
      if (delay) {
        entered();
        await new Promise((r) => setTimeout(r, 40));
      }
      return resource;
    },
    install: (b) => {
      const next = new Map(live);
      next.set(b.key, b.resources);
      const roots = [...next.values()].map((r) => r.root),
        solids = [...next.values()].flatMap((r) => r.solids);
      const candidate = createExteriorCollider(roots, {
        compiledSolids: solids,
        completeSurfaces: true,
      });
      assert.equal(candidate.stats().buildings, next.size);
      live = next;
      snapshot = roots;
    },
    detach: (b) => {
      live.delete(b.key);
      snapshot = [...live.values()].map((r) => r.root);
      createExteriorCollider(snapshot, {
        compiledSolids: [...live.values()].flatMap((r) => r.solids),
      });
    },
    dispose: (b) => {
      if (!b.resources) return;
      assert.ok(!b.resources.dead && !snapshot.includes(b.resources.root));
      b.resources.dead = true;
      dispose(b.resources.root);
      freed++;
    },
  });
  try {
    manager.request([
      { x: 0, z: 0, lod: "coarse" },
      { x: 1, z: 0, lod: "coarse" },
    ]);
    await manager.idle();
    assert.equal(live.size, 2);
    const retained = manager.active.get("1,0").resources;
    manager.request([{ x: 0, z: 0, lod: "coarse" }]);
    await manager.idle();
    assert.ok(!snapshot.includes(retained.root) && !retained.dead);
    manager.request([
      { x: 0, z: 0, lod: "coarse" },
      { x: 1, z: 0, lod: "coarse" },
    ]);
    await manager.idle();
    assert.equal(manager.active.get("1,0").resources, retained);
    delay = true;
    manager.request([
      { x: 0, z: 0, lod: "fine" },
      { x: 1, z: 0, lod: "coarse" },
    ]);
    await ready;
    manager.request([
      { x: 0, z: 0, lod: "coarse" },
      { x: 1, z: 0, lod: "coarse" },
    ]);
    delay = false;
    await manager.idle();
    assert.equal(manager.active.get("0,0").lod, "coarse");
    assert.ok(manager.snapshot().stats.stale > 0);
  } finally {
    manager.close();
    await manager.idle();
  }
  assert.equal(manager.snapshot().closeState, "complete");
  assert.equal(live.size, 0);
  assert.equal(created, freed);
  assert.equal(manager.snapshot().stats.callbackErrors, 0);
});
