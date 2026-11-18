import { ShapeUtils, Vector2 } from "three";
import { area, covers, type Point, type TerrainControl } from "../model";
import { clipTriangle } from "../terrain-mesh";
import { pchip } from "./height-patch";
import { triangulateHeightControls } from "./triangulate";
import { northSurfaceData as data } from "./north-surface-data";
import type { GeometryData } from "./schema";

const map = (z: number, d: number): Point => [
  data.mapping.xAtZReference +
    data.mapping.xPerZ * (z - data.mapping.zReference) +
    d,
  z,
];
export const northOutline: readonly Point[] = data.domainZD.map(([z, d]) =>
  map(z, d),
);
const round = (v: number) => Math.round(v * 1e9) / 1e9;
function edgeLevel(p: Point): number | undefined {
  for (const edge of data.edgeProfiles) {
    const a = northOutline[edge.startDomainVertex]!,
      b = northOutline[edge.endDomainVertex]!;
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz);
    if (
      t < -1e-8 ||
      t > 1 + 1e-8 ||
      Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz) >
        data.boundaryHeightSnapToleranceMetres
    )
      continue;
    const stations = edge.stations;
    if (t <= stations[0].t) return stations[0].level;
    for (let i = 1; i < stations.length; i++) {
      const a = stations[i - 1]!,
        b = stations[i]!;
      if (t <= b.t)
        return a.level + ((b.level - a.level) * (t - a.t)) / (b.t - a.t);
    }
    return stations[stations.length - 1]!.level;
  }
  return undefined;
}
/** Scalar lattice levels and 90 PCHIP controls; no saved mesh coordinates/connectivity. */
export function northControls(): TerrainControl[] {
  const rows = data.coreProfile.levelsByD.map((row) =>
    pchip(data.coreProfile.zStations, row),
  );
  const controls = new Map<string, TerrainControl>();
  const put = (p: Point, height: number) => {
    const x = round(p[0]),
      z = round(p[1]);
    controls.set(`${x},${z}`, { x, z, height });
  };
  const pins: Readonly<Record<string, number>> = data.nonCoreLevelPins;
  for (let iz = 0; iz < data.grid.zCount; iz++) {
    const z = data.grid.zStart + iz * data.grid.zStep;
    const across = pchip(
      data.coreProfile.lateralOffsets,
      rows.map((row) => row(z)),
    );
    for (let id = 0; id < data.grid.dCount; id++) {
      const d = data.grid.dStart + id * data.grid.dStep,
        p = map(z, d);
      if (!covers(p, northOutline, data.domainCoverToleranceMetres)) continue;
      const key = `z${String(iz).padStart(2, "0")}_d${String(id).padStart(2, "0")}`;
      put(p, pins[key] ?? across(d));
    }
  }
  for (const edge of data.edgeProfiles) {
    const a = northOutline[edge.startDomainVertex]!,
      b = northOutline[edge.endDomainVertex]!;
    for (const { t, level } of edge.stations)
      put([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], level);
  }
  return [...controls.values()];
}
/** Clean construction ownership replaces microscopic old/new overlapping remnants.
 * This standalone patch must replace, never overlay, the corresponding old domain.
 * Float32 is deliberate: validation must assess coordinates actually sent to GPU. */
export function northSurfaceGeometry(): GeometryData {
  const controls = northControls(),
    positions: number[] = [],
    indices: number[] = [],
    keys = new Map<string, number>(),
    faces = new Set<string>();
  const outlineFaces = ShapeUtils.triangulateShape(
    northOutline.map((p) => new Vector2(...p)),
    [],
  );
  const rawFaces: TerrainControl[][] = [];
  const append = (points: readonly TerrainControl[]) => {
    if (Math.abs(area(points.map((p) => [p.x, p.z]))) > 1e-9)
      rawFaces.push([...points]);
  };
  const emit = (points: readonly TerrainControl[]) => {
    const rounded = points.map((p) => ({
      x: Math.fround(p.x),
      z: Math.fround(p.z),
      height: Math.fround(edgeLevel([p.x, p.z]) ?? p.height),
    }));
    const signed = area(rounded.map((p) => [p.x, p.z]));
    if (Math.abs(signed) < 1e-8) return;
    const face = (
      signed > 0 ? [rounded[0]!, rounded[2]!, rounded[1]!] : rounded
    ).map((p) => {
      const key = `${p.x},${p.z}`;
      let id = keys.get(key);
      if (id === undefined) {
        id = positions.length / 3;
        positions.push(p.x, p.height, p.z);
        keys.set(key, id);
      }
      return id;
    });
    const key = [...face].sort((a, b) => a - b).join(",");
    if (!faces.has(key)) {
      indices.push(...face);
      faces.add(key);
    }
  };
  for (const face of triangulateHeightControls(controls)) {
    const pts = face.map((i) => controls[i]!);
    // Test vertices and edge interiors; the only concavity is the authored notch.
    const probes = pts.flatMap((p, i) => {
      const q = pts[(i + 1) % 3]!;
      return [
        [p.x, p.z],
        [(p.x + q.x) / 2, (p.z + q.z) / 2],
      ] as Point[];
    });
    if (probes.every((p) => covers(p, northOutline, 1e-9))) {
      append(pts);
      continue;
    }
    for (const cut of outlineFaces) {
      const clipped = clipTriangle(
        pts,
        cut.map((i) => northOutline[i]!),
      );
      for (let i = 1; i < clipped.length - 1; i++)
        append([clipped[0]!, clipped[i]!, clipped[i + 1]!]);
    }
  }
  // Resolve clipping T-junctions before Float32 rounding. Both neighbouring faces
  // must contain each inserted edge station, otherwise rounding creates slivers.
  const vertices = new Map<string, TerrainControl>();
  for (const face of rawFaces)
    for (const p of face) vertices.set(`${round(p.x)},${round(p.z)}`, p);
  const all = [...vertices.values()];
  for (const face of rawFaces) {
    const boundary: TerrainControl[] = [];
    let split = false;
    for (let i = 0; i < 3; i++) {
      const a = face[i]!,
        b = face[(i + 1) % 3]!,
        dx = b.x - a.x,
        dz = b.z - a.z,
        length2 = dx * dx + dz * dz;
      const extras = all
        .map((p) => ({ p, t: ((p.x - a.x) * dx + (p.z - a.z) * dz) / length2 }))
        .filter(
          ({ p, t }) =>
            t > 1e-7 &&
            t < 1 - 1e-7 &&
            Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz) < 1e-8,
        )
        .sort((a, b) => a.t - b.t);
      boundary.push(a, ...extras.map(({ p }) => p));
      split ||= extras.length > 0;
    }
    if (!split) {
      emit(face);
      continue;
    }
    const centre = {
      x: face.reduce((s, p) => s + p.x, 0) / 3,
      z: face.reduce((s, p) => s + p.z, 0) / 3,
      height: face.reduce((s, p) => s + p.height, 0) / 3,
    };
    for (let i = 0; i < boundary.length; i++)
      emit([centre, boundary[i]!, boundary[(i + 1) % boundary.length]!]);
  }
  if (indices.length / 3 > 4000)
    throw new Error("Northern surface triangle budget exceeded");
  return { positions, indices };
}
