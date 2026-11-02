import { expect, test } from "vitest";
import {
  gridToLocal,
  localToGrid,
  parseSiteData,
  terrainHeight,
  type SiteData,
} from "./model";
import { createSiteScene, terrainPositions } from "./scene";
const fixture: SiteData = {
  boundary: [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ],
  buildings: [
    {
      id: "test",
      name: "Synthetic test",
      footprint: [
        [20, 20],
        [40, 20],
        [40, 30],
        [20, 30],
      ],
      base: 12,
      height: 30,
      uncertainty: "Synthetic unit fixture, not estate data",
    },
  ],
  terrainControls: [
    { x: 0, z: 0, height: 10 },
    { x: 100, z: 100, height: 20 },
  ],
  provenance: { synthetic: true },
};
test("coordinate conversion preserves metres, vertical datum and north sign", () => {
  expect(gridToLocal(1010, 2020, 7, [1000, 2000])).toEqual([10, 7, -20]);
  expect(localToGrid(10, 7, -20, [1000, 2000])).toEqual([1010, 2020, 7]);
});
test("controls interpolate exactly and terrain remains finite within control range", () => {
  expect(terrainHeight(0, 0, fixture.terrainControls)).toBe(10);
  for (const x of [0, 25, 50, 100]) {
    const h = terrainHeight(x, 50, fixture.terrainControls);
    expect(h).toBeGreaterThanOrEqual(10);
    expect(h).toBeLessThanOrEqual(20);
  }
});
test("subdivision never changes plan footprint or exceeds budget", () => {
  const positions = terrainPositions(fixture, 2);
  expect(positions).toHaveLength(2 * 16 * 9);
  expect(positions.every(Number.isFinite)).toBe(true);
  for (let i = 0; i < positions.length; i += 3) {
    expect(positions[i]).toBeGreaterThanOrEqual(0);
    expect(positions[i]).toBeLessThanOrEqual(100);
    expect(positions[i + 2]).toBeGreaterThanOrEqual(0);
    expect(positions[i + 2]).toBeLessThanOrEqual(100);
  }
  expect(() => terrainPositions(fixture, 10)).toThrow();
});
test("rejects missing evidence, bad values and duplicate building IDs", () => {
  expect(parseSiteData(fixture)).toBe(fixture);
  expect(() => parseSiteData({ ...fixture, terrainControls: [] })).toThrow();
  expect(() =>
    parseSiteData({
      ...fixture,
      buildings: [fixture.buildings[0], fixture.buildings[0]],
    }),
  ).toThrow();
  expect(() =>
    parseSiteData({
      ...fixture,
      buildings: [{ ...fixture.buildings[0], uncertainty: "" }],
    }),
  ).toThrow();
  expect(() =>
    parseSiteData({
      ...fixture,
      boundary: [
        [0, 0],
        [0, 0],
        [0, 0],
      ],
    }),
  ).toThrow();
});
test("procedural building extrusion retains footprint, base and height without mirrored Z", () => {
  const { buildings, terrain, dispose } = createSiteScene(fixture);
  const mesh = buildings.children[0];
  expect(mesh).toBeDefined();
  if (!mesh) throw new Error("Missing mesh");
  const geometry = (mesh as import("three").Mesh).geometry;
  geometry.computeBoundingBox();
  expect(geometry.boundingBox?.min.toArray()).toEqual([20, 12, 20]);
  expect(geometry.boundingBox?.max.toArray()).toEqual([40, 42, 30]);
  const normal = terrain.geometry.getAttribute("normal");
  for (let i = 0; i < normal.count; i++)
    expect(normal.getY(i)).toBeGreaterThan(0);
  dispose();
});
