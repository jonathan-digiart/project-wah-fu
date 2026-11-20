import { expect, test } from "vitest";
import { TERRAIN_INCLINES, terrainInclineGeometry } from "./terrain-inclines";
import { TERRAIN_PLATEAUX } from "./terrain-plateaux";

test("all selected grade domains generate two non-flat triangles without overlapping verified plates", () => {
  for (const [i, a] of TERRAIN_INCLINES.entries()) {
    const mesh = terrainInclineGeometry(a);
    expect(mesh.indices).toHaveLength(6);
    expect(
      new Set(mesh.positions.filter((_, j) => j % 3 === 1)).size,
    ).toBeGreaterThan(1);
    for (const b of [...TERRAIN_INCLINES.slice(i + 1), ...TERRAIN_PLATEAUX]) {
      expect(
        Math.min(a.x[1], b.x[1]) <= Math.max(a.x[0], b.x[0]) ||
          Math.min(a.z[1], b.z[1]) <= Math.max(a.z[0], b.z[0]),
      ).toBe(true);
    }
  }
});

test("adjacent coastal grade tiles generate identical full seam coordinates", () => {
  const seam = (i: number) => {
    const { positions } = terrainInclineGeometry(TERRAIN_INCLINES[i]!);
    return Array.from({ length: positions.length / 3 }, (_, j) =>
      positions.slice(j * 3, j * 3 + 3),
    )
      .filter(([x]) => x === 256)
      .sort((a, b) => a[2]! - b[2]!);
  };
  expect(seam(10)).toHaveLength(2);
  expect(seam(10)).toStrictEqual(seam(11));
});
