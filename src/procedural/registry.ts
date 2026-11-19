import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  type Material,
} from "three";
import { v128Material, type SurfaceRole } from "./palette";
import { generateComponent } from "./geometry";
import type { Component } from "./schema";
export interface ComponentStats {
  id: string;
  triangles: number;
  vertices: number;
  geometryBytes: number;
}
/** Stable-ID modules can be replaced independently; disposal never affects neighbours. */
export class ComponentRegistry {
  readonly group = new Group();
  private entries = new Map<
    string,
    { mesh: Mesh<BufferGeometry, Material>; stats: ComponentStats }
  >();
  constructor(readonly triangleBudget = 100_000) {
    if (!Number.isSafeInteger(triangleBudget) || triangleBudget < 1)
      throw new Error("Invalid triangle budget");
  }
  replace(
    component: Component,
    role: SurfaceRole = component.kind === "footprint"
      ? "contextBuilding"
      : component.kind === "road-strip"
        ? "road"
        : "terrain",
  ) {
    if (
      component.kind === "construction-surface" &&
      component.origin &&
      !component.origin.every(Number.isFinite)
    )
      throw new Error("Invalid component origin");
    const data = generateComponent(component);
    if (
      data.positions.length % 3 ||
      data.indices.length % 3 ||
      !data.positions.every(Number.isFinite) ||
      data.indices.some(
        (i) =>
          !Number.isSafeInteger(i) || i < 0 || i >= data.positions.length / 3,
      )
    )
      throw new Error("Invalid generated component geometry");
    const stats: ComponentStats = {
      id: component.id,
      triangles: data.indices.length / 3,
      vertices: data.positions.length / 3,
      geometryBytes:
        data.positions.length * 4 +
        data.indices.length * (data.positions.length / 3 > 65535 ? 4 : 2),
    };
    const old = this.entries.get(component.id);
    if (
      this.stats().reduce((s, v) => s + v.triangles, 0) -
        (old?.stats.triangles ?? 0) +
        stats.triangles >
      this.triangleBudget
    )
      throw new Error("Component exceeds scene triangle budget");
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(data.positions, 3),
    );
    geometry.setIndex(data.indices);
    // Flat shading keeps roof/wall edges sharp without duplicating vertex positions.
    geometry.computeVertexNormals();
    const material = v128Material(
      role,
      component.kind !== "height-patch" &&
        component.kind !== "control-surface" &&
        component.kind !== "authored-cells" &&
        component.kind !== "construction-surface",
    );
    const mesh = new Mesh(geometry, material);
    if (component.kind === "construction-surface" && component.origin)
      mesh.position.set(...component.origin);
    mesh.name = component.label;
    mesh.userData = {
      ...component,
      outline: undefined,
      stations: undefined,
      generate: undefined,
    };
    if (old) this.remove(component.id);
    this.entries.set(component.id, { mesh, stats });
    this.group.add(mesh);
    return stats;
  }
  remove(id: string) {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.group.remove(entry.mesh);
    entry.mesh.geometry.dispose();
    entry.mesh.material.dispose();
    this.entries.delete(id);
  }
  stats() {
    return [...this.entries.values()].map(({ stats }) => ({ ...stats }));
  }
  dispose() {
    for (const id of this.entries.keys()) this.remove(id);
  }
}
