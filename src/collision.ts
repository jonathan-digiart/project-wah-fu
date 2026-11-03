import {
  Group,
  type Object3D,
  type PerspectiveCamera,
  type Vector3,
} from "three";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { covers, inside, createHeightSampler, type SiteData } from "./model";
import {
  attachExteriorCamera,
  createExteriorCollider,
} from "./exterior-camera-collision.mjs";
/** Exact semantic interiors complement continuous sphere sweeps against generated surfaces. */
export function collisionInputs(
  data: SiteData,
  buildings: Group,
  terrain: Object3D,
  shell: Object3D,
) {
  const ground = new Group();
  ground.name = "Generated ground collision surface";
  const parent = terrain.parent;
  ground.add(terrain, shell);
  parent?.add(ground);
  const heightAt = createHeightSampler(data);
  const byId = new Map(
    data.buildings.map((building) => [building.id, building]),
  );
  const roots = [...buildings.children, ground];
  const containsPoint = (root: Object3D, p: Vector3): boolean => {
    const point = [p.x, p.z] as const;
    if (root === ground) {
      if (!covers(point, data.boundary)) return false;
      const isLand = (data.landRegions ?? [data.boundary]).some((region) =>
        covers(point, region),
      );
      const height = isLand
        ? heightAt(p.x, p.z)
        : (data.seaHeight ?? heightAt(p.x, p.z));
      return p.y <= height;
    }
    const building = byId.get(String(root.userData.id));
    return (
      !!building &&
      p.y >= building.base &&
      p.y <= building.base + building.height &&
      covers(point, building.footprint) &&
      !(building.holes ?? []).some((hole) => inside(point, hole))
    );
  };
  const options = {
    clearance: 1,
    collideHidden: true,
    completeSurfaces: true,
    containsPoint,
  };
  return { roots, options };
}
export function createProceduralCollider(
  data: SiteData,
  buildings: Group,
  terrain: Object3D,
  shell: Object3D,
) {
  const { roots, options } = collisionInputs(data, buildings, terrain, shell);
  return createExteriorCollider(roots, options);
}
export function protectCamera(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  data: SiteData,
  buildings: Group,
  terrain: Object3D,
  shell: Object3D,
) {
  const { roots, options } = collisionInputs(data, buildings, terrain, shell);
  return attachExteriorCamera(camera, controls, roots, options);
}
