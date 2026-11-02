import { ShapeUtils, Vector2 } from "three";
import { area, type Point, type SiteData, type TerrainControl } from "./model";
import { triangulateControls } from "./linear-terrain";
function cross(a: Point, b: Point, p: TerrainControl) {
  return (b[0] - a[0]) * (p.z - a[1]) - (b[1] - a[1]) * (p.x - a[0]);
}
/** Convex clipping interpolates height on the newly generated control triangle. */
export function clipTriangle(
  input: readonly TerrainControl[],
  clip: readonly Point[],
): TerrainControl[] {
  let output = [...input];
  const sign = area(clip) >= 0 ? 1 : -1;
  for (let i = 0; i < clip.length; i++) {
    const a = clip[i]!,
      b = clip[(i + 1) % clip.length]!;
    const previous = output;
    output = [];
    for (let j = 0; j < previous.length; j++) {
      const p = previous[j]!,
        q = previous[(j + 1) % previous.length]!;
      const dp = sign * cross(a, b, p),
        dq = sign * cross(a, b, q);
      if (dp >= -1e-8) output.push(p);
      if (dp >= 0 !== dq >= 0) {
        const t = dp / (dp - dq);
        output.push({
          x: p.x + (q.x - p.x) * t,
          z: p.z + (q.z - p.z) * t,
          height: p.height + (q.height - p.height) * t,
        });
      }
    }
  }
  return output;
}
/** No source mesh: triangles generated from semantic controls then clipped to semantic land. */
export function linearTerrainPositions(data: SiteData): number[] {
  const positions: number[] = [];
  const triangles = triangulateControls(data.terrainControls);
  for (const region of data.landRegions ?? [data.boundary]) {
    const landTriangles = ShapeUtils.triangulateShape(
      region.map((p) => new Vector2(...p)),
      [],
    );
    for (const t of triangles)
      for (const land of landTriangles) {
        const clipped = clipTriangle(
          t.map((i) => data.terrainControls[i]!),
          land.map((i) => region[i]!),
        );
        for (let i = 1; i < clipped.length - 1; i++) {
          const a = clipped[0]!,
            b = clipped[i]!,
            c = clipped[i + 1]!;
          const signed = (b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z);
          if (Math.abs(signed) < 1e-8) continue;
          for (const p of signed > 0 ? [a, c, b] : [a, b, c])
            positions.push(p.x, p.height, p.z);
        }
      }
  }
  return positions;
}
