import test from "node:test";
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import { Vector3 } from "three";
import { buildTile, heightOnTile } from "../src/geometry.mjs";
import { TileManager } from "../src/manager.mjs";
import { compileInWorker } from "../collision/collider-loader.mjs";
import {
  validateGeometry,
  validateCompiledGeometry,
} from "../collision/validation.mjs";
import {
  buildMasked,
  maskedHeight,
  maskedTransfers,
  MASK_LIMITS,
} from "./protocol.mjs";
import { triangulateRegions } from "./triangulate.mjs";
import {
  heightQuery,
  createOwnershipAdapter,
  hasPreparedQuery,
} from "./adapter.mjs";
const config = {
  tileSize: 64,
  origin: [0, 0],
  latticeSegments: 64,
  coarseSegments: 8,
  fineSegments: 32,
  sampler: {
    kind: "analytic-fixture",
    fixture: "plane",
    domain: { minX: -256, maxX: 512, minZ: -256, maxZ: 512 },
  },
};
const tile = (x = 0, z = 0, n = 8) =>
  buildTile({ ...config, x, z, interiorSegments: n });
const land = triangulateRegions([
  [
    [0, 0],
    [128, 0],
    [128, 128],
    [0, 128],
  ],
]);
const holes = triangulateRegions([
  {
    outer: [
      [0, 0],
      [128, 0],
      [128, 128],
      [0, 128],
    ],
    holes: [
      [
        [55, 55],
        [73, 55],
        [73, 73],
        [55, 73],
      ],
    ],
  },
  [
    [150, 0],
    [160, 0],
    [160, 10],
    [150, 10],
  ],
]);
const compile = (d, opts = {}) =>
  compileInWorker(
    d,
    { signal: new AbortController().signal, generation: 1, ...opts },
    Worker,
    true,
  );
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
async function close(m, a) {
  m.close();
  await m.idle();
  assert.equal(a.snapshot.live.size, 0);
  assert.equal(a.snapshot.solids.length, 0);
  assert.equal(a.stats.allocated, a.stats.disposed);
  assert.equal(m.stats.callbackErrors, 0);
}
function manager(loader, extra = {}) {
  const a = createOwnershipAdapter({
      WorkerClass: Worker,
      node: true,
      ...extra.adapter,
    }),
    m = new TileManager({
      config,
      loader,
      heightQuery,
      maxCached: 0,
      concurrency: 2,
      prepare: a.prepare,
      install: a.install,
      detach: a.detach,
      dispose: a.dispose,
      ...extra.manager,
    });
  return { m, a };
}

test("packed masked geometry real worker roundtrip, actual triangle heights, semantic holes and island", async () => {
  const d = buildMasked(tile(), holes),
    original = structuredClone(d),
    bytes = maskedTransfers(d).reduce((s, b) => s + b.byteLength, 0);
  assert.equal(d.bytes, bytes);
  assert(!("cells" in d));
  assert(!("edges" in d));
  const r = await compile(d);
  assert.equal(d.positions.byteLength, 0);
  assert.equal(d.maskTriangles.byteLength, 0);
  assert.deepEqual(r.data, original);
  validateCompiledGeometry(r.data, r.solids);
  assert.equal(r.solids.length, 1);
  assert(
    Math.abs(maskedHeight(r.data, 10, 10) - heightOnTile(tile(), 10, 10)) <
      1e-6,
  );
  assert.equal(maskedHeight(r.data, 60, 60), null);
  assert.equal(maskedHeight(r.data, -1, 3), null);
  const island = await compile(buildMasked(tile(2), holes));
  assert.notEqual(maskedHeight(island.data, 155, 5), null);
  assert.equal(maskedHeight(island.data, 145, 5), null);
});

test("bounded metadata, malformed payload rejection, explicit empty result contract", async () => {
  assert.throws(
    () =>
      buildMasked(tile(), Array(MASK_LIMITS.maskTriangles + 1).fill(land[0])),
    /Mask metadata limit/,
  );
  const d = buildMasked(tile(), land);
  for (const mutate of [
    (v) => v.bytes++,
    (v) => (v.unboundedMetadata = "unexpected"),
    (v) => (v.indices[0] = 999999),
    (v) => (v.cells = new Uint32Array()),
    (v) => (v.maskTriangles[0] = NaN),
    (v) => (v.tileBounds[1] = v.tileBounds[0]),
    (v) => (v.geometryKind = "unknown"),
    (v) => (v.sourceFacets = new Uint32Array(0)),
    (v) =>
      (v.maskTriangles = new Float64Array((MASK_LIMITS.maskTriangles + 1) * 6)),
  ]) {
    const copy = structuredClone(d);
    mutate(copy);
    assert.throws(() => validateGeometry(copy));
  }
  const empty = buildMasked(tile(), []),
    r = await compile(empty);
  assert.equal(r.data.indices.length, 0);
  assert.equal(r.solids.length, 0);
  assert.equal(maskedHeight(r.data, 10, 10), null);
  assert.equal(r.data.bytes, 32);
  assert.throws(() => validateCompiledGeometry(d, []));
  assert.throws(() => validateCompiledGeometry(r.data, [{}]));
});

