import { describe, expect, it } from "vitest";
import {
  Box3,
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Vector3,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { attachExteriorCamera } from "./exterior-camera-collision.mjs";
import {
  createNavigationBound,
  inspectionOverlap,
  visibleInspection,
} from "./navigation";
import { fitCamera } from "./view";
function setup(aspect: number) {
  const camera = new PerspectiveCamera(45, aspect, 0.5, 6000);
  const mesh = new Mesh(new BoxGeometry(40, 40, 20), new MeshBasicMaterial());
  mesh.position.y = 20;
  mesh.updateMatrixWorld();
  const bounds = new Box3().setFromObject(mesh);
  let activeBounds = bounds;
  const controls = new OrbitControls(camera);
  controls.target.copy(fitCamera(camera, bounds, new Vector3(0, 0.3, 1)));
  controls.update();
  const accepts = createNavigationBound(camera, () => activeBounds);
  const guard = attachExteriorCamera(camera, controls, [mesh], {
    clearance: 1,
    completeSurfaces: true,
    containsPoint: (_root, p) => bounds.containsPoint(p),
    acceptNavigationPose: accepts,
  });
  const request = (position: Vector3, target: Vector3) => {
    camera.position.copy(position);
    controls.target.copy(target);
    controls.update();
  };
  const pan = (delta: Vector3) =>
    request(
      camera.position.clone().add(delta),
      controls.target.clone().add(delta),
    );
  const safe = () => {
    expect(guard.collider.contains(camera.position)).toBe(false);
    expect(
      guard.collider.distanceToSurface(camera.position),
    ).toBeGreaterThanOrEqual(0.99999);
    expect(accepts(camera.position, controls.target)).toBe(true);
  };
  return {
    camera,
    controls,
    mesh,
    bounds,
    guard,
    accepts,
    request,
    pan,
    safe,
    setBounds: (b: Box3) => {
      activeBounds = b;
    },
    dispose: () => {
      guard.dispose();
      mesh.geometry.dispose();
      mesh.material.dispose();
    },
  };
}
describe("aspect-aware bounded navigation", () => {
  for (const aspect of [1280 / 800, 390 / 844, 844 / 390])
    it(`repeated outward pan stops and a single reverse input responds at aspect ${aspect}`, () => {
      const s = setup(aspect),
        start = s.camera.position.clone();
      for (let i = 0; i < 100; i++) {
        s.pan(new Vector3(5, 0, 0));
        s.safe();
      }
      expect(s.camera.position.x - start.x).toBeGreaterThan(10);
      const edge = s.camera.position.clone(),
        target = s.controls.target.clone(),
        radius = edge.distanceTo(target);
      for (let i = 0; i < 20; i++) {
        s.pan(new Vector3(5, 0, 0));
        s.safe();
        expect(s.camera.position.distanceTo(edge)).toBeLessThan(1e-4);
      }
      s.pan(new Vector3(-5, 0, 0));
      s.safe();
      expect(s.camera.position.x).toBeCloseTo(edge.x - 5, 4);
      expect(s.camera.position.distanceTo(s.controls.target)).toBeCloseTo(
        radius,
        5,
      );
      s.dispose();
    });
  it("orbit and zoom at the pan boundary retain overlap without a forced recenter", () => {
    const s = setup(390 / 844);
    for (let i = 0; i < 100; i++) s.pan(new Vector3(5, 0, 0));
    for (let i = 0; i < 120; i++) {
      const before = s.camera.position.clone(),
        target = s.controls.target.clone();
      const offset = before
        .clone()
        .sub(target)
        .applyAxisAngle(new Vector3(0, 1, 0), 0.025);
      const requested = target.clone().add(offset);
      s.request(requested, target);
      s.safe();
      expect(s.camera.position.distanceTo(before)).toBeLessThanOrEqual(
        requested.distanceTo(before) + 0.001,
      );
      expect(s.controls.target.distanceTo(target)).toBeLessThan(1e-8);
    }
    for (let i = 0; i < 30; i++) {
      const target = s.controls.target.clone(),
        offset = s.camera.position.clone().sub(target);
      s.request(target.clone().addScaledVector(offset, 0.95), target);
      s.safe();
    }
    const before = s.camera.position.clone(),
      target = s.controls.target.clone();
    s.request(
      target.clone().addScaledVector(before.clone().sub(target), 1.1),
      target,
    );
    s.safe();
    expect(s.camera.position.distanceTo(target)).toBeGreaterThanOrEqual(
      before.distanceTo(target) - 1e-5,
    );
    s.dispose();
  });
  it("wall collisions and view boundaries do not alternate corrections or allow escape", () => {
    const s = setup(1280 / 800);
    s.guard.teleport(() => {
      s.camera.position.set(0, 20, 30);
      s.controls.target.set(0, 20, 0);
      s.controls.update();
    });
    for (let i = 0; i < 40; i++) {
      s.pan(new Vector3(0, 0, -2));
      s.safe();
    }
    const blocked = s.camera.position.clone();
    for (let i = 0; i < 30; i++) {
      s.pan(new Vector3(0, 0, -2));
      s.safe();
      expect(s.camera.position.distanceTo(blocked)).toBeLessThan(1e-4);
    }
    s.pan(new Vector3(0, 0, 2));
    s.safe();
    expect(s.camera.position.z).toBeGreaterThan(blocked.z + 1.99);
    for (let i = 0; i < 60; i++) {
      s.pan(new Vector3(2, -0.25, 0));
      s.safe();
    }
    const edge = s.camera.position.clone();
    for (let i = 0; i < 20; i++) {
      s.pan(new Vector3(2, -0.25, 0));
      s.safe();
      expect(s.camera.position.distanceTo(edge)).toBeLessThan(1e-4);
    }
    s.dispose();
  });
  it("reset/focus and resize recover even from an initially invalid pose", () => {
    const s = setup(1);
    s.guard.teleport(() => {
      s.camera.position.set(2000, 100, 300);
      s.controls.target.set(2000, 10, 0);
      s.controls.update();
    });
    expect(s.accepts(s.camera.position, s.controls.target)).toBe(false);
    for (const aspect of [390 / 844, 844 / 390, 1280 / 800])
      for (let repeat = 0; repeat < 3; repeat++) {
        s.camera.aspect = aspect;
        s.camera.updateProjectionMatrix();
        s.setBounds(s.bounds);
        s.guard.teleport(() => {
          s.controls.target.copy(
            fitCamera(s.camera, s.bounds, new Vector3(0.4, 0.8, 1)),
          );
          s.controls.update();
        });
        s.safe();
        const selected = s.bounds.clone().expandByScalar(-5);
        s.setBounds(selected);
        s.guard.teleport(() => {
          s.controls.target.copy(
            fitCamera(s.camera, selected, new Vector3(0, 0.1, 1)),
          );
          s.controls.update();
        });
        s.safe();
      }
    s.dispose();
  });
  it("hiding the focused context clears selection and changes bounds without recentering", () => {
    for (const aspect of [1280 / 800, 390 / 844, 844 / 390]) {
      const s = setup(aspect);
      s.mesh.userData.reviewId = "estate";
      const context = new Mesh(
        new BoxGeometry(20, 30, 20),
        new MeshBasicMaterial(),
      );
      context.position.set(500, 15, 0);
      context.userData.reviewId = "context";
      const terrain = new Mesh(
        new BoxGeometry(200, 1, 200),
        new MeshBasicMaterial(),
      );
      terrain.position.y = -1;
      const objects = [s.mesh, context];
      let state = visibleInspection(terrain, objects, "context");
      expect(state.selection).toBe("context");
      s.setBounds(state.bounds);
      s.guard.teleport(() => {
        s.controls.target.copy(
          fitCamera(s.camera, state.bounds, new Vector3(0, 0.3, 1)),
        );
        s.controls.update();
      });
      const position = s.camera.position.clone(),
        target = s.controls.target.clone();
      context.visible = false;
      state = visibleInspection(terrain, objects, state.selection);
      s.setBounds(state.bounds);
      expect(state.selection).toBeUndefined();
      expect(state.bounds.max.x).toBe(100);
      expect(s.camera.position).toEqual(position);
      expect(s.controls.target).toEqual(target);
      expect(s.accepts(s.camera.position, s.controls.target)).toBe(false);
      // The new volume may start offscreen. One inward pan must still work.
      s.pan(new Vector3(-5, 0, 0));
      expect(s.camera.position.x).toBeCloseTo(position.x - 5, 8);
      expect(s.controls.target.x).toBeCloseTo(target.x - 5, 8);
      const inwardPosition = s.camera.position.clone(),
        inwardTarget = s.controls.target.clone();
      context.visible = true;
      state = visibleInspection(terrain, objects, state.selection);
      s.setBounds(state.bounds);
      expect(state.selection).toBeUndefined();
      expect(state.bounds.max.x).toBe(510);
      expect(s.camera.position).toEqual(inwardPosition);
      expect(s.controls.target).toEqual(inwardTarget);
      context.visible = false;
      expect(visibleInspection(terrain, objects, "estate").selection).toBe(
        "estate",
      );
      s.guard.teleport(() => {
        s.controls.target.copy(
          fitCamera(s.camera, state.bounds, new Vector3(0, 0.3, 1)),
        );
        s.controls.update();
      });
      s.safe();
      terrain.geometry.dispose();
      terrain.material.dispose();
      context.geometry.dispose();
      context.material.dispose();
      s.dispose();
    }
  });
  it("target-only navigation cannot bypass the view bound", () => {
    const s = setup(390 / 844);
    const position = s.camera.position.clone();
    s.controls.target.x += 2000;
    s.controls.update();
    s.safe();
    expect(s.camera.position.distanceTo(position)).toBeLessThan(1e-6);
    expect(s.controls.target.x).toBeLessThan(2000);
    s.dispose();
  });
  it("handles near-clipped, behind-camera and degenerate inspection projections", () => {
    const camera = new PerspectiveCamera(45, 1, 0.5, 6000),
      box = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
    expect(
      inspectionOverlap(
        camera,
        box,
        new Vector3(0, 0, 5),
        new Vector3(0, 0, 10),
      ),
    ).toBe(0);
    expect(
      inspectionOverlap(
        camera,
        box,
        new Vector3(0, 0, 0.75),
        new Vector3(0, 0, -5),
      ),
    ).toBeGreaterThan(0.99);
    expect(inspectionOverlap(camera, box, new Vector3(), new Vector3())).toBe(
      0,
    );
    expect(
      inspectionOverlap(
        camera,
        new Box3(),
        new Vector3(0, 0, 5),
        new Vector3(),
      ),
    ).toBe(0);
    expect(
      inspectionOverlap(camera, box, new Vector3(0, 5, 0), new Vector3()),
    ).toBe(0);
    expect(() => createNavigationBound(camera, () => box, 1)).toThrow();
  });
});
