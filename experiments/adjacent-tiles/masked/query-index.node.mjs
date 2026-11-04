import test from "node:test";
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import { buildTile } from "../src/geometry.mjs";
import { TileManager } from "../src/manager.mjs";
import { buildMasked, maskedHeight } from "./protocol.mjs";
import { triangulateRegions } from "./triangulate.mjs";
import {
  buildQueryIndex,
  indexedHeight,
  validateQueryIndex,
  QUERY_LIMITS,
} from "./query-index.mjs";
import {
  createOwnershipAdapter,
  heightQuery,
  hasPreparedQuery,
} from "./adapter.mjs";
const config = {
  origin: [0, 0],
  tileSize: 64,
  latticeSegments: 64,
  coarseSegments: 8,
  fineSegments: 32,
  sampler: {
    kind: "analytic-fixture",
    fixture: "wave",
    domain: { minX: -128, maxX: 256, minZ: -128, maxZ: 256 },
  },
};
const mask = triangulateRegions([
  {
    outer: [
      [0, 0],
      [64, 0],
      [64, 64],
      [0, 64],
    ],
    holes: [
      [
        [20, 20],
        [40, 20],
        [40, 40],
        [20, 40],
      ],
    ],
  },
]);
const data = (n) =>
  buildMasked(buildTile({ ...config, x: 0, z: 0, interiorSegments: n }), mask);

test("indexed heights exactly match exhaustive actual-facet queries at deterministic interiors, vertices, bins, and hole boundaries", () => {
  let seed = 123456789;
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (const n of [8, 32, 64]) {
    const d = data(n),
      index = buildQueryIndex(d),
      points = [];
    for (let i = 0; i < 500; i++)
      points.push([random() * 66 - 1, random() * 66 - 1]);
    for (
      let k = 0;
      k < d.positions.length;
      k += Math.max(3, Math.floor(d.positions.length / 600 / 3) * 3)
    )
      points.push([d.positions[k], d.positions[k + 2]]);
    for (const edge of [0, 20, 40, 64])
      for (const delta of [-1e-7, -1e-10, 0, 1e-10, 1e-7])
        for (const other of [0, 10, 20, 30, 40, 50, 64])
          points.push([edge + delta, other], [other, edge + delta]);
    for (let i = 0; i <= index.n; i++)
      points.push([(i / index.n) * 64, 10.123], [11.234, (i / index.n) * 64]);
    for (const [x, z] of points)
      assert.equal(
        indexedHeight(index, x, z),
        maskedHeight(d, x, z),
        `resolution ${n} at ${x},${z}`,
      );
    assert.equal(
      index.bytes,
      index.triangles.offsets.byteLength +
        index.triangles.ids.byteLength +
        index.mask.offsets.byteLength +
        index.mask.ids.byteLength,
    );
    assert(index.bytes <= QUERY_LIMITS.bytes);
  }
});

test("query indexes reject invalid offsets, IDs, byte counts, source indexes and capped overlap growth", () => {
  const d = data(8),
    index = buildQueryIndex(d);
  for (const alter of [
    (v) => v.bytes++,
    (v) => (v.n = 0),
    (v) => (v.triangles.offsets[0] = 1),
    (v) => (v.triangles.ids[0] = d.indices.length),
    (v) => (v.mask.ids[0] = 999999),
    (v) => v.mask.offsets[v.mask.offsets.length - 1]++,
  ]) {
    const copy = structuredClone(index);
    alter(copy);
    assert.throws(() => validateQueryIndex(copy));
  }
  const malformed = structuredClone(d);
  malformed.indices[0] = 999999;
  assert.throws(() => buildQueryIndex(malformed));
  assert.throws(() => buildQueryIndex(d, { maxEntries: 0 }), /entry limit/);
  const large = data(1),
    largeIndex = buildQueryIndex(large);
  assert(largeIndex.triangles.ids.length > large.indices.length / 3);
  assert.throws(
    () => buildQueryIndex(large, { maxEntries: large.indices.length / 3 }),
    /entry limit/,
  );
});

