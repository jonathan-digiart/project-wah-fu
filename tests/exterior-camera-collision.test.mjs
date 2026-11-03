import { test } from "vitest";
import assert from "node:assert/strict";
import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Vector3,
} from "three";
import {
  createExteriorCollider as createConfiguredCollider,
  attachExteriorCamera as attachConfiguredCamera,
  EXTERIOR_CAMERA,
} from "../src/exterior-camera-collision.mjs";
// Retain small-radius numerical regressions as a configurable geometry check.
const createExteriorCollider = (roots, options = {}) =>
  createConfiguredCollider(roots, { clearance: 0.05, ...options });
const attachExteriorCamera = (camera, controls, roots, options = {}) =>
  attachConfiguredCamera(camera, controls, roots, {
    clearance: 0.05,
    ...options,
  });
const v = (x, y, z) => new Vector3(x, y, z);
function box(x = 0, y = 0, z = 0, w = 2, h = 2, d = 2) {
  const mesh = new Mesh(new BoxGeometry(w, h, d), new MeshBasicMaterial());
  mesh.position.set(x, y, z);
  return mesh;
}
const close = (a, b, e = 2e-5) => assert(Math.abs(a - b) < e, `${a} != ${b}`);
test("5 cm clearance, full-distance wheel sweep and exact near-wall approach", () => {
  const c = createExteriorCollider([box()]);
  const p = c.move(v(-100, 0, 0), v(100, 0, 0));
  close(p.x, -1.05);
  close(p.y, 0);
  assert(!c.contains(p));
  close(c.move(v(-2, 0, 0), v(-1.06, 0, 0)).x, -1.06);
});
test("slide tangentially along facade instead of cancelling pan", () => {
  const c = createExteriorCollider([box(0, 0, 0, 2, 200, 200)]);
  const p = c.move(v(-2, 0, 0), v(0, 4, 3), 0.05, true);
  close(p.x, -1.05);
  close(p.y, 4);
  close(p.z, 3);
});
test("roof and underside sweeps cannot enter; clear travel above roof stays free", () => {
  const c = createExteriorCollider([box()]);
  close(c.move(v(0, 100, 0), v(0, -100, 0)).y, 1.05);
  close(c.move(v(0, -100, 0), v(0, 100, 0)).y, -1.05);
  close(c.move(v(-10, 1.06, 0), v(10, 1.06, 0)).x, 10);
});
test("starting inside recovers to exterior with centimetre clearance", () => {
  const c = createExteriorCollider([box()]);
  assert(c.contains(v(0, 0, 0)));
  const p = c.recover(v(0.7, 0, 0));
  assert(!c.contains(p));
  close(p.x, 1.05);
});
test("concave courtyard and gaps are not filled by broad-phase boxes", () => {
  const root = new Group();
  root.add(
    box(-3, 0, 0, 2, 4, 8),
    box(3, 0, 0, 2, 4, 8),
    box(0, 0, -3, 4, 4, 2),
  );
  const c = createExteriorCollider([root]);
  assert(!c.contains(v(0, 0, 0)));
  const p = c.move(v(0, 0, 10), v(0, 0, -1.8));
  close(p.z, -1.8);
  close(c.move(v(0, 0, 2), v(0, 0, -4)).z, -1.95);
});
test("an open photo plane is not a solid but its surface blocks crossings", () => {
  const g = new BufferGeometry();
  g.setAttribute(
    "position",
    new Float32BufferAttribute(
      [0, -1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1],
      3,
    ),
  );
  const c = createExteriorCollider([new Mesh(g)]);
  assert(!c.contains(v(0.2, 0, 0)));
  close(c.move(v(-2, 0, 0), v(2, 0, 0)).x, -0.05);
});
test("edge and corner grazes use sphere clearance, not just center rays", () => {
  const c = createExteriorCollider([box()]);
  const p = c.move(v(-3, 1.03, 0), v(3, 1.03, 0));
  assert(p.y >= 1.049 || p.x < -1, "edge cannot tunnel");
  const free = c.move(v(-3, 1.06, 1.06), v(3, 1.06, 1.06));
  close(free.x, 3);
});
test("physical shell remains while hidden; optional visible-only mode is reversible", () => {
  const root = box();
  root.visible = false;
  assert(createExteriorCollider([root]).move(v(-3, 0, 0), v(3, 0, 0)).x < 0);
  close(
    createExteriorCollider([root], { collideHidden: false }).move(
      v(-3, 0, 0),
      v(3, 0, 0),
    ).x,
    3,
  );
});
test("narrow open paths stay open, separate buildings remain separate solids", () => {
  const c = createExteriorCollider([box(-1.2, 0, 0), box(1.2, 0, 0)]);
  const p = c.move(v(0, 0, 10), v(0, 0, -10));
  close(p.z, -10);
  assert(!c.contains(p));
});
test("named camera poses may cross building to other exterior side; dispose/reload cleanly", () => {
  const camera = new PerspectiveCamera(37, 3, 0.1, 2000);
  camera.position.set(-3, 0, 0);
  const listeners = new Set();
  const controls = {
    target: v(0, 0, 0),
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  };
  const guard = attachExteriorCamera(camera, controls, [box()]);
  guard.teleport(() => camera.position.set(3, 0, 0));
  close(camera.position.x, 3);
  assert(camera.near < 0.05);
  camera.position.set(-3, 0, 0);
  listeners.forEach((fn) => fn());
  assert(camera.position.x >= 1.049);
  guard.dispose();
  assert.equal(listeners.size, 0);
});
test("repeated push, release and reversal do not jitter or trap the camera", () => {
  const c = createExteriorCollider([box()]);
  let p = v(-2, 0, 0);
  for (let i = 0; i < 200; i++) p = c.move(p, p.clone().add(v(0.4, 0, 0)));
  close(p.x, -1.05);
  p = c.move(p, p.clone().add(v(-0.01, 0, 0)));
  close(p.x, -1.06);
});
test("continuous solid checks stop outside-to-outside travel through opposing missing faces", () => {
  const geometry = new BoxGeometry(2, 2, 2).toNonIndexed(),
    a = geometry.attributes.position.array;
  // BoxGeometry writes the +/- X sides first; leave the other four faces.
  geometry.setAttribute("position", new Float32BufferAttribute(a.slice(36), 3));
  const c = createExteriorCollider([new Mesh(geometry)]);
  assert(c.contains(v(0, 0, 0)));
  const p = c.move(v(-100, 0, 0), v(100, 0, 0));
  assert(p.x < 0);
  assert(!c.contains(p));
  const free = c.move(v(-100, 2, 0), v(100, 2, 0));
  close(free.x, 100);
});
test("continuous interior intervals do not close a concave courtyard", () => {
  const root = new Group();
  root.add(
    box(-3, 0, 0, 2, 4, 8),
    box(3, 0, 0, 2, 4, 8),
    box(0, 0, -3, 4, 4, 2),
  );
  const c = createExteriorCollider([root]);
  const p = c.move(v(0, 0, 100), v(0, 0, -1));
  close(p.z, -1);
});

