import { expect, test } from "vitest";
import { CD_OWNER_GRID } from "./cd-owner-data";
import { terrainGridGeometry } from "./terrain-grid";

test("generates only the accepted C-side pilot without bridging D", () => {
  const { positions, indices } = terrainGridGeometry(CD_OWNER_GRID);
  expect(positions.length / 3).toBe(297);
  expect(indices.length / 3).toBe(512);
  expect(Math.max(...positions.filter((_, i) => i % 3 === 0))).toBeLessThan(
    375.5,
  );
});
