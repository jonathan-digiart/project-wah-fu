import { test } from "vitest";
import assert from "node:assert/strict";
import { Mesh, PlaneGeometry, BoxGeometry, Vector3 } from "three";
import { createExteriorCollider } from "../src/exterior-camera-collision.mjs";
import { constrainReversibleOrbit } from "../src/reversible-orbit.mjs";
function plane() {
  const root = new Mesh(new PlaneGeometry(2000, 2000));
  root.rotation.x = -Math.PI / 2;
  return root;
}
function box(x, y, z, a, b, c) {
  const root = new Mesh(new BoxGeometry(a, b, c));
  root.position.set(x, y, z);
  return root;
}
function clean(roots) {
  for (const root of roots) {
    root.geometry.dispose();
    root.material.dispose();
  }
}
function assertAccepted(collider, previous, target, result) {
  const position = result.position;
  assert.ok(!collider.contains(position));
  assert.ok(collider.distanceToSurface(position) >= 1 - 1e-5);
  assert.ok(
    collider.move(previous, position, 1, false).distanceTo(position) < 1e-5,
  );
  const end = position
    .clone()
    .addScaledVector(
      position.clone().sub(target).normalize(),
      result.probeDistance,
    );
  assert.ok(collider.move(position, end, 1, false).distanceTo(end) < 1e-5);
  assert.ok(
    Math.abs(position.distanceTo(target) - previous.distanceTo(target)) < 1e-9,
  );
  assert.ok(result.queries <= 20);
}
test("safe shallow yaw remains fully usable without requiring steep clearance gain", () => {
  const roots = [plane()];
  try {
    const collider = createExteriorCollider(roots, { completeSurfaces: true }),
      previous = new Vector3(0, 1.1, 20),
      target = new Vector3(),
      requested = previous.clone().applyAxisAngle(new Vector3(0, 1, 0), 0.1);
    const result = constrainReversibleOrbit(
      collider,
      previous,
      target,
      requested,
      1,
    );
    assert.equal(result.fraction, 1);
    assert.ok(result.position.distanceTo(requested) < 1e-9);
    assertAccepted(collider, previous, target, result);
    const end = requested
        .clone()
        .addScaledVector(requested.clone().normalize(), result.probeDistance),
      gain =
        collider.distanceToSurface(end) - collider.distanceToSurface(requested);
    assert.ok(
      gain < 0.1 * result.probeDistance,
      "Fixture must exercise former overrestriction",
    );
  } finally {
    clean(roots);
  }
});
test("near-wall and corner candidates retain swept safety and a full useful reverse path", () => {
  const cases = [
    {
      roots: [plane(), box(0, 3, 0, 2, 6, 2)],
      previous: new Vector3(0, 1.1, 2.1),
      target: new Vector3(0, 1.1, 0),
      angles: [0.1, 0.5, 1.2],
    },
    {
      roots: [plane(), box(-0.5, 3, 5, 1, 6, 12), box(5, 3, -0.5, 12, 6, 1)],
      previous: new Vector3(2.1, 1.1, 2.1),
      target: new Vector3(0, 1.1, 0),
      angles: [-0.6, 0.2, 0.6],
    },
  ];
  for (const fixture of cases) {
    try {
      const collider = createExteriorCollider(fixture.roots, {
        completeSurfaces: true,
      });
      for (const angle of fixture.angles) {
        const requested = fixture.previous
            .clone()
            .sub(fixture.target)
            .applyAxisAngle(new Vector3(0, 1, 0), angle)
            .add(fixture.target),
          result = constrainReversibleOrbit(
            collider,
            fixture.previous,
            fixture.target,
            requested,
            1,
          );
        assertAccepted(collider, fixture.previous, fixture.target, result);
      }
    } finally {
      clean(fixture.roots);
    }
  }
});
