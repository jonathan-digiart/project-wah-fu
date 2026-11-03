import type { BufferGeometry } from "three";
import { Box3, Mesh, Object3D, PerspectiveCamera, Ray, Vector3 } from "three";
export const OVERVIEW_DIRECTION = new Vector3(-0.4, 0.65, 1);

/** Bounding-sphere fit respects whichever field of view is narrower, including portrait canvases. */
export function fitCamera(
  camera: PerspectiveCamera,
  bounds: Box3,
  direction: Vector3,
  padding = 1.18,
): Vector3 {
  const centre = bounds.getCenter(new Vector3());
  const radius = Math.max(bounds.getSize(new Vector3()).length() / 2, 1);
  const vertical = (camera.fov * Math.PI) / 360;
  const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
  const distance =
    (radius / Math.sin(Math.min(vertical, horizontal))) * padding;
  camera.position
    .copy(centre)
    .add(direction.clone().normalize().multiplyScalar(distance));
  camera.far = Math.max(6000, distance + radius * 4);
  camera.updateProjectionMatrix();
  camera.lookAt(centre);
  return centre;
}
/** Choose an elevated inspection side with least intervening massing, rather than a fixed occluded side. */
export function focusDirection(
  selected: Box3,
  neighbours: readonly Box3[],
): Vector3 {
  const centre = selected.getCenter(new Vector3());
  let best = new Vector3(1, 2, 1);
  let bestScore = Infinity;
  const radius = selected.getSize(new Vector3()).length() / 2;
  for (let i = 0; i < 8; i++) {
    const direction = new Vector3(
      Math.cos((i * Math.PI) / 4),
      2,
      Math.sin((i * Math.PI) / 4),
    ).normalize();
    const eye = centre
      .clone()
      .add(direction.clone().multiplyScalar(Math.max(radius * 4, 100)));
    const ray = new Ray(eye, centre.clone().sub(eye).normalize());
    let score = 0;
    for (const box of neighbours) {
      const hit = ray.intersectBox(box, new Vector3());
      if (hit && hit.distanceTo(eye) < centre.distanceTo(eye)) score++;
    }
    if (score < bestScore) {
      best = direction;
      bestScore = score;
    }
  }
  return best;
}
export function uniqueSentences(text: string): string {
  return [...new Set(text.trim().split(/(?<=[.!?])\s+(?=[A-Z])/))].join(" ");
}

export function highlightSelection(
  meshes: readonly import("three").Mesh[],
  originals: ReadonlyMap<
    import("three").Mesh,
    import("three").Material | import("three").Material[]
  >,
  material: import("three").Material,
  id?: string,
): void {
  for (const mesh of meshes)
    mesh.material =
      (mesh.userData.reviewId ?? mesh.userData.id) === id
        ? material
        : originals.get(mesh)!;
}

export function setContextVisible(
  meshes: readonly import("three").Mesh[],
  visible: boolean,
): void {
  for (const mesh of meshes)
    if (mesh.userData.category === "context") mesh.visible = visible;
}

/** Collect generated surface vertices once, including the presentation base. */
export function framingPoints(roots: readonly Object3D[]): Vector3[] {
  const points: Vector3[] = [];
  for (const root of roots) {
    root.updateWorldMatrix(true, true);
    root.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      const positions = (node.geometry as BufferGeometry).getAttribute(
        "position",
      );
      for (let i = 0; i < positions.count; i++)
        points.push(
          new Vector3()
            .fromBufferAttribute(positions, i)
            .applyMatrix4(node.matrixWorld),
        );
    });
  }
  return points;
}

/** Fit both projected silhouette edges, not just one edge around a world-space centre. */
export function fitOverview(
  camera: PerspectiveCamera,
  points: readonly Vector3[],
  direction: Vector3,
  occupancy = 0.82,
): Vector3 {
  if (!points.length || !(occupancy > 0 && occupancy < 1))
    throw new Error("Overview requires geometry and a visible margin");
  const target = new Box3().setFromPoints([...points]).getCenter(new Vector3());
  const back = direction.clone().normalize();
  const right = new Vector3().crossVectors(camera.up, back).normalize();
  const up = new Vector3().crossVectors(back, right).normalize();
  const tanV = Math.tan((camera.fov * Math.PI) / 360) * occupancy;
  const tanH = tanV * camera.aspect;
  const coordinates = points.map((point) => {
    const p = point.clone().sub(target);
    return [p.dot(right), p.dot(up), p.dot(back)] as const;
  });
  const intervals = (distance: number) => {
    let minX = -Infinity,
      maxX = Infinity,
      minY = -Infinity,
      maxY = Infinity;
    for (const [x, y, z] of coordinates) {
      const depth = distance - z;
      minX = Math.max(minX, x - tanH * depth);
      maxX = Math.min(maxX, x + tanH * depth);
      minY = Math.max(minY, y - tanV * depth);
      maxY = Math.min(maxY, y + tanV * depth);
    }
    return { minX, maxX, minY, maxY };
  };
  let low = Math.max(...coordinates.map((p) => p[2])) + camera.near * 2;
  let high = Math.max(low, 1);
  const feasible = (distance: number) => {
    const i = intervals(distance);
    return i.minX <= i.maxX && i.minY <= i.maxY;
  };
  while (!feasible(high)) high *= 2;
  for (let iteration = 0; iteration < 42; iteration++) {
    const mid = (low + high) / 2;
    if (feasible(mid)) high = mid;
    else low = mid;
  }
  const i = intervals(high);
  target
    .addScaledVector(right, (i.minX + i.maxX) / 2)
    .addScaledVector(up, (i.minY + i.maxY) / 2);
  camera.position.copy(target).addScaledVector(back, high);
  camera.far = Math.max(6000, high * 4);
  camera.updateProjectionMatrix();
  camera.lookAt(target);
  return target;
}
