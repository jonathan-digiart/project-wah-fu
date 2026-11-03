import { expect, test } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createProceduralCollider, protectCamera } from "./collision";
import { parseSiteData, type SiteData } from "./model";
import { createSiteScene } from "./scene";
import {
  fitCamera,
  fitOverview,
  framingPoints,
  OVERVIEW_DIRECTION,
} from "./view";
const data: SiteData = {
  boundary: [
    [-100, -100],
    [100, -100],
    [100, 100],
    [-100, 100],
  ],
  terrainControls: [
    { x: -100, z: -100, height: 0 },
    { x: 100, z: -100, height: 20 },
    { x: 100, z: 100, height: 20 },
    { x: -100, z: 100, height: 0 },
  ],
  interpolation: "linear",
  presentationBottom: -25,
  buildings: [
    {
      id: "courtyard",
      name: "Synthetic courtyard",
      footprint: [
        [-20, -20],
        [20, -20],
        [20, 20],
        [-20, 20],
      ],
      holes: [
        [
          [-10, -10],
          [-10, 10],
          [10, 10],
          [10, -10],
        ],
      ],
      base: 10,
      height: 30,
      uncertainty: "Synthetic",
    },
  ],
  provenance: { synthetic: true },
};
test("generated terrain and shell stop complete downwards and sideward sweeps, and recover underground starts", () => {
  const s = createSiteScene(data);
  const c = createProceduralCollider(data, s.buildings, s.terrain, s.shell);
  const p = c.move(new Vector3(60, 100, 60), new Vector3(60, -100, 60));
  expect(p.y).toBeGreaterThan(16.9);
  expect(c.contains(p)).toBe(false);
  expect(c.distanceToSurface(p)).toBeGreaterThanOrEqual(0.99999);
  const side = c.move(new Vector3(150, 5, 50), new Vector3(50, 5, 50));
  expect(side.x).toBeGreaterThan(100.9);
  const recovered = c.recover(new Vector3(50, -1000, 50));
  expect(c.contains(recovered)).toBe(false);
  expect(c.distanceToSurface(recovered)).toBeGreaterThanOrEqual(0.99999);
  s.dispose();
});
test("courtyard is open but its walls and roof block a swept sphere; hidden geometry stays solid", () => {
  const s = createSiteScene(data);
  const c = createProceduralCollider(data, s.buildings, s.terrain, s.shell);
  expect(c.contains(new Vector3(0, 25, 0))).toBe(false);
  expect(c.contains(new Vector3(15, 25, 0))).toBe(true);
  const roof = c.move(new Vector3(15, 100, 0), new Vector3(15, 20, 0));
  expect(roof.y).toBeGreaterThan(40.9);
  s.buildings.visible = false;
  const across = c.move(new Vector3(-50, 25, 0), new Vector3(50, 25, 0));
  expect(across.x).toBeLessThan(-20.9);
  s.dispose();
});
test("named view recovery and near-plane clearance remain safe through repeated aspect changes", () => {
  const s = createSiteScene(data);
  const camera = new PerspectiveCamera(45, 1, 0.5, 6000);
  camera.position.set(80, 100, 80);
  const controls = new OrbitControls(camera);
  controls.target.set(0, 10, 0);
  controls.update();
  const guard = protectCamera(
    camera,
    controls,
    data,
    s.buildings,
    s.terrain,
    s.shell,
  );
  for (const aspect of [1, 0.4, 4, 20, 0.4, 1]) {
    camera.aspect = aspect;
    guard.teleport(() => {
      camera.position.set(15, 25, 0);
      controls.update();
    });
    expect(guard.collider.contains(camera.position)).toBe(false);
    const corner =
      camera.near *
      Math.sqrt(
        1 + Math.tan((camera.fov * Math.PI) / 360) ** 2 * (1 + aspect ** 2),
      );
    expect(corner).toBeLessThan(1);
    expect(
      guard.collider.distanceToSurface(camera.position),
    ).toBeGreaterThanOrEqual(0.99999);
  }
  guard.dispose();
  // Headless OrbitControls never connected to a DOM element.
  s.dispose();
});
const path = new URL("../public/site-data.json", import.meta.url);
test.skipIf(!existsSync(path))(
  "actual clay data: every building sweep and named overview stays exterior without geometry changes",
  () => {
    const real = parseSiteData(
      JSON.parse(readFileSync(path, "utf8")) as unknown,
    );
    const s = createSiteScene(real);
    const prior = Array.from(s.terrain.geometry.getAttribute("position").array);
    const began = performance.now();
    const c = createProceduralCollider(real, s.buildings, s.terrain, s.shell);
    const buildMs = performance.now() - began;
    const durations: number[] = [];
    for (const b of real.buildings) {
      const xs = b.footprint.map((p) => p[0]),
        zs = b.footprint.map((p) => p[1]);
      const z = (Math.min(...zs) + Math.max(...zs)) / 2,
        y = b.base + b.height / 2;
      const start = c.recover(new Vector3(Math.min(...xs) - 5, y, z));
      const time = performance.now();
      const end = c.move(start, new Vector3(Math.max(...xs) + 5, y, z));
      durations.push(performance.now() - time);
      expect(c.contains(end)).toBe(false);
      expect(c.distanceToSurface(end)).toBeGreaterThanOrEqual(0.99999);
    }
    const bounds = new Box3().setFromObject(s.scene);
    const points = framingPoints([s.terrain, s.buildings, s.shell]);
    for (const aspect of [0.4, 1, 2, 3]) {
      const camera = new PerspectiveCamera(45, aspect, 0.5, 6000);
      fitCamera(camera, bounds, new Vector3(0.65, 0.8, 0.85));
      expect(c.contains(c.recover(camera.position))).toBe(false);
      const oldDistance = camera.position.distanceTo(
        bounds.getCenter(new Vector3()),
      );
      const target = fitOverview(camera, points, OVERVIEW_DIRECTION);
      expect(camera.position.distanceTo(target)).toBeLessThan(oldDistance);
      expect(c.contains(camera.position)).toBe(false);
      expect(c.distanceToSurface(camera.position)).toBeGreaterThan(1);
      camera.updateMatrixWorld();
      let occupied = 0;
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      for (const point of points) {
        const projected = point.clone().project(camera);
        minX = Math.min(minX, projected.x);
        maxX = Math.max(maxX, projected.x);
        minY = Math.min(minY, projected.y);
        maxY = Math.max(maxY, projected.y);
        occupied = Math.max(
          occupied,
          Math.abs(projected.x),
          Math.abs(projected.y),
        );
      }
      expect(occupied).toBeCloseTo(0.82, 6);
      expect(Math.max(maxX - minX, maxY - minY)).toBeCloseTo(1.64, 6);
      if (aspect === 2) {
        expect((maxX - minX) / 2).toBeGreaterThan(0.75);
        expect((maxX - minX) / 2).toBeLessThan(0.81);
        expect((maxY - minY) / 2).toBeCloseTo(0.82, 6);
      }
      if (process.env.OVERVIEW_REPORT)
        writeFileSync(
          process.env.OVERVIEW_REPORT,
          JSON.stringify({
            aspect,
            width: (maxX - minX) / 2,
            height: (maxY - minY) / 2,
          }) + "\n",
          { flag: "a" },
        );
    }
    expect(
      Array.from(s.terrain.geometry.getAttribute("position").array),
    ).toEqual(prior);
    durations.sort((a, b) => a - b);
    const report = {
      collisionBuildMs: buildMs,
      sweepCount: durations.length,
      sweepMedianMs: durations[Math.floor(durations.length * 0.5)],
      sweepP95Ms: durations[Math.floor(durations.length * 0.95)],
      sweepMaxMs: durations.at(-1),
      ...c.stats(),
    };
    if (process.env.COLLISION_REPORT_PATH)
      writeFileSync(
        process.env.COLLISION_REPORT_PATH,
        JSON.stringify(report, null, 2),
      );
    s.dispose();
  },
  30000,
);
