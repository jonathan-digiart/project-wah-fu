import test from "node:test";
import assert from "node:assert/strict";
import { buildTile, heightOnTile, createSampler } from "../src/geometry.mjs";
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
const tile = (x, z, n) => buildTile({ ...config, x, z, interiorSegments: n });
const edge = (d, s) =>
  [...d.edges[s]].map((i) => [...d.positions.slice(i * 3, i * 3 + 3)]);

test("all coarse/fine edges match exactly including four-way junction; sparse interiors", () => {
  for (const a of [8, 64])
    for (const b of [8, 64]) {
      assert.deepEqual(
        edge(tile(0, 0, a), "east"),
        edge(tile(1, 0, b), "west"),
      );
      assert.deepEqual(
        edge(tile(0, 0, a), "north"),
        edge(tile(0, 1, b), "south"),
      );
    }
  const junction = [
    [0, 0, 8, "north", 64],
    [1, 0, 64, "north", 0],
    [0, 1, 64, "south", 64],
    [1, 1, 8, "south", 0],
  ].map(([x, z, n, s, k]) => edge(tile(x, z, n), s)[k]);
  junction.forEach((v) => assert.deepEqual(v, junction[0]));
  assert(tile(0, 0, 8).positions.length < tile(0, 0, 64).positions.length / 10);
});
test("triangles positive area, cover full tile, no holes and render-query agreement", () => {
  for (const n of [1, 2, 8, 64]) {
    const d = tile(0, 0, n),
      p = d.positions;
    let area = 0;
    for (let i = 0; i < d.indices.length; i += 3) {
      const [a, b, c] = [...d.indices.slice(i, i + 3)].map((x) => x * 3);
      const A =
        ((p[b + 2] - p[a + 2]) * (p[c] - p[a]) -
          (p[b] - p[a]) * (p[c + 2] - p[a + 2])) /
        2;
      assert(A > 0);
      area += A;
      const x = (p[a] + p[b] + p[c]) / 3,
        z = (p[a + 2] + p[b + 2] + p[c + 2]) / 3;
      assert(
        Math.abs(heightOnTile(d, x, z) - (p[a + 1] + p[b + 1] + p[c + 1]) / 3) <
          1e-9,
      );
    }
    assert.equal(area, 4096);
    for (let j = 0; j <= 100; j++)
      for (let i = 0; i <= 100; i++)
        assert(Number.isFinite(heightOnTile(d, i * 0.64, j * 0.64)));
  }
});
test("domain enforcement never extrapolates", () => {
  assert.throws(() => tile(-1, 0, 8), /Outside/);
  assert.throws(
    () => createSampler({ ...config.sampler, fixture: "site" }),
    /Unsupported/,
  );
});
test("projected-size policy hysteresis prevents threshold oscillation and caps fine selections", async () => {
  const { selectTileLods } = await import("../src/lod-policy.mjs");
  const policy = { enterFinePixels: 100, exitFinePixels: 70, maxFine: 1 };
  let previous = new Map();
  const sequence = [99, 100, 99, 71, 70, 71, 99, 100],
    expected = [
      "coarse",
      "fine",
      "fine",
      "fine",
      "coarse",
      "coarse",
      "coarse",
      "fine",
    ];
  sequence.forEach((r, i) => {
    const result = selectTileLods(
      [{ x: 0, z: 0, projectedRadiusPixels: r }],
      previous,
      policy,
    );
    assert.equal(result[0].lod, expected[i]);
    previous = new Map([["0,0", result[0].lod]]);
  });
  assert.deepEqual(
    selectTileLods(
      [
        { x: 0, z: 0, projectedRadiusPixels: 150 },
        { x: 1, z: 0, projectedRadiusPixels: 200 },
      ],
      new Map(),
      policy,
    ).map((t) => t.lod),
    ["coarse", "fine"],
  );
  assert.throws(
    () =>
      selectTileLods([], new Map(), {
        enterFinePixels: 70,
        exitFinePixels: 100,
      }),
    /Invalid/,
  );
});
