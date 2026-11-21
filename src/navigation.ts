import { Box3, Object3D, PerspectiveCamera, Vector3 } from "three";
type Point = readonly [number, number];
const cross = (a: Point, b: Point, c: Point) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function hull(points: Point[]): Point[] {
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (values: Point[]) => {
    const result: Point[] = [];
    for (const p of values) {
      while (
        result.length >= 2 &&
        cross(result.at(-2)!, result.at(-1)!, p) <= 0
      )
        result.pop();
      result.push(p);
    }
    result.pop();
    return result;
  };
  return [...half(points), ...half([...points].reverse())];
}
function area(points: readonly Point[]) {
  let result = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!,
      b = points[(i + 1) % points.length]!;
    result += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(result) / 2;
}
function clip(points: Point[], axis: 0 | 1, limit: number, sign: 1 | -1) {
  const result: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!,
      b = points[(i + 1) % points.length]!,
      insideA = sign * (a[axis] - limit) <= 0,
      insideB = sign * (b[axis] - limit) <= 0;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      const t = (limit - a[axis]) / (b[axis] - a[axis]);
      result.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return result;
}
/**
 * Project a near-clipped inspection box, not an unbounded target radius. The
 * convex volume is a conservative subject envelope, not an occlusion test.
 * Fraction is relative to the smaller of projected subject and viewport area:
 * close inspection can fill the screen; a distant subject remains partly shown.
 */
export function inspectionOverlap(
  camera: PerspectiveCamera,
  bounds: Box3,
  position: Vector3,
  target: Vector3,
) {
  if (bounds.isEmpty() || !Number.isFinite(camera.aspect) || camera.aspect <= 0)
    return 0;
  const forward = target.clone().sub(position);
  if (forward.lengthSq() < 1e-16) return 0;
  forward.normalize();
  const right = new Vector3().crossVectors(forward, camera.up).normalize();
  if (right.lengthSq() < 1e-16) return 0;
  const up = new Vector3().crossVectors(right, forward);
  const corners: Vector3[] = [];
  for (let i = 0; i < 8; i++) {
    const p = new Vector3(
      i & 1 ? bounds.max.x : bounds.min.x,
      i & 2 ? bounds.max.y : bounds.min.y,
      i & 4 ? bounds.max.z : bounds.min.z,
    ).sub(position);
    corners.push(new Vector3(p.dot(right), p.dot(up), p.dot(forward)));
  }
  const near = Math.max(camera.near, 1e-6),
    clipped = corners.filter((p) => p.z >= near);
  for (let i = 0; i < 8; i++)
    for (const bit of [1, 2, 4]) {
      if (i & bit) continue;
      const a = corners[i]!,
        b = corners[i | bit]!;
      if (a.z < near !== b.z < near)
        clipped.push(a.clone().lerp(b, (near - a.z) / (b.z - a.z)));
    }
  if (clipped.length < 3) return 0;
  const tanV = Math.tan((camera.fov * Math.PI) / 360) / camera.zoom,
    tanH = tanV * camera.aspect;
  let polygon = hull(
    clipped.map((p) => [p.x / (p.z * tanH), p.y / (p.z * tanV)]),
  );
  const projectedArea = area(polygon);
  if (!Number.isFinite(projectedArea) || projectedArea < 1e-16) return 0;
  polygon = clip(
    clip(clip(clip(polygon, 0, 1, 1), 0, -1, -1), 1, 1, 1),
    1,
    -1,
    -1,
  );
  return Math.min(1, area(polygon) / Math.min(4, projectedArea));
}
export function createNavigationBound(
  camera: PerspectiveCamera,
  getBounds: () => Box3,
  minimumOverlap = 0.2,
) {
  if (!(minimumOverlap > 0 && minimumOverlap < 1))
    throw new Error("Navigation overlap must be between zero and one");
  return (position: Vector3, target: Vector3) =>
    inspectionOverlap(camera, getBounds(), position, target) >= minimumOverlap;
}

/** Reconcile a focused subject with current visibility without changing a pose. */
export function visibleInspection(
  terrain: Object3D,
  objects: readonly Object3D[],
  selection?: string,
) {
  const visible = objects.filter((object) => object.visible);
  const selected =
    selection === undefined
      ? []
      : visible.filter(
          (object) =>
            (object.userData.reviewId ?? object.userData.id) === selection,
        );
  const bounds = new Box3();
  for (const object of selected.length ? selected : [terrain, ...visible])
    bounds.union(new Box3().setFromObject(object));
  return { bounds, selection: selected.length ? selection : undefined };
}
