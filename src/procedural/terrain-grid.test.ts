import { expect, test } from "vitest";
import { terrainGridGeometry } from "./terrain-grid";
const grid = {
  x: [0, 1, 2],
  z: [0, 1],
  levels: [
    [0, 1, 2],
    [1, 2, 3],
  ],
  maxTriangles: 4,
};
test("generates upward faces and welds neighbouring cells", () => {
  const { positions, indices } = terrainGridGeometry(grid);
  expect(positions.length).toBe(18);
  expect(indices.length).toBe(12);
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices
      .slice(i, i + 3)
      .map((n) => positions.slice(3 * n, 3 * n + 3));
    expect(
      (b![2]! - a![2]!) * (c![0]! - a![0]!) -
        (b![0]! - a![0]!) * (c![2]! - a![2]!),
    ).toBeGreaterThan(0);
  }
});
test("honours explicit diagonals and missing ground", () => {
  const options = {
    ...grid,
    levels: [
      [null, 1, 2],
      [1, 2, 3],
    ],
  };
  expect(terrainGridGeometry(options).indices.length).toBe(9);
  expect(
    terrainGridGeometry({ ...options, fallingDiagonals: new Set(["0,0"]) })
      .indices.length,
  ).toBe(6);
});
test("refuses imprecise stations, invalid heights and excess geometry", () => {
  expect(() => terrainGridGeometry({ ...grid, x: [1, 1 + 1e-9, 2] })).toThrow(
    "Invalid",
  );
  expect(() =>
    terrainGridGeometry({
      ...grid,
      levels: [
        [0, Infinity, 2],
        [1, 2, 3],
      ],
    }),
  ).toThrow("Invalid");
  expect(() => terrainGridGeometry({ ...grid, maxTriangles: 3 })).toThrow(
    "budget",
  );
});
