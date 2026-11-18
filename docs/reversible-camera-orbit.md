# Candidate fix: reversible normal camera orbit

This local candidate addresses issue #31. It is not a merge, release, deployment or acceptance decision.

## Change

A clipped orbit can leave the camera below its unchanged target and silently shorten the orbit radius. Outward radial zoom then points into terrain: the camera remains collision-safe but reverse wheel input produces no useful movement.

Normal orbit now checks both the complete swept path to its candidate and a useful swept outward radial probe. The probe is `max(clearance, min(4 metres, radius × 0.25))`. If blocked, an eight-iteration bounded search shortens the requested angular move on the same sphere, preserving target and radius. Each candidate is independently swept at the existing clearance. No clearance-gain/slope heuristic is imposed, so safe shallow yaw remains available.

The helper performs at most 20 swept queries per normal orbit. It does not build or rebuild collision geometry. Pan, zoom, teleport/recovery and the existing explicit `surfaceCloseUp` branch are unchanged. No dynamic tile manager, worker protocol, synthetic diagnostic page or private camera attachment is included in the runtime change.

## Tests

The regression uses actual OrbitControls math: inward wheel scaling equivalent to −120 until stopped, an upward 100 px rotation, then six +120-equivalent outward wheel events. Three viewport-height cases fail against the unmodified public attachment and pass with this candidate. Every sampled pose remains outside the collider at the original clearance. Each reverse event must move over 0.04 m, with total movement over 0.4 m. Target and orbit radius must be preserved.

Additional regressions cover the shallow flat-ground yaw previously over-restricted by a discarded clearance-gain heuristic, and near-wall/corner candidates with continuous orbit and outward-probe checks. The existing camera suite, including surface-close-up behavior, remains unchanged.

## Measured cost and remaining gates

A local cloud Node measurement of 100 repeated constrained-orbit requests on a 512-triangle synthetic surface recorded a 10.37 ms first/maximum call, 0.48 ms median, 2.79 ms p95 and at most 19 swept queries. These figures exclude BVH construction, DOM events, GPU work and the production scene. They are not Mac interaction or frame-rate measurements. The algorithmic cap is 20 swept queries; scene complexity still affects each query's cost.

The isolated v6 synthetic prototype passed actual Chrome DOM checks at desktop and narrow viewport sizes. Six reverse-wheel events travelled 0.44674 m; safe shallow yaw/reverse retained target and radius. Four automatic runs passed 13 checks each; overview, box, seam/LOD, resize and reload gestures worked with no unsafe/stale/error samples and zero resources after teardown. Policy calls peaked at 0.9 ms desktop and 1.7 ms narrow. Initial frame gaps reached 116.7/83.4 ms, repeat gaps 50.1/66.6 ms and interactive gaps 50 ms, so stalls are not solved. These are synthetic Mac viewport measurements, not physical-phone tests.

The actual production viewer remains a separate gate: its focus/selection behavior, full scene and interaction cost require review before merging or deploying. No production-viewer browser pass is claimed.

The finite radial probe proves useful finite reverse travel, not unlimited escape from every enclosure. If the previous pose already lacks that path, the policy retains it rather than inventing motion. The bounded search need not find the globally largest permissible arc. This change adds no unloaded-terrain availability policy, world boundary, model-in-viewport constraint, geographic fidelity claim or walking/interior controller.
