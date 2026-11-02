import { Box3, PerspectiveCamera, Ray, Vector3 } from "three";
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
