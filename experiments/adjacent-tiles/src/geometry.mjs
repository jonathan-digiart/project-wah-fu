/** Synthetic engineering fixtures ONLY. No site elevations or legacy terrain imports. */
export function createSampler(spec) {
  if (
    spec.kind !== "analytic-fixture" ||
    !["wave", "plane"].includes(spec.fixture)
  )
    throw Error("Unsupported sampler");
  const { minX, maxX, minZ, maxZ } = spec.domain;
  if (
    ![minX, maxX, minZ, maxZ].every(Number.isFinite) ||
    minX >= maxX ||
    minZ >= maxZ
  )
    throw Error("Invalid domain");
  return (x, z) => {
    if (x < minX || x > maxX || z < minZ || z > maxZ)
      throw Error("Outside sampler domain");
    return spec.fixture === "plane"
      ? 0.1 * x + 0.03 * z
      : 3 * Math.sin(x / 23) * Math.cos(z / 31) + 0.015 * x;
  };
}
const power2 = (n) => Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
/** Global coordinates, y up. Dense canonical perimeter, sparse conforming interior centre fans.
 * Adapted conceptually from recovered adaptive-terrain.ts; no runtime dependency on that release.
 * Tile boundaries use (tile * N + local)/N * size, never independently accumulated origins.
 */
export function buildTile({
  x,
  z,
  tileSize = 64,
  latticeSegments = 64,
  interiorSegments = 8,
  origin = [0, 0],
  sampler,
}) {
  const N = latticeSegments,
    n = interiorSegments;
  if (
    ![x, z].every(Number.isSafeInteger) ||
    !Number.isInteger(tileSize) ||
    tileSize < 1 ||
    !power2(N) ||
    N > 256 ||
    !power2(n) ||
    n > N
  )
    throw Error("Invalid tile grid");
  if (origin.length !== 2 || !origin.every(Number.isFinite))
    throw Error("Invalid origin");
  const sample = createSampler(sampler),
    positions = [],
    indices = [],
    cache = new Map(),
    cells = [];
  const add = (u, v) => {
    const key = `${u},${v}`;
    if (cache.has(key)) return cache.get(key);
    const wx = origin[0] + ((x * N + u) / N) * tileSize,
      wz = origin[1] + ((z * N + v) / N) * tileSize;
    const id = positions.length / 3;
    positions.push(wx, sample(wx, wz), wz);
    cache.set(key, id);
    return id;
  };
  const s = N / n;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const u = i * s,
        v = j * s,
        ring = [];
      const edge = (a, b, c, d, steps) => {
        for (let k = 0; k < steps; k++)
          ring.push(add(a + ((c - a) * k) / steps, b + ((d - b) * k) / steps));
      };
      edge(u, v, u + s, v, j === 0 ? s : 1);
      edge(u + s, v, u + s, v + s, i === n - 1 ? s : 1);
      edge(u + s, v + s, u, v + s, j === n - 1 ? s : 1);
      edge(u, v + s, u, v, i === 0 ? s : 1);
      const center = add(u + s / 2, v + s / 2),
        start = indices.length;
      // Clockwise in x/z produces upward-facing y normals.
      for (let k = 0; k < ring.length; k++)
        indices.push(center, ring[(k + 1) % ring.length], ring[k]);
      cells.push(start, indices.length);
    }
  const edges = {};
  for (const [side, coordinate] of Object.entries({
    west: (k) => [0, k],
    east: (k) => [N, k],
    south: (k) => [k, 0],
    north: (k) => [k, N],
  }))
    edges[side] = Uint32Array.from(
      Array.from({ length: N + 1 }, (_, k) => add(...coordinate(k))),
    );
  const data = {
    x,
    z,
    origin,
    tileSize,
    latticeSegments: N,
    interiorSegments: n,
    positions: Float32Array.from(positions),
    indices: Uint32Array.from(indices),
    cells: Uint32Array.from(cells),
    edges,
  };
  data.bytes =
    data.positions.byteLength +
    data.indices.byteLength +
    data.cells.byteLength +
    Object.values(edges).reduce((sum, a) => sum + a.byteLength, 0);
  return data;
}
/** Query the actual render triangles, not the analytic sampler. Half-open tile ownership is external. */
export function heightOnTile(data, x, z) {
  const {
    tileSize: S,
    interiorSegments: n,
    positions: p,
    indices: ix,
    cells,
  } = data;
  const u = (x - data.origin[0] - data.x * S) / S,
    v = (z - data.origin[1] - data.z * S) / S;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  const c =
    (Math.min(n - 1, Math.floor(v * n)) * n +
      Math.min(n - 1, Math.floor(u * n))) *
    2;
  for (let k = cells[c]; k < cells[c + 1]; k += 3) {
    const a = ix[k] * 3,
      b = ix[k + 1] * 3,
      d = ix[k + 2] * 3;
    const den =
      (p[b + 2] - p[d + 2]) * (p[a] - p[d]) +
      (p[d] - p[b]) * (p[a + 2] - p[d + 2]);
    const wa =
      ((p[b + 2] - p[d + 2]) * (x - p[d]) + (p[d] - p[b]) * (z - p[d + 2])) /
      den;
    const wb =
      ((p[d + 2] - p[a + 2]) * (x - p[d]) + (p[a] - p[d]) * (z - p[d + 2])) /
      den;
    if (wa >= -1e-10 && wb >= -1e-10 && wa + wb <= 1 + 1e-10)
      return wa * p[a + 1] + wb * p[b + 1] + (1 - wa - wb) * p[d + 1];
  }
  return null;
}
export function transferables(data) {
  return [
    data.positions.buffer,
    data.indices.buffer,
    data.cells.buffer,
    ...Object.values(data.edges).map((a) => a.buffer),
  ];
}
