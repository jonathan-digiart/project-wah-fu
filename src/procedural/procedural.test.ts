import { expect, test } from "vitest";
import { footprintGeometry, roadGeometry, sampleCubic } from "./geometry";
import { ComponentRegistry } from "./registry";
import { wahMingPlan, WAH_MING_OUTLINE } from "./wah-ming";
import type { Footprint } from "./schema";
const box: Footprint = {
  id: "test",
  label: "Synthetic box",
  source: "unit test",
  confidence: "synthetic",
  kind: "footprint",
  outline: [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ],
  base: 5,
  height: 10,
};
test("minimal footprint extrusion has 10 triangles without a hidden bottom", () => {
  const g = footprintGeometry(box);
  expect(g.indices.length / 3).toBe(10);
  expect(g.positions.length / 3).toBe(8);
  expect(footprintGeometry({ ...box, bottom: true }).indices.length / 3).toBe(
    12,
  );
  expect(footprintGeometry({ ...box, height: 0 }).indices.length / 3).toBe(2);
});
test("roof normals face up and boundary walls face outward", () => {
  const g = footprintGeometry(box);
  for (let i = 0; i < g.indices.length; i += 3) {
    const p = g.indices
      .slice(i, i + 3)
      .map((j) => g.positions.slice(j * 3, j * 3 + 3));
    const a = p[0]!,
      b = p[1]!,
      c = p[2]!;
    const u = b.map((x, j) => x - a[j]!),
      v = c.map((x, j) => x - a[j]!);
    const normal = [
      u[1]! * v[2]! - u[2]! * v[1]!,
      u[2]! * v[0]! - u[0]! * v[2]!,
      u[0]! * v[1]! - u[1]! * v[0]!,
    ];
    if (i < 6) expect(normal[1]).toBeGreaterThan(0);
    else
      expect(
        normal[0]! * (a[0]! - 5) + normal[2]! * (a[2]! - 5),
      ).toBeGreaterThan(0);
  }
});
test("holes remain open and both winding directions produce same budget", () => {
  const hollow = {
    ...box,
    outline: [
      [0, 0],
      [0, 10],
      [10, 10],
      [10, 0],
    ] as const,
    holes: [
      [
        [2, 2],
        [8, 2],
        [8, 8],
        [2, 8],
      ] as const,
    ],
  };
  expect(footprintGeometry(hollow).indices.length / 3).toBe(24);
});
test("road stations retain elevation and variable width with two triangles per span", () => {
  const g = roadGeometry({
    id: "bridge",
    label: "test",
    source: "test",
    confidence: "synthetic",
    kind: "road-strip",
    stations: [
      { left: [0, 10, 0], right: [4, 11, 0] },
      { left: [0, 12, 10], right: [6, 13, 10] },
    ],
  });
  expect(g.indices.length).toBe(6);
  expect(g.positions).toContain(13);
});
test("adaptive curves use only endpoint pair for a straight line and enforce tolerance budget", () => {
  expect(
    sampleCubic(
      [
        [0, 0, 0],
        [3, 0, 0],
        [7, 0, 0],
        [10, 0, 0],
      ],
      0.005,
    ),
  ).toHaveLength(2);
  expect(
    sampleCubic(
      [
        [0, 0, 0],
        [0, 0, 10],
        [10, 0, 10],
        [10, 0, 0],
      ],
      0.005,
    ).length,
  ).toBeGreaterThan(2);
  expect(() =>
    sampleCubic(
      [
        [0, 0, 0],
        [0, 0, 10],
        [10, 0, 10],
        [10, 0, 0],
      ],
      0.005,
      0,
    ),
  ).toThrow(/budget/);
});
test("component replacement is atomic on a budget failure and neighbours remain editable", () => {
  const registry = new ComponentRegistry(20);
  registry.replace(box);
  registry.replace({ ...box, id: "other" });
  expect(() => registry.replace({ ...box, bottom: true })).toThrow(/budget/);
  expect(registry.stats().reduce((s, v) => s + v.triangles, 0)).toBe(20);
  registry.remove("other");
  registry.replace({ ...box, height: 0 });
  expect(registry.stats()[0]!.triangles).toBe(2);
  registry.dispose();
  expect(registry.group.children).toHaveLength(0);
});
test("accepted carpark outline is retained, without pretending to know elevation", () => {
  const g = footprintGeometry(wahMingPlan(0));
  expect(g.indices.length / 3).toBe(WAH_MING_OUTLINE.length - 2);
  expect(g.positions.every((v, i) => i % 3 !== 1 || v === 0)).toBe(true);
});
test("malformed parameters fail before creating geometry", () => {
  expect(() => footprintGeometry({ ...box, height: -1 })).toThrow();
  expect(() => footprintGeometry({ ...box, base: NaN })).toThrow();
  expect(() =>
    footprintGeometry({
      ...box,
      outline: [
        [0, 0],
        [10, 10],
        [0, 10],
        [10, 0],
      ],
    }),
  ).toThrow();
});
test("code-defined recipe output is validated before registry replacement", () => {
  const registry = new ComponentRegistry();
  registry.replace(box);
  for (const data of [
    { positions: [0, NaN, 0], indices: [0, 0, 0] },
    { positions: [0, 0, 0], indices: [0, 1, 2] },
    { positions: [0, 0], indices: [] },
  ])
    expect(() =>
      registry.replace({
        ...box,
        kind: "construction-surface",
        generate: () => data,
      }),
    ).toThrow(/geometry/);
  expect(registry.stats()[0]!.triangles).toBe(10);
  registry.dispose();
});

test("local construction origins preserve component placement independently", () => {
  const registry = new ComponentRegistry();
  registry.replace({
    ...box,
    kind: "construction-surface",
    origin: [444, 55, -314],
    generate: () => ({
      positions: [0, 0, 0, 0, 0, 1, 1, 0, 0],
      indices: [0, 1, 2],
    }),
  });
  expect(registry.group.children[0]!.position.toArray()).toEqual([
    444, 55, -314,
  ]);
  expect(registry.stats()[0]!.triangles).toBe(1);
  registry.dispose();
});