test("four-way seam-crossing hole, mixed regular/masked ownership, pending and sea navigation blocked", async () => {
  const { m, a } = manager(async (job) =>
    job.x === 2 ? buildTile(job) : buildMasked(buildTile(job), holes),
  );
  assert.equal(m.heightAt(10, 10), null);
  assert.equal(
    m.moveFixtureTerrainOnly([1, 10, 1], [10, 10, 10]).blocked,
    true,
  );
  m.request([
    { x: 0, z: 0, lod: "fine" },
    { x: 1, z: 0, lod: "coarse" },
    { x: 0, z: 1, lod: "coarse" },
    { x: 1, z: 1, lod: "fine" },
    { x: 2, z: 0, lod: "coarse" },
  ]);
  await m.idle();
  assert.equal(m.failed.size, 0);
  for (const [x, z] of [
    [60, 60],
    [68, 60],
    [60, 68],
    [68, 68],
    [64, 64],
  ])
    assert.equal(m.heightAt(x, z), null);
  for (const [x, z] of [
    [50, 50],
    [80, 50],
    [50, 80],
    [80, 80],
    [127.9, 10],
    [128, 10],
    [129, 10],
  ])
    assert.notEqual(m.heightAt(x, z), null);
  assert.equal(m.owner(128, 10), "2,0");
  assert(Math.abs(m.heightAt(128, 10) - heightOnTile(tile(2), 128, 10)) < 1e-6);
  assert.equal(
    m.moveFixtureTerrainOnly([50, 10, 50], [80, 10, 80]).reason,
    "coverage-policy-required",
  );
  assert.equal(
    m.moveFixtureTerrainOnly([129, 30, 10], [135, 30, 10]).blocked,
    false,
  );
  const saved = m.heightQuery;
  for (const broken of [
    () => NaN,
    () => Infinity,
    () => {
      throw Error("query failed");
    },
  ]) {
    m.heightQuery = broken;
    assert.equal(m.heightAt(129, 10), null);
    assert.equal(
      m.moveFixtureTerrainOnly([129, 30, 10], [135, 30, 10]).reason,
      "ground-unavailable",
    );
  }
  m.heightQuery = saved;
  await close(m, a);
});

test("all-sea atomic replacement clears prior land collider before disposal", async () => {
  const snapshots = [];
  const { m, a } = manager(
    async (job) =>
      buildMasked(buildTile(job), job.interiorSegments === 32 ? [] : land),
    { manager: { onChange: (s) => snapshots.push(s) } },
  );
  m.request([{ x: 0, z: 0, lod: "coarse" }]);
  await m.idle();
  const old = m.active.get("0,0").resources;
  assert.equal(a.snapshot.solids.length, 1);
  assert.notEqual(m.heightAt(20, 20), null);
  m.request([{ x: 0, z: 0, lod: "fine" }]);
  await m.idle();
  assert.equal(m.failed.size, 0);
  assert.equal(m.active.get("0,0").data.indices.length, 0);
  assert.equal(a.snapshot.solids.length, 0);
  assert.equal(a.snapshot.live.size, 1);
  assert(old.dead);
  assert.equal(m.heightAt(20, 20), null);
  assert.equal(
    m.moveFixtureTerrainOnly([20, 10, 20], [21, 10, 21]).blocked,
    true,
  );
  assert.equal(a.snapshot.collider.stats().triangles, 0);
  assert.equal(
    a.snapshot.collider.distanceToSurface(new Vector3(20, 10, 20)),
    Infinity,
  );
  await close(m, a);
});

