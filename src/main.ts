import { createNavigationBound, visibleInspection } from "./navigation";
import "./style.css";
import { protectCamera } from "./collision";
import {
  fitCamera,
  OVERVIEW_DIRECTION,
  fitOverview,
  framingPoints,
  focusDirection,
  uniqueSentences,
  highlightSelection,
  setContextVisible,
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
import { parseSiteData, groupBuildingRecords } from "./model";
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
      "Model parameters not supplied. Reload or report the missing model file.",
    );
  const data = parseSiteData(await response.json());
  if (data.review) {
    const note = document.querySelector<HTMLParagraphElement>("#terrain-note")!;
    const r = data.review;
    note.textContent = `Provisional terrain: ${r.samples} independent height probes; mean error ${r.meanError.toFixed(1)} m, 95th percentile ${r.p95Error.toFixed(1)} m, maximum ${r.maxError.toFixed(1)} m. Ground-contact approval remains open.`;
  }
  const records = groupBuildingRecords(data.buildings);
  const contextList =
    document.querySelector<HTMLUListElement>("#context-buildings")!;
  document.querySelector("#context-count")!.textContent = String(
    records.filter((record) => record.category === "context").length,
  );
  const buttons = new Map<string, HTMLButtonElement>();
  for (const building of records) {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.textContent = building.name;
    button.disabled = true;
    const detail = document.createElement("small");
    detail.textContent = uniqueSentences(building.parts[0]!.uncertainty);
    li.append(button, detail);
    (building.category === "context" ? contextList : list).append(li);
    buttons.set(building.id, button);
  }

  const { scene, buildings, terrain, shell, dispose } = createSiteScene(data);
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
      "WebGL 2 is unavailable in this browser. The list remains available; open this model in a WebGL-enabled browser for 3D review.",
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
  let overviewPoints = framingPoints([terrain, buildings, shell]);
  // Initialize a safe overview before subscribing to navigation. Origin is not a starting pose.
  controls.target.copy(
    fitOverview(camera, overviewPoints, OVERVIEW_DIRECTION.clone()),
  );
  controls.update();
  let currentBox = box;
  const collision = protectCamera(
    camera,
    controls,
    data,
    buildings,
    terrain,
    shell,
    createNavigationBound(camera, () => currentBox),
  );
  let framing = false;
  const render = () => {
    if (!framing) renderer.render(scene, camera);
  };
  let isOverview = true;
  let currentDirection = OVERVIEW_DIRECTION.clone();
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
  let selectedId: string | undefined;
  const select = (id?: string) => {
    selectedId = id;
    highlightSelection(meshes, originals, selectedMaterial, id);
    for (const [key, button] of buttons)
      button.setAttribute("aria-pressed", String(key === id));
    selectionNote.textContent = id
      ? `Selected: ${records.find((item) => item.id === id)?.name ?? id}. Highlighted in lighter clay.`
      : "Select a building to inspect its highlighted mass.";
  };
  const frame = () => {
    framing = true;
    try {
      collision.teleport(() => {
        controls.target.copy(
          isOverview
            ? fitOverview(camera, overviewPoints, currentDirection)
            : fitCamera(camera, currentBox, currentDirection),
        );
        controls.update();
      });
    } finally {
      framing = false;
    }
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
    isOverview = true;
    select();
    currentBox = visibleInspection(terrain, meshes).bounds;
    currentDirection = OVERVIEW_DIRECTION.clone();
    frame();
  };
  reset.onclick = overview;
  top.onclick = () => {
    select();
    isOverview = false;
    currentBox = visibleInspection(terrain, meshes).bounds;
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
  const contextToggle = document.querySelector<HTMLInputElement>("#context")!;
  contextToggle.onchange = () => {
    setContextVisible(meshes, contextToggle.checked);
    const next = visibleInspection(terrain, meshes, selectedId);
    currentBox = next.bounds;
    if (next.selection !== selectedId) {
      select(next.selection);
      isOverview = true;
      currentDirection = OVERVIEW_DIRECTION.clone();
    }
    overviewPoints = framingPoints([
      terrain,
      shell,
      ...meshes.filter((mesh) => mesh.visible),
    ]);
    // Visibility changes never recenter the camera/target. Explicit reset/focus
    // can recover an offscreen view, and inward pan remains available meanwhile.
    render();
  };
  for (const building of records) {
    const button = buttons.get(building.id)!;
    button.disabled = false;
    button.onclick = () => {
      const selected = meshes.filter(
        (mesh) => mesh.userData.reviewId === building.id,
      );
      if (!selected.length) return;
      if (building.category === "context") {
        contextToggle.checked = true;
        setContextVisible(meshes, true);
        overviewPoints = framingPoints([terrain, shell, ...meshes]);
      }
      select(building.id);
      isOverview = false;
      currentBox = new Box3();
      for (const mesh of selected)
        currentBox.union(new Box3().setFromObject(mesh));
      currentDirection = focusDirection(
        currentBox,
        meshes
          .filter((item) => item.visible && !selected.includes(item))
          .map((item) => new Box3().setFromObject(item)),
      );
      frame();
    };
  }
  status.textContent = `${records.filter((record) => record.category === "estate").length} estate + ${records.filter((record) => record.category === "context").length} other legacy building objects · ${data.buildings.length} clay components · provisional terrain`;
  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    status.textContent = "Graphics interrupted. Reload to restore the model.";
  });
  cleanup = () => {
    observer.disconnect();
    collision.dispose();
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
