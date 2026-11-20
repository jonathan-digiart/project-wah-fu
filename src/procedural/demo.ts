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
import { buildingRole, V128_PALETTE } from "./palette";
import { ComponentRegistry } from "./registry";
import { fitCamera } from "../view";
import { wahMingPlan, WAH_MING_GRADED_PAVING } from "./wah-ming";
import { WAH_MING_AUTHORED } from "./wah-ming-authored";
const started = performance.now();
const registry = new ComponentRegistry();
for (const building of BUILDING_ENVELOPES)
  registry.replace(
    {
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
    },
    buildingRole(building.id),
  );
registry.replace(WAH_MING_GRADED_PAVING, "paving");
const generationMs = performance.now() - started;
const scene = new Scene();
scene.background = new Color().setRGB(...V128_PALETTE.background, "srgb");
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
let selectedBox = new Box3();
let focus: "overview" | "carpark" | "section" = "overview";
let viewGeneration = 0;
let selectedId: string | undefined;
const generationTimes = new Map<string, number>();
const initialObjects = new Set(registry.group.children);
const viewNote = document.querySelector<HTMLParagraphElement>("#view-note")!;
const render = () => {
  renderer.render(scene, camera);
  metrics.textContent = `${registry.stats().length} registered modules · ${renderer.info.render.triangles.toLocaleString()} drawn triangles · ${renderer.info.render.calls} draw calls · ${generationMs.toFixed(1)} ms initial geometry${selectedId && generationTimes.has(selectedId) ? ` · ${generationTimes.get(selectedId)!.toFixed(1)} ms selected surface generation` : ""}`;
};
const frame = () => {
  controls.target.copy(
    fitCamera(
      camera,
      focus === "overview" ? box : selectedBox,
      focus === "overview"
        ? new Vector3(0.6, 0.85, 1)
        : focus === "section"
          ? new Vector3(-0.35, 0.7, 1)
          : new Vector3(0, 1, 0.0001),
    ),
  );
  controls.update();
  render();
};
const overview = () => {
  ++viewGeneration;
  focus = "overview";
  selectedId = undefined;
  for (const child of registry.group.children)
    child.visible = initialObjects.has(child);
  viewNote.textContent =
    "Building envelopes and the graded Wah Ming carpark. Surrounding terrain is not integrated.";
  frame();
};
const isolate = (id: string) => {
  selectedId = id;
  const mesh = registry.group.children.find((x) => x.userData.id === id)!;
  focus = "carpark";
  selectedBox = new Box3().setFromObject(mesh);
  for (const child of registry.group.children) child.visible = child === mesh;
  frame();
};
const gradedCarpark = () => {
  ++viewGeneration;
  isolate(WAH_MING_GRADED_PAVING.id);
  viewNote.textContent =
    "Feature-aware carpark: 1,260 triangles, maximum 9.481 mm height difference from v128. Surrounding terrain is not integrated.";
};
const referenceCarpark = () => {
  ++viewGeneration;
  try {
    const id = "wah-ming-reference";
    if (!generationTimes.has(id)) {
      const start = performance.now();
      registry.replace(
        {
          ...WAH_MING_AUTHORED,
          id,
          label: "Wah Ming authoring-grid reference",
          kind: "authored-cells",
          source:
            "Accepted v126/v127 inferred paving; original constructive grid and named scalar levels",
          confidence: "inferred",
        },
        "paving",
      );
      generationTimes.set(id, performance.now() - start);
    }
    isolate(id);
    viewNote.textContent =
      "Code-generated authoring-grid reference: 1,616 triangles. No imported 3D asset.";
  } catch (error) {
    viewNote.textContent = `Surface generation failed: ${error instanceof Error ? error.message : String(error)}`;
  }
};
const northEdgeSection = async () => {
  const token = ++viewGeneration;
  viewNote.textContent = "Generating Wah Ming’s north edge…";
  try {
    const edge = await import("./wah-ming-north-edge");
    if (token !== viewGeneration) return;
    const id = "wah-ming-north-edge";
    if (!generationTimes.has(id)) {
      const start = performance.now();
      for (const [part, generate] of [
        ["wall", edge.wahMingNorthWallWithEastReturn],
        ["bank", edge.wahMingNorthBank],
      ] as const)
        registry.replace(
          {
            id: `${id}-${part}`,
            label: `Wah Ming north edge: ${part}`,
            kind: "construction-surface",
            source: "Verified, bounded v128 reference slice, not a survey",
            confidence: "reference-derived",
            generate,
          },
          part === "wall" ? "retainingWall" : "bank",
        );
      generationTimes.set(id, performance.now() - start);
    }
    const visible = new Set([
      WAH_MING_GRADED_PAVING.id,
      `${id}-wall`,
      `${id}-bank`,
    ]);
    for (const child of registry.group.children) {
      const childId: unknown = child.userData.id;
      child.visible = typeof childId === "string" && visible.has(childId);
    }
    // Frame the measured join rather than imply that the whole carpark edge is rebuilt.
    const { northing, bankDepth, breaklines, wallFoot } =
      edge.WAH_MING_NORTH_EDGE;
    selectedBox = new Box3(
      new Vector3(
        breaklines[0].crest[0] - 1,
        Math.min(...wallFoot.map(([, y]) => y)),
        northing - bankDepth,
      ),
      new Vector3(
        breaklines.at(-1)!.crest[0] + 1,
        Math.max(...breaklines.map(({ rear: [, y] }) => y)),
        northing + 5,
      ),
    );
    selectedId = id;
    focus = "section";
    viewNote.textContent =
      "Verified straight north edge: 19.79 m of retaining wall and a 2 m strip of adjoining bank, connected to the accepted paving. Includes a 1.06 m east return; no west return is inferred. Surrounding terrain and the other carpark edges are not rebuilt.";
    frame();
  } catch (error) {
    if (token === viewGeneration)
      viewNote.textContent = `North edge generation failed: ${error instanceof Error ? error.message : String(error)}`;
  }
};
const northSurface = async () => {
  const token = ++viewGeneration;
  viewNote.textContent = "Generating northern boundary from procedural levels…";
  try {
    const data = await import("./north-surface");
    if (token !== viewGeneration) return;
    const id = "north-boundary";
    if (!registry.group.children.some((x) => x.userData.id === id)) {
      const start = performance.now();
      registry.replace({
        id,
        label: "Northern boundary construction surface",
        kind: "construction-surface",
        source:
          "Original construction domain, PCHIP and boundary-level recipe; obsolete overlapping remnants excluded",
        confidence: "reference-derived",
        generate: data.northSurfaceGeometry,
      });
      generationTimes.set(id, performance.now() - start);
    }
    isolate(id);
    viewNote.textContent =
      "Northern boundary: 2,379 triangles, maximum 5.232 mm height difference on construction-owned surface. Obsolete conflicting remnants excluded. Draft, not integrated.";
  } catch (error) {
    if (token === viewGeneration)
      viewNote.textContent = `Surface generation failed: ${error instanceof Error ? error.message : String(error)}`;
  }
};
const r06Surface = async () => {
  const token = ++viewGeneration;
  viewNote.textContent =
    "Generating R06 west and building contact from planes and grade controls…";
  try {
    const data = await import("./r06-surface");
    if (token !== viewGeneration) return;
    const id = "r06-top";
    if (!registry.group.children.some((x) => x.userData.id === id)) {
      const start = performance.now();
      registry.replace(
        {
          id,
          label: "R06 west top and contact apron",
          kind: "construction-surface",
          source:
            "Accepted plane and localized grade zones; support geometry excluded",
          confidence: "reference-derived",
          origin: data.r06SurfaceOrigin,
          generate: () => {
            const west = data.r06SurfaceGeometry(0),
              apron = data.r06SurfaceGeometry(1);
            return {
              positions: [...west.positions, ...apron.positions],
              indices: [
                ...west.indices,
                ...apron.indices.map((i) => i + west.positions.length / 3),
              ],
            };
          },
        },
        "road",
      );
      generationTimes.set(id, performance.now() - start);
    }
    isolate(id);
    viewNote.textContent =
      "R06 tops: 633 triangles, maximum 8.636 mm height difference. Existing 9 mm apron step preserved. Supports excluded; not integrated.";
  } catch (error) {
    if (token === viewGeneration)
      viewNote.textContent = `Surface generation failed: ${error instanceof Error ? error.message : String(error)}`;
  }
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
  ++viewGeneration;
  const plan = wahMingPlan(0);
  if (!registry.stats().some((entry) => entry.id === plan.id))
    registry.replace(plan, "paving");
  isolate(plan.id);
  viewNote.textContent =
    "Locked footprint only, displayed at arbitrary zero elevation.";
});
document.querySelector("#carpark10")!.addEventListener("click", gradedCarpark);
document
  .querySelector("#carpark50")!
  .addEventListener("click", referenceCarpark);
document
  .querySelector("#wah-ming-north-edge")!
  .addEventListener("click", () => {
    void northEdgeSection();
  });
document.querySelector("#north")!.addEventListener("click", () => {
  void northSurface();
});
document.querySelector("#r06")!.addEventListener("click", () => {
  void r06Surface();
});
resize();
overview();
window.addEventListener(
  "pagehide",
  () => {
    ++viewGeneration;
    resizeObserver.disconnect();
    controls.dispose();
    registry.dispose();
    renderer.dispose();
  },
  { once: true },
);
