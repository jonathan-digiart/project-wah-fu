import { ShapeUtils, Vector2 } from "three";
import { r06SurfaceData } from "./r06-surface-data";
import { r06GradeSurfaceGeometry } from "./r06-grade-surface";
import type { GeometryData } from "./schema";
import type { Point } from "../model";

export const r06SurfaceOrigin = [444, 55, -314] as const;

/** Independent experimental R06 top only; does not replace accepted road or supports. */
export function r06SurfaceGeometry(partIndex: 0 | 1): GeometryData {
  const part = r06SurfaceData.parts[partIndex];
  const [a, b, c] = part.basePlaneXZ1;
  const level = (x: number, z: number) => a * x + b * z + c;
  const positions: number[] = [],
    indices: number[] = [];
  const append = (g: GeometryData) => {
    const offset = positions.length / 3;
    positions.push(...g.positions);
    indices.push(...g.indices.map((i) => i + offset));
  };
  for (const domain of part.planeDomains) {
    const outline = domain.outline.map((p) => new Vector2(...p));
    const holes: Vector2[][] = (
      domain.holes as readonly (readonly Point[])[]
    ).map((r) => r.map((p) => new Vector2(...p)));
    const points = [...outline, ...holes.flat()];
    const localPositions = points.flatMap((p) => [
      Math.fround(p.x - r06SurfaceOrigin[0]),
      Math.fround(level(p.x, p.y) - r06SurfaceOrigin[1]),
      Math.fround(p.y - r06SurfaceOrigin[2]),
    ]);
    const localIndices: number[] = [];
    for (const face of ShapeUtils.triangulateShape(outline, holes)) {
      const [i, j, k] = face as [number, number, number];
      const x = (n: number) => localPositions[n * 3]!;
      const z = (n: number) => localPositions[n * 3 + 2]!;
      const cross =
        (x(j) - x(i)) * (z(k) - z(i)) - (z(j) - z(i)) * (x(k) - x(i));
      if (Math.abs(cross) <= 2e-8) continue;
      localIndices.push(...(cross > 0 ? [i, k, j] : [i, j, k]));
    }
    append({ positions: localPositions, indices: localIndices });
  }
  for (const zone of part.gradeZones) {
    const outline: Point[] = zone.outline.map((p) => [p[0], p[1]]);
    const controls = outline.map(([x, z], i) => ({
      x,
      z,
      height: level(x, z) + zone.boundaryPlaneDeltas[i]!,
    }));
    const { originXZ: o, spanXZ: s } = zone.controlFrame;
    for (const pin of zone.insetGradeControls) {
      const x = o[0] + pin.u * s[0],
        z = o[1] + pin.v * s[1];
      controls.push({ x, z, height: level(x, z) + pin.planeDelta });
    }
    append(
      r06GradeSurfaceGeometry(
        {
          kind: "control-surface",
          id: zone.id,
          label: zone.id,
          source: "accepted R06 LP grade experiment",
          confidence: "inferred",
          outline,
          controls,
          maxTriangles: 2000,
        },
        r06SurfaceOrigin,
      ),
    );
  }
  return { positions, indices };
}
