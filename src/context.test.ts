import { expect, test } from "vitest";
import { BoxGeometry, Mesh, MeshStandardMaterial } from "three";
import {
  groupBuildingRecords,
  parseSiteData,
  covers,
  type SiteData,
  type Building,
} from "./model";
import { createSiteScene } from "./scene";
import { highlightSelection, setContextVisible } from "./view";
const building: Building = {
  id: "school-part1",
  sourceId: "school",
  category: "context",
  group: "School campus",
  boundaryRelation: "partial",
  name: "School part",
  footprint: [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ],
  holes: [
    [
      [3, 3],
      [7, 3],
      [7, 7],
      [3, 7],
    ],
  ],
  base: 10,
  height: 20,
  uncertainty: "Synthetic courtyard fixture",
};
test("multipart review groups preserve component identity without counting them as extra source buildings", () => {
  const grouped = groupBuildingRecords([
    building,
    { ...building, id: "school-part2" },
  ]);
  expect(grouped).toHaveLength(1);
  expect(grouped[0]?.parts).toHaveLength(2);
  expect(grouped[0]?.category).toBe("context");
});
test("courtyard remains open in generated roof and partial-boundary points are retained", () => {
  const data: SiteData = {
    boundary: [
      [0, 0],
      [20, 0],
      [20, 20],
      [0, 20],
    ],
    buildings: [building],
    terrainControls: [{ x: 0, z: 0, height: 0 }],
    provenance: { synthetic: true },
  };
  expect(covers([0, 5], data.boundary)).toBe(true);
  expect(covers([-1, 5], data.boundary)).toBe(false);
  const { buildings, dispose } = createSiteScene(parseSiteData(data));
  const geometry = (buildings.children[0] as Mesh).geometry;
  const p = geometry.getAttribute("position");
  let area = 0;
  for (let i = 0; i < p.count; i += 3) {
    if ([i, i + 1, i + 2].every((j) => Math.abs(p.getY(j) - 30) < 1e-6)) {
      area +=
        Math.abs(
          (p.getX(i + 1) - p.getX(i)) * (p.getZ(i + 2) - p.getZ(i)) -
            (p.getX(i + 2) - p.getX(i)) * (p.getZ(i + 1) - p.getZ(i)),
        ) / 2;
    }
  }
  expect(area).toBeCloseTo(84, 5);
  dispose();
});
test("invalid external courtyard is rejected", () => {
  expect(() =>
    parseSiteData({
      boundary: [
        [0, 0],
        [20, 0],
        [20, 20],
      ],
      buildings: [
        {
          ...building,
          holes: [
            [
              [11, 11],
              [12, 11],
              [12, 12],
            ],
          ],
        },
      ],
      terrainControls: [{ x: 0, z: 0, height: 0 }],
      provenance: { synthetic: true },
    }),
  ).toThrow();
});
test("context filter and source selection affect all parts but preserve estate visibility", () => {
  const geometry = new BoxGeometry(),
    base = new MeshStandardMaterial(),
    selected = new MeshStandardMaterial();
  const estate = new Mesh(geometry, base),
    a = new Mesh(geometry, base),
    b = new Mesh(geometry, base);
  estate.userData = { id: "estate", category: "estate" };
  a.userData = { id: "a", reviewId: "campus", category: "context" };
  b.userData = { id: "b", reviewId: "campus", category: "context" };
  const meshes = [estate, a, b];
  setContextVisible(meshes, false);
  expect(estate.visible).toBe(true);
  expect(a.visible).toBe(false);
  expect(b.visible).toBe(false);
  setContextVisible(meshes, true);
  highlightSelection(
    meshes,
    new Map(meshes.map((mesh) => [mesh, base])),
    selected,
    "campus",
  );
  expect(a.material).toBe(selected);
  expect(b.material).toBe(selected);
  expect(estate.material).toBe(base);
  geometry.dispose();
  base.dispose();
  selected.dispose();
});
