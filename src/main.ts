import "./style.css";
import { Box3, PerspectiveCamera, Vector3, WebGLRenderer } from "three";
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
    detail.textContent = building.uncertainty;
    li.append(button, detail);
    list.append(li);
    buttons.set(building.id, button);
  }

  const { scene, buildings, terrain, boundary, dispose } =
    createSiteScene(data);
  const box = new Box3().setFromObject(terrain);
  const centre = box.getCenter(new Vector3());
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
  controls.maxDistance = span * 3;
  controls.maxPolarAngle = Math.PI * 0.49;
  const render = () => renderer.render(scene, camera);
  const resize = () => {
    const { width, height } = app.getBoundingClientRect();
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  };
  const overview = () => {
    controls.target.copy(centre);
    camera.position
      .copy(centre)
      .add(new Vector3(span * 0.65, span * 0.8, span * 0.85));
    controls.update();
    render();
  };
  reset.onclick = overview;
  top.onclick = () => {
    controls.target.copy(centre);
    camera.position.copy(centre).add(new Vector3(0, span * 1.4, 0.01));
    controls.update();
    render();
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
      const target = new Box3().setFromObject(mesh).getCenter(new Vector3());
      controls.target.copy(target);
      camera.position.copy(target).add(new Vector3(100, 110, 130));
      controls.update();
      render();
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
