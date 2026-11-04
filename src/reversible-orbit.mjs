/** Bounded orbit acceptance. Does not move the target, teleport, or weaken clearance.
 * Every accepted candidate has both a swept path from the current camera and a
 * short clear radial reverse-dolly path. Rejected arcs are shortened on the same
 * orbit sphere, so clipping cannot silently shorten its radius or invert escape.
 */
export function constrainReversibleOrbit(
  collider,
  previous,
  target,
  requested,
  clearance,
) {
  const start = globalThis.performance.now();
  const a = previous.clone().sub(target),
    b = requested.clone().sub(target),
    radius = a.length();
  const probeDistance = Math.max(clearance, Math.min(4, radius * 0.25));
  let queries = 0;
  function admissible(point) {
    queries++;
    const reached = collider.move(previous, point, clearance, false);
    if (reached.distanceTo(point) > 1e-5) return false;
    const radial = point.clone().sub(target);
    if (radial.lengthSq() < 1e-12) return false;
    const probe = point
      .clone()
      .addScaledVector(radial.normalize(), probeDistance);
    queries++;
    if (collider.move(point, probe, clearance, false).distanceTo(probe) > 1e-5)
      return false;
    return true;
  }
  const result = (position, fraction) => ({
    position,
    fraction,
    limited: fraction < 1,
    probeDistance,
    queries,
    ms: globalThis.performance.now() - start,
  });
  if (radius < 1e-6) return result(previous.clone(), 0);
  if (admissible(requested)) return result(requested.clone(), 1);
  if (!admissible(previous)) return result(previous.clone(), 0);
  let low = 0,
    high = 1,
    best = previous.clone();
  // Bounded search, each accepted point independently swept; no monotonicity assumption
  // is needed for safety. This need not find the globally largest feasible arc.
  for (let i = 0; i < 8; i++) {
    const t = (low + high) / 2,
      offset = a.clone().lerp(b, t);
    if (offset.lengthSq() < 1e-12) {
      high = t;
      continue;
    }
    const candidate = offset.setLength(radius).add(target);
    if (admissible(candidate)) {
      low = t;
      best = candidate;
    } else high = t;
  }
  return result(best, low);
}
