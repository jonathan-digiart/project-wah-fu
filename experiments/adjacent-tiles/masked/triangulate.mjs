import { ShapeUtils, Vector2 } from "three";
import { prepareMask } from "./clip.mjs";
/** Copy first: ShapeUtils may remove closure points in its private input arrays. */
export function normalizeRing(ring) {
  if (!Array.isArray(ring)) throw Error("Invalid polygon ring");
  const out = [];
  for (const p of ring) {
    if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))
      throw Error("Invalid polygon point");
    if (!out.length || p[0] !== out.at(-1)[0] || p[1] !== out.at(-1)[1])
      out.push([p[0], p[1]]);
  }
  while (
    out.length > 1 &&
    out[0][0] === out.at(-1)[0] &&
    out[0][1] === out.at(-1)[1]
  )
    out.pop();
  if (out.length < 3) throw Error("Degenerate polygon ring");
  const seen = new Set();
  for (const p of out) {
    const key = JSON.stringify(p);
    if (seen.has(key)) throw Error("Nonconsecutive repeated polygon vertex");
    seen.add(key);
  }
  const area = out.reduce((s, p, i) => {
    const q = out[(i + 1) % out.length];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0);
  if (Math.abs(area) < 1e-12) throw Error("Degenerate polygon ring");
  return out;
}
export function triangulateRegions(regions) {
  return prepareMask(
    regions.flatMap((region) => {
      const outer = normalizeRing(
          Array.isArray(region) ? region : region.outer,
        ),
        holes = (region.holes ?? []).map(normalizeRing);
      const points = [outer, ...holes].flat();
      return ShapeUtils.triangulateShape(
        outer.map((p) => new Vector2(...p)),
        holes.map((r) => r.map((p) => new Vector2(...p))),
      ).map((t) => t.map((i) => points[i]));
    }),
  );
}
