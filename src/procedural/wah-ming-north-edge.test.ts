import { describe, expect, it } from "vitest";
import { authoredCellGeometry } from "./cell-surface";
import { WAH_MING_AUTHORED_OPTIMISED } from "./wah-ming-authored";
import {
  WAH_MING_NORTH_EDGE,
  wahMingNorthBank,
  wahMingNorthWall,
} from "./wah-ming-north-edge";

describe("Wah Ming north edge", () => {
  it("uses six triangles per part and gives the bank and wall the exact same Float32 seam", () => {
    const wall = wahMingNorthWall();
    const bank = wahMingNorthBank();
    expect(wall.indices).toHaveLength(18);
    expect(bank.indices).toHaveLength(18);
    for (let i = 0; i < wall.positions.length; i += 6) {
      expect(Float32Array.from(wall.positions.slice(i, i + 3))).toEqual(
        Float32Array.from(bank.positions.slice(i, i + 3)),
      );
    }
  });

  it("contacts the unchanged parking surface at every shared station", () => {
    const wall = Float32Array.from(wahMingNorthWall().positions);
    const paving = Float32Array.from(
      authoredCellGeometry(WAH_MING_AUTHORED_OPTIMISED).positions,
    );
    for (let i = 0; i < wall.length; i += 6) {
      let y: number | undefined;
      for (let j = 0; j < paving.length; j += 3) {
        if (wall[i] === paving[j] && wall[i + 2] === paving[j + 2])
          y = paving[j + 1];
      }
      expect(y).toBeDefined();
      expect(y! - wall[i + 4]!).toBeCloseTo(0.025, 5);
      expect(y!).toBeLessThan(wall[i + 1]!);
    }
    expect(WAH_MING_NORTH_EDGE.bankDepth).toBe(1);
  });
});
