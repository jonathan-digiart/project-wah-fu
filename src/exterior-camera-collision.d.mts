import type { Object3D, PerspectiveCamera, Vector3 } from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
export interface CollisionOptions {
  enabled?: boolean;
  clearance?: number;
  collideHidden?: boolean;
  completeSurfaces?: boolean;
  acceptNavigationPose?: (position: Vector3, target: Vector3) => boolean;
  containsPoint?: (root: Object3D, position: Vector3) => boolean;
}
export const EXTERIOR_CAMERA: Readonly<{
  enabled: boolean;
  clearance: number;
  collideHidden: boolean;
}>;
export function createExteriorCollider(
  roots: Object3D[],
  options?: CollisionOptions,
): {
  move(
    from: Vector3,
    to: Vector3,
    radius?: number,
    slideAlongSurface?: boolean,
  ): Vector3;
  recover(position: Vector3, radius?: number): Vector3;
  contains(position: Vector3): boolean;
  distanceToSurface(position: Vector3): number;
  config: { enabled: boolean; clearance: number; collideHidden: boolean };
  stats(): {
    buildings: number;
    triangles: number;
    clearanceMetres: number;
    collideHidden: boolean;
    renderedProxyTriangles: number;
    packedVertexBytes: number;
    packedBufferBytes: number;
  };
};
export function attachExteriorCamera(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  roots: Object3D[],
  options?: CollisionOptions,
): {
  apply(teleport?: boolean): void;
  collider: ReturnType<typeof createExteriorCollider>;
  teleport(action: () => void): void;
  setSurfaceCloseUp(enabled: boolean): void;
  dispose(): void;
  snapshot(): ReturnType<ReturnType<typeof createExteriorCollider>["stats"]> & {
    surfaceCloseUp: boolean;
  };
};
