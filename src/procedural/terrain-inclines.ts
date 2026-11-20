import { terrainGridGeometry } from "./terrain-grid";

/** Semantic grade planes: named reference level and derivatives in metres/metre.
 * Rectangles are coverage domains, not saved faces. */
const grades = {
  northern: { level: 59.3271138, dx: -0.05477491, dz: -0.07806326 },
  coastal: { level: 34.1089025, dx: -0.00830320734, dz: -0.01305119 },
} as const;

type Span = readonly [number, number];
type Incline = { grade: keyof typeof grades; x: Span; z: Span };

export const TERRAIN_INCLINES: readonly Incline[] = [
  { grade: "northern", x: [476, 489], z: [-495, -481] },
  { grade: "northern", x: [463, 472], z: [-515, -499] },
  { grade: "northern", x: [450, 461], z: [-529, -517] },
  { grade: "northern", x: [434, 443], z: [-552, -538] },
  { grade: "northern", x: [412, 421], z: [-584, -571] },
  { grade: "northern", x: [425, 433], z: [-566, -552] },
  { grade: "northern", x: [441, 454], z: [-537, -530] },
  { grade: "northern", x: [473, 481], z: [-504, -496] },
  { grade: "northern", x: [418, 424], z: [-570, -562] },
  { grade: "northern", x: [456, 462], z: [-516, -509] },
  { grade: "coastal", x: [249, 256], z: [-12, 3] },
  { grade: "coastal", x: [256, 263], z: [-12, 3] },
  { grade: "coastal", x: [255, 263], z: [-17, -13] },
];

export function terrainInclineGeometry({ grade, x, z }: Incline) {
  const { level, dx, dz } = grades[grade];
  const levels = z.map((zi) => x.map((xi) => level + dx * xi + dz * zi));
  return terrainGridGeometry({ x, z, levels, maxTriangles: 2 });
}
