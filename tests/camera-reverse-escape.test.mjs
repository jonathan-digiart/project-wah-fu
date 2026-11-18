import { test } from "vitest";
import assert from "node:assert/strict";
import {
  PerspectiveCamera,
  Mesh,
  BufferGeometry,
  Float32BufferAttribute,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { attachExteriorCamera } from "../src/exterior-camera-collision.mjs";
// Synthetic local wave only. Centre-fan triangles around the focus reproduce
// the captured orbit/zoom state without a geographic dataset or tile manager.
function terrain() {
  const positions = [];
  const point = (x, z) => [
    x,
    3 * Math.sin(x / 23) * Math.cos(z / 31) + 0.015 * x,
    z,
  ];
  for (let z = 0; z < 64; z += 8)
    for (let x = 0; x < 64; x += 8) {
      const corners = [
          point(x, z),
          point(x + 8, z),
          point(x + 8, z + 8),
          point(x, z + 8),
        ],
        center = point(x + 4, z + 4);
      for (let i = 0; i < 4; i++)
        positions.push(...center, ...corners[(i + 1) % 4], ...corners[i]);
    }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return new Mesh(geometry);
}
for (const height of [1206, 600, 480])
  test(`terrain contact, upward100px orbit and six reverse120 wheels remain useful at ${height}px`, () => {
    const root = terrain(),
      camera = new PerspectiveCamera(48, 2, 0.1, 1000);
    const ground = 1.799319088459015;
    camera.position.set(35, ground + 8, 35);
    const controls = new OrbitControls(camera, null);
    controls.target.set(50, ground, 50);
    controls.minDistance = 1;
    controls.maxDistance = 600;
    controls.maxPolarAngle = Math.PI - 0.04;
    controls.update();
    const attachment = attachExteriorCamera(camera, controls, [root], {
      completeSurfaces: true,
    });
    const safe = () => {
      assert.ok(!attachment.collider.contains(camera.position));
      assert.ok(
        attachment.collider.distanceToSurface(camera.position) >= 1 - 1e-5,
      );
    };
    try {
      for (let i = 0; i < 54; i++) {
        controls.dollyIn(Math.pow(0.95, 1.2));
        safe();
      }
      const radius = camera.position.distanceTo(controls.target),
        target = controls.target.clone();
      controls.rotateUp((-2 * Math.PI * 100) / height);
      safe();
      assert.ok(
        Math.abs(camera.position.distanceTo(controls.target) - radius) < 1e-9,
        "Orbit must preserve radius",
      );
      assert.ok(
        controls.target.distanceTo(target) < 1e-9,
        "Orbit must preserve target",
      );
      const start = camera.position.clone();
      for (let i = 0; i < 6; i++) {
        const previous = camera.position.clone();
        controls.dollyOut(Math.pow(0.95, 1.2));
        safe();
        assert.ok(
          camera.position.distanceTo(previous) > 0.04,
          "Reverse wheel must produce useful movement",
        );
      }
      assert.ok(camera.position.distanceTo(start) > 0.4);
    } finally {
      attachment.dispose();
      root.geometry.dispose();
      root.material.dispose();
    }
  });
