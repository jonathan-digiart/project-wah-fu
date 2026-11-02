import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { Box3, Mesh } from "three";
import { area, hasCrossingEdges, inside, parseSiteData } from "./model";
import { createSiteScene } from "./scene";
const path = new URL("../public/site-data.json", import.meta.url);
test("regression: rounding must not introduce self-crossing footprints", () => {
  expect(
    hasCrossingEdges([
      [0, 0],
      [3, 3],
      [0, 4],
      [4, 0],
    ]),
  ).toBe(true);
});
test.skipIf(!existsSync(path))(
  "private supplied parameters generate finite, correctly oriented, bounded clay geometry",
  () => {
    const data = parseSiteData(
      JSON.parse(readFileSync(path, "utf8")) as unknown,
    );
    const { scene, buildings, terrain, dispose } = createSiteScene(data);
    expect(buildings.children).toHaveLength(data.buildings.length);
    for (const b of data.buildings) {
      expect(b.footprint.every((p) => inside(p, data.boundary))).toBe(true);
    }
    scene.traverse((node) => {
      if (node instanceof Mesh) {
        const position = (
          node.geometry as import("three").BufferGeometry
        ).getAttribute("position");
        for (let i = 0; i < position.count; i++)
          expect(
            [position.getX(i), position.getY(i), position.getZ(i)].every(
              Number.isFinite,
            ),
          ).toBe(true);
      }
    });
    const normal = terrain.geometry.getAttribute("normal");
    for (let i = 0; i < normal.count; i++)
      expect(normal.getY(i)).toBeGreaterThan(0);
    const bounds = new Box3().setFromObject(terrain);
    expect(bounds.isEmpty()).toBe(false);
    if (data.landRegions && data.seaRegions) {
      const sum = [...data.landRegions, ...data.seaRegions].reduce(
        (a, p) => a + Math.abs(area(p)),
        0,
      );
      expect(Math.abs(sum - Math.abs(area(data.boundary)))).toBeLessThan(0.1);
    }
    dispose();
  },
);