test("stale prepared empty result cannot clear newer land; cancelled worker and install rollback", async () => {
  const ready = deferred(),
    gate = deferred();
  let firstFine = true,
    sea = false,
    staleData;
  const { m, a } = manager(async (job) =>
    buildMasked(buildTile(job), sea ? [] : land),
  );
  const prepare = a.prepare;
  m.prepare = async (d, c) => {
    const r = await prepare(d, c);
    if (c.lod === "fine" && firstFine) {
      firstFine = false;
      staleData = d;
      assert(hasPreparedQuery(d));
      ready.resolve();
      await gate.promise;
    }
    return r;
  };
  m.request([{ x: 0, z: 0, lod: "coarse" }]);
  await m.idle();
  sea = true;
  m.request([{ x: 0, z: 0, lod: "fine" }]);
  await ready.promise;
  sea = false;
  m.request([{ x: 0, z: 0, lod: "fine" }]);
  while (m.active.get("0,0").lod !== "fine")
    await new Promise((r) => setTimeout(r, 5));
  const latest = m.active.get("0,0");
  assert(latest.data.indices.length > 0);
  gate.resolve();
  await m.idle();
  assert.equal(m.active.get("0,0"), latest);
  assert.equal(a.snapshot.solids.length, 1);
  assert(m.stats.stale > 0);
  assert(!hasPreparedQuery(staleData));
  assert(hasPreparedQuery(latest.data));
  await close(m, a);
  assert(!hasPreparedQuery(latest.data));
  const abort = new AbortController();
  abort.abort();
  const d = buildMasked(tile(), land);
  await assert.rejects(compile(d, { signal: abort.signal }), /Aborted/);
  assert(d.positions.length > 0);
  const liveAbort = new AbortController(),
    pending = compile(buildMasked(tile(0, 0, 32), land), {
      signal: liveAbort.signal,
    });
  liveAbort.abort();
  await assert.rejects(pending, /Aborted/);
  let fail = false;
  const pair = manager(async (job) => buildMasked(buildTile(job), land), {
    adapter: {
      beforeCommit: () => {
        if (fail) throw Error("injected before commit");
      },
    },
  });
  pair.m.request([{ x: 0, z: 0, lod: "coarse" }]);
  await pair.m.idle();
  const old = pair.m.active.get("0,0");
  fail = true;
  pair.m.request([{ x: 0, z: 0, lod: "fine" }]);
  await pair.m.idle();
  assert.equal(pair.m.active.get("0,0"), old);
  assert.equal(pair.a.snapshot.live.get("0,0"), old.resources);
  assert(!old.resources.dead);
  fail = false;
  await close(pair.m, pair.a);
});

test("resident geometry budget counts mask/bounds buffers and rejects prepared replacement safely", async () => {
  const coarse = buildMasked(tile(), land),
    fine = buildMasked(tile(0, 0, 32), land);
  assert(fine.bytes > coarse.bytes);
  const metadata =
    coarse.maskTriangles.byteLength + coarse.tileBounds.byteLength;
  assert.equal(
    coarse.bytes,
    coarse.positions.byteLength +
      coarse.indices.byteLength +
      coarse.sourceFacets.byteLength +
      metadata,
  );
  const { m, a } = manager(async (job) => buildMasked(buildTile(job), land), {
    manager: { maxBytes: coarse.bytes },
  });
  m.request([{ x: 0, z: 0, lod: "coarse" }]);
  await m.idle();
  const old = m.active.get("0,0");
  assert.equal(m.snapshot().bytes, coarse.bytes);
  assert.equal(old.resources.geometryBufferBytes, coarse.bytes);
  assert(old.resources.colliderBufferBytes > 0);
  m.request([{ x: 0, z: 0, lod: "fine" }]);
  await m.idle();
  assert.equal(m.active.get("0,0"), old);
  assert(m.failed.has("0,0/fine"));
  assert.equal(m.snapshot().bytes, coarse.bytes);
  assert(m.stats.peakBytes <= coarse.bytes);
  await close(m, a);
});

test("closed rings and adjacent duplicate coordinates normalize without mutating caller holes", () => {
  const outer = [
      [0, 0],
      [64, 0],
      [64, 64],
      [0, 64],
    ],
    hole = [
      [20, 20],
      [20, 40],
      [40, 40],
      [40, 20],
    ];
  const closed = (r) => [...r.map((p) => [...p]), [...r[0]]],
    duplicates = (r) => r.flatMap((p) => [[...p], [...p]]);
  const expected = triangulateRegions([{ outer, holes: [hole] }]);
  for (const region of [
    { outer: closed(outer), holes: [closed(hole)] },
    { outer: duplicates(closed(outer)), holes: [duplicates(closed(hole))] },
    { outer, holes: [closed(hole)] },
    { outer: closed(outer), holes: [hole] },
  ]) {
    const before = structuredClone(region),
      mask = triangulateRegions([region]);
    assert.deepEqual(region, before);
    assert.deepEqual(mask, expected);
    const d = buildMasked(tile(), mask);
    assert.equal(maskedHeight(d, 30, 30), null);
    assert.notEqual(maskedHeight(d, 10, 10), null);
    let area = 0;
    for (let k = 0; k < d.indices.length; k += 3) {
      const [a, b, c] = Array.from(d.indices.slice(k, k + 3), (i) => i * 3),
        p = d.positions;
      area -=
        ((p[b] - p[a]) * (p[c + 2] - p[a + 2]) -
          (p[b + 2] - p[a + 2]) * (p[c] - p[a])) /
        2;
    }
    assert(Math.abs(area - 3696) < 1e-6);
  }
  assert.throws(
    () =>
      triangulateRegions([
        [
          [0, 0],
          [0, 0],
          [0, 0],
        ],
      ]),
    /Degenerate polygon ring/,
  );
  assert.throws(
    () =>
      triangulateRegions([
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [1, 0],
          [0, 1],
        ],
      ]),
    /Nonconsecutive repeated/,
  );
});
