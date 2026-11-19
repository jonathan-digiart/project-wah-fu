import { MeshStandardMaterial, ShaderMaterial, Vector3 } from "three";

/**
 * Editable v128 display palette, not the baseColorFactors in the GLB files.
 * Number triples are the sRGB display inputs from v128's appearance.mjs.
 * Keep geometry/triangle budgets independent of material choices.
 */
const HOUSE = [212 / 255, 200 / 255, 180 / 255] as const;
const LAND = [0.54, 0.6, 0.48] as const;
const ROAD = [0.35, 0.38, 0.34] as const;
export const V128_PALETTE = {
  background: [0.867, 0.89, 0.847],
  estateBuilding: HOUSE,
  contextBuilding: [188 / 255, 183 / 255, 173 / 255],
  paving: ROAD,
  retainingWall: ROAD,
  bank: LAND,
  terrain: LAND,
  road: ROAD,
} as const;
export type SurfaceRole = Exclude<keyof typeof V128_PALETTE, "background">;

// Stable source IDs in the published v128 catalogue (houses and estateAssociated).
const ESTATE_SOURCE_IDS = new Set([
  "B319321253701063C0",
  "B319711245301063C0",
  "B319741259301063C0",
  "B319801262901063C0",
  "B320011241002063C0",
  "B320211247701063C0",
  "B320441252301063C0",
  "B320681271701063C0",
  "B320701242801063C0",
  "B320751277502063C0",
  "B320791270602063C0",
  "B320791278001063C0",
  "B320961237801063C0",
  "B320961263701063C0",
  "B320991244201063C0",
  "B321191239302063C0",
  "B321201256601063C0",
  "B321241275202063C0",
  "B321451247901063C0",
  "B321461251901063C0",
  "B321481231301063C0",
  "B321551240701063C0",
  "B321551271001063C0",
  "B321621236201063C0",
  "B321661239102063C0",
  "B321751251701063C0",
  "B321871257401063C0",
  "B321911243901063C0",
  "B322051237701063C0",
  "B322081264001063C0",
  "B322241247801063C0",
  "B322311254301063C0",
  "B322681252502063C0",
]);
export function buildingRole(id: string): "estateBuilding" | "contextBuilding" {
  return ESTATE_SOURCE_IDS.has(id) ? "estateBuilding" : "contextBuilding";
}

export function v128Material(role: SurfaceRole, flatShading: boolean) {
  const [r, g, b] = V128_PALETTE[role];
  if (role === "estateBuilding" || role === "contextBuilding") {
    const material = new MeshStandardMaterial({ roughness: 1, flatShading });
    // Three consumes linear internal colours; this API converts from sRGB.
    material.color.setRGB(r, g, b, "srgb");
    return material;
  }
  // The v128 non-clay shader shades directly in display space. PBR lighting
  // would transform those colours differently. Match the v128 expression here
  // without altering the building lights or adding textures or geometry.
  return new ShaderMaterial({
    uniforms: { displayColor: { value: new Vector3(r, g, b) } },
    toneMapped: false,
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = mat3(modelMatrix) * normal;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 displayColor;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec3 normal = ${flatShading ? "cross(dFdx(vWorldPosition), dFdy(vWorldPosition))" : "vWorldNormal"};
        vec3 n = gl_FrontFacing ? normalize(normal) : -normalize(normal);
        float shade = .48 + .52 * max(0., dot(n, normalize(vec3(.5, .85, .35))));
        // This is already display sRGB, matching the old shader's direct output.
        gl_FragColor = vec4(displayColor * shade, 1.);
      }
    `,
  });
}
