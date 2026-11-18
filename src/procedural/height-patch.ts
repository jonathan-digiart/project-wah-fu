import type { GeometryData, HeightPatch } from "./schema";
/** Fritsch-Carlson/PCHIP tangents preserve monotonicity between semantic levels. */
export function pchip(knots: readonly number[], values: readonly number[]) {
  if (
    knots.length < 2 ||
    knots.length !== values.length ||
    ![...knots, ...values].every(Number.isFinite) ||
    knots.some((x, i) => i > 0 && x <= knots[i - 1]!)
  )
    throw new Error("Invalid profile knots");
  const h = knots.slice(1).map((x, i) => x - knots[i]!),
    d = h.map((x, i) => (values[i + 1]! - values[i]!) / x),
    m = new Array<number>(knots.length);
  if (![...h, ...d].every(Number.isFinite))
    throw new Error("Nonfinite profile arithmetic");
  if (knots.length === 2) m.fill(d[0]!);
  else {
    const endpoint = (h0: number, h1: number, d0: number, d1: number) => {
      let slope = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
      if (Math.sign(slope) !== Math.sign(d0)) slope = 0;
      else if (
        Math.sign(d0) !== Math.sign(d1) &&
        Math.abs(slope) > Math.abs(3 * d0)
      )
        slope = 3 * d0;
      return slope;
    };
    m[0] = endpoint(h[0]!, h[1]!, d[0]!, d[1]!);
    const n = h.length;
    m[n] = endpoint(h[n - 1]!, h[n - 2]!, d[n - 1]!, d[n - 2]!);
    for (let i = 1; i < n; i++) {
      const a = d[i - 1]!,
        b = d[i]!;
      if (a === 0 || b === 0 || Math.sign(a) !== Math.sign(b)) m[i] = 0;
      else {
        const w1 = 2 * h[i]! + h[i - 1]!,
          w2 = h[i]! + 2 * h[i - 1]!;
        m[i] = (w1 + w2) / (w1 / a + w2 / b);
      }
    }
  }
  if (!m.every(Number.isFinite)) throw new Error("Nonfinite profile tangents");
  return (x: number) => {
    if (!Number.isFinite(x) || x < knots[0]! - 1e-9 || x > knots.at(-1)! + 1e-9)
      throw new Error("Profile query outside authored domain");
    let i = 0;
    while (i < knots.length - 2 && x > knots[i + 1]!) i++;
    const t = Math.max(0, Math.min(1, (x - knots[i]!) / h[i]!)),
      t2 = t * t,
      t3 = t2 * t;
    const result =
      (2 * t3 - 3 * t2 + 1) * values[i]! +
      (t3 - 2 * t2 + t) * h[i]! * m[i]! +
      (-2 * t3 + 3 * t2) * values[i + 1]! +
      (t3 - t2) * h[i]! * m[i + 1]!;
    if (!Number.isFinite(result)) throw new Error("Nonfinite profile result");
    return result;
  };
}
export function heightSampler(patch: HeightPatch) {
  if (patch.heights.length !== patch.vKnots.length)
    throw new Error("Height rows mismatch");
  const rows = patch.heights.map((row) => pchip(patch.uKnots, row));
  pchip(
    patch.vKnots,
    patch.heights.map((row) => row[0]!),
  );
  const columns = new Map<number, (v: number) => number>();
  return (u: number, v: number) => {
    let column = columns.get(u);
    if (!column) {
      column = pchip(
        patch.vKnots,
        rows.map((row) => row(u)),
      );
      columns.set(u, column);
    }
    return column(v);
  };
}
/** Globally shared row/column refinements avoid T-junctions across adaptive cells.
 * Tolerance is sampled tessellation error, NOT a claimed continuous/source error bound.
 */
export function heightPatchGeometry(patch: HeightPatch): GeometryData {
  const h = heightSampler(patch);
  if (
    !Number.isFinite(patch.tolerance) ||
    patch.tolerance <= 0 ||
    !Number.isSafeInteger(patch.maxTriangles) ||
    patch.maxTriangles < 2
  )
    throw new Error("Invalid height-patch budget");
  if (![...patch.origin, ...patch.uAxis, ...patch.vAxis].every(Number.isFinite))
    throw new Error("Invalid patch frame");
  const determinant =
    patch.uAxis[0] * patch.vAxis[1] - patch.uAxis[1] * patch.vAxis[0];
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-10)
    throw new Error("Degenerate patch frame");
  let us = [...patch.uKnots],
    vs = [...patch.vKnots];
  const sample = (u: number, v: number) => h(u, v);
  for (let pass = 0; pass < 16; pass++) {
    if (2 * (us.length - 1) * (vs.length - 1) > patch.maxTriangles)
      throw new Error("Height patch exceeds triangle budget before tolerance");
    const splitU = new Set<number>(),
      splitV = new Set<number>();
    for (let j = 0; j < vs.length - 1; j++)
      for (let i = 0; i < us.length - 1; i++) {
        const u0 = us[i]!,
          u1 = us[i + 1]!,
          v0 = vs[j]!,
          v1 = vs[j + 1]!;
        const a = sample(u0, v0),
          b = sample(u1, v0),
          c = sample(u0, v1),
          d = sample(u1, v1);
        for (const s of [0, 0.25, 0.5, 0.75, 1])
          for (const t of [0, 0.25, 0.5, 0.75, 1]) {
            const linear =
              s + t <= 1
                ? a + (b - a) * s + (c - a) * t
                : d + (c - d) * (1 - s) + (b - d) * (1 - t);
            if (!Number.isFinite(linear))
              throw new Error("Nonfinite patch interpolation");
            if (
              Math.abs(
                sample(u0 + (u1 - u0) * s, v0 + (v1 - v0) * t) - linear,
              ) > patch.tolerance
            ) {
              splitU.add(i);
              splitV.add(j);
            }
          }
      }
    if (!splitU.size && !splitV.size) {
      const positions = vs.flatMap((v) =>
        us.flatMap((u) => [
          patch.origin[0] + patch.uAxis[0] * u + patch.vAxis[0] * v,
          sample(u, v),
          patch.origin[1] + patch.uAxis[1] * u + patch.vAxis[1] * v,
        ]),
      );
      if (!positions.every(Number.isFinite))
        throw new Error("Nonfinite patch positions");
      const indices: number[] = [];
      for (let j = 0; j < vs.length - 1; j++)
        for (let i = 0; i < us.length - 1; i++) {
          const a = j * us.length + i,
            b = a + 1,
            c = a + us.length,
            d = c + 1;
          indices.push(
            ...(determinant > 0 ? [a, c, b, b, c, d] : [a, b, c, b, d, c]),
          );
        }
      return { positions, indices };
    }
    const refine = (x: number[], selected: Set<number>) =>
      x.flatMap((v, i) => (selected.has(i) ? [v, (v + x[i + 1]!) / 2] : [v]));
    us = refine(us, splitU);
    vs = refine(vs, splitV);
  }
  throw new Error("Height-patch refinement did not converge");
}
