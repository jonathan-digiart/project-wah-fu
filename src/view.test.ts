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
  focusDirection,
  uniqueSentences,
  highlightSelection,
} from "./view";
test("overview fit keeps all estate corners padded at desktop,800px and390px canvases", () => {
  const bounds = new Box3(
    new Vector3(-500, -20, -600),
    new Vector3(700, 200, 400),
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
