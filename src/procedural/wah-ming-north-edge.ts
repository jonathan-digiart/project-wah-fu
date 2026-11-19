import type { GeometryData } from "./schema";

/** Reconstructed from published v128, not a survey. X increases east. */
export const WAH_MING_NORTH_EDGE = {
  northing: -246.49997,
  /** Exactly three adjacent panels along the accepted straight north kerb. */
  xStart: 76,
  interval: 1.5,
  wallTop: [21.417650223, 21.446020126, 21.474388123, 21.502756119],
  wallFoot: [20.836671829, 20.823244095, 20.807912827, 20.82308197],
  /** One metre of the adjoining bank. Stop before the next source breakline. */
  bankDepth: 1,
  risePerMetreNorth: 0.5425818643,
} as const;

/** Build the shared wall-top and bank-edge positions from the same controls. */
function buildNorthEdge(surface: "wall" | "bank"): GeometryData {
  const edge = WAH_MING_NORTH_EDGE;
  const positions: number[] = [];
  const indices: number[] = [];
  for (const [i, top] of edge.wallTop.entries()) {
    const x = edge.xStart + i * edge.interval;
    positions.push(x, top, edge.northing);
    if (surface === "wall") positions.push(x, edge.wallFoot[i]!, edge.northing);
    else
      positions.push(
        x,
        top + edge.bankDepth * edge.risePerMetreNorth,
        edge.northing - edge.bankDepth,
      );
    if (i === 0) continue;
    const a = 2 * (i - 1);
    if (surface === "wall") indices.push(a + 2, a, a + 1, a + 2, a + 1, a + 3);
    else indices.push(a, a + 2, a + 3, a, a + 3, a + 1);
  }
  return { positions, indices };
}

export const wahMingNorthWall = () => buildNorthEdge("wall");
export const wahMingNorthBank = () => buildNorthEdge("bank");
