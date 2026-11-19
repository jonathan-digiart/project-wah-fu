import { Box3 } from "three";
import { expect, test } from "vitest";
import { BUILDING_ENVELOPES } from "./building-envelopes";
import { ComponentRegistry } from "./registry";
import { wahMingPlan, WAH_MING_GRADED_PAVING } from "./wah-ming";
test("semantic envelope inventory generates independently under budget", () => {
  const registry = new ComponentRegistry(20_000);
  for (const b of BUILDING_ENVELOPES)
    registry.replace({
      id: b.id,
      label: b.name,
      kind: "footprint",
      outline: b.footprint,
      ...(b.holes ? { holes: b.holes } : {}),
      base: b.base,
      height: b.height,
      source: "earlier semantic scaffold",
      confidence: "reference-derived",
    });
  const buildings = registry.stats();
  registry.replace(wahMingPlan(0));
  const report = {
    buildingComponents: buildings.length,
    buildingTriangles: buildings.reduce((s, x) => s + x.triangles, 0),
    carparkPlanTriangles: registry.stats().at(-1)!.triangles,
    totalVertices: registry.stats().reduce((s, x) => s + x.vertices, 0),
    positionIndexBytes: registry
      .stats()
      .reduce((s, x) => s + x.geometryBytes, 0),
  };
  expect(report.buildingTriangles).toBe(5804);
  expect(report.carparkPlanTriangles).toBe(146);
  expect(buildings).toHaveLength(124);
  expect(report.buildingTriangles).toBeLessThan(20_000);
  registry.dispose();
});

test("overview uses the accepted graded paving without a scene offset", () => {
  const registry = new ComponentRegistry();
  expect(registry.replace(WAH_MING_GRADED_PAVING, "paving").triangles).toBe(
    1260,
  );
  const mesh = registry.group.children[0]!;
  expect(mesh.position.toArray()).toEqual([0, 0, 0]);
  const bounds = new Box3().setFromObject(mesh);
  // v128 WAH_MING_SKETCH_TOP bounds, from the SHA-verified published GLB.
  expect(bounds.min.toArray()).toEqual(
    [70.387465, 17.589914, -246.49997].map(Math.fround),
  );
  expect(bounds.max.toArray()).toEqual(
    [119.9, 21.025515, -186.1].map(Math.fround),
  );
  registry.dispose();
});
