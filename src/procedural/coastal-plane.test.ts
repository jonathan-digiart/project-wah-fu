import { expect, test } from "vitest";
import { coastalPlaneGeometry } from "./coastal-plane";

test("the separately generated tiles share the full seam without overlap", () => {
  const [west, east] = coastalPlaneGeometry();
  const seam = (positions: number[]) =>
    Array.from({ length: positions.length / 3 }, (_, i) =>
      positions.slice(i * 3, i * 3 + 3),
    )
      .filter(([x]) => x === 300)
      .sort((a, b) => a[2]! - b[2]!);

  expect(west!.indices).toHaveLength(6);
  expect(east!.indices).toHaveLength(6);
  expect(seam(west!.positions)).toEqual([
    [300, 1.3, 78],
    [300, 1.3, 120],
  ]);
  expect(seam(east!.positions)).toEqual(seam(west!.positions));
  expect(Math.max(...west!.positions.filter((_, i) => i % 3 === 0))).toBe(300);
  expect(Math.min(...east!.positions.filter((_, i) => i % 3 === 0))).toBe(300);
});