import { OrbitControls } from "three/addons/controls/OrbitControls.js";
function orbit(position, target = v(0, 0, 0)) {
  const camera = new PerspectiveCamera(37, 1.5, 0.03, 2000);
  camera.position.copy(position);
  const controls = new OrbitControls(camera);
  controls.domElement = { clientHeight: 900, clientWidth: 1350 };
  controls.target.copy(target);
  controls.screenSpacePanning = true;
  controls.update();
  camera.updateMatrixWorld(true);
  return { camera, controls };
}
test("real OrbitControls free orbit, pan, tilt and dolly are unchanged", () => {
  const a = orbit(v(0, 3, 8)),
    b = orbit(v(0, 3, 8));
  const guard = attachExteriorCamera(b.camera, b.controls, [box()]);
  for (const [method, value] of [
    ["rotateLeft", 0.25],
    ["rotateUp", 0.15],
    ["pan", 30],
    ["dollyIn", 0.8],
    ["dollyOut", 0.8],
  ]) {
    a.camera.updateMatrixWorld(true);
    b.camera.updateMatrixWorld(true);
    if (method === "pan") {
      a.controls.pan(value, 20);
      b.controls.pan(value, 20);
    } else {
      a.controls[method](value);
      b.controls[method](value);
    }
    assert(
      a.camera.position.distanceTo(b.camera.position) < 1e-9,
      method + " camera changed",
    );
    assert(
      a.controls.target.distanceTo(b.controls.target) < 1e-9,
      method + " target changed",
    );
  }
  guard.dispose();
});
test("real OrbitControls blocked pan translates target by the camera correction", () => {
  const a = orbit(v(-3, 0, 0), v(-3, 0, -5)),
    b = orbit(v(-3, 0, 0), v(-3, 0, -5));
  const guard = attachExteriorCamera(b.camera, b.controls, [box()]);
  a.controls.pan(-1000, 0);
  b.controls.pan(-1000, 0);
  const correction = b.camera.position.clone().sub(a.camera.position),
    targetCorrection = b.controls.target.clone().sub(a.controls.target);
  assert(correction.length() > 0.1);
  assert(correction.distanceTo(targetCorrection) < 1e-9);
  assert(!guard.collider.contains(b.camera.position));
  close(guard.collider.distanceToSurface(b.camera.position), 0.05);
  guard.dispose();
});
test("real OrbitControls repeated damped dolly stops outside and can reverse", () => {
  const { camera, controls } = orbit(v(-3, 0, 0));
  controls.enableDamping = true;
  const guard = attachExteriorCamera(camera, controls, [box()]);
  for (let i = 0; i < 30; i++) {
    controls.dollyIn(0.1);
    controls.update();
    guard.apply();
    assert(!guard.collider.contains(camera.position));
    assert(guard.collider.distanceToSurface(camera.position) >= 0.05 - 1e-5);
  }
  const before = camera.position.clone();
  controls.dollyOut(0.9);
  controls.update();
  guard.apply();
  assert(camera.position.distanceTo(before) > 0.01);
  guard.dispose();
});
test("near-plane corners fit within clearance even at extreme aspect ratios", () => {
  for (const aspect of [0.3, 1, 1.5, 4, 10]) {
    const { camera, controls } = orbit(v(-3, 0, 0));
    camera.aspect = aspect;
    camera.near = 0.1;
    const guard = attachExteriorCamera(camera, controls, [box()]);
    const tangent = Math.tan((camera.fov * Math.PI) / 360),
      radius =
        camera.near * Math.sqrt(1 + tangent * tangent * (1 + aspect * aspect));
    assert(radius <= 0.04500001);
    guard.dispose();
  }
});

