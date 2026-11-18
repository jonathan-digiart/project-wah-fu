import { terrainGridGeometry, type TerrainGrid } from "./terrain-grid";

/** Two independently editable rectangles in the accepted low coastal plane.
 * Their shared line at X=300 derives from a single station datum. */
const level = 1.3;
const z = [78, 120];
const sharedX = 300;
export const COASTAL_PLANE_TILES: readonly TerrainGrid[] = [
  [200, sharedX],
  [sharedX, 305],
].map((x) => ({
  x,
  z,
  levels: [
    [level, level],
    [level, level],
  ],
  maxTriangles: 2,
}));

export const coastalPlaneGeometry = () =>
  COASTAL_PLANE_TILES.map(terrainGridGeometry);
