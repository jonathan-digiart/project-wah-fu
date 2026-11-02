import { createLinearTerrain } from "./linear-terrain";
import { linearTerrainPositions } from "./terrain-mesh";
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { Box3, Mesh } from "three";
import { area, hasCrossingEdges, covers, parseSiteData } from "./model";
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
      expect(b.footprint.every((p) => covers(p, data.boundary))).toBe(true);
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

test.skipIf(!existsSync(path))(
  "linear private terrain matches independently computed predictions and covers land",
  () => {
    const data = parseSiteData(
      JSON.parse(readFileSync(path, "utf8")) as unknown,
    );
    if (data.interpolation !== "linear") return;
    const linear = createLinearTerrain(data.terrainControls, () => Number.NaN);
    const samples = data.provenance.independentSamples as
      { x: number; z: number; contourHeight: number }[] | undefined;
    expect(samples?.length).toBeGreaterThan(0);
    for (const sample of samples ?? [])
      expect(linear.heightAt(sample.x, sample.z)).toBeCloseTo(
        sample.contourHeight,
        4,
      );
    const vertices = linearTerrainPositions(data);
    let total = 0;
    for (let i = 0; i < vertices.length; i += 9) {
      const ax = vertices[i]!,
        az = vertices[i + 2]!,
        bx = vertices[i + 3]!,
        bz = vertices[i + 5]!,
        cx = vertices[i + 6]!,
        cz = vertices[i + 8]!;
      total += Math.abs((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) / 2;
    }
    const expected = (data.landRegions ?? [data.boundary]).reduce(
      (sum, p) => sum + Math.abs(area(p)),
      0,
    );
    expect(Math.abs(total - expected)).toBeLessThan(0.01);
  },
);

test.skipIf(!existsSync(path))(
  "private context inventory is complete and approved exclusions remain excluded",
  () => {
    const data = parseSiteData(
      JSON.parse(readFileSync(path, "utf8")) as unknown,
    );
    const audit = data.provenance.contextMassing as
      | {
          expectedSourceIds: string[];
          approvedExcludedSourceIds: string[];
          expectedComponentCount: number;
          retainedCourtyardCount: number;
        }
      | undefined;
    if (!audit) return;
    const parts = data.buildings.filter((b) => b.category === "context");
    const actual = [...new Set(parts.map((b) => b.sourceId ?? b.id))].sort();
    expect(actual).toEqual([...audit.expectedSourceIds].sort());
    expect(parts).toHaveLength(audit.expectedComponentCount);
    expect(parts.reduce((count, b) => count + (b.holes?.length ?? 0), 0)).toBe(
      audit.retainedCourtyardCount,
    );
    for (const id of audit.approvedExcludedSourceIds)
      expect(actual).not.toContain(id);
  },
);
