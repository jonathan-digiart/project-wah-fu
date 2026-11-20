import { clipTriangle } from "../terrain-mesh";
import { expect, test } from "vitest";
import { writeFileSync } from "node:fs";
import { authoredCellGeometry } from "./cell-surface";
import {
  WAH_MING_AUTHORED,
  WAH_MING_AUTHORED_OPTIMISED,
} from "./wah-ming-authored";
test("authored cells reconstruct carpark without saved mesh vertices or indices", () => {
  const g = authoredCellGeometry(WAH_MING_AUTHORED);
  expect(g.positions.every(Number.isFinite)).toBe(true);
  if (process.env.WAHFU_EXPORT_GEOMETRY)
    writeFileSync(process.env.WAHFU_EXPORT_GEOMETRY, JSON.stringify(g));
});

test("feature-aware macro cells reduce triangles while retaining every seam station", () => {
  const g = authoredCellGeometry(WAH_MING_AUTHORED_OPTIMISED);
  expect(g.indices.length / 3).toBe(1260);
  if (process.env.WAHFU_EXPORT_GEOMETRY)
    writeFileSync(
      process.env.WAHFU_EXPORT_GEOMETRY.replace(".json", "-optimised.json"),
      JSON.stringify(g),
    );
});

test("optimised surface retains exact boundary topology and stays below10mm everywhere", () => {
  const baseline = authoredCellGeometry(WAH_MING_AUTHORED),
    candidate = authoredCellGeometry(WAH_MING_AUTHORED_OPTIMISED);
  const boundary = (g: typeof baseline) => {
    const edges = new Map<string, number>(),
      faces = new Set<string>(),
      oriented = new Map<string, number>();
    let area = 0;
    for (let i = 0; i < g.indices.length; i += 3) {
      const f = g.indices.slice(i, i + 3);
      const [a, b, c] = f.map(
        (j) => [g.positions[j * 3]!, g.positions[j * 3 + 2]!] as const,
      );
      const signed =
        (b![0] - a![0]) * (c![1] - a![1]) - (b![1] - a![1]) * (c![0] - a![0]);
      expect(signed).toBeLessThan(0);
      area -= signed / 2;
      const key = [...f].sort((a, b) => a - b).join(":");
      expect(faces.has(key)).toBe(false);
      faces.add(key);
      for (let j = 0; j < 3; j++) {
        const edge = [f[j]!, f[(j + 1) % 3]!].sort((a, b) => a - b).join(":");
        oriented.set(
          edge,
          (oriented.get(edge) ?? 0) + (f[j]! < f[(j + 1) % 3]! ? 1 : -1),
        );
        edges.set(edge, (edges.get(edge) ?? 0) + 1);
      }
    }
    for (const [edge, count] of edges)
      expect(Math.abs(oriented.get(edge)!)).toBe(count === 2 ? 0 : 1);
    const outline = WAH_MING_AUTHORED.outline;
    const expectedArea =
      Math.abs(
        outline.reduce((sum, p, i) => {
          const q = outline[(i + 1) % outline.length]!;
          return sum + p[0] * q[1] - p[1] * q[0];
        }, 0),
      ) / 2;
    expect(Math.abs(area - expectedArea)).toBeLessThan(0.001);
    expect([...edges.values()].every((v) => v === 1 || v === 2)).toBe(true);
    expect(g.positions.length / 3 - edges.size + g.indices.length / 3).toBe(1);
    return [...edges]
      .filter(([, count]) => count === 1)
      .map(([key]) =>
        key
          .split(":")
          .map(Number)
          .map((i) => g.positions.slice(i * 3, i * 3 + 3).join(","))
          .sort()
          .join("|"),
      )
      .sort();
  };
  expect(boundary(candidate)).toEqual(boundary(baseline));
  expect(boundary(candidate)).toHaveLength(316);
  const triangles = (g: typeof baseline) =>
    Array.from({ length: g.indices.length / 3 }, (_, i) =>
      g.indices.slice(i * 3, i * 3 + 3).map((j) => ({
        x: g.positions[j * 3]!,
        height: g.positions[j * 3 + 1]!,
        z: g.positions[j * 3 + 2]!,
      })),
    );
  const reference = triangles(baseline);
  let maximum = 0;
  for (const triangle of triangles(candidate))
    for (const source of reference) {
      if (
        Math.max(...triangle.map((p) => p.x)) <
          Math.min(...source.map((p) => p.x)) ||
        Math.min(...triangle.map((p) => p.x)) >
          Math.max(...source.map((p) => p.x)) ||
        Math.max(...triangle.map((p) => p.z)) <
          Math.min(...source.map((p) => p.z)) ||
        Math.min(...triangle.map((p) => p.z)) >
          Math.max(...source.map((p) => p.z))
      )
        continue;
      const [a, b, c] = source;
      const determinant =
        (b!.x - a!.x) * (c!.z - a!.z) - (b!.z - a!.z) * (c!.x - a!.x);
      const dx =
        ((b!.height - a!.height) * (c!.z - a!.z) -
          (c!.height - a!.height) * (b!.z - a!.z)) /
        determinant;
      const dz =
        ((b!.x - a!.x) * (c!.height - a!.height) -
          (c!.x - a!.x) * (b!.height - a!.height)) /
        determinant;
      for (const p of clipTriangle(
        triangle,
        source.map((v) => [v.x, v.z]),
      )) {
        maximum = Math.max(
          maximum,
          Math.abs(
            p.height - a!.height - dx * (p.x - a!.x) - dz * (p.z - a!.z),
          ),
        );
      }
    }
  expect(maximum).toBeLessThan(0.00999);
});

test("invalid edits fail before producing geometry or unbounded grid work", () => {
  expect(() =>
    authoredCellGeometry({ ...WAH_MING_AUTHORED, outline: [] }),
  ).toThrow(/outline/);
  expect(() =>
    authoredCellGeometry({
      ...WAH_MING_AUTHORED,
      step: 0.000001,
      precision: 1e-9,
    }),
  ).toThrow(/budget/);
  expect(() =>
    authoredCellGeometry({
      ...WAH_MING_AUTHORED,
      levels: { "g:0:0:garbage": 0 },
    }),
  ).toThrow(/key/);
  expect(() =>
    authoredCellGeometry({
      outline: [
        [0, 0],
        [1, 0],
        [0.2, 0.2],
        [0, 1],
      ],
      origin: [0, 0],
      step: 1,
      precision: 1e-6,
      levels: { "v:0": 0, "v:1": 0, "v:2": 0, "v:3": 0 },
      boundaryQuadFallingCells: [[0, 0]],
    }),
  ).toThrow(/ridge/);
});
