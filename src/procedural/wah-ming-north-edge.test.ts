import { BufferAttribute, BufferGeometry, Mesh } from "three";
import { describe, expect, it } from "vitest";
import { ComponentRegistry } from "./registry";
import { authoredCellGeometry } from "./cell-surface";
import { WAH_MING_AUTHORED_OPTIMISED } from "./wah-ming-authored";
import {
  WAH_MING_NORTH_EDGE,
  wahMingNorthBank,
  wahMingNorthWall,
  wahMingNorthWallWithEastReturn,
} from "./wah-ming-north-edge";

describe("Wah Ming north edge", () => {
  it("joins the full straight kerb to a two-metre bank using shared Float32 crest stations", () => {
    const wall = wahMingNorthWall();
    const bank = wahMingNorthBank();
    expect(wall.indices).toHaveLength(39);
    expect(bank.indices).toHaveLength(54);
    const n = WAH_MING_NORTH_EDGE.breaklines.length;
    const w = Float32Array.from(wall.positions);
    const b = Float32Array.from(bank.positions);
    for (let i = 0; i < n; i++)
      expect(w.slice(i * 3, i * 3 + 3)).toEqual(b.slice(i * 6, i * 6 + 3));
    expect(w[(n - 1) * 3]! - w[0]!).toBeCloseTo(19.79, 5);
    expect(b[2]! - b[5]!).toBe(2);
  });

  it("keeps a coincident hard corner and generates only the reference-owned return", () => {
    const straight = wahMingNorthWall();
    const withReturn = wahMingNorthWallWithEastReturn();
    expect(withReturn.positions.slice(0, 45)).toEqual(straight.positions);
    expect(withReturn.indices.slice(0, 39)).toEqual(straight.indices);
    expect(withReturn.indices.slice(39)).toEqual([
      17, 15, 16, 17, 16, 18, 19, 17, 18, 19, 18, 20,
    ]);
    const p = Float32Array.from(withReturn.positions);
    expect(p.slice(45, 48)).toEqual(p.slice(27, 30));
    expect(p.slice(48, 51)).toEqual(p.slice(42, 45));
    for (const i of [9, 14, 15, 16, 17, 18, 19, 20])
      expect(p[i * 3]).toBe(Math.fround(92.8));
    expect(p[17 * 3 + 2]).toBe(-245.5);
    expect(p[19 * 3 + 2]).toBe(-245.4364013671875);
    expect(p[17 * 3 + 1]!).toBeGreaterThan(p[18 * 3 + 1]!);
    expect(p[19 * 3 + 1]!).toBeGreaterThan(p[20 * 3 + 1]!);
  });

  it("preserves original wall normals and gives the return its own -X normals in the registry", () => {
    const registry = new ComponentRegistry();
    const normalArray = (generate: typeof wahMingNorthWall) => {
      registry.replace(
        {
          id: "test-wall",
          label: "Test wall",
          kind: "construction-surface",
          source: "Unit test",
          confidence: "reference-derived",
          generate,
        },
        "retainingWall",
      );
      const wall = registry.group.children[0];
      if (!(wall instanceof Mesh))
        throw new Error("Missing registry wall mesh");
      expect(registry.group.children).toHaveLength(1);
      const geometry: unknown = wall.geometry;
      if (!(geometry instanceof BufferGeometry))
        throw new Error("Missing registry buffer geometry");
      const normal: unknown = geometry.getAttribute("normal");
      if (!(normal instanceof BufferAttribute))
        throw new Error("Missing registry wall normals");
      const values: unknown = normal.array;
      if (!(values instanceof Float32Array))
        throw new Error("Expected Float32 registry wall normals");
      return Array.from(values);
    };
    try {
      const normalBefore = normalArray(wahMingNorthWall);
      const normalAfter = normalArray(wahMingNorthWallWithEastReturn);
      expect(normalAfter.slice(0, normalBefore.length)).toEqual(normalBefore);
      for (let i = normalBefore.length; i < normalAfter.length; i += 3)
        expect(normalAfter.slice(i, i + 3)).toEqual([-1, 0, 0]);
    } finally {
      registry.dispose();
    }
  });

  it("retains the accepted parking contact through all generated paving edge stations", () => {
    const { wallFoot, breaklines, northing } = WAH_MING_NORTH_EDGE;
    const interpolate = (
      stations: readonly (readonly [number, number])[],
      x: number,
    ) => {
      for (let i = 1; i < stations.length; i++) {
        const [x0, y0] = stations[i - 1]!.map(Math.fround);
        const [x1, y1] = stations[i]!.map(Math.fround);
        if (x <= x1!) return y0! + ((y1! - y0!) * (x - x0!)) / (x1! - x0!);
      }
      throw Error("Out of verified kerb span");
    };
    const crest = breaklines.map(({ crest }) => crest);
    const paving = Float32Array.from(
      authoredCellGeometry(WAH_MING_AUTHORED_OPTIMISED).positions,
    );
    let stations = 0;
    for (let i = 0; i < paving.length; i += 3) {
      if (paving[i + 2] !== Math.fround(northing)) continue;
      const [x, y] = paving.slice(i, i + 2);
      const offset = y! - interpolate(wallFoot, x!);
      expect(Math.abs(offset - 0.025)).toBeLessThan(0.001);
      expect(interpolate(crest, x!) - y!).toBeGreaterThan(0.3);
      stations++;
    }
    expect(stations).toBe(15);
  });
});
