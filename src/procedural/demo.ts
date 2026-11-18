import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BUILDING_ENVELOPES } from "./building-envelopes";
import { ComponentRegistry } from "./registry";
import { fitCamera } from "../view";
import { wahMingPlan } from "./wah-ming";
const started = performance.now();
const registry = new ComponentRegistry();
for (const building of BUILDING_ENVELOPES)
  registry.replace({
    id: building.id,
    label: building.name,
    kind: "footprint",
    outline: building.footprint,
    ...(building.holes ? { holes: building.holes } : {}),
    base: building.base,
    height: building.height,
    source:
      "Earlier semantic footprint/height scaffold; not v128 geometry parity",
    confidence: "reference-derived",
  });
registry.replace(wahMingPlan(0));
const generationMs = performance.now() - started;
const scene = new Scene();
scene.background = new Color("#e9e7e1");
scene.add(registry.group, new AmbientLight(0xffffff, 2));
const light = new DirectionalLight(0xffffff, 3);
light.position.set(-300, 600, 200);
scene.add(light);
const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const viewport = document.querySelector<HTMLElement>("#viewport")!;
viewport.append(renderer.domElement);
const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.5, 10000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.maxPolarAngle = Math.PI * 0.49;
controls.screenSpacePanning = true;
const metrics = document.querySelector<HTMLParagraphElement>("#metrics")!;
const box = new Box3().setFromObject(registry.group);
const carparkMesh = registry.group.children.find(
  (x) => x.userData.id === "wah-ming-north-carpark-plan",
)!;
const carparkBox = new Box3().setFromObject(carparkMesh);
let focus: "overview" | "carpark" = "overview";
const render = () => {
  renderer.render(scene, camera);
  metrics.textContent = `${registry.stats().length} modules · ${renderer.info.render.triangles.toLocaleString()} drawn triangles · ${renderer.info.render.calls} draw calls · ${generationMs.toFixed(1)} ms geometry generation`;
};
const frame = () => {
  controls.target.copy(
    fitCamera(
      camera,
      focus === "overview" ? box : carparkBox,
      focus === "overview"
        ? new Vector3(0.6, 0.85, 1)
        : new Vector3(0, 1, 0.0001),
    ),
  );
  controls.update();
  render();
};
const overview = () => {
  focus = "overview";
  for (const child of registry.group.children) child.visible = true;
  frame();
};
const resize = () => {
  const width = viewport.clientWidth,
    height = Math.max(1, viewport.clientHeight);
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  frame();
};
controls.addEventListener("change", render);
const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(viewport);
document.querySelector("#overview")!.addEventListener("click", overview);
document.querySelector("#carpark")!.addEventListener("click", () => {
  focus = "carpark";
  for (const child of registry.group.children)
    child.visible = child === carparkMesh;
  frame();
});
resize();
overview();
window.addEventListener(
  "pagehide",
  () => {
    resizeObserver.disconnect();
    controls.dispose();
    registry.dispose();
    renderer.dispose();
  },
  { once: true },
);
