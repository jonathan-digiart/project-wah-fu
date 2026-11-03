import { expect, test } from "vitest";
import {
  Box3,
  PerspectiveCamera,
  Vector3,
  Mesh,
  BoxGeometry,
  MeshStandardMaterial,
} from "three";
import {
  fitCamera,
  OVERVIEW_DIRECTION,
  fitOverview,
  framingPoints,
  focusDirection,
  uniqueSentences,
  highlightSelection,
} from "./view";
test("overview fit keeps all estate corners padded at desktop,800px and390px canvases", () => {
  const bounds = new Box3(
    new Vector3(-225, -24, -600),
    new Vector3(695, 162, 359),
  );
  for (const [width, height] of [
    [1200, 700],
    [515, 600],
    [390, 500],
    [390, 800],
  ]) {
    const camera = new PerspectiveCamera(45, width! / height!, 0.5, 6000);
    fitCamera(camera, bounds, new Vector3(0.65, 0.8, 0.85));
    camera.updateMatrixWorld();
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          const projected = new Vector3(x, y, z).project(camera);
          expect(Math.abs(projected.x)).toBeLessThan(0.9);
          expect(Math.abs(projected.y)).toBeLessThan(0.9);
        }
  }
});
test("focus direction avoids a mass blocking its first candidate", () => {
  const selected = new Box3(new Vector3(-10, 0, -10), new Vector3(10, 50, 10));
  const obstruction = new Box3(
    new Vector3(20, 0, -30),
    new Vector3(80, 200, 30),
  );
  const direction = focusDirection(selected, [obstruction]);
  expect(direction.x).toBeLessThan(0.44);
  expect(direction.y).toBeGreaterThan(0.7);
});
test("deduplicates whole tolerance sentences without splitting decimals", () => {
  const sentence =
    "Outline simplification tolerance 0.25m; measured projected-outline deviation 0.08m.";
  expect(uniqueSentences(`Approximate envelope. ${sentence} ${sentence}`)).toBe(
    `Approximate envelope. ${sentence}`,
  );
});

test("selected clay material changes only chosen mass and reset restores originals", () => {
  const base = new MeshStandardMaterial({ color: "#d4c8b4" }),
    selected = new MeshStandardMaterial({ color: "#e5c699" }),
    geometry = new BoxGeometry();
  const a = new Mesh(geometry, base),
    b = new Mesh(geometry, base);
  a.userData.id = "a";
  b.userData.id = "b";
  const original = new Map([
    [a, base],
    [b, base],
  ]);
  highlightSelection([a, b], original, selected, "a");
  expect(a.material).toBe(selected);
  expect(b.material).toBe(base);
  highlightSelection([a, b], original, selected, "b");
  expect(a.material).toBe(base);
  expect(b.material).toBe(selected);
  highlightSelection([a, b], original, selected);
  expect(a.material).toBe(base);
  expect(b.material).toBe(base);
  geometry.dispose();
  base.dispose();
  selected.dispose();
});

test("closer overview includes generated base and refits at portrait and wide aspects", () => {
  const geometry = new BoxGeometry(100, 20, 80);
  const material = new MeshStandardMaterial();
  const mesh = new Mesh(geometry, material);
  mesh.position.set(10, 20, -30);
  const points = framingPoints([mesh]);
  for (const aspect of [0.4, 0.78, 1, 2, 4]) {
    const camera = new PerspectiveCamera(45, aspect, 0.5, 6000);
    const target = fitOverview(camera, points, new Vector3(0.65, 0.8, 0.85));
    expect(target.toArray().every(Number.isFinite)).toBe(true);
    camera.updateMatrixWorld();
    let edge = 0;
    let minY = Infinity,
      maxY = -Infinity,
      minX = Infinity,
      maxX = -Infinity;
    for (const point of points) {
      const p = point.clone().project(camera);
      edge = Math.max(edge, Math.abs(p.x), Math.abs(p.y));
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
      expect(p.z).toBeGreaterThan(-1);
      expect(p.z).toBeLessThan(1);
    }
    expect(edge).toBeCloseTo(0.82, 6);
    expect(Math.max(maxX - minX, maxY - minY)).toBeCloseTo(1.64, 6);
    const first = camera.position.clone();
    fitOverview(camera, points, new Vector3(0.65, 0.8, 0.85));
    expect(camera.position.toArray()).toEqual(first.toArray());
  }
  geometry.dispose();
  material.dispose();
});

test("default overview faces the estate from the requested frontal side", () => {
  expect(OVERVIEW_DIRECTION.toArray()).toEqual([-0.4, 0.65, 1]);
  expect(
    OVERVIEW_DIRECTION.y /
      Math.hypot(OVERVIEW_DIRECTION.x, OVERVIEW_DIRECTION.z),
  ).toBeLessThan(0.65);
});
