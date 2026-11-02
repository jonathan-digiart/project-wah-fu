import { createLinearTerrain } from "./linear-terrain";
/** Semantic, metre-based input. Never stores source mesh vertices or texture pixels. */
export type Point = readonly [number, number];
export interface Building {
  id: string;
  name: string;
  footprint: Point[];
  base: number;
  height: number;
  uncertainty: string;
}
export interface TerrainControl {
  x: number;
  z: number;
  height: number;
}
export interface SiteData {
  boundary: Point[];
  interpolation?: "linear" | "idw";
  review?: {
    samples: number;
    meanError: number;
    p95Error: number;
    maxError: number;
  };
  landRegions?: Point[][];
  seaRegions?: Point[][];
  seaHeight?: number;
  presentationBottom?: number;
  buildings: Building[];
  terrainControls: TerrainControl[];
  provenance: Record<string, unknown>;
}
export const COORDINATES = Object.freeze({
  units: "metres",
  up: "+Y",
  north: "-Z",
  east: "+X",
  verticalDatum: "Hong Kong Principal Datum",
});
export function gridToLocal(
  easting: number,
  northing: number,
  height: number,
  origin: Point,
) {
  return [easting - origin[0], height, origin[1] - northing] as const;
}
export function localToGrid(x: number, y: number, z: number, origin: Point) {
  return [x + origin[0], origin[1] - z, y] as const;
}
export function area(polygon: readonly Point[]): number {
  return (
    polygon.reduce((sum, p, i) => {
      const next = polygon[(i + 1) % polygon.length]!;
      return sum + p[0] * next[1] - next[0] * p[1];
    }, 0) / 2
  );
}
export function inside(point: Point, polygon: readonly Point[]): boolean {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      result = !result;
  }
  return result;
}
export function terrainHeight(
  x: number,
  z: number,
  controls: readonly TerrainControl[],
): number {
  if (!controls.length)
    throw new Error("Terrain reference controls are missing");
  let weighted = 0;
  let total = 0;
  for (const control of controls) {
    const distanceSquared = (x - control.x) ** 2 + (z - control.z) ** 2;
    if (distanceSquared < 1e-10) return control.height;
    const weight = 1 / distanceSquared ** 1.5;
    weighted += weight * control.height;
    total += weight;
  }
  return weighted / total;
}
export function createHeightSampler(
  data: SiteData,
): (x: number, z: number) => number {
  const fallback = (x: number, z: number) =>
    terrainHeight(x, z, data.terrainControls);
  return data.interpolation === "linear"
    ? createLinearTerrain(data.terrainControls, fallback).heightAt
    : fallback;
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}
function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
export function hasCrossingEdges(points: readonly Point[]): boolean {
  const cross = (a: Point, b: Point, c: Point) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      const a = points[i]!;
      const b = points[(i + 1) % points.length]!;
      const c = points[j]!;
      const d = points[(j + 1) % points.length]!;
      if (
        cross(a, b, c) * cross(a, b, d) < 0 &&
        cross(c, d, a) * cross(c, d, b) < 0
      )
        return true;
    }
  return false;
}
function polygon(value: unknown): value is Point[] {
  return (
    Array.isArray(value) &&
    value.length >= 3 &&
    value.length <= 64 &&
    value.every(
      (p: unknown) => Array.isArray(p) && p.length === 2 && p.every(finite),
    ) &&
    Math.abs(area(value as Point[])) > 0.01 &&
    !hasCrossingEdges(value as Point[])
  );
}
/** Fail closed: no guessed dimensions or missing controls silently enter the model. */
export function parseSiteData(value: unknown): SiteData {
  if (
    !object(value) ||
    !polygon(value.boundary) ||
    !Array.isArray(value.buildings) ||
    !Array.isArray(value.terrainControls) ||
    !object(value.provenance)
  )
    throw new Error("Invalid semantic site data");
  if (!value.terrainControls.length || value.terrainControls.length > 320)
    throw new Error("Expected 1–320 semantic terrain controls");
  for (const c of value.terrainControls as unknown[])
    if (!object(c) || !finite(c.x) || !finite(c.z) || !finite(c.height))
      throw new Error("Invalid terrain control");
  for (const key of ["landRegions", "seaRegions"]) {
    if (
      value[key] !== undefined &&
      (!Array.isArray(value[key]) || !(value[key] as unknown[]).every(polygon))
    )
      throw new Error("Invalid semantic region");
  }
  if (value.seaRegions !== undefined && !finite(value.seaHeight))
    throw new Error("Sea datum required");
  if (
    value.presentationBottom !== undefined &&
    !finite(value.presentationBottom)
  )
    throw new Error("Invalid presentation bottom");
  if (
    value.interpolation !== undefined &&
    value.interpolation !== "linear" &&
    value.interpolation !== "idw"
  )
    throw new Error("Unknown interpolation");
  if (value.review !== undefined) {
    if (
      !object(value.review) ||
      !["samples", "meanError", "p95Error", "maxError"].every(
        (key) =>
          finite((value.review as Record<string, unknown>)[key]) &&
          ((value.review as Record<string, number>)[key] ?? -1) >= 0,
      )
    )
      throw new Error("Invalid review metrics");
  }
  const ids = new Set<string>();
  for (const b of value.buildings as unknown[]) {
    if (
      !object(b) ||
      typeof b.id !== "string" ||
      ids.has(b.id) ||
      typeof b.name !== "string" ||
      !polygon(b.footprint) ||
      !finite(b.base) ||
      !finite(b.height) ||
      b.height <= 0 ||
      typeof b.uncertainty !== "string" ||
      !b.uncertainty
    )
      throw new Error("Invalid, duplicated or unqualified building");
    ids.add(b.id);
  }
  return value as unknown as SiteData;
}
