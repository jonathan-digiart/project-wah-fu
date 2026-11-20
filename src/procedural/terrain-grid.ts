import type { GeometryData } from "./schema";

/** Levels in metres on coordinate stations; null is no terrain.
 * A breakline diagonal may be authored explicitly for a particular cell.
 * No positions or faces are supplied as input. */
export interface TerrainGrid {
  readonly x: readonly number[];
  readonly z: readonly number[];
  readonly levels: readonly (readonly (number | null)[])[];
  readonly fallingDiagonals?: ReadonlySet<string>;
  readonly maxTriangles: number;
}

export function terrainGridGeometry(grid: TerrainGrid): GeometryData {
  const validAxis = (axis: readonly number[]) =>
    axis.length >= 2 &&
    axis.every(
      (v, i) =>
        Number.isFinite(Math.fround(v)) &&
        (i === 0 || Math.fround(v) > Math.fround(axis[i - 1]!)),
    );
  const width = grid.x.length,
    length = grid.z.length;
  if (
    width * length > 1_000_000 ||
    !validAxis(grid.x) ||
    !validAxis(grid.z) ||
    grid.levels.length !== length ||
    grid.levels.some(
      (row) =>
        row.length !== width ||
        row.some((h) => h !== null && !Number.isFinite(Math.fround(h))),
    ) ||
    !Number.isSafeInteger(grid.maxTriangles) ||
    grid.maxTriangles < 1
  )
    throw new Error("Invalid terrain stations, levels or budget");

  const positions: number[] = [],
    indices: number[] = [];
  const remap = new Map<number, number>();
  const elevation = (id: number) =>
    grid.levels[Math.floor(id / width)]![id % width]!;
  function add(a: number, b: number, c: number) {
    const ids = [a, b, c];
    if (ids.some((id) => elevation(id) === null)) return;
    if (indices.length / 3 >= grid.maxTriangles)
      throw new Error("Terrain exceeds triangle budget");
    for (const id of ids) {
      let index = remap.get(id);
      if (index === undefined) {
        index = positions.length / 3;
        positions.push(
          grid.x[id % width]!,
          elevation(id) ?? 0,
          grid.z[Math.floor(id / width)]!,
        );
        remap.set(id, index);
      }
      indices.push(index);
    }
  }
  for (let j = 0; j < length - 1; j++)
    for (let i = 0; i < width - 1; i++) {
      const a = j * width + i,
        b = a + 1,
        c = a + width,
        d = c + 1;
      if (grid.fallingDiagonals?.has(`${i},${j}`)) {
        add(a, c, d);
        add(a, d, b);
      } else {
        add(a, c, b);
        add(b, c, d);
      }
    }
  return { positions, indices };
}