test("prepared index retained in owned cache, deleted on disposal; index cap failure preserves old resources", async () => {
  const coarse = buildQueryIndex(data(8)),
    fine = buildQueryIndex(data(32)),
    limit = coarse.triangles.ids.length + coarse.mask.ids.length;
  assert(fine.triangles.ids.length + fine.mask.ids.length > limit);
  const a = createOwnershipAdapter({
      WorkerClass: Worker,
      node: true,
      queryOptions: { maxEntries: limit },
    }),
    m = new TileManager({
      config,
      loader: async (job) => buildMasked(buildTile(job), mask),
      heightQuery,
      maxCached: 1,
      prepare: a.prepare,
      install: a.install,
      detach: a.detach,
      dispose: a.dispose,
    });
  m.request([{ x: 0, z: 0, lod: "coarse" }]);
  await m.idle();
  const old = m.active.get("0,0");
  assert(hasPreparedQuery(old.data));
  assert.equal(old.resources.queryIndexBytes, coarse.bytes);
  assert(Number.isFinite(old.resources.queryIndexBuildMs));
  m.request([]);
  await m.idle();
  assert(hasPreparedQuery(old.data));
  assert.equal(m.heightAt(10, 10), null);
  assert.notEqual(heightQuery(old.data, 10, 10), null);
  m.request([{ x: 0, z: 0, lod: "coarse" }]);
  await m.idle();
  assert.equal(m.active.get("0,0"), old);
  m.request([{ x: 0, z: 0, lod: "fine" }]);
  await m.idle();
  assert(m.failed.has("0,0/fine"));
  assert.equal(m.active.get("0,0"), old);
  assert.equal(a.snapshot.live.get("0,0"), old.resources);
  assert(hasPreparedQuery(old.data));
  m.close();
  await m.idle();
  assert(!hasPreparedQuery(old.data));
  assert.equal(heightQuery(old.data, 10, 10), null);
  assert.equal(old.resources.queryIndex, null);
  assert.equal(a.stats.allocated, a.stats.disposed);
});

test("slanted mask edges, noninteger signed origins and edge-adjacent points retain exhaustive semantics", () => {
  for (const origin of [
    [0.1, 0.3],
    [-64.1, -64.3],
  ]) {
    const shift = (ring) =>
        ring.map(([x, z]) => [x + origin[0], z + origin[1]]),
      outer = shift([
        [-5, 4.1],
        [55, -3.7],
        [67, 48.3],
        [23.1, 68],
        [-8, 46],
      ]),
      hole = shift([
        [21.3, 20.7],
        [41.4, 23.9],
        [37.8, 41.2],
        [18.2, 38.4],
      ]);
    const d = buildMasked(
        buildTile({ ...config, origin, x: 0, z: 0, interiorSegments: 16 }),
        triangulateRegions([{ outer, holes: [hole] }]),
      ),
      index = buildQueryIndex(d),
      points = [];
    for (const ring of [outer, hole])
      for (let j = 0; j < ring.length; j++) {
        const a = ring[j],
          b = ring[(j + 1) % ring.length];
        for (const t of [0, 0.125, 0.5, 0.875, 1])
          for (const e of [-1e-7, -1e-10, 0, 1e-10, 1e-7])
            points.push([
              a[0] + (b[0] - a[0]) * t + e,
              a[1] + (b[1] - a[1]) * t - e,
            ]);
      }
    for (let i = 0; i < 200; i++)
      points.push([
        origin[0] + ((i * 17.731) % 64),
        origin[1] + ((i * 31.123) % 64),
      ]);
    for (const [x, z] of points)
      assert.equal(
        indexedHeight(index, x, z),
        maskedHeight(d, x, z),
        `${origin} at ${x},${z}`,
      );
  }
});

test("duplicate owned or in-flight preparation rejects before transferring live geometry", async () => {
  const a = createOwnershipAdapter({ WorkerClass: Worker, node: true }),
    d = data(8),
    context = { signal: new AbortController().signal, generation: 1 };
  const first = a.prepare(d, context);
  await assert.rejects(
    a.prepare(d, context),
    /Duplicate prepared data identity/,
  );
  const resources = await first,
    bundle = { key: "0,0", data: d, resources };
  a.install(bundle, null);
  const bytes = d.positions.byteLength,
    geometryArray = resources.mesh.geometry.getAttribute("position").array,
    prior = heightQuery(d, 10, 10);
  await assert.rejects(
    a.prepare(d, context),
    /Duplicate prepared data identity/,
  );
  assert.equal(d.positions.byteLength, bytes);
  assert.equal(geometryArray.byteLength, bytes);
  assert.equal(heightQuery(d, 10, 10), prior);
  assert.equal(a.snapshot.live.get("0,0"), resources);
  a.detach(bundle);
  a.dispose(bundle);
  assert(!hasPreparedQuery(d));
  assert.equal(a.stats.allocated, a.stats.disposed);
});
