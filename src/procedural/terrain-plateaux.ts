import { terrainGridGeometry } from "./terrain-grid";

/** Plan bounds and a single accepted-model datum per flat experiment.
 * No source triangulation or runtime asset references are retained. */
export const TERRAIN_PLATEAUX = [
  { name: "coastal-01", x: [96, 584], z: [120, 294], level: 1.3 },
  { name: "coastal-02", x: [96, 200], z: [114, 120], level: 1.3 },
  { name: "coastal-03", x: [305, 584], z: [114, 120], level: 1.3 },
  { name: "coastal-04", x: [-164, -16], z: [-206, 42], level: 1.3 },
  { name: "coastal-05", x: [-12, 92], z: [-26, 206], level: 1.3 },
  { name: "upland-06", x: [456, 540], z: [-70, -42], level: 7.26 },
  { name: "upland-07", x: [416, 488], z: [-18, -2], level: 7.26 },
  { name: "upland-08", x: [404, 508], z: [-242, -230], level: 33.2 },
  { name: "upland-09", x: [384, 416], z: [-526, -498], level: 63.35 },
  { name: "upland-10", x: [416, 440], z: [-494, -462], level: 63.35 },
  { name: "upland-11", x: [216, 244], z: [-362, -334], level: 54.2 },
  { name: "upland-12", x: [196, 220], z: [-330, -306], level: 54.2 },
  { name: "upland-13", x: [308, 332], z: [-342, -310], level: 73.38 },
  { name: "upland-14", x: [336, 360], z: [-362, -338], level: 73.38 },
  { name: "upland-15", x: [380, 488], z: [-274, -270], level: 45.68 },
  { name: "upland-16", x: [400, 424], z: [-418, -390], level: 65.36 },
] as const;

export const terrainPlateauGeometry = () =>
  TERRAIN_PLATEAUX.map(({ x, z, level }) =>
    terrainGridGeometry({
      x,
      z,
      levels: [
        [level, level],
        [level, level],
      ],
      maxTriangles: 2,
    }),
  );