test("requested exterior default is one metre and supports a two metre buffer", () => {
  assert.equal(EXTERIOR_CAMERA.clearance, 1);
  for (const radius of [1, 2]) {
    const c = createConfiguredCollider([box()], { clearance: radius });
    const p = c.move(v(-10, 0, 0), v(10, 0, 0));
    close(p.x, -1 - radius);
    assert(c.distanceToSurface(p) >= radius - 1e-6);
  }
});
test("one metre clearance preserves a real-width courtyard while rejecting too-narrow gaps", () => {
  const root = new Group();
  root.add(
    box(-4, 0, 0, 2, 8, 10),
    box(4, 0, 0, 2, 8, 10),
    box(0, 0, -4, 6, 8, 2),
  );
  const c = createConfiguredCollider([root]);
  assert(!c.contains(v(0, 0, 0)));
  close(c.move(v(0, 0, 20), v(0, 0, -1)).z, -1);
  const narrow = createConfiguredCollider([
    box(-1.5, 0, 0, 2, 8, 10),
    box(1.5, 0, 0, 2, 8, 10),
  ]);
  const p = narrow.move(v(0, 0, 20), v(0, 0, -20));
  assert(p.z > 5);
  assert(narrow.distanceToSurface(p) >= 1 - 1e-6);
});

