import type { TerrainControl } from "./model";
type Triangle = readonly [number, number, number];
interface Circle {
  x: number;
  z: number;
  radiusSquared: number;
}
function circle(
  a: TerrainControl,
  b: TerrainControl,
  c: TerrainControl,
): Circle | undefined {
  const d = 2 * (a.x * (b.z - c.z) + b.x * (c.z - a.z) + c.x * (a.z - b.z));
  if (Math.abs(d) < 1e-12) return undefined;
  const aa = a.x * a.x + a.z * a.z,
    bb = b.x * b.x + b.z * b.z,
    cc = c.x * c.x + c.z * c.z;
  const x = (aa * (b.z - c.z) + bb * (c.z - a.z) + cc * (a.z - b.z)) / d;
  const z = (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / d;
  return { x, z, radiusSquared: (x - a.x) ** 2 + (z - a.z) ** 2 };
}
/** Bowyer–Watson on semantic anchors, not source triangles. Deterministic input order. */
export function triangulateControls(
  input: readonly TerrainControl[],
): Triangle[] {
  if (input.length < 3) return [];
  const points = [...input];
  const minX = Math.min(...points.map((p) => p.x)),
    maxX = Math.max(...points.map((p) => p.x));
  const minZ = Math.min(...points.map((p) => p.z)),
    maxZ = Math.max(...points.map((p) => p.z));
  const span = Math.max(maxX - minX, maxZ - minZ, 1),
    x = (minX + maxX) / 2,
    z = (minZ + maxZ) / 2;
  const n = points.length;
  points.push(
    { x: x - 32 * span, z: z - span, height: 0 },
    { x, z: z + 32 * span, height: 0 },
    { x: x + 32 * span, z: z - span, height: 0 },
  );
  let triangles: Triangle[] = [[n, n + 1, n + 2]];
  for (let i = 0; i < n; i++) {
    const p = points[i]!;
    const bad = new Set<Triangle>();
    const edges = new Map<
      string,
      { edge: readonly [number, number]; count: number }
    >();
    for (const t of triangles) {
      const circum = circle(points[t[0]]!, points[t[1]]!, points[t[2]]!);
      if (
        circum &&
        (p.x - circum.x) ** 2 + (p.z - circum.z) ** 2 <=
          circum.radiusSquared + 1e-8
      ) {
        bad.add(t);
        for (const edge of [
          [t[0], t[1]],
          [t[1], t[2]],
          [t[2], t[0]],
        ] as const) {
          const key = [...edge].sort((a, b) => a - b).join(":");
          const prior = edges.get(key);
          edges.set(key, { edge, count: (prior?.count ?? 0) + 1 });
        }
      }
    }
    triangles = triangles.filter((t) => !bad.has(t));
    for (const { edge, count } of edges.values())
      if (count === 1 && circle(points[edge[0]]!, points[edge[1]]!, p))
        triangles.push([edge[0], edge[1], i]);
  }
  return triangles.filter((t) => t.every((i) => i < n));
}
export function createLinearTerrain(
  controls: readonly TerrainControl[],
  fallback: (x: number, z: number) => number,
) {
  const triangles = triangulateControls(controls);
  const sample = (x: number, z: number): number | undefined => {
    for (const t of triangles) {
      const a = controls[t[0]]!,
        b = controls[t[1]]!,
        c = controls[t[2]]!;
      const denominator = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
      if (Math.abs(denominator) < 1e-12) continue;
      const u =
        ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / denominator;
      const v =
        ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / denominator;
      const w = 1 - u - v;
      if (u >= -1e-9 && v >= -1e-9 && w >= -1e-9)
        return u * a.height + v * b.height + w * c.height;
    }
    return undefined;
  };
  return {
    triangles,
    sample,
    heightAt: (x: number, z: number) => sample(x, z) ?? fallback(x, z),
  };
}
