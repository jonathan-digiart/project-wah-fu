import type { GeometryData } from "./schema";

/** Published v128 model coordinates, not a survey. X increases east. */
export const WAH_MING_NORTH_EDGE = {
  northing: -246.49997,
  bankDepth: 2,
  // Each measured grade breakline is named by its crest and rear (x, elevation).
  // Adjacent zones use the very same controls, not separate rounded copies.
  breaklines: [
    { crest: [73.010002136, 21.506980896], rear: [73.010002136, 22.501863711] },
    { crest: [73.4375, 21.558267593], rear: [73.4375, 22.553150409] },
    { crest: [74.395187378, 21.438562393], rear: [73.588734522, 22.534246997] },
    { crest: [74.701644897, 21.419296265], rear: [73.637129183, 22.53120456] },
    { crest: [75.008102417, 21.430582047], rear: [73.685523844, 22.532986744] },
    { crest: [75.250030518, 21.403467178], rear: [74.250030518, 22.469718595] },
    { crest: [86.800231934, 21.621908188], rear: [79.200231934, 22.563339031] },
    { crest: [88.341079712, 21.430051804], rear: [82.79562465, 22.115664756] },
    { crest: [89.604545593, 21.278505325], rear: [85.743786722, 21.762047361] },
    { crest: [92.800003052, 21.336803436], rear: [92.800003052, 21.890782969] },
  ],
  // Minimal source-station profile with <1 mm deviation from the published foot.
  wallFoot: [
    [73.010002136, 20.929000854],
    [76, 20.836671829],
    [79, 20.807912827],
    [82, 20.838878632],
    [92.800003052, 21.000513077],
  ],
} as const;

/** Join the separately editable crest and foot profiles without widening the wall. */
export function wahMingNorthWall(): GeometryData {
  const { northing, breaklines, wallFoot } = WAH_MING_NORTH_EDGE;
  const positions = [
    ...breaklines.flatMap(({ crest: [x, y] }) => [x, y, northing]),
    ...wallFoot.flatMap(([x, y]) => [x, y, northing]),
  ];
  const indices: number[] = [];
  const n = breaklines.length;
  let top = 0;
  let foot = 0;
  while (top < n - 1 || foot < wallFoot.length - 1) {
    if (
      top < n - 1 &&
      (foot === wallFoot.length - 1 ||
        breaklines[top + 1]!.crest[0] <= wallFoot[foot + 1]![0])
    ) {
      indices.push(top + 1, top, n + foot);
      top++;
    } else {
      indices.push(top, n + foot, n + foot + 1);
      foot++;
    }
  }
  return { positions, indices };
}

/** Interpolate between shared breaklines, then stop at the verified rear crop. */
export function wahMingNorthBank(): GeometryData {
  const { northing, bankDepth, breaklines } = WAH_MING_NORTH_EDGE;
  const positions = breaklines.flatMap(({ crest, rear }) => [
    ...crest,
    northing,
    ...rear,
    northing - bankDepth,
  ]);
  const indices: number[] = [];
  for (let a = 0; a < positions.length / 3 - 2; a += 2)
    indices.push(a, a + 2, a + 3, a, a + 3, a + 1);
  return { positions, indices };
}
