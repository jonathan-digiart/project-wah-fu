import type { TerrainControl } from "../model";
type Triangle = readonly [number, number, number];
/** Predicate fallback on a one-nanometre authoring grid, avoiding unstable circumcentre division. */
export function triangulateHeightControls(
  input: readonly TerrainControl[],
): Triangle[] {
  if (input.length < 3) return [];
  const minX = Math.min(...input.map((p) => p.x)),
    maxX = Math.max(...input.map((p) => p.x)),
    minZ = Math.min(...input.map((p) => p.z)),
    maxZ = Math.max(...input.map((p) => p.z));
  const span = Math.max(maxX - minX, maxZ - minZ, 1),
    x = (minX + maxX) / 2,
    z = (minZ + maxZ) / 2,
    n = input.length;
  const points = [
    ...input,
    { x: x - 32 * span, z: z - span, height: 0 },
    { x: x + 32 * span, z: z - span, height: 0 },
    { x, z: z + 32 * span, height: 0 },
  ];
  const exact = points.map(
    (p) =>
      [
        BigInt(Math.round((p.x - minX) * 1e9)),
        BigInt(Math.round((p.z - minZ) * 1e9)),
      ] as const,
  );
  const orientation = (a: number, b: number, c: number) => {
    const p = exact[a]!,
      q = exact[b]!,
      r = exact[c]!;
    const d = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    return d > 0n ? 1 : d < 0n ? -1 : 0;
  };
  const contains = (t: Triangle, i: number) => {
    const p = points[i]!,
      a = points[t[0]]!,
      b = points[t[1]]!,
      c = points[t[2]]!;
    const ax = a.x - p.x,
      ay = a.z - p.z,
      bx = b.x - p.x,
      by = b.z - p.z,
      cx = c.x - p.x,
      cy = c.z - p.z;
    const v1 = (ax * ax + ay * ay) * (bx * cy - by * cx),
      v2 = (bx * bx + by * by) * (ax * cy - ay * cx),
      v3 = (cx * cx + cy * cy) * (ax * by - ay * bx),
      det = v1 - v2 + v3;
    if (Math.abs(det) > 1e-12 * (Math.abs(v1) + Math.abs(v2) + Math.abs(v3)))
      return det > 0;
    const q = exact[i]!,
      aa = exact[t[0]]!,
      bb = exact[t[1]]!,
      cc = exact[t[2]]!;
    const A = aa[0] - q[0],
      B = aa[1] - q[1],
      C = bb[0] - q[0],
      D = bb[1] - q[1],
      E = cc[0] - q[0],
      F = cc[1] - q[1];
    return (
      (A * A + B * B) * (C * F - D * E) -
        (C * C + D * D) * (A * F - B * E) +
        (E * E + F * F) * (A * D - B * C) >=
      0n
    );
  };
  let triangles: Triangle[] = [[n, n + 1, n + 2]];
  for (let i = 0; i < n; i++) {
    const bad = new Set<Triangle>(),
      edges = new Map<
        string,
        { edge: readonly [number, number]; count: number }
      >();
    for (const t of triangles)
      if (contains(t, i)) {
        bad.add(t);
        for (const edge of [
          [t[0], t[1]],
          [t[1], t[2]],
          [t[2], t[0]],
        ] as const) {
          const key = [...edge].sort((a, b) => a - b).join(":");
          edges.set(key, { edge, count: (edges.get(key)?.count ?? 0) + 1 });
        }
      }
    triangles = triangles.filter((t) => !bad.has(t));
    for (const { edge, count } of edges.values())
      if (count === 1) {
        const sign = orientation(edge[0], edge[1], i);
        if (sign)
          triangles.push(
            sign > 0 ? [edge[0], edge[1], i] : [edge[1], edge[0], i],
          );
      }
  }
  return triangles.filter((t) => t.every((i) => i < n));
}
