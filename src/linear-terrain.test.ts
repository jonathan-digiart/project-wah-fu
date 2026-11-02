import { expect, test } from "vitest";
import { createLinearTerrain, triangulateControls } from "./linear-terrain";
import { clipTriangle, linearTerrainPositions } from "./terrain-mesh";
import type { SiteData } from "./model";
const controls = [
  { x: 0, z: 0, height: 0 },
  { x: 100, z: 0, height: 10 },
  { x: 100, z: 100, height: 30 },
  { x: 0, z: 100, height: 20 },
  { x: 50, z: 50, height: 15 },
];
test("generated Delaunay surface exactly represents affine fields and control heights", () => {
  const model = createLinearTerrain(controls, () => -999);
  expect(triangulateControls(controls)).toHaveLength(4);
  for (const c of controls)
    expect(model.heightAt(c.x, c.z)).toBeCloseTo(c.height, 8);
  expect(model.heightAt(25, 75)).toBeCloseTo(17.5, 8);
  expect(model.sample(-100, 0)).toBeUndefined();
  expect(model.heightAt(-100, 0)).toBe(-999);
});
test("collinear input does not generate invalid triangles", () => {
  expect(
    triangulateControls([
      { x: 0, z: 0, height: 0 },
      { x: 1, z: 1, height: 1 },
      { x: 2, z: 2, height: 2 },
    ]),
  ).toEqual([]);
});
test("triangle clipping preserves height as well as plan coordinates", () => {
  const result = clipTriangle(
    [
      { x: 0, z: 0, height: 0 },
      { x: 10, z: 0, height: 10 },
      { x: 0, z: 10, height: 20 },
    ],
    [
      [0, 0],
      [5, 0],
      [0, 5],
    ],
  );
  for (const p of result) {
    expect(p.x + p.z).toBeLessThanOrEqual(5.000001);
    expect(p.height).toBeCloseTo(p.x + 2 * p.z, 8);
  }
});
test("rendered control triangulation retains total land area and has no missing coverage", () => {
  const data: SiteData = {
    boundary: [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ],
    terrainControls: controls,
    buildings: [],
    provenance: { synthetic: true },
    interpolation: "linear",
  };
  const vertices = linearTerrainPositions(data);
  let total = 0;
  for (let i = 0; i < vertices.length; i += 9) {
    const ax = vertices[i]!,
      az = vertices[i + 2]!,
      bx = vertices[i + 3]!,
      bz = vertices[i + 5]!,
      cx = vertices[i + 6]!,
      cz = vertices[i + 8]!;
    total += Math.abs((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) / 2;
    for (let j = i; j < i + 9; j += 3)
      expect(vertices[j + 1]).toBeCloseTo(
        vertices[j]! * 0.1 + vertices[j + 2]! * 0.2,
        7,
      );
  }
  expect(total).toBeCloseTo(10000, 5);
});