test("blocked off-centre wheel zoom cannot collapse the orbit target or slow pan/reverse zoom", () => {
  for (const minimumDistance of [0.25, 0.65])
    for (const damping of [false, true])
      for (const closeUp of [false, true]) {
        const { camera, controls } = orbit(v(0, 0, -11.00001));
        controls.domElement.getBoundingClientRect = () => ({
          left: 0,
          top: 0,
          width: 1350,
          height: 900,
        });
        controls.minDistance = minimumDistance;
        controls.zoomToCursor = true;
        controls.enableDamping = damping;
        const guard = attachConfiguredCamera(camera, controls, [
            box(0, 0, 0, 100, 100, 20),
          ]),
          initialRadius = camera.position.distanceTo(controls.target),
          initialTarget = controls.target.clone();
        guard.setSurfaceCloseUp(closeUp);
        for (let i = 0; i < 100; i++) {
          camera.updateMatrixWorld(true);
          controls._handleMouseWheel({
            clientX: 950,
            clientY: 350,
            deltaY: -100,
          });
          guard.apply();
        }
        assert(
          camera.position.distanceTo(controls.target) > initialRadius - 0.0001,
          "Rejected zoom must not shorten the orbit radius",
        );
        assert(
          controls.target.distanceTo(initialTarget) < 0.0001,
          "Blocked cursor zoom must not pull the orbit target to the camera",
        );
        const before = camera.position.clone();
        camera.updateMatrixWorld(true);
        controls._handleMouseWheel({ clientX: 950, clientY: 350, deltaY: 100 });
        guard.apply();
        assert(
          camera.position.distanceTo(before) > 0.5,
          "One reverse wheel event should move away normally",
        );
        const reference = orbit(camera.position, controls.target);
        reference.controls.enableDamping = damping;
        camera.updateMatrixWorld(true);
        reference.camera.updateMatrixWorld(true);
        controls.pan(40, 15);
        reference.controls.pan(40, 15);
        guard.apply();
        assert(
          camera.position.distanceTo(reference.camera.position) < 1e-7,
          "Pan should retain its normal scale after blocked zoom",
        );
        guard.dispose();
      }
});

test("unblocked off-centre wheel navigation stays identical to original OrbitControls", () => {
  const a = orbit(v(0, 0, -100)),
    b = orbit(v(0, 0, -100));
  for (const item of [a, b]) {
    item.controls.domElement.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 1350,
      height: 900,
    });
    item.controls.zoomToCursor = true;
    item.camera.updateMatrixWorld(true);
  }
  const guard = attachConfiguredCamera(b.camera, b.controls, [
    box(0, 0, 0, 100, 100, 20),
  ]);
  for (const deltaY of [-100, -100, 100, -100, 100]) {
    for (const item of [a, b]) {
      item.camera.updateMatrixWorld(true);
      item.controls._handleMouseWheel({ clientX: 1000, clientY: 200, deltaY });
    }
    guard.apply();
    assert(a.camera.position.distanceTo(b.camera.position) < 1e-8);
    assert(a.controls.target.distanceTo(b.controls.target) < 1e-8);
  }
  guard.dispose();
});
test("partially accepted cursor zoom applies the same fraction to camera and target", () => {
  const a = orbit(v(0, 0, -13)),
    b = orbit(v(0, 0, -13)),
    start = b.camera.position.clone(),
    target = b.controls.target.clone();
  for (const item of [a, b]) {
    item.controls.domElement.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 1350,
      height: 900,
    });
    item.controls.zoomToCursor = true;
    item.camera.updateMatrixWorld(true);
  }
  const guard = attachConfiguredCamera(b.camera, b.controls, [
    box(0, 0, 0, 100, 100, 20),
  ]);
  for (const item of [a, b])
    item.controls._handleMouseWheel({
      clientX: 950,
      clientY: 350,
      deltaY: -1000,
    });
  const requested = a.camera.position.clone().sub(start),
    accepted =
      b.camera.position.clone().sub(start).dot(requested) /
      requested.lengthSq();
  assert(accepted > 0 && accepted < 1);
  const expected = target.clone().lerp(a.controls.target, accepted);
  assert(expected.distanceTo(b.controls.target) < 1e-8);
  assert(guard.collider.distanceToSurface(b.camera.position) >= 1 - 1e-6);
  guard.dispose();
});

