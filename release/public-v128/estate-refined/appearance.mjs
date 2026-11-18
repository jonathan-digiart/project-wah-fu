import { ROAD_FINISH_ROLE, ROAD_FINISH_COLOR } from './road-finish.mjs';
/**
 * The temporary terrain is the unchanged public-release mesh. Its source's
 * terrainPositions() appends linear land triangles, then sea triangles.
 * Pin this display-only split to the exact asset rather than guessing from
 * height: a different terrain file must have its boundary verified again.
 */
export const BOOTSTRAP_TERRAIN_LAYOUT = Object.freeze({
  sha256: '1af6567c63f845bdfb149eda86c31615b86917b428f91d7984e724b871042bbe',
  sourceCommit: '348b19d7166fbee2ef01b6fb6bf6b048b3bf5e4b',
  triangles: 1293,
  landTriangles: 1255,
});

// The detailed stage's existing values are intentionally unchanged.
const palette = Object.freeze({
  base: Object.freeze([152/255,153/255,143/255]),
  land: Object.freeze([.54,.60,.48]),
  sea: Object.freeze([.47,.61,.63]),
  road: Object.freeze([.35,.38,.34]),
  house: Object.freeze([212/255,200/255,180/255]),
  clay: Object.freeze([188/255,183/255,173/255]),
});

/** Return the renderer's display treatment without changing geometry. */
export function appearance(layer, material) {
  let color;
  if (layer === 'bootstrapBuildings') color = material === 0 ? palette.house : palette.clay;
  else if (layer === 'roads') color = material === ROAD_FINISH_ROLE ? ROAD_FINISH_COLOR : palette.road;
  else if ((layer === 'houses' || layer === 'estateAssociated')) color = palette.house;
  else if (layer === 'surroundings') color = palette.clay;
  else if (layer === 'sea') color = palette.sea;
  else if (layer === 'base' || layer === 'bootstrapBase') color = palette.base;
  else color = material === 1 ? palette.sea : palette.land;
  return {
    color,
    publicClay: layer === 'houses' || layer === 'estateAssociated' || layer === 'surroundings' || layer === 'bootstrapBuildings',
    role: layer === 'bootstrapBuildings' ? (material === 0 ? 'temporary-house' : 'temporary-context') : null,
  };
}
