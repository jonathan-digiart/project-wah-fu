import { describe, expect, it } from "vitest";
import {
  northControls,
  northOutline,
  northSurfaceGeometry,
} from "./north-surface";
import { area, covers } from "../model";
describe("northern construction surface", () => {
  it("generates editable controls and finite, upward, bounded geometry", () => {
    expect(northControls()).toHaveLength(1314);
    const g = northSurfaceGeometry();
    expect(g.positions.every(Number.isFinite)).toBe(true);
    expect(g.indices.length / 3).toBeLessThan(4000);
    let total = 0;
    const edges = new Map<
      string,
      {
        count: number;
        a: readonly [number, number];
        b: readonly [number, number];
      }
    >();
    for (let i = 0; i < g.indices.length; i += 3) {
      const p = g.indices
        .slice(i, i + 3)
        .map((j) => [g.positions[j * 3]!, g.positions[j * 3 + 2]!] as const);
      for (let e = 0; e < 3; e++) {
        const a = p[e]!,
          b = p[(e + 1) % 3]!;
        const key = [a.join(","), b.join(",")].sort().join("|");
        const found = edges.get(key);
        edges.set(key, { count: (found?.count ?? 0) + 1, a, b });
      }
      const a = area(p);
      expect(a).toBeLessThan(0);
      total -= a;
      for (const q of p) expect(covers(q, northOutline, 0.00005)).toBe(true);
    }
    for (const { count, a, b } of edges.values()) {
      expect(count).toBeLessThanOrEqual(2);
      if (count !== 1) continue;
      const p = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const distance = Math.min(
        ...northOutline.map((a, i) => {
          const b = northOutline[(i + 1) % northOutline.length]!,
            dx = b[0] - a[0],
            dz = b[1] - a[1];
          const t = Math.max(
            0,
            Math.min(
              1,
              ((p[0]! - a[0]) * dx + (p[1]! - a[1]) * dz) / (dx * dx + dz * dz),
            ),
          );
          return Math.hypot(p[0]! - a[0] - t * dx, p[1]! - a[1] - t * dz);
        }),
      );
      expect(distance).toBeLessThan(0.00005);
    }
    expect(total).toBeCloseTo(Math.abs(area(northOutline)), 3);
  });
});
