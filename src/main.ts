import "./style.css";
import {
  fitCamera,
  focusDirection,
  uniqueSentences,
  highlightSelection,
} from "./view";
import {
  Box3,
  Mesh,
  MeshStandardMaterial,
  MOUSE,
  TOUCH,
  PerspectiveCamera,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { parseSiteData } from "./model";
import { createSiteScene } from "./scene";
const app = document.querySelector<HTMLDivElement>("#app")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;
const list = document.querySelector<HTMLUListElement>("#buildings")!;
const reset = document.querySelector<HTMLButtonElement>("#reset")!;
const top = document.querySelector<HTMLButtonElement>("#top")!;
let cleanup: (() => void) | undefined;
async function start() {
  const response = await fetch(`${import.meta.env.BASE_URL}site-data.json`, {
    cache: "no-cache",
  });
  if (!response.ok)
    throw new Error(
      "Private reference parameters not supplied. The public renderer contains no legacy assets.",
    );
  const data = parseSiteData(await response.json());
  if (data.review) {
    const note = document.querySelector<HTMLParagraphElement>("#terrain-note")!;
    const r = data.review;
    note.textContent = `Provisional terrain: ${r.samples} independent height probes; mean error ${r.meanError.toFixed(1)} m, 95th percentile ${r.p95Error.toFixed(1)} m, maximum ${r.maxError.toFixed(1)} m. Ground-contact approval remains open.`;
  }
  const buttons = new Map<string, HTMLButtonElement>();
  for (const building of data.buildings) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.textContent = building.name;
    button.disabled = true;
    const detail = document.createElement("small");
    detail.textContent = uniqueSentences(building.uncertainty);
    li.append(button, detail);
    list.append(li);
    buttons.set(building.id, button);
  }

  const { scene, buildings, terrain, boundary, dispose } =
    createSiteScene(data);
  const box = new Box3()
    .setFromObject(terrain)
    .union(new Box3().setFromObject(buildings));

  const size = box.getSize(new Vector3());
  const span = Math.max(size.x, size.z);
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true });
  } catch {
    dispose();
    throw new Error(
      "WebGL 2 is unavailable in this browser. The list remains available; open this private preview in a WebGL-enabled browser for 3D review.",
    );
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.domElement.setAttribute(
    "aria-label",
    "Wah Fu clay model. Drag to orbit; right-drag or two fingers to pan; wheel or pinch to zoom.",
  );
  app.append(renderer.domElement);
  const camera = new PerspectiveCamera(45, 1, 0.5, 6000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.minDistance = 20;
  controls.maxDistance = span * 12;
  controls.screenSpacePanning = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  const render = () => renderer.render(scene, camera);
  let currentBox = box;
  let currentDirection = new Vector3(0.65, 0.8, 0.85);
  const meshes = buildings.children.filter(
    (node): node is Mesh => node instanceof Mesh,
  );
  const originals = new Map(meshes.map((mesh) => [mesh, mesh.material]));
  const selectedMaterial = new MeshStandardMaterial({
    color: "#e5c699",
    roughness: 1,
    metalness: 0,
  });
  const selectionNote =
    document.querySelector<HTMLParagraphElement>("#selection-note")!;
  const select = (id?: string) => {
    highlightSelection(meshes, originals, selectedMaterial, id);
    for (const [key, button] of buttons)
      button.setAttribute("aria-pressed", String(key === id));
    selectionNote.textContent = id
      ? `Selected: ${data.buildings.find((item) => item.id === id)?.name ?? id}. Highlighted in lighter clay.`
      : "Select a building to inspect its highlighted mass.";
  };
  const frame = () => {
    controls.target.copy(fitCamera(camera, currentBox, currentDirection));
    controls.update();
    render();
  };
  const resize = () => {
    const { width, height } = app.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    frame();
  };
  const overview = () => {
    select();
    currentBox = box;
    currentDirection = new Vector3(0.65, 0.8, 0.85);
    frame();
  };
  reset.onclick = overview;
  top.onclick = () => {
    currentBox = box;
    currentDirection = new Vector3(0, 1, 0.001);
    frame();
  };
  const pan = document.querySelector<HTMLButtonElement>("#pan")!;
  pan.onclick = () => {
    const enabled = pan.getAttribute("aria-pressed") !== "true";
    pan.setAttribute("aria-pressed", String(enabled));
    pan.textContent = enabled ? "Pan mode on" : "Pan mode";
    controls.mouseButtons.LEFT = enabled ? MOUSE.PAN : MOUSE.ROTATE;
    controls.touches.ONE = enabled ? TOUCH.PAN : TOUCH.ROTATE;
  };
  controls.addEventListener("change", render);
  const observer = new ResizeObserver(resize);
  observer.observe(app);
  for (const building of data.buildings) {
    const button = buttons.get(building.id)!;
    button.disabled = false;
    button.onclick = () => {
      const mesh = buildings.children.find(
        (item) => item.userData.id === building.id,
      );
      if (!mesh) return;
      select(building.id);
      currentBox = new Box3().setFromObject(mesh);
      currentDirection = focusDirection(
        currentBox,
        meshes
          .filter((item) => item !== mesh)
          .map((item) => new Box3().setFromObject(item)),
      );
      frame();
    };
  }
  const boundaryToggle = document.querySelector<HTMLInputElement>("#boundary")!;
  boundaryToggle.onchange = () => {
    boundary.visible = boundaryToggle.checked;
    render();
  };
  status.textContent = `${data.buildings.length} reference-derived clay masses · terrain approximation · owner review required`;
  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    status.textContent = "Graphics interrupted. Reload to restore the model.";
  });
  cleanup = () => {
    observer.disconnect();
    controls.dispose();
    selectedMaterial.dispose();
    dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
  overview();
  resize();
}
window.addEventListener("pagehide", () => cleanup?.(), { once: true });
void start().catch((error: unknown) => {
  status.textContent =
    error instanceof Error ? error.message : "Unable to open the model";
  status.setAttribute("role", "alert");
});
