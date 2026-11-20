import { expect, test } from "vitest";
import { heightPatchGeometry, heightSampler, pchip } from "./height-patch";
import type { HeightPatch } from "./schema";
const plane: HeightPatch = {
  id: "plane",
  label: "Synthetic surface",
  source: "analytic unit test",
  confidence: "synthetic",
  kind: "height-patch",
  origin: [10, -20],
  uAxis: [1, 0],
  vAxis: [0, 1],
  uKnots: [0, 10],
  vKnots: [0, 20],
  heights: [
    [1, 3],
    [4, 6],
  ],
  tolerance: 0.001,
  maxTriangles: 1000,
};
test("planar terrain needs only two triangles with exact coordinates and upward normals", () => {
  const g = heightPatchGeometry(plane);
  expect(g.indices).toHaveLength(6);
  expect(g.positions).toEqual([10, 1, -20, 20, 3, -20, 10, 4, 0, 20, 6, 0]);
  expect(g.indices).toEqual([0, 2, 1, 1, 2, 3]);
});
test("PCHIP passes authored heights without overshooting a flat or monotone span", () => {
  const h = pchip([0, 1, 2, 4], [0, 2, 2, 3]);
  expect(h(0)).toBe(0);
  expect(h(1)).toBe(2);
  expect(h(2)).toBe(2);
  expect(h(4)).toBe(3);
  for (let x = 0; x <= 4; x += 0.01) {
    const y = h(x);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(3);
    if (x >= 1 && x <= 2) expect(y).toBeCloseTo(2, 12);
  }
  expect(() => h(4.1)).toThrow(/outside/);
});
test("adaptive surface has shared rows and meets independent within-triangle probes", () => {
  const patch = {
    ...plane,
    origin: [0, 0] as const,
    uKnots: [0, 1],
    vKnots: [0, 1],
    heights: [
      [0, 0],
      [0, 1],
    ],
    tolerance: 0.01,
  };
  const h = heightSampler(patch),
    g = heightPatchGeometry(patch);
  expect(g.indices.length).toBeGreaterThan(6);
  const counts = new Map<string, number>();
  for (let i = 0; i < g.positions.length; i += 3) {
    const key = `${g.positions[i]},${g.positions[i + 2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  expect([...counts.values()].every((x) => x === 1)).toBe(true);
  for (let i = 0; i < g.indices.length; i += 3) {
    const p = g.indices
      .slice(i, i + 3)
      .map((j) => g.positions.slice(j * 3, j * 3 + 3));
    for (const weights of [
      [0.13, 0.29, 0.58],
      [0.41, 0.37, 0.22],
      [1 / 3, 1 / 3, 1 / 3],
    ]) {
      const q = [0, 1, 2].map((k) =>
        weights.reduce((s, w, j) => s + w * p[j]![k]!, 0),
      );
      expect(Math.abs(h(q[0]!, q[2]!) - q[1]!)).toBeLessThanOrEqual(0.01);
    }
  }
});
test("insufficient triangle budget fails instead of silently increasing terrain error", () => {
  expect(() =>
    heightPatchGeometry({
      ...plane,
      uKnots: [0, 1],
      vKnots: [0, 1],
      heights: [
        [0, 0],
        [0, 1],
      ],
      maxTriangles: 2,
    }),
  ).toThrow(/budget/);
  expect(() =>
    heightPatchGeometry({ ...plane, uAxis: [0, 1], vAxis: [0, 1] }),
  ).toThrow(/Degenerate/);
  expect(() => pchip([0, 0], [1, 2])).toThrow();
});

test("finite but overflowing authoring values reject rather than create NaN geometry", () => {
  expect(() => pchip([-1e308, 1e308], [0, 1])).toThrow(/Nonfinite/);
  expect(() => pchip([0, 1], [-1e308, 1e308])).toThrow(/Nonfinite/);
  expect(() =>
    heightPatchGeometry({ ...plane, uAxis: [1e308, 0], vAxis: [0, 1e308] }),
  ).toThrow(/frame/);
});
