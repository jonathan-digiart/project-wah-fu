import { ShapeUtils, Vector2 } from "three";
import { area, covers, hasCrossingEdges, type Point } from "../model";
import { triangulateHeightControls } from "./triangulate";
import { clipTriangle } from "../terrain-mesh";
import type { ControlSurface, GeometryData } from "./schema";
const cross = (a: Point, b: Point, c: Point) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const crosses = (a: Point, b: Point, c: Point, d: Point) =>
  cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
/** Generates a fresh triangulation from sparse editable height controls, not saved faces. */
export function r06GradeSurfaceGeometry(
  input: ControlSurface,
  origin: readonly [number, number, number] = [0, 0, 0],
): GeometryData {
  if (
    input.outline.length < 3 ||
    hasCrossingEdges(input.outline) ||
    Math.abs(area(input.outline)) < 1e-8
  )
    throw new Error("Invalid control-surface outline");
  if (!Number.isSafeInteger(input.maxTriangles) || input.maxTriangles < 1)
    throw new Error("Invalid control-surface budget");
  if (
    !input.outline.flat().every(Number.isFinite) ||
    input.controls.length < 3 ||
    input.controls.some((p) => ![p.x, p.z, p.height].every(Number.isFinite))
  )
    throw new Error("Invalid control-surface parameters");
  const controlKeys = new Set(input.controls.map((p) => `${p.x},${p.z}`));
  if (controlKeys.size !== input.controls.length)
    throw new Error("Duplicate height control");
  const boundaryFaces = ShapeUtils.triangulateShape(
    input.outline.map((p) => new Vector2(...p)),
    [],
  );
  const positions: number[] = [],
    indices: number[] = [],
    keys = new Map<string, number>();
  const uniqueFaces = new Set<string>();
  const append = (
    points: readonly { x: number; z: number; height: number }[],
  ) => {
    if (Math.abs(area(points.map((p) => [p.x, p.z]))) <= 1e-8) return;
    // Weld and reject degeneracy at the precision actually sent to the GPU.
    const rounded = points.map((p) => ({
      x: Math.fround(p.x - origin[0]),
      z: Math.fround(p.z - origin[2]),
      height: Math.fround(p.height - origin[1]),
    }));
    const plan = rounded.map((p) => [p.x, p.z] as Point),
      signed = area(plan);
    if (Math.abs(signed) <= 1e-8) return;
    const faceIndices: number[] = [];
    for (const p of signed > 0
      ? [rounded[0]!, rounded[2]!, rounded[1]!]
      : rounded) {
      const key = [p.x, p.height, p.z].join(",");
      let index = keys.get(key);
      if (index === undefined) {
        index = positions.length / 3;
        positions.push(p.x, p.height, p.z);
        keys.set(key, index);
      }
      faceIndices.push(index);
    }
    const faceKey = [...faceIndices].sort((a, b) => a - b).join(":");
    if (!uniqueFaces.has(faceKey)) {
      indices.push(...faceIndices);
      uniqueFaces.add(faceKey);
    }
    if (indices.length / 3 > input.maxTriangles)
      throw new Error("Control surface exceeds triangle budget");
  };
  let coveredArea = 0;
  for (const triangle of triangulateHeightControls(input.controls)) {
    const vertices = triangle.map((i) => input.controls[i]!),
      plan = vertices.map((p) => [p.x, p.z] as Point);
    const whollyInside =
      plan.every((p) => covers(p, input.outline, 1e-10)) &&
      covers(
        [
          plan.reduce((s, p) => s + p[0], 0) / 3,
          plan.reduce((s, p) => s + p[1], 0) / 3,
        ],
        input.outline,
        1e-10,
      ) &&
      plan.every((p, i) =>
        covers(
          [
            (p[0] + plan[(i + 1) % 3]![0]) / 2,
            (p[1] + plan[(i + 1) % 3]![1]) / 2,
          ],
          input.outline,
          1e-10,
        ),
      ) &&
      !plan.some((a, i) =>
        input.outline.some((c, j) =>
          crosses(
            a,
            plan[(i + 1) % 3]!,
            c,
            input.outline[(j + 1) % input.outline.length]!,
          ),
        ),
      );
    if (whollyInside) {
      append(vertices);
      coveredArea += Math.abs(area(plan));
      continue;
    }
    const pieces: { x: number; z: number; height: number }[][] = [];
    for (const face of boundaryFaces) {
      const clip = face.map((i) => input.outline[i]!);
      // Cheap axis bounds reject avoids most polygon clipping work.
      if (
        Math.max(...plan.map((p) => p[0])) <
          Math.min(...clip.map((p) => p[0])) ||
        Math.min(...plan.map((p) => p[0])) >
          Math.max(...clip.map((p) => p[0])) ||
        Math.max(...plan.map((p) => p[1])) <
          Math.min(...clip.map((p) => p[1])) ||
        Math.min(...plan.map((p) => p[1])) > Math.max(...clip.map((p) => p[1]))
      )
        continue;
      const polygon = clipTriangle(vertices, clip);
      if (
        polygon.length >= 3 &&
        Math.abs(area(polygon.map((v) => [v.x, v.z]))) > 1e-10
      )
        pieces.push(polygon);
    }
    for (const polygon of pieces)
      for (let i = 1; i < polygon.length - 1; i++) {
        const points = [polygon[0]!, polygon[i]!, polygon[i + 1]!];
        append(points);
        coveredArea += Math.abs(area(points.map((p) => [p.x, p.z])));
      }
  }
  if (
    Math.abs(coveredArea - Math.abs(area(input.outline))) >
    Math.max(0.00001, Math.abs(area(input.outline)) * 1e-7)
  )
    throw new Error(
      `Height controls do not cover the full outline: ${coveredArea} vs ${Math.abs(area(input.outline))}`,
    );
  return { positions, indices };
}
