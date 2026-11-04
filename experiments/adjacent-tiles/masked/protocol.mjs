import { clipTile, heightOnMaskedTile, prepareMask } from "./clip.mjs";
export const MASKED = "semantic-masked-triangles-v1";
export const MASK_LIMITS = Object.freeze({
  vertices: 100000,
  triangles: 32768,
  maskTriangles: 4096,
  bytes: 8 * 1024 * 1024,
  coordinate: 1e7,
});
const check = (v, s) => {
  if (!v) throw Error(s);
};
const arrays = (d) => [
  d.positions,
  d.indices,
  d.sourceFacets,
  d.maskTriangles,
  d.tileBounds,
];
export const maskedTransfers = (d) => arrays(d).map((a) => a.buffer);
export function buildMasked(tile, mask) {
  check(
    Array.isArray(mask) && mask.length <= MASK_LIMITS.maskTriangles,
    "Mask metadata limit",
  );
  check(
    tile.positions instanceof Float32Array &&
      tile.positions.length <= MASK_LIMITS.vertices * 3 &&
      tile.indices instanceof Uint32Array &&
      tile.indices.length <= MASK_LIMITS.triangles * 3,
    "Source geometry limit",
  );
  for (const m of mask)
    check(
      m?.points?.length === 3 &&
        m.points.every(
          (p) =>
            Array.isArray(p) &&
            p.length === 2 &&
            p.every(
              (v) =>
                Number.isFinite(v) && Math.abs(v) <= MASK_LIMITS.coordinate,
            ),
        ),
      "Invalid source mask",
    );
  mask = prepareMask(mask.map((m) => m.points));
  const clipped = clipTile(tile, mask);
  const d = {
    geometryKind: MASKED,
    positions: clipped.positions,
    indices: clipped.indices,
    sourceFacets: clipped.sourceFacets,
    maskTriangles: Float64Array.from(mask.flatMap((m) => m.points.flat())),
    tileBounds: Float64Array.from(clipped.tileBounds),
  };
  d.bytes = arrays(d).reduce((n, a) => n + a.byteLength, 0);
  validateMasked(d);
  return d;
}
export function validateMasked(d) {
  check(d?.geometryKind === MASKED, "Invalid masked kind");
  const allowed = [
    "geometryKind",
    "positions",
    "indices",
    "sourceFacets",
    "maskTriangles",
    "tileBounds",
    "bytes",
  ];
  check(
    Object.keys(d).length === allowed.length &&
      Object.keys(d).every((k) => allowed.includes(k)),
    "Unexpected masked metadata",
  );
  check(
    d.positions instanceof Float32Array &&
      d.indices instanceof Uint32Array &&
      d.sourceFacets instanceof Uint32Array &&
      d.maskTriangles instanceof Float64Array &&
      d.tileBounds instanceof Float64Array,
    "Invalid masked arrays",
  );
  check(
    !("cells" in d) && !("edges" in d),
    "Masked geometry cannot carry grid fields",
  );
  check(
    d.positions.length % 3 === 0 &&
      d.positions.length <= MASK_LIMITS.vertices * 3,
    "Masked vertex limit",
  );
  check(
    d.indices.length % 3 === 0 &&
      d.indices.length <= MASK_LIMITS.triangles * 3 &&
      d.sourceFacets.length === d.indices.length / 3,
    "Masked triangle limit",
  );
  check(
    d.maskTriangles.length % 6 === 0 &&
      d.maskTriangles.length <= MASK_LIMITS.maskTriangles * 6,
    "Mask metadata limit",
  );
  check(d.tileBounds.length === 4, "Invalid bounds");
  const finite = (n) =>
    Number.isFinite(n) && Math.abs(n) <= MASK_LIMITS.coordinate;
  for (const a of arrays(d))
    check(
      a.buffer instanceof ArrayBuffer &&
        a.byteOffset === 0 &&
        a.byteLength === a.buffer.byteLength,
      "Expected dedicated masked buffer",
    );
  check(new Set(maskedTransfers(d)).size === 5, "Aliased masked buffers");
  for (const a of [d.positions, d.maskTriangles, d.tileBounds])
    for (const v of a) check(finite(v), "Invalid masked coordinate");
  const [l, r, s, n] = d.tileBounds;
  check(l < r && s < n, "Invalid tile extent");
  for (let i = 0; i < d.positions.length; i += 3)
    check(
      d.positions[i] >= l &&
        d.positions[i] <= r &&
        d.positions[i + 2] >= s &&
        d.positions[i + 2] <= n,
      "Vertex outside tile",
    );
  for (const i of d.indices)
    check(i < d.positions.length / 3, "Masked index out of range");
  for (let k = 0; k < d.indices.length; k += 3) {
    const [a, b, c] = Array.from(d.indices.slice(k, k + 3), (i) => i * 3),
      p = d.positions;
    check(
      (p[b] - p[a]) * (p[c + 2] - p[a + 2]) -
        (p[b + 2] - p[a + 2]) * (p[c] - p[a]) <
        -1e-12,
      "Masked winding or degeneracy",
    );
  }
  for (let k = 0; k < d.maskTriangles.length; k += 6) {
    const p = d.maskTriangles;
    check(
      (p[k + 2] - p[k]) * (p[k + 5] - p[k + 1]) -
        (p[k + 3] - p[k + 1]) * (p[k + 4] - p[k]) >
        1e-12,
      "Mask triangle winding or degeneracy",
    );
  }
  check(
    Number.isSafeInteger(d.bytes) &&
      d.bytes === arrays(d).reduce((n, a) => n + a.byteLength, 0) &&
      d.bytes <= MASK_LIMITS.bytes,
    "Invalid masked byte accounting",
  );
  return d;
}
export function maskedHeight(d, x, z) {
  // Metadata remains packed in transfers; this bounded local adapter supplies the query API.
  const triangles = [];
  for (let k = 0; k < d.maskTriangles.length; k += 6)
    triangles.push([
      [d.maskTriangles[k], d.maskTriangles[k + 1]],
      [d.maskTriangles[k + 2], d.maskTriangles[k + 3]],
      [d.maskTriangles[k + 4], d.maskTriangles[k + 5]],
    ]);
  return heightOnMaskedTile({ ...d, mask: prepareMask(triangles) }, x, z);
}
