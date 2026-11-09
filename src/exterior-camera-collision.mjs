import { constrainReversibleOrbit } from "./reversible-orbit.mjs";
import { Box3, Ray, Triangle, Vector3 } from "three";

// Coordinates in all three viewers are metres. This is physical camera
// clearance, not a minimum orbit radius or an expanded building bounding box.
// Exterior default requested by the user; smaller interior clearances are a
// separate future mode. Set clearance to 2 for a more generous exterior buffer.
export const EXTERIOR_CAMERA = Object.freeze({
  enabled: true,
  clearance: 1,
  collideHidden: true,
});
const EPS = 1e-6;
const AXES = [
  new Vector3(1, 0.137, 0.071),
  new Vector3(-1, -0.137, -0.071),
  new Vector3(0.053, 1, 0.119),
  new Vector3(-0.053, -1, -0.119),
  new Vector3(0.097, 0.031, 1),
  new Vector3(-0.097, -0.031, -1),
].map((v) => v.normalize());
const point = new Vector3();

// Only packed world-space vertices and BVH leaf indices are retained. Keep
// temporary triangle vectors reusable; do not allocate an object graph for
// every triangle of the estate.
const scratchTriangle = new Triangle(),
  scratchNormal = new Vector3();
const scratchRecord = {
  a: scratchTriangle.a,
  b: scratchTriangle.b,
  c: scratchTriangle.c,
  triangle: scratchTriangle,
  normal: scratchNormal,
};
function readTriangle(data, index) {
  const offset = index * 9;
  scratchTriangle.a.fromArray(data.positions, offset);
  scratchTriangle.b.fromArray(data.positions, offset + 3);
  scratchTriangle.c.fromArray(data.positions, offset + 6);
  scratchTriangle.getNormal(scratchNormal);
  return scratchRecord;
}
function tree(indices, data, bounds) {
  const box = new Box3();
  for (const id of indices) {
    const o = id * 6;
    box.min.x = Math.min(box.min.x, bounds[o]);
    box.min.y = Math.min(box.min.y, bounds[o + 1]);
    box.min.z = Math.min(box.min.z, bounds[o + 2]);
    box.max.x = Math.max(box.max.x, bounds[o + 3]);
    box.max.y = Math.max(box.max.y, bounds[o + 4]);
    box.max.z = Math.max(box.max.z, bounds[o + 5]);
  }
  if (indices.length <= 12) return { box, indices, data };
  const size = box.getSize(new Vector3()),
    axis =
      size.x > size.y ? (size.x > size.z ? 0 : 2) : size.y > size.z ? 1 : 2;
  indices.sort(
    (a, b) =>
      bounds[a * 6 + axis] +
      bounds[a * 6 + axis + 3] -
      (bounds[b * 6 + axis] + bounds[b * 6 + axis + 3]),
  );
  const half = indices.length >> 1;
  return {
    box,
    left: tree(indices.subarray(0, half), data, bounds),
    right: tree(indices.subarray(half), data, bounds),
  };
}
function query(node, box, out) {
  if (!node.box.intersectsBox(box)) return;
  if (node.indices) out.push(...node.indices);
  else {
    query(node.left, box, out);
    query(node.right, box, out);
  }
}
function intersections(node, ray, out) {
  if (!ray.intersectsBox(node.box)) return;
  if (node.indices) {
    for (const id of node.indices) {
      const t = readTriangle(node.data, id);
      if (ray.intersectTriangle(t.a, t.b, t.c, false, point)) {
        const distance = point.distanceTo(ray.origin);
        if (distance > EPS) out.push(distance);
      }
    }
  } else {
    intersections(node.left, ray, out);
    intersections(node.right, ray, out);
  }
}
function parity(solid, p, direction) {
  const hits = [];
  intersections(solid.tree, new Ray(p, direction), hits);
  hits.sort((a, b) => a - b);
  let unique = 0,
    last = -Infinity;
  for (const hit of hits)
    if (hit - last > 1e-4) {
      unique++;
      last = hit;
    }
  return unique % 2 === 1;
}
function contains(solid, p) {
  if (!solid.tree.box.containsPoint(p)) return false;
  // Opposed rays prevent a single open photo/railing sheet becoming a solid.
  // A supermajority tolerates source T-junctions and one open underside; the
  // actual triangle sweep remains authoritative at every visible surface.
  let votes = 0;
  for (let i = 0; i < AXES.length; i++) {
    if (parity(solid, p, AXES[i])) votes++;
    if (votes >= 4) return true;
    if (votes + AXES.length - i - 1 < 4) return false;
  }
  return false;
}
// A containment vote changes only when its ray crosses a triangle edge (or
// its origin crosses a face). Partition the complete movement at those events
// and test the open intervals. This detects an outside-to-outside passage
// through missing opposing faces without fixed sampling or box-shaped solids.
function projectionCandidates(node, start, normal, along, span, out) {
  const center = node.box.getCenter(new Vector3()).sub(start),
    half = node.box.getSize(new Vector3()).multiplyScalar(0.5);
  const extent = (axis) =>
    Math.abs(axis.x) * half.x +
    Math.abs(axis.y) * half.y +
    Math.abs(axis.z) * half.z;
  if (Math.abs(center.dot(normal)) > extent(normal) + EPS) return;
  const d = center.dot(along),
    e = extent(along);
  if (d + e < -EPS || d - e > span + EPS) return;
  if (node.indices) out.push(...node.indices);
  else {
    projectionCandidates(node.left, start, normal, along, span, out);
    projectionCandidates(node.right, start, normal, along, span, out);
  }
}
function firstInterior(solid, start, delta) {
  const end = start.clone().add(delta),
    segmentBox = new Box3().setFromPoints([start, end]);
  if (!solid.tree.box.intersectsBox(segmentBox)) return null;
  const events = [0, 1];
  for (const direction of [AXES[0], AXES[2], AXES[4]]) {
    const along = delta
        .clone()
        .addScaledVector(direction, -delta.dot(direction)),
      span = along.lengthSq();
    if (span < EPS * EPS) continue;
    const normal = delta.clone().cross(direction).normalize(),
      candidates = [];
    projectionCandidates(solid.tree, start, normal, along, span, candidates);
    for (const id of candidates) {
      const t = readTriangle(solid.data, id);
      for (const [a, b] of [
        [t.a, t.b],
        [t.b, t.c],
        [t.c, t.a],
      ]) {
        const edge = b.clone().sub(a),
          w = a.clone().sub(start),
          denominator = delta.clone().cross(edge).dot(direction);
        if (Math.abs(denominator) < 1e-12) continue;
        const fraction = w.clone().cross(edge).dot(direction) / denominator;
        if (fraction <= 0 || fraction >= 1) continue;
        const edgeFraction =
          w.clone().cross(delta).dot(direction) / denominator;
        if (edgeFraction >= -EPS && edgeFraction <= 1 + EPS)
          events.push(fraction);
      }
      const speed = t.normal.dot(delta);
      if (Math.abs(speed) > EPS) {
        const fraction = t.normal.dot(t.a.clone().sub(start)) / speed;
        if (
          fraction > 0 &&
          fraction < 1 &&
          t.triangle.containsPoint(
            start.clone().addScaledVector(delta, fraction),
          )
        )
          events.push(fraction);
      }
    }
  }
  events.sort((a, b) => a - b);
  let previous = events[0];
  for (let i = 1; i < events.length; i++) {
    const next = events[i];
    if (next - previous < 1e-10) continue;
    if (
      contains(
        solid,
        start.clone().addScaledVector(delta, (previous + next) * 0.5),
      )
    )
      return previous;
    previous = next;
  }
  return null;
}
function nearest(node, p, best) {
  if (node.box.distanceToPoint(p) > best.distance) return;
  if (node.indices) {
    for (const id of node.indices) {
      const t = readTriangle(node.data, id);
      t.triangle.closestPointToPoint(p, point);
      const d = p.distanceTo(point);
      if (d < best.distance) {
        best.distance = d;
        best.point.copy(point);
        best.normal.copy(t.normal);
      }
    }
  } else {
    const first =
      node.left.box.distanceToPoint(p) < node.right.box.distanceToPoint(p)
        ? node.left
        : node.right;
    nearest(first, p, best);
    nearest(first === node.left ? node.right : node.left, p, best);
  }
}
function firstRoot(a, b, c) {
  if (Math.abs(a) < EPS) return null;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= -EPS && t <= 1 + EPS ? Math.max(0, Math.min(1, t)) : null;
}
// Exact swept sphere against faces, finite edge capsules and vertices. The
// segment is the complete requested movement, not fixed time/distance steps.
function sweepTriangle(start, delta, r, t) {
  let best = null;
  const accept = (time, normal) => {
    if (
      time !== null &&
      delta.dot(normal) < -EPS &&
      (!best || time < best.time)
    )
      best = { time, normal: normal.clone() };
  };
  const signed = t.normal.dot(start.clone().sub(t.a)),
    speed = t.normal.dot(delta);
  if (Math.abs(speed) > EPS)
    for (const sign of [-1, 1]) {
      const time = (sign * r - signed) / speed;
      if (time >= -EPS && time <= 1 + EPS) {
        const p = start
          .clone()
          .addScaledVector(delta, time)
          .addScaledVector(t.normal, -sign * r);
        if (t.triangle.containsPoint(p))
          accept(
            Math.max(0, Math.min(1, time)),
            t.normal.clone().multiplyScalar(sign),
          );
      }
    }
  for (const [a, b] of [
    [t.a, t.b],
    [t.b, t.c],
    [t.c, t.a],
  ]) {
    const edge = b.clone().sub(a),
      length2 = edge.lengthSq(),
      w = start.clone().sub(a);
    if (length2 > EPS * EPS) {
      const m = delta.clone().addScaledVector(edge, -delta.dot(edge) / length2),
        n = w.clone().addScaledVector(edge, -w.dot(edge) / length2);
      const time = firstRoot(m.lengthSq(), 2 * m.dot(n), n.lengthSq() - r * r);
      if (time !== null) {
        const s = (w.dot(edge) + time * delta.dot(edge)) / length2;
        if (s >= 0 && s <= 1)
          accept(time, n.addScaledVector(m, time).normalize());
      }
    }
    const time = firstRoot(
      delta.lengthSq(),
      2 * w.dot(delta),
      w.lengthSq() - r * r,
    );
    if (time !== null) accept(time, w.addScaledVector(delta, time).normalize());
  }
  return best;
}

