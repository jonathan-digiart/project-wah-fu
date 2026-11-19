import { expect, test } from "vitest";
import { COASTAL_PLANE_TILES } from "./coastal-plane";
import { TERRAIN_PLATEAUX, terrainPlateauGeometry } from "./terrain-plateaux";

test("verified flat domains are disjoint and do not overlap the coastline pilot", () => {
  const all = [...TERRAIN_PLATEAUX, ...COASTAL_PLANE_TILES];
  for (const [i, a] of all.entries())
    for (const b of all.slice(i + 1))
      expect(
        Math.min(a.x[1], b.x[1]) <= Math.max(a.x[0], b.x[0]) ||
          Math.min(a.z[1], b.z[1]) <= Math.max(a.z[0], b.z[0]),
      ).toBe(true);
});
test("each plane generates two triangles at its editable datum", () => {
  expect(terrainPlateauGeometry()).toHaveLength(TERRAIN_PLATEAUX.length);
  for (const [i, mesh] of terrainPlateauGeometry().entries()) {
    expect(mesh.indices).toHaveLength(6);
    expect(mesh.positions.filter((_, k) => k % 3 === 1)).toEqual(
      Array(4).fill(TERRAIN_PLATEAUX[i]!.level),
    );
  }
});

test("plateaux touching each other or the coastal pilot share their datum", () => {
  const all = [
    ...TERRAIN_PLATEAUX,
    ...COASTAL_PLANE_TILES.map((tile) => ({
      ...tile,
      level: tile.levels[0]![0],
    })),
  ];
  let seams = 0;
  for (const [i, a] of all.entries()) {
    for (const b of all.slice(i + 1)) {
      const x = Math.min(a.x[1], b.x[1]) - Math.max(a.x[0], b.x[0]);
      const z = Math.min(a.z[1], b.z[1]) - Math.max(a.z[0], b.z[0]);
      if (x >= 0 && z >= 0) {
        expect(a.level).toBe(b.level);
        seams++;
      }
    }
  }
  expect(seams).toBeGreaterThan(0);
});
