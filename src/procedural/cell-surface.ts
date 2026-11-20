import { ShapeUtils, Vector2 } from "three";
import { area, covers, hasCrossingEdges, type Point } from "../model";
import type { GeometryData } from "./schema";
export interface AuthoredCellSurface {
  outline: readonly Point[];
  origin: Point;
  step: number;
  precision: number;
  levels: Readonly<Record<string, number>>;
  maxCells?: number;
  boundaryQuadFallingCells?: readonly Point[];
  macroCells?: readonly {
    originCell: Point;
    spanCells: Point;
    centreHeight: number;
  }[];
}
const cross = (a: Point, b: Point, c: Point) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
/** Reconstructs clipped-grid cells and levels from authoring keys, never source faces. */
export function authoredCellGeometry(input: AuthoredCellSurface): GeometryData {
  const { outline, origin, step, precision } = input;
  if (
    !Number.isFinite(step) ||
    step <= 0 ||
    !Number.isFinite(precision) ||
    precision < 1e-9 ||
    precision >= step
  )
    throw new Error("Invalid authoring grid");
  if (
    outline.length < 3 ||
    outline.length > 2048 ||
    ![...origin, ...outline.flat()].every(Number.isFinite) ||
    hasCrossingEdges(outline) ||
    !Number.isFinite(area(outline)) ||
    Math.abs(area(outline)) < precision * precision
  )
    throw new Error("Invalid authored outline");
  if (
    [...origin, ...outline.flat()].some(
      (x) => Math.abs(x / precision) > Number.MAX_SAFE_INTEGER,
    )
  )
    throw new Error("Authoring coordinates exceed precision range");
  const maxCells = input.maxCells ?? 20000;
  if (!Number.isSafeInteger(maxCells) || maxCells < 1 || maxCells > 100000)
    throw new Error("Invalid cell budget");
  const snap = (p: Point): Point => [
    Math.round(p[0] / precision) * precision,
    Math.round(p[1] / precision) * precision,
  ];
  const key = (p: Point) => p.map((x) => Math.round(x / precision)).join(",");
  const minX = Math.min(...outline.map((p) => p[0])),
    maxX = Math.max(...outline.map((p) => p[0])),
    minZ = Math.min(...outline.map((p) => p[1])),
    maxZ = Math.max(...outline.map((p) => p[1]));
  const cellCount =
    (Math.ceil((maxX - origin[0]) / step) -
      Math.floor((minX - origin[0]) / step)) *
    (Math.ceil((maxZ - origin[1]) / step) -
      Math.floor((minZ - origin[1]) / step));
  if (!Number.isSafeInteger(cellCount) || cellCount > maxCells)
    throw new Error("Authored surface exceeds cell budget");
  if (
    [minX, maxX].some(
      (x) => !Number.isSafeInteger(Math.floor((x - origin[0]) / step)),
    ) ||
    [minZ, maxZ].some(
      (z) => !Number.isSafeInteger(Math.floor((z - origin[1]) / step)),
    )
  )
    throw new Error("Authoring grid index outside safe range");
  const snappedOutline = outline.map(snap);
  if (
    new Set(snappedOutline.map(key)).size !== outline.length ||
    hasCrossingEdges(snappedOutline)
  )
    throw new Error("Snapped outline is invalid");
  for (let i = 0; i < snappedOutline.length; i++) {
    const p = snappedOutline[i]!;
    for (let j = 0; j < snappedOutline.length; j++) {
      if (j === i || (j + 1) % snappedOutline.length === i) continue;
      const a = snappedOutline[j]!,
        b = snappedOutline[(j + 1) % snappedOutline.length]!;
      if (
        Math.abs(cross(a, b, p)) <= precision * precision &&
        p[0] >= Math.min(a[0], b[0]) &&
        p[0] <= Math.max(a[0], b[0]) &&
        p[1] >= Math.min(a[1], b[1]) &&
        p[1] <= Math.max(a[1], b[1])
      )
        throw new Error("Authored outline touches itself");
    }
  }
  const levels = new Map<string, number>();
  for (const [name, height] of Object.entries(input.levels)) {
    if (!/^(g:-?\d+:-?\d+|v:\d+|e:\d+:[xz]:-?\d+)$/.test(name))
      throw new Error("Invalid semantic level key");
    const parts = name.split(":"),
      k = Number(parts[1]);
    if (
      !Number.isSafeInteger(k) ||
      (parts[0] !== "g" && (k < 0 || k >= outline.length))
    )
      throw new Error("Invalid semantic level index");
    if (
      parts[0] !== "v" &&
      !Number.isSafeInteger(Number(parts[parts[0] === "g" ? 2 : 3]))
    )
      throw new Error("Invalid semantic level index");
    let p: Point;
    if (parts[0] === "g")
      p = [origin[0] + step * k, origin[1] + step * Number(parts[2])];
    else if (parts[0] === "v") p = outline[k]!;
    else if (parts[0] === "e") {
      const a = outline[k]!,
        b = outline[(k + 1) % outline.length]!,
        axis = parts[2] === "x" ? 0 : 1,
        coordinate = origin[axis] + step * Number(parts[3]);
      const t = (coordinate - a[axis]) / (b[axis] - a[axis]);
      if (!Number.isFinite(t) || t < -1e-8 || t > 1 + 1e-8)
        throw new Error("Level intersection falls outside edge");
      p = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    } else throw new Error("Unknown level key");
    if (!p || ![...p, height].every(Number.isFinite))
      throw new Error("Invalid authored level");
    const prior = levels.get(key(p));
    if (prior !== undefined && Math.abs(prior - height) > 1e-5)
      throw new Error("Conflicting authored levels");
    levels.set(key(p), height);
  }
  const positions: number[] = [],
    indices: number[] = [],
    vertexMap = new Map<string, number>();
  const append = (ring: Point[], faces: number[][]) => {
    const vertexIndices = ring.map((p) => {
      const k = key(p);
      let id = vertexMap.get(k);
      if (id !== undefined) return id;
      const height = levels.get(k);
      if (height === undefined)
        throw new Error(`Missing semantic level at ${k}`);
      id = positions.length / 3;
      const q = snap(p);
      positions.push(Math.fround(q[0]), Math.fround(height), Math.fround(q[1]));
      vertexMap.set(k, id);
      return id;
    });
    for (const face of faces) {
      const plan = face.map((i) => ring[i]!);
      if (Math.abs(area(plan)) < 1e-9) continue;
      indices.push(
        ...(area(plan) > 0 ? [face[0]!, face[2]!, face[1]!] : face).map(
          (i) => vertexIndices[i]!,
        ),
      );
    }
  };
  const skipped = new Set<string>();
  const macros: { ring: Point[]; centre: Point; height: number }[] = [];
  for (const m of input.macroCells ?? []) {
    const [i, j] = m.originCell,
      [w, h] = m.spanCells;
    if (
      ![i, j, w, h].every(Number.isSafeInteger) ||
      w < 1 ||
      h < 1 ||
      w * h > maxCells ||
      !Number.isSafeInteger(i + w) ||
      !Number.isSafeInteger(j + h) ||
      !Number.isFinite(m.centreHeight)
    )
      throw new Error("Invalid macro cell");
    for (let x = i; x < i + w; x++)
      for (let z = j; z < j + h; z++) {
        const k = `${x},${z}`;
        if (skipped.has(k)) throw new Error("Overlapping macro cells");
        skipped.add(k);
        if (skipped.size > maxCells)
          throw new Error("Macro cells exceed cell budget");
      }
    const point = (x: number, z: number): Point => [
      origin[0] + x * step,
      origin[1] + z * step,
    ];
    const ring: Point[] = [];
    for (let x = i; x < i + w; x++) ring.push(point(x, j));
    for (let z = j; z < j + h; z++) ring.push(point(i + w, z));
    for (let x = i + w; x > i; x--) ring.push(point(x, j + h));
    for (let z = j + h; z > j; z--) ring.push(point(i, z));
    const centre = point(i + w / 2, j + h / 2);
    if (
      !ring.every((p) => covers(p, outline)) ||
      !covers(centre, outline) ||
      outline.some(
        (p) =>
          p[0] > origin[0] + i * step + precision &&
          p[0] < origin[0] + (i + w) * step - precision &&
          p[1] > origin[1] + j * step + precision &&
          p[1] < origin[1] + (j + h) * step - precision,
      )
    )
      throw new Error("Macro cell crosses a feature boundary");
    macros.push({ ring, centre, height: m.centreHeight });
  }
  const signed = area(outline) > 0 ? 1 : -1;
  for (
    let i = Math.floor((minX - origin[0]) / step);
    i < Math.ceil((maxX - origin[0]) / step);
    i++
  )
    for (
      let j = Math.floor((minZ - origin[1]) / step);
      j < Math.ceil((maxZ - origin[1]) / step);
      j++
    ) {
      if (skipped.has(`${i},${j}`)) continue;
      const x0 = origin[0] + i * step,
        x1 = x0 + step,
        z0 = origin[1] + j * step,
        z1 = z0 + step;
      const corners: Point[] = [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
      ];
      const edges = new Map<string, { a: Point; b: Point }>();
      const add = (a: Point, b: Point) => {
        a = snap(a);
        b = snap(b);
        if (key(a) !== key(b)) edges.set(`${key(a)}|${key(b)}`, { a, b });
      };
      const intersections: Point[] = [];
      for (let k = 0; k < outline.length; k++) {
        const a = outline[k]!,
          b = outline[(k + 1) % outline.length]!,
          dx = b[0] - a[0],
          dz = b[1] - a[1];
        let lo = 0,
          hi = 1,
          valid = true;
        for (const [p, q] of [
          [-dx, a[0] - x0],
          [dx, x1 - a[0]],
          [-dz, a[1] - z0],
          [dz, z1 - a[1]],
        ] as const) {
          if (Math.abs(p) < 1e-15) {
            if (q < 0) valid = false;
          } else {
            const t = q / p;
            if (p < 0) lo = Math.max(lo, t);
            else hi = Math.min(hi, t);
          }
        }
        if (!valid || lo > hi + 1e-12) continue;
        const p = snap([a[0] + lo * dx, a[1] + lo * dz]),
          q = snap([a[0] + hi * dx, a[1] + hi * dz]);
        intersections.push(p, q);
        const onSameSide =
          (Math.abs(p[0] - q[0]) < precision / 2 &&
            (Math.abs(p[0] - x0) < precision / 2 ||
              Math.abs(p[0] - x1) < precision / 2)) ||
          (Math.abs(p[1] - q[1]) < precision / 2 &&
            (Math.abs(p[1] - z0) < precision / 2 ||
              Math.abs(p[1] - z1) < precision / 2));
        if (!onSameSide) {
          if (signed > 0) add(p, q);
          else add(q, p);
        }
      }
      for (let side = 0; side < 4; side++) {
        const a = corners[side]!,
          b = corners[(side + 1) % 4]!,
          dx = b[0] - a[0],
          dz = b[1] - a[1];
        const points = [
          a,
          b,
          ...intersections.filter(
            (p) =>
              Math.abs(cross(a, b, p)) < step * precision &&
              p[0] >= x0 - precision &&
              p[0] <= x1 + precision &&
              p[1] >= z0 - precision &&
              p[1] <= z1 + precision,
          ),
        ].sort((p, q) => (p[0] - q[0]) * dx + (p[1] - q[1]) * dz);
        for (let k = 0; k < points.length - 1; k++) {
          const p = points[k]!,
            q = points[k + 1]!;
          if (
            key(p) !== key(q) &&
            covers(
              [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2],
              outline,
              precision / 10,
            )
          )
            add(p, q);
        }
      }
      while (edges.size) {
        const first = edges.values().next().value!,
          ring = [first.a];
        let current = first.a;
        const budget = edges.size + 1;
        for (let count = 0; count < budget; count++) {
          const found = [...edges.entries()].find(
            ([, e]) => key(e.a) === key(current),
          );
          if (!found) throw new Error(`Cell boundary failed at ${i},${j}`);
          edges.delete(found[0]);
          current = found[1].b;
          if (key(current) === key(ring[0]!)) break;
          ring.push(current);
        }
        if (key(current) !== key(ring[0]!))
          throw new Error("Unclosed authored cell");
        if (ring.length < 3 || Math.abs(area(ring)) < 1e-9) continue;
        // The source authoring rule uses the rising diagonal on complete cells.
        if (
          ring.length === 4 &&
          corners.every((p) => ring.some((q) => key(p) === key(q)))
        )
          append(corners, [
            [0, 1, 2],
            [0, 2, 3],
          ]);
        else if (ring.length === 4 && input.boundaryQuadFallingCells) {
          const sign = input.boundaryQuadFallingCells.some(
            ([x, z]) => x === i && z === j,
          )
            ? -1
            : 1;
          const diagonal = (a: number, b: number) =>
            (ring[b]![0] - ring[a]![0]) * (ring[b]![1] - ring[a]![1]);
          const faces =
            diagonal(0, 2) * sign > 0
              ? [
                  [0, 1, 2],
                  [0, 2, 3],
                ]
              : diagonal(1, 3) * sign > 0
                ? [
                    [0, 1, 3],
                    [1, 2, 3],
                  ]
                : undefined;
          if (!faces) throw new Error("Ambiguous authored ridge diagonal");
          const signedArea = area(ring),
            areas = faces.map((f) => area(f.map((k) => ring[k]!)));
          if (
            areas.some((a) => a * signedArea <= 0) ||
            Math.abs(
              areas.reduce((sum, a) => sum + Math.abs(a), 0) -
                Math.abs(signedArea),
            ) > 1e-8
          )
            throw new Error("Authored ridge falls outside the polygon");
          append(ring, faces);
        } else append(ring, constrainedFaces(ring));
      }
    }
  for (const { ring, centre, height } of macros) {
    levels.set(key(centre), height);
    const n = ring.length;
    append(
      [...ring, centre],
      ring.map((_, i) => [i, (i + 1) % n, n]),
    );
  }
  if (!positions.every(Number.isFinite))
    throw new Error("Nonfinite GPU positions");
  const gpuKeys = new Set<string>();
  for (let i = 0; i < positions.length; i += 3) {
    const k = positions.slice(i, i + 3).join(",");
    if (gpuKeys.has(k))
      throw new Error("GPU precision collapses distinct vertices");
    gpuKeys.add(k);
  }
  for (let i = 0; i < indices.length; i += 3) {
    const face = indices
      .slice(i, i + 3)
      .map((j) => [positions[j * 3]!, positions[j * 3 + 2]!] as Point);
    if (!(cross(face[0]!, face[1]!, face[2]!) < 0))
      throw new Error("GPU precision collapses or reverses face");
  }
  return { positions, indices };
}
/** Earcut seeds a valid polygon triangulation; local flips restore constrained Delaunay. */
function constrainedFaces(points: Point[]): number[][] {
  const faces = ShapeUtils.triangulateShape(
    points.map((p) => new Vector2(...p)),
    [],
  ).map((f) =>
    cross(points[f[0]!]!, points[f[1]!]!, points[f[2]!]!) > 0
      ? f
      : [f[0]!, f[2]!, f[1]!],
  );
  for (let pass = 0; pass < points.length * points.length; pass++) {
    const edges = new Map<
      string,
      { face: number; a: number; b: number; c: number }
    >();
    let changed = false;
    outer: for (let k = 0; k < faces.length; k++)
      for (let e = 0; e < 3; e++) {
        const f = faces[k]!,
          a = f[e]!,
          b = f[(e + 1) % 3]!,
          c = f[(e + 2) % 3]!,
          key = [a, b].sort((x, y) => x - y).join(":");
        const prior = edges.get(key);
        if (!prior) {
          edges.set(key, { face: k, a, b, c });
          continue;
        }
        const d = prior.c,
          A = points[a]!,
          B = points[b]!,
          C = points[c]!,
          D = points[d]!;
        if (cross(C, D, A) * cross(C, D, B) >= -1e-14) continue;
        const ax = A[0] - D[0],
          az = A[1] - D[1],
          bx = B[0] - D[0],
          bz = B[1] - D[1],
          cx = C[0] - D[0],
          cz = C[1] - D[1];
        const determinant =
          (ax * ax + az * az) * (bx * cz - bz * cx) -
          (bx * bx + bz * bz) * (ax * cz - az * cx) +
          (cx * cx + cz * cz) * (ax * bz - az * bx);
        if (determinant <= 1e-10) continue;
        const make = (x: number, y: number, z: number) =>
          cross(points[x]!, points[y]!, points[z]!) > 0 ? [x, y, z] : [x, z, y];
        faces[k] = make(c, d, a);
        faces[prior.face] = make(d, c, b);
        changed = true;
        break outer;
      }
    if (!changed) return faces;
  }
  throw new Error("Constrained triangulation did not converge");
}
