import { expect, test } from "vitest";
import { controlSurfaceGeometry } from "./control-surface";
import type { ControlSurface } from "./schema";
const plane: ControlSurface = {
  id: "surface",
  label: "test",
  kind: "control-surface",
  source: "synthetic",
  confidence: "synthetic",
  outline: [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ],
  controls: [
    { x: 0, z: 0, height: 0 },
    { x: 10, z: 0, height: 1 },
    { x: 10, z: 10, height: 2 },
    { x: 0, z: 10, height: 1 },
  ],
  maxTriangles: 100,
};
test("sparse planar controls regenerate two triangles without source connectivity", () => {
  const g = controlSurfaceGeometry(plane);
  expect(g.indices.length).toBe(6);
  expect(g.positions.length).toBe(12);
});
test("control surface preserves concave domain instead of spanning excluded corner", () => {
  const g = controlSurfaceGeometry({
    ...plane,
    outline: [
      [0, 0],
      [10, 0],
      [10, 5],
      [5, 5],
      [5, 10],
      [0, 10],
    ],
  });
  let area = 0;
  for (let i = 0; i < g.indices.length; i += 3) {
    const p = g.indices
      .slice(i, i + 3)
      .map((j) => g.positions.slice(3 * j, 3 * j + 3));
    const [a, b, c] = p;
    area +=
      Math.abs(
        (b![0]! - a![0]!) * (c![2]! - a![2]!) -
          (b![2]! - a![2]!) * (c![0]! - a![0]!),
      ) / 2;
  }
  expect(area).toBeCloseTo(75, 5);
});
test("missing height coverage is rejected", () => {
  expect(() =>
    controlSurfaceGeometry({ ...plane, controls: plane.controls.slice(0, 3) }),
  ).toThrow(/cover/);
});