test("surface close-up can look upward from a podium without lowering the camera", () => {
  const { camera, controls } = orbit(v(0, 1.00001, 10));
  controls.maxPolarAngle = Math.PI * 0.4999;
  const originalLimit = controls.maxPolarAngle;
  const guard = attachConfiguredCamera(camera, controls, [
      box(0, -1, 0, 100, 2, 100),
    ]),
    start = camera.position.clone();
  guard.setSurfaceCloseUp(true);
  for (let i = 0; i < 4; i++) {
    camera.updateMatrixWorld(true);
    controls.rotateUp(-0.3);
    guard.apply();
  }
  assert(
    camera.getWorldDirection(new Vector3()).y > 0.8,
    "Close-up must allow a useful upward angle",
  );
  assert(
    camera.position.distanceTo(start) < 1e-8,
    "Vertical close-up tilt must not move into the podium",
  );
  assert(guard.collider.distanceToSurface(camera.position) >= 1 - 1e-6);
  const beforeReverse = camera.getWorldDirection(new Vector3()).y;
  controls.rotateUp(0.3);
  guard.apply();
  assert(camera.getWorldDirection(new Vector3()).y < beforeReverse);
  close(camera.position.y, start.y);
  guard.setSurfaceCloseUp(false);
  assert.equal(controls.maxPolarAngle, originalLimit);
  guard.dispose();
});
test("close-up horizontal orbit, pan and cursor zoom retain existing movement", () => {
  const a = orbit(v(0, 3, -30)),
    b = orbit(v(0, 3, -30));
  for (const item of [a, b]) {
    item.controls.maxPolarAngle = Math.PI * 0.4999;
    item.controls.zoomToCursor = true;
    item.controls.domElement.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 1350,
      height: 900,
    });
  }
  const guard = attachConfiguredCamera(b.camera, b.controls, [box()]);
  guard.setSurfaceCloseUp(true);
  for (const action of ["horizontal", "pan", "wheel"]) {
    for (const item of [a, b]) {
      item.camera.updateMatrixWorld(true);
      if (action === "horizontal") item.controls.rotateLeft(0.2);
      else if (action === "pan") item.controls.pan(20, 15);
      else
        item.controls._handleMouseWheel({
          clientX: 950,
          clientY: 350,
          deltaY: -100,
        });
    }
    guard.apply();
    assert(
      a.camera.position.distanceTo(b.camera.position) < 1e-8,
      action + " camera",
    );
    assert(
      a.controls.target.distanceTo(b.controls.target) < 1e-8,
      action + " target",
    );
  }
  guard.dispose();
});
test("normal estate orbit keeps its original cap and close-up mode does not leak across disposal", () => {
  const { camera, controls } = orbit(v(0, 3, 10));
  controls.maxPolarAngle = Math.PI * 0.4999;
  const original = controls.maxPolarAngle,
    guard = attachConfiguredCamera(camera, controls, [box(100, 0, 0)]);
  controls.rotateUp(-2);
  guard.apply();
  assert(camera.getWorldDirection(new Vector3()).y <= 0);
  guard.setSurfaceCloseUp(true);
  assert(controls.maxPolarAngle > Math.PI / 2);
  guard.dispose();
  assert.equal(controls.maxPolarAngle, original);
});
test("damped close-up tilt keeps elevation even without a terrain collider and reverses", () => {
  const { camera, controls } = orbit(v(0, 0.2, 10));
  controls.maxPolarAngle = Math.PI * 0.4999;
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  const guard = attachConfiguredCamera(camera, controls, []);
  guard.setSurfaceCloseUp(true);
  const start = camera.position.clone();
  controls.rotateUp(-1.2);
  for (let i = 0; i < 100; i++) {
    controls.update();
    guard.apply();
  }
  assert(camera.getWorldDirection(new Vector3()).y > 0.8);
  assert(camera.position.distanceTo(start) < 1e-7);
  const up = camera.getWorldDirection(new Vector3()).y;
  controls.rotateUp(0.5);
  for (let i = 0; i < 100; i++) {
    controls.update();
    guard.apply();
  }
  assert(camera.getWorldDirection(new Vector3()).y < up - 0.2);
  assert(camera.position.distanceTo(start) < 1e-7);
  guard.dispose();
});
test("repeated close-up tilt clamps without radius drift, settles, zooms and exits cleanly", () => {
  for (const damping of [false, true]) {
    const { camera, controls } = orbit(v(0, 1.00001, 10));
    controls.maxPolarAngle = Math.PI * 0.4999;
    controls.enableDamping = damping;
    controls.dampingFactor = 0.09;
    controls.zoomToCursor = true;
    controls.domElement.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 1350,
      height: 900,
    });
    const guard = attachConfiguredCamera(camera, controls, [
      box(0, -1, 0, 100, 2, 100),
    ]);
    guard.setSurfaceCloseUp(true);
    const start = camera.position.clone(),
      radius = camera.position.distanceTo(controls.target);
    for (let i = 0; i < 100; i++) {
      controls.rotateUp(-0.3);
      controls.update();
      guard.apply();
    }
    for (let i = 0; i < 200; i++) {
      controls.update();
      guard.apply();
    }
    assert(camera.position.distanceTo(start) < 1e-7);
    close(camera.position.distanceTo(controls.target), radius);
    const settled = controls.target.clone();
    for (let i = 0; i < 100; i++) {
      controls.update();
      guard.apply();
    }
    assert(
      controls.target.distanceTo(settled) < 1e-7,
      "Released tilt must stop moving the target",
    );
    const reference = orbit(camera.position, controls.target);
    reference.controls.zoomToCursor = true;
    reference.controls.domElement.getBoundingClientRect =
      controls.domElement.getBoundingClientRect;
    for (const item of [{ camera, controls }, reference]) {
      item.camera.updateMatrixWorld(true);
      item.controls._handleMouseWheel({
        clientX: 675,
        clientY: 450,
        deltaY: -100,
      });
    }
    guard.apply();
    assert(
      camera.position.distanceTo(reference.camera.position) < 1e-7,
      "Upward zoom should move normally",
    );
    assert(guard.collider.distanceToSurface(camera.position) >= 1 - 1e-6);
    guard.setSurfaceCloseUp(false);
    guard.teleport(() => {
      controls.enableDamping = false;
      controls.update();
      camera.position.set(0, 30, 100);
      controls.target.set(0, 0, 0);
      controls.update();
      controls.enableDamping = damping;
    });
    const resetEye = camera.position.clone(),
      resetTarget = controls.target.clone();
    for (let i = 0; i < 100; i++) {
      controls.update();
      guard.apply();
    }
    assert(camera.position.distanceTo(resetEye) < 1e-7);
    assert(controls.target.distanceTo(resetTarget) < 1e-7);
    assert.equal(controls.maxPolarAngle, Math.PI * 0.4999);
    guard.dispose();
  }
});

test("rebuilding a cropped collider removes old walls while preserving retained physical shells", () => {
  const removed = box(-4, 0, 0),
    retained = box(4, 0, 0);
  const original = createExteriorCollider([removed, retained]);
  assert(original.move(v(-10, 0, 0), v(0, 0, 0)).x < -5);
  const cropped = createExteriorCollider([retained]);
  assert.equal(cropped.stats().buildings, 1);
  close(cropped.move(v(-10, 0, 0), v(0, 0, 0)).x, 0);
  assert(!cropped.contains(v(-4, 0, 0)));
  close(cropped.move(v(0, 0, 0), v(10, 0, 0)).x, 2.95);
  retained.visible = false;
  close(cropped.move(v(0, 0, 0), v(10, 0, 0)).x, 2.95);
});
