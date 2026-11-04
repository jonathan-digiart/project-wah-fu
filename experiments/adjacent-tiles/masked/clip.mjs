/** Experimental semantic-mask clipping. Input mask triangles must form a disjoint partition. */
const cross = (a, b, c) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const key = (p) => `${p[0]},${p[1]}`;
const stable = (n) => Math.round(n * 1e9) / 1e9;
export const canonicalFloat32 = (n) => Math.fround(stable(n));
const bounds = (t) => [
  Math.min(...t.map((p) => p[0])),
  Math.max(...t.map((p) => p[0])),
  Math.min(...t.map((p) => p[1])),
  Math.max(...t.map((p) => p[1])),
];
const overlap = (a, b) =>
  a[0] <= b[1] && a[1] >= b[0] && a[2] <= b[3] && a[3] >= b[2];
function intersection(p, q, a, b) {
  if (key(p) > key(q)) [p, q] = [q, p];
  if (key(a) > key(b)) [a, b] = [b, a];
  const dp = cross(a, b, p),
    dq = cross(a, b, q),
    t = dp / (dp - dq);
  return [stable(p[0] + (q[0] - p[0]) * t), stable(p[1] + (q[1] - p[1]) * t)];
}
function clip(subject, mask) {
  let poly = subject;
  for (let j = 0; j < 3; j++) {
    const a = mask[j],
      b = mask[(j + 1) % 3],
      out = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i],
        q = poly[(i + 1) % poly.length],
        pin = cross(a, b, p) >= -1e-10,
        qin = cross(a, b, q) >= -1e-10;
      if (pin) out.push(p);
      if (pin !== qin) out.push(intersection(p, q, a, b));
    }
    poly = out.filter(
      (p, i) =>
        i === 0 ||
        Math.hypot(p[0] - out[i - 1][0], p[1] - out[i - 1][1]) > 1e-9,
    );
    if (
      poly.length > 1 &&
      Math.hypot(poly[0][0] - poly.at(-1)[0], poly[0][1] - poly.at(-1)[1]) <=
        1e-9
    )
      poly.pop();
    if (poly.length < 3) return [];
  }
  return poly;
}
export function prepareMask(triangles) {
  return triangles.map((t) => {
    if (t.length !== 3 || !t.flat().every(Number.isFinite))
      throw Error("Invalid mask triangle");
    t = t.map((p) => p.slice());
    if (cross(...t) < 0) t.reverse();
    if (Math.abs(cross(...t)) < 1e-12) throw Error("Degenerate mask triangle");
    return { points: t, bounds: bounds(t) };
  });
}
export function containsMask(mask, x, z) {
  return mask.some(({ points: t }) =>
    t.every((a, i) => cross(a, t[(i + 1) % 3], [x, z]) >= -1e-9),
  );
}
function height(t, p) {
  const den = cross(t[0], t[1], t[2]),
    a = cross(t[1], t[2], p) / den,
    b = cross(t[2], t[0], p) / den;
  return a * t[0][2] + b * t[1][2] + (1 - a - b) * t[2][2];
}
/** No source sampler, heightmap or original mesh is required after this call. */
export function clipTile(tile, mask) {
  const positions = [],
    indices = [],
    sourceFacets = [],
    cache = new Map(),
    p = tile.positions,
    ix = tile.indices;
  const xmin = Math.fround(tile.origin[0] + tile.x * tile.tileSize),
    xmax = Math.fround(tile.origin[0] + (tile.x + 1) * tile.tileSize),
    zmin = Math.fround(tile.origin[1] + tile.z * tile.tileSize),
    zmax = Math.fround(tile.origin[1] + (tile.z + 1) * tile.tileSize);
  function add(v, t) {
    const x = canonicalFloat32(v[0]),
      z = canonicalFloat32(v[1]);
    let y;
    // Shared canonical perimeter segments are identical for every interior LOD.
    for (let i = 0; i < 3; i++) {
      const a = t[i],
        b = t[(i + 1) % 3];
      if (
        (a[0] === b[0] &&
          (a[0] === xmin || a[0] === xmax) &&
          Math.abs(x - a[0]) < 1e-6) ||
        (a[1] === b[1] &&
          (a[1] === zmin || a[1] === zmax) &&
          Math.abs(z - a[1]) < 1e-6)
      ) {
        let u = a,
          w = b;
        if (key(u) > key(w)) [u, w] = [w, u];
        const f =
          u[0] === w[0]
            ? (z - u[1]) / (w[1] - u[1])
            : (x - u[0]) / (w[0] - u[0]);
        y = u[2] + (w[2] - u[2]) * f;
        break;
      }
    }
    y = canonicalFloat32(y ?? height(t, [x, z]));
    const k = `${x},${y},${z}`;
    if (!cache.has(k)) {
      cache.set(k, positions.length / 3);
      positions.push(x, y, z);
    }
    return cache.get(k);
  }
  let candidates = 0;
  for (let k = 0; k < ix.length; k += 3) {
    const t = Array.from(ix.slice(k, k + 3), (i) => [
        p[i * 3],
        p[i * 3 + 2],
        p[i * 3 + 1],
      ]),
      bb = bounds(t);
    for (const m of mask) {
      if (!overlap(bb, m.bounds)) continue;
      candidates++;
      const poly = clip(t, m.points);
      if (poly.length < 3) continue;
      const ids = poly.map((v) => add(v, t));
      for (let j = 1; j < ids.length - 1; j++) {
        const a = ids[0],
          b = ids[j],
          c = ids[j + 1],
          area =
            (positions[b * 3] - positions[a * 3]) *
              (positions[c * 3 + 2] - positions[a * 3 + 2]) -
            (positions[b * 3 + 2] - positions[a * 3 + 2]) *
              (positions[c * 3] - positions[a * 3]);
        if (Math.abs(area) <= 1e-12) continue;
        indices.push(...(area < 0 ? [a, b, c] : [a, c, b]));
        sourceFacets.push(k / 3);
      }
    }
  }
  const data = {
    positions: Float32Array.from(positions),
    indices: Uint32Array.from(indices),
    sourceFacets: Uint32Array.from(sourceFacets),
    mask,
    tileBounds: [xmin, xmax, zmin, zmax],
    stats: {
      sourceTriangles: ix.length / 3,
      clippedTriangles: indices.length / 3,
      candidates,
    },
  };
  data.bytes =
    data.positions.byteLength +
    data.indices.byteLength +
    data.sourceFacets.byteLength;
  return data;
}
export function heightOnMaskedTile(data, x, z) {
  const [a, b, c, d] = data.tileBounds;
  if (x < a || x > b || z < c || z > d || !containsMask(data.mask, x, z))
    return null;
  const p = data.positions,
    ix = data.indices;
  for (let k = 0; k < ix.length; k += 3) {
    const t = Array.from(ix.slice(k, k + 3), (i) => [
        p[i * 3],
        p[i * 3 + 2],
        p[i * 3 + 1],
      ]),
      den = cross(...t),
      u = cross(t[1], t[2], [x, z]) / den,
      v = cross(t[2], t[0], [x, z]) / den;
    if (u >= -1e-8 && v >= -1e-8 && u + v <= 1 + 1e-8) return height(t, [x, z]);
  }
  return null;
}
export function transferables(data) {
  return [data.positions.buffer, data.indices.buffer, data.sourceFacets.buffer];
}
