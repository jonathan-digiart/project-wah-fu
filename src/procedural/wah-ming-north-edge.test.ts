import { describe, expect, it } from "vitest";
import { authoredCellGeometry } from "./cell-surface";
import { WAH_MING_AUTHORED_OPTIMISED } from "./wah-ming-authored";
import {
  WAH_MING_NORTH_EDGE,
  wahMingNorthBank,
  wahMingNorthWall,
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
