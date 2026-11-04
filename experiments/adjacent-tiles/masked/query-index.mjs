import { validateMasked } from "./protocol.mjs";
export const QUERY_LIMITS = Object.freeze({
  binsPerAxis: 64,
  entries: 1048576,
  bytes: 8 * 1024 * 1024,
});
const cross = (ax, az, bx, bz, cx, cz) =>
  (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
function buildBins(data, count, coordinates, tolerance, n, remaining) {
  const [l, r, s, t] = data.tileBounds,
    w = r - l,
    h = t - s,
    bins = n * n,
    counts = new Uint32Array(bins),
    ranges = new Int32Array(count * 4);
  let entries = 0;
  for (let id = 0; id < count; id++) {
    const [ax, az, bx, bz, cx, cz] = coordinates(id),
      minX = Math.min(ax, bx, cx),
      maxX = Math.max(ax, bx, cx),
      minZ = Math.min(az, bz, cz),
      maxZ = Math.max(az, bz, cz);
    const den = Math.abs(cross(ax, az, bx, bz, cx, cz)),
      tol = tolerance === "mask" ? 1e-9 / den : 1e-8;
    // Include the exhaustive query's relaxed barycentric/half-plane acceptance band.
    const round =
      Number.EPSILON *
      Math.max(
        1,
        Math.abs(ax),
        Math.abs(az),
        Math.abs(bx),
        Math.abs(bz),
        Math.abs(cx),
        Math.abs(cz),
      ) *
      64;
    const px = 3 * tol * (maxX - minX) + round,
      pz = 3 * tol * (maxZ - minZ) + round;
    if (maxX + px < l || minX - px > r || maxZ + pz < s || minZ - pz > t) {
      ranges[id * 4] = -1;
      continue;
    }
    const ix0 = Math.max(
        0,
        Math.min(n - 1, Math.floor(((minX - px - l) / w) * n)),
      ),
      ix1 = Math.max(0, Math.min(n - 1, Math.floor(((maxX + px - l) / w) * n))),
      iz0 = Math.max(0, Math.min(n - 1, Math.floor(((minZ - pz - s) / h) * n))),
      iz1 = Math.max(0, Math.min(n - 1, Math.floor(((maxZ + pz - s) / h) * n)));
    ranges.set([ix0, ix1, iz0, iz1], id * 4);
    entries += (ix1 - ix0 + 1) * (iz1 - iz0 + 1);
    if (entries > remaining) throw Error("Query index entry limit");
    for (let z = iz0; z <= iz1; z++)
      for (let x = ix0; x <= ix1; x++) counts[z * n + x]++;
  }
  const offsets = new Uint32Array(bins + 1);
  for (let i = 0; i < bins; i++) offsets[i + 1] = offsets[i] + counts[i];
  const ids = new Uint32Array(entries),
    cursor = offsets.slice(0, bins);
  for (let id = 0; id < count; id++) {
    const [a, b, c, d] = ranges.subarray(id * 4, id * 4 + 4);
    if (a < 0) continue;
    for (let z = c; z <= d; z++)
      for (let x = a; x <= b; x++) ids[cursor[z * n + x]++] = id;
  }
  return { offsets, ids };
}
export function buildQueryIndex(
  data,
  { maxEntries = QUERY_LIMITS.entries } = {},
) {
  if (
    !Number.isInteger(maxEntries) ||
    maxEntries < 0 ||
    maxEntries > QUERY_LIMITS.entries
  )
    throw Error("Invalid query entry budget");
  validateMasked(data);
  const p = data.positions,
    ix = data.indices,
    m = data.maskTriangles;
  const n = Math.max(
    1,
    Math.min(
      QUERY_LIMITS.binsPerAxis,
      Math.ceil(Math.sqrt(Math.max(1, ix.length / 3) / 8)),
    ),
  );
  const triangles = buildBins(
    data,
    ix.length / 3,
    (id) => {
      const a = ix[id * 3] * 3,
        b = ix[id * 3 + 1] * 3,
        c = ix[id * 3 + 2] * 3;
      return [p[a], p[a + 2], p[b], p[b + 2], p[c], p[c + 2]];
    },
    "terrain",
    n,
    maxEntries,
  );
  const mask = buildBins(
    data,
    m.length / 6,
    (id) => Array.from(m.subarray(id * 6, id * 6 + 6)),
    "mask",
    n,
    maxEntries - triangles.ids.length,
  );
  const bytes =
    triangles.offsets.byteLength +
    triangles.ids.byteLength +
    mask.offsets.byteLength +
    mask.ids.byteLength;
  if (bytes > QUERY_LIMITS.bytes) throw Error("Query index byte limit");
  const index = { data, n, triangles, mask, bytes };
  validateQueryIndex(index);
  return index;
}
/** Built internally at prepare time; no per-query allocation or rebuilding. */
export function indexedHeight(index, x, z) {
  const { data, n, triangles, mask } = index,
    bounds = data.tileBounds,
    l = bounds[0],
    r = bounds[1],
    s = bounds[2],
    t = bounds[3];
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(z) ||
    x < l ||
    x > r ||
    z < s ||
    z > t
  )
    return null;
  const bin =
      Math.min(n - 1, Math.floor(((z - s) / (t - s)) * n)) * n +
      Math.min(n - 1, Math.floor(((x - l) / (r - l)) * n)),
    m = data.maskTriangles;
  let land = false;
  for (let j = mask.offsets[bin]; j < mask.offsets[bin + 1]; j++) {
    const k = mask.ids[j] * 6,
      ax = m[k],
      az = m[k + 1],
      bx = m[k + 2],
      bz = m[k + 3],
      cx = m[k + 4],
      cz = m[k + 5];
    if (
      cross(ax, az, bx, bz, x, z) >= -1e-9 &&
      cross(bx, bz, cx, cz, x, z) >= -1e-9 &&
      cross(cx, cz, ax, az, x, z) >= -1e-9
    ) {
      land = true;
      break;
    }
  }
  if (!land) return null;
  const p = data.positions,
    ix = data.indices;
  for (let j = triangles.offsets[bin]; j < triangles.offsets[bin + 1]; j++) {
    const k = triangles.ids[j] * 3,
      a = ix[k] * 3,
      b = ix[k + 1] * 3,
      c = ix[k + 2] * 3,
      ax = p[a],
      az = p[a + 2],
      bx = p[b],
      bz = p[b + 2],
      cx = p[c],
      cz = p[c + 2],
      den = cross(ax, az, bx, bz, cx, cz),
      u = cross(bx, bz, cx, cz, x, z) / den,
      v = cross(cx, cz, ax, az, x, z) / den;
    if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8)
      return u * p[a + 1] + v * p[b + 1] + (1 - u - v) * p[c + 1];
  }
  return null;
}

