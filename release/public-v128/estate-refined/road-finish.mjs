// Local testing contract only; source adoption requires separate verified bindings.
// A named source role gets one fixed palette; arbitrary glTF colors stay ignored.
export const ROAD_FINISH_ROLE = 'paved-separator-v1';
export const ROAD_FINISH_COLOR = Object.freeze([152 / 255, 153 / 255, 143 / 255]);
export const ROAD_FINISH_MATERIAL = Object.freeze({
  name: 'Wah Fu paved separator finish v1',
  extras: Object.freeze({ wahfuSurfaceRole: ROAD_FINISH_ROLE }),
  pbrMetallicRoughness: Object.freeze({
    baseColorFactor: Object.freeze([...ROAD_FINISH_COLOR, 1]),
    roughnessFactor: 1,
    metallicFactor: 0,
  }),
  doubleSided: true,
});
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
const pinned = JSON.stringify(canonical(ROAD_FINISH_MATERIAL));
export function roadFinishRole(material) {
  const role = material?.extras?.wahfuSurfaceRole;
  if (role === undefined) return null;
  if (role !== ROAD_FINISH_ROLE || JSON.stringify(canonical(material)) !== pinned) throw Error('Unverified road finish material');
  return ROAD_FINISH_ROLE;
}
export function roadPartStyle(layer, material, ordinaryAppearance) {
  if (layer !== 'roads' || material !== ROAD_FINISH_ROLE) return ordinaryAppearance(layer, material);
  return { color: ROAD_FINISH_COLOR, publicClay: false, role: null };
}
