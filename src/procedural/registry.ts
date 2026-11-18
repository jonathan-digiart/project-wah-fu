import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
} from "three";
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
    { mesh: Mesh<BufferGeometry, MeshStandardMaterial>; stats: ComponentStats }
  >();
  constructor(readonly triangleBudget = 100_000) {
    if (!Number.isSafeInteger(triangleBudget) || triangleBudget < 1)
      throw new Error("Invalid triangle budget");
  }
  replace(component: Component) {
    const data = generateComponent(component);
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
    const material = new MeshStandardMaterial({
      color: component.kind === "road-strip" ? "#9e9d97" : "#d4c8b4",
      roughness: 1,
      flatShading: true,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = component.label;
    mesh.userData = { ...component, outline: undefined, stations: undefined };
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
