import { expect, test } from "vitest";
import { writeFileSync } from "node:fs";
import { r06SurfaceGeometry, r06SurfaceOrigin } from "./r06-surface";
for (const part of [0, 1] as const)
  test(`R06 top ${part} remains finite and bounded`, () => {
    const g = r06SurfaceGeometry(part);
    expect(g.positions.every(Number.isFinite)).toBe(true);
    expect(g.indices.length / 3).toBeLessThan(800);
    expect(g.indices.length).toBeGreaterThan(0);
    let projectedArea = 0;
    for (let i = 0; i < g.indices.length; i += 3) {
      const q = g.indices
        .slice(i, i + 3)
        .map((j) => g.positions.slice(j * 3, j * 3 + 3));
      const a = q[0]!,
        b = q[1]!,
        c = q[2]!;
      const u = b.map((v, j) => v - a[j]!),
        v = c.map((x, j) => x - a[j]!);
      const n = [
        u[1]! * v[2]! - u[2]! * v[1]!,
        u[2]! * v[0]! - u[0]! * v[2]!,
        u[0]! * v[1]! - u[1]! * v[0]!,
      ];
      expect(n[1]!).toBeGreaterThan(2e-8);
      expect(Math.hypot(n[0]!, n[2]!) / n[1]!).toBeLessThan(0.11);
      projectedArea += n[1]! / 2;
    }
    expect(projectedArea).toBeCloseTo(part === 0 ? 153.9396 : 10.31869, 2);
    if (process.env.R06_EXPORT)
      writeFileSync(
        `/tmp/wah-fu-r06-${part}.json`,
        JSON.stringify({ ...g, origin: r06SurfaceOrigin }),
      );
  });