export function createExteriorCollider(roots, options = {}) {
  const config = { ...EXTERIOR_CAMERA, ...options };
  if (!Number.isFinite(config.clearance) || config.clearance <= 0)
    throw new Error("Camera clearance must be a positive distance in metres.");
  const solids = [];
  let triangleCount = 0;
  for (const root of roots) {
    root.updateWorldMatrix(true, true);
    const vertices = [],
      triangleBounds = [],
      seen = new Set(),
      triangle = new Triangle();
    root.traverse((node) => {
      if (!node.isMesh) return;
      const p = node.geometry.attributes.position,
        index = node.geometry.index;
      if (!p) return;
      for (let i = 0; i < (index?.count ?? p.count); i += 3) {
        const corners = [triangle.a, triangle.b, triangle.c];
        for (let k = 0; k < 3; k++)
          corners[k]
            .fromBufferAttribute(p, index ? index.getX(i + k) : i + k)
            .applyMatrix4(node.matrixWorld);
        if (triangle.getArea() < 1e-10) continue;
        const key = corners
          .map((v) =>
            v
              .toArray()
              .map((n) => Math.round(n * 1e5))
              .join(","),
          )
          .sort()
          .join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        for (const corner of corners)
          vertices.push(corner.x, corner.y, corner.z);
        for (const axis of ["x", "y", "z"])
          triangleBounds.push(Math.min(...corners.map((v) => v[axis])));
        for (const axis of ["x", "y", "z"])
          triangleBounds.push(Math.max(...corners.map((v) => v[axis])));
      }
    });
    const count = vertices.length / 9;
    if (count) {
      triangleCount += count;
      const data = { positions: new Float64Array(vertices) },
        indices = Uint32Array.from({ length: count }, (_, i) => i);
      solids.push({
        root,
        data,
        tree: tree(indices, data, new Float64Array(triangleBounds)),
      });
    }
  }
  const active = (solid) => config.collideHidden || visible(solid.root);
  const containsSolid = (solid, p) =>
    options.containsPoint
      ? options.containsPoint(solid.root, p)
      : contains(solid, p);
  const inside = (p) => solids.some((s) => active(s) && containsSolid(s, p));
  const distanceToSurface = (p) => {
    const best = {
      distance: Infinity,
      point: new Vector3(),
      normal: new Vector3(),
    };
    for (const solid of solids) if (active(solid)) nearest(solid.tree, p, best);
    return best.distance;
  };
  const safe = (p, r) => !inside(p) && distanceToSurface(p) >= r - EPS;

  function recover(position, r = config.clearance) {
    const result = position.clone();
    for (let pass = 0; pass < 12; pass++) {
      let changed = false;
      for (const solid of solids) {
        if (!active(solid) || solid.tree.box.distanceToPoint(result) > r)
          continue;
        const best = {
          distance: Infinity,
          point: new Vector3(),
          normal: new Vector3(),
        };
        nearest(solid.tree, result, best);
        const within = containsSolid(solid, result);
        if (!within && best.distance >= r - EPS) continue;
        let direction = result.clone().sub(best.point);
        if (within || direction.lengthSq() < EPS * EPS) {
          const candidates = [
            best.point.clone().addScaledVector(best.normal, r + EPS),
            best.point.clone().addScaledVector(best.normal, -r - EPS),
          ];
          const outside = candidates.filter((p) => !containsSolid(solid, p));
          if (outside.length) {
            outside.sort(
              (a, b) =>
                a.distanceToSquared(result) - b.distanceToSquared(result),
            );
            result.copy(outside[0]);
          } else {
            // Deep in intersecting/open source shells: use a verified exterior
            // point above this building, rather than leave the camera trapped.
            result.y = solid.tree.box.max.y + r + EPS;
          }
        } else
          result
            .copy(best.point)
            .addScaledVector(direction.normalize(), r + EPS);
        changed = true;
      }
      if (!changed) break;
    }
    if (!safe(result, r)) {
      // Intersecting or tightly spaced source skins can make alternating
      // nearest-face projections oscillate. For an invalid initial pose only,
      // choose the nearest verified exterior candidate; never return trapped.
      const candidates = [],
        whole = new Box3();
      for (const solid of solids) {
        if (!active(solid)) continue;
        whole.union(solid.tree.box);
        if (solid.tree.box.distanceToPoint(position) > r) continue;
        for (const axis of ["x", "y", "z"])
          for (const sign of [-1, 1]) {
            const p = position.clone();
            p[axis] =
              (sign < 0 ? solid.tree.box.min[axis] : solid.tree.box.max[axis]) +
              sign * (r + EPS);
            candidates.push(p);
          }
      }
      if (!whole.isEmpty())
        for (const axis of ["x", "y", "z"])
          for (const sign of [-1, 1]) {
            const p = position.clone();
            p[axis] =
              (sign < 0 ? whole.min[axis] : whole.max[axis]) + sign * (r + EPS);
            candidates.push(p);
          }
      candidates.sort(
        (a, b) => a.distanceToSquared(position) - b.distanceToSquared(position),
      );
      const exterior = candidates.find((p) => safe(p, r));
      if (exterior) result.copy(exterior);
    }
    return result;
  }
  function move(from, to, r = config.clearance, slideAlongSurface = false) {
    if (!config.enabled) return to.clone();
    let current = recover(from, r),
      remaining = to.clone().sub(from);
    const initial = current.clone();
    for (
      let slide = 0;
      slide < 4 && remaining.lengthSq() > EPS * EPS;
      slide++
    ) {
      const end = current.clone().add(remaining),
        box = new Box3().setFromPoints([current, end]).expandByScalar(r + EPS);
      let hit = null;
      for (const solid of solids) {
        if (!active(solid)) continue;
        const candidates = [];
        query(solid.tree, box, candidates);
        for (const id of candidates) {
          const candidate = sweepTriangle(
            current,
            remaining,
            r,
            readTriangle(solid.data, id),
          );
          if (candidate && (!hit || candidate.time < hit.time)) hit = candidate;
        }
      }
      let interior = null;
      const limit = hit ? hit.time : 1,
        interiorDelta = remaining.clone().multiplyScalar(limit);
      for (const solid of solids) {
        if (options.completeSurfaces || !active(solid)) continue;
        const interval = firstInterior(solid, current, interiorDelta),
          candidate = interval === null ? null : interval * limit;
        if (candidate !== null && (interior === null || candidate < interior))
          interior = candidate;
      }
      if (interior !== null && (!hit || interior < hit.time)) {
        current.addScaledVector(
          remaining,
          Math.max(0, interior - (r + EPS) / remaining.length()),
        );
        remaining.set(0, 0, 0);
        break;
      }
      if (!hit) {
        current.copy(end);
        break;
      }
      const fraction = Math.max(
        0,
        hit.time - EPS / Math.max(remaining.length(), EPS),
      );
      current.addScaledVector(remaining, fraction);
      if (!slideAlongSurface) {
        remaining.set(0, 0, 0);
        break;
      }
      remaining.multiplyScalar(1 - fraction);
      const inward = remaining.dot(hit.normal);
      if (inward < 0) remaining.addScaledVector(hit.normal, -inward);
    }
    // A damaged/open source shell can have no crossing triangle. Reject a
    // solid destination, retaining the previous exterior side of that opening.
    if (inside(current)) {
      let lo = 0,
        hi = 1;
      for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2;
        if (inside(from.clone().lerp(current, mid))) hi = mid;
        else lo = mid;
      }
      current.copy(from.clone().lerp(current, lo));
    }
    // Contact at intersecting skins may have no feasible local correction.
    // Keep the last safe pose rather than pop through a wall or jump to a roof.
    return safe(current, r) ? current : initial;
  }
  return {
    move,
    recover,
    contains: inside,
    distanceToSurface,
    config,
    stats: () => ({
      buildings: solids.length,
      triangles: triangleCount,
      clearanceMetres: config.clearance,
      collideHidden: config.collideHidden,
      renderedProxyTriangles: 0,
      packedVertexBytes: triangleCount * 9 * 8,
      packedBufferBytes: triangleCount * (9 * 8 + 4),
    }),
  };
}
function visible(root) {
  for (let n = root; n; n = n.parent) if (!n.visible) return false;
  return true;
}

