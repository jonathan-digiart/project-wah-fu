import { authoredCellGeometry } from "./cell-surface";
import { controlSurfaceGeometry } from "./control-surface";
import { heightPatchGeometry } from "./height-patch";
import { ShapeUtils, Vector2 } from "three";
import { area, hasCrossingEdges } from "../model";
import type {
  Component,
  Footprint,
  GeometryData,
  PlanPoint,
  Position,
  RoadStrip,
} from "./schema";
const EPSILON = 1e-8;
function finite(values: readonly number[]) {
  if (!values.every(Number.isFinite))
    throw new Error("Non-finite component parameter");
}
function ring(input: readonly PlanPoint[], clockwise: boolean): PlanPoint[] {
  let points = input.map((p) => {
    finite(p);
    return p;
  });
  if (
    points.length > 1 &&
    Math.hypot(
      points[0]![0] - points.at(-1)![0],
      points[0]![1] - points.at(-1)![1],
    ) < EPSILON
  )
    points.pop();
  if (
    points.length < 3 ||
    Math.abs(area(points)) < EPSILON ||
    hasCrossingEdges(points)
  )
    throw new Error("Invalid footprint ring");
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!,
      b = points[(i + 1) % points.length]!;
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < EPSILON)
      throw new Error("Duplicate footprint corner");
  }
  if (area(points) < 0 !== clockwise) points = points.reverse();
  return points;
}
/** Exactly n-2 cap triangles for a simple n-corner outline, two per wall. */
export function footprintGeometry(input: Footprint): GeometryData {
  finite([input.base, input.height]);
  if (input.height < 0) throw new Error("Negative extrusion height");
  const outline = ring(input.outline, false),
    holes = (input.holes ?? []).map((h) => ring(h, true));
  const rings = [outline, ...holes],
    points = rings.flat();
  const faces = ShapeUtils.triangulateShape(
    outline.map((p) => new Vector2(...p)),
    holes.map((h) => h.map((p) => new Vector2(...p))),
  );
  const positions = points.flatMap((p) => [
    p[0],
    input.base + input.height,
    p[1],
  ]);
  const indices: number[] = [];
  for (const f of faces) {
    const [a, b, c] = f as [number, number, number];
    const signed = area([points[a]!, points[b]!, points[c]!]);
    indices.push(...(signed > 0 ? [a, c, b] : [a, b, c]));
  }
  if (input.height === 0) return { positions, indices };
  const n = points.length;
  positions.push(...points.flatMap((p) => [p[0], input.base, p[1]]));
  if (input.bottom)
    for (const f of faces) {
      const [a, b, c] = f as [number, number, number];
      indices.push(
        ...(area([points[a]!, points[b]!, points[c]!]) > 0
          ? [n + a, n + b, n + c]
          : [n + a, n + c, n + b]),
      );
    }
  let offset = 0;
  for (const r of rings) {
    for (let i = 0; i < r.length; i++) {
      const a = offset + i,
        b = offset + ((i + 1) % r.length);
      indices.push(a, b, n + a, b, n + b, n + a);
    }
    offset += r.length;
  }
  return { positions, indices };
}
/** Two triangles per explicit station span; never flatten tunnels onto terrain. */
export function roadGeometry(input: RoadStrip): GeometryData {
  if (input.stations.length < 2) throw new Error("Road requires two stations");
  const positions = input.stations.flatMap(({ left, right }) => {
    finite([...left, ...right]);
    return [...left, ...right];
  });
  const indices: number[] = [];
  for (let i = 0; i < input.stations.length - 1; i++) {
    const a = 2 * i,
      b = a + 1,
      c = a + 2,
      d = a + 3;
    for (const face of [
      [a, b, c],
      [b, d, c],
    ]) {
      const p = face.map(
        (j) => [positions[3 * j]!, positions[3 * j + 2]!] as PlanPoint,
      );
      const signed = area(p);
      if (Math.abs(signed) < EPSILON) throw new Error("Degenerate road span");
      indices.push(...(signed > 0 ? face.reverse() : face));
    }
  }
  return { positions, indices };
}
export function generateComponent(component: Component): GeometryData {
  if (!component.id.trim()) throw new Error("Component requires a stable ID");
  if (component.kind === "authored-cells")
    return authoredCellGeometry(component);
  if (component.kind === "control-surface")
    return controlSurfaceGeometry(component);
  if (component.kind === "height-patch") return heightPatchGeometry(component);
  return component.kind === "footprint"
    ? footprintGeometry(component)
    : roadGeometry(component);
}
/** Adaptive cubic sampling: refine only where control points leave the chord tolerance. */
export function sampleCubic(
  controls: readonly [Position, Position, Position, Position],
  tolerance: number,
  maxDepth = 16,
): Position[] {
  if (
    !Number.isFinite(tolerance) ||
    tolerance <= 0 ||
    !Number.isInteger(maxDepth) ||
    maxDepth < 0 ||
    maxDepth > 20
  )
    throw new Error("Invalid curve budget");
  controls.forEach(finite);
  const result: Position[] = [controls[0]];
  const mid = (a: Position, b: Position): Position => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
    (a[2] + b[2]) / 2,
  ];
  const distance = (p: Position, a: Position, b: Position) => {
    const d = b.map((v, i) => v - a[i]!);
    const len = d.reduce((s, v) => s + v * v, 0);
    const t = len
      ? Math.max(
          0,
          Math.min(1, d.reduce((s, v, i) => s + v * (p[i]! - a[i]!), 0) / len),
        )
      : 0;
    return Math.hypot(...p.map((v, i) => v - a[i]! - t * d[i]!));
  };
  const split = (
    [a, b, c, d]: readonly [Position, Position, Position, Position],
    depth: number,
  ) => {
    if (Math.max(distance(b, a, d), distance(c, a, d)) <= tolerance) {
      result.push(d);
      return;
    }
    if (!depth) throw new Error("Curve tolerance exceeds subdivision budget");
    const ab = mid(a, b),
      bc = mid(b, c),
      cd = mid(c, d),
      abc = mid(ab, bc),
      bcd = mid(bc, cd),
      centre = mid(abc, bcd);
    split([a, ab, abc, centre], depth - 1);
    split([centre, bcd, cd, d], depth - 1);
  };
  split(controls, maxDepth);
  return result;
}