export function validateQueryIndex(index) {
  const { data, n, triangles, mask, bytes } = index;
  if (!Number.isInteger(n) || n < 1 || n > QUERY_LIMITS.binsPerAxis)
    throw Error("Invalid query grid");
  let total = 0,
    entries = 0;
  const buffers = new Set();
  for (const [group, count] of [
    [triangles, data.indices.length / 3],
    [mask, data.maskTriangles.length / 6],
  ]) {
    if (
      !(group.offsets instanceof Uint32Array) ||
      !(group.ids instanceof Uint32Array) ||
      group.offsets.length !== n * n + 1 ||
      group.offsets[0] !== 0 ||
      group.offsets.at(-1) !== group.ids.length
    )
      throw Error("Invalid query offsets");
    for (const a of [group.offsets, group.ids]) {
      if (
        !(a.buffer instanceof ArrayBuffer) ||
        a.byteOffset !== 0 ||
        a.byteLength !== a.buffer.byteLength ||
        buffers.has(a.buffer)
      )
        throw Error("Invalid query buffer");
      buffers.add(a.buffer);
      total += a.byteLength;
    }
    for (let bin = 0; bin < n * n; bin++) {
      const start = group.offsets[bin],
        end = group.offsets[bin + 1];
      if (end < start || end > group.ids.length)
        throw Error("Invalid query range");
      let previous = -1;
      for (let j = start; j < end; j++) {
        const id = group.ids[j];
        if (id >= count || id <= previous)
          throw Error("Invalid query triangle id");
        previous = id;
      }
    }
    entries += group.ids.length;
  }
  if (
    total !== bytes ||
    total > QUERY_LIMITS.bytes ||
    entries > QUERY_LIMITS.entries
  )
    throw Error("Invalid query index bytes");
  return index;
}