export function attachExteriorCamera(camera, controls, roots, options = {}) {
  const collider = createExteriorCollider(roots, options);
  let previous = camera.position.clone(),
    previousTarget = controls.target.clone(),
    applying = false,
    suspended = false,
    surfaceCloseUp = false;
  const originalMaxPolarAngle = controls.maxPolarAngle;
  function clipNear() {
    // Fit the whole near-plane rectangle inside the configured camera sphere, even
    // for a wide viewport. No increase in the collision radius on resize.
    const tan = Math.tan((camera.fov * Math.PI) / 360),
      corner = Math.sqrt(1 + tan * tan * (1 + camera.aspect * camera.aspect));
    const near = Math.min(
      camera.near,
      (collider.config.clearance * 0.9) / corner,
    );
    if (near !== camera.near) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }
  }
  function apply(teleport = false) {
    if (applying || suspended || !collider.config.enabled) return;
    applying = true;
    if (!teleport && camera.position.distanceToSquared(previous) < EPS * EPS) {
      clipNear();
      previousTarget.copy(controls.target);
      applying = false;
      return;
    }
    const requested = camera.position.clone(),
      movement = requested.clone().sub(previous),
      targetMovement = controls.target.clone().sub(previousTarget);
    const isPan =
      targetMovement.lengthSq() > EPS * EPS &&
      movement.distanceToSquared(targetMovement) < EPS * EPS;
    const previousOffset = previous.clone().sub(previousTarget),
      requestedOffset = requested.clone().sub(controls.target);
    const isOrbit =
      Math.abs(previousOffset.length() - requestedOffset.length()) <
        EPS * Math.max(1, previousOffset.length()) &&
      previousOffset.distanceToSquared(requestedOffset) > EPS * EPS;
    let physicalRequest = requested;
    if (!teleport && surfaceCloseUp && isOrbit) {
      // Surface inspection needs a look-up tilt, not a downward camera arc
      // through the picked podium/terrain. Retain the horizontal orbit and any
      // explicit pan, but keep pitch from changing the camera's elevation.
      const horizontal = Math.hypot(previousOffset.x, previousOffset.z),
        azimuth = Math.atan2(requestedOffset.x, requestedOffset.z);
      physicalRequest = controls.target
        .clone()
        .add(
          new Vector3(
            Math.sin(azimuth) * horizontal,
            previousOffset.y,
            Math.cos(azimuth) * horizontal,
          ),
        );
    }
    const orbitPolicy =
      !teleport &&
      !surfaceCloseUp &&
      isOrbit &&
      targetMovement.lengthSq() < EPS * EPS
        ? constrainReversibleOrbit(
            collider,
            previous,
            previousTarget,
            requested,
            collider.config.clearance,
          )
        : null;
    const position = orbitPolicy
        ? orbitPolicy.position
        : teleport
          ? collider.recover(requested)
          : collider.move(
              previous,
              physicalRequest,
              collider.config.clearance,
              isPan,
            ),
      correction = position.clone().sub(requested);
    camera.position.copy(position);
    if (!teleport && surfaceCloseUp && isOrbit) controls.target.add(correction);
    else if (!teleport && targetMovement.lengthSq() > EPS * EPS) {
      if (isPan) controls.target.add(correction);
      else {
        // Cursor zoom changes both camera and target. Accept only the target
        // change belonging to actual travel. Applying the entire correction
        // here would shrink the orbit radius on every rejected wheel event,
        // eventually making pan and reverse zoom feel stuck at minDistance.
        const accepted =
          movement.lengthSq() > EPS * EPS
            ? Math.max(
                0,
                Math.min(
                  1,
                  position.clone().sub(previous).dot(movement) /
                    movement.lengthSq(),
                ),
              )
            : 0;
        controls.target
          .copy(previousTarget)
          .addScaledVector(targetMovement, accepted);
      }
    }
    if (correction.lengthSq() > EPS * EPS) camera.lookAt(controls.target);
    clipNear();
    previous.copy(camera.position);
    previousTarget.copy(controls.target);
    applying = false;
  }
  const onChange = () => apply();
  controls.addEventListener("change", onChange);
  apply(true);
  return {
    apply,
    collider,
    teleport(action) {
      suspended = true;
      try {
        action();
      } finally {
        suspended = false;
        apply(true);
      }
    },
    setSurfaceCloseUp(enabled) {
      surfaceCloseUp = Boolean(enabled);
      controls.maxPolarAngle = surfaceCloseUp
        ? Math.PI - 0.04
        : originalMaxPolarAngle;
    },
    dispose() {
      controls.removeEventListener("change", onChange);
      controls.maxPolarAngle = originalMaxPolarAngle;
    },
    snapshot: () => ({ ...collider.stats(), surfaceCloseUp }),
  };
}
