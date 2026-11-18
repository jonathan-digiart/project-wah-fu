# Code-only reconstruction experiment (stage 1, incomplete)

The owner requested a genuinely code-only, modular procedural reconstruction of
v128, using as few triangles as practicable, to compare size, loading efficiency
and runtime performance. The published v128 page remains untouched.

## What this branch actually provides

- Separate `procedural.html` development entry and `npm run build:procedural`.
  It cannot replace the Pages release through the existing build command.
- Semantic component schemas: editable footprints, courtyard holes, base/height,
  and road edge stations with explicit elevation, width and crossfall.
- Indexed geometry: cap triangulation, one quad per wall segment, no hidden
  bottom unless requested. Simple four-corner building: 10 triangles, 8 vertices.
- Stable component IDs, replace/remove/dispose operations and scene triangle
  budget. Flat-shaded materials keep sharp building edges without image textures.
- Cubic curve sampling with a geometric tolerance and a hard subdivision budget.
  Straight cubic segments need only endpoints. Failure to meet tolerance throws,
  rather than silently accepting an under-resolved curve.
- A partial viewer of **124 earlier semantic building envelopes**, plus the
  **locked accepted Wah Ming north carpark perimeter**. The carpark plan is at an
  arbitrary zero elevation, clearly labelled. Its U-shaped green is retained.
- No imported images, textures, GLBs, geometry binaries, compressed mesh arrays
  or encoded mesh payloads in the experimental output. Numeric footprint/height
  authoring data is bundled as code, not loaded as 3D assets.

This is **not a v128-equivalent scene**. Do not present its small download as a
reduction achieved at the same fidelity. No accepted terrain or road surfaces
are reconstructed in this first stage. Earlier envelope parameters are not the
accepted detailed building geometry. In particular, the older 265-point terrain
scaffold has approximately 2.58 m mean error and 7.53 m p95 error; it is deliberately
not included in this experiment.

## Stage-1 measurements

Measured deterministically by `src/procedural/inventory.test.ts`:

| Metric                                                               | Stage 1 |
| -------------------------------------------------------------------- | ------: |
| Building components                                                  |     124 |
| Building triangles                                                   |   5,804 |
| Flat carpark-plan triangles                                          |     146 |
| Total vertices                                                       |   4,136 |
| Position/index buffer bytes (excludes normals and renderer overhead) |  85,332 |
| Built files                                                          |       5 |
| Built uncompressed bytes                                             | 624,156 |
| Tar-gzip QA package bytes                                            | 163,845 |

Five files are HTML, JavaScript and three attribution/license notices. The JS
includes Three.js and OrbitControls. Vite warns that the bundle exceeds 500 kB;
this is an advisory, not a failed build. Gzip package size is not measured HTTP
transfer size. Runtime draw calls and frame times need browser measurement.

Cloud Chromium QA is blocked by `socket() failed: Operation not permitted`,
including the reviewed escalation. The separate cloud browser cannot reach the
execution environment's localhost. This branch does not bypass the sandbox.
The first Mac Chrome smoke completed without console warnings/errors and loaded
only local HTML/JavaScript (apart from an unserved favicon). It found a portrait
framing defect, now corrected with aspect-aware fitting, a non-overlapping header
and an isolated carpark-plan view. Final retest is pending. No load-time or FPS
advantage over v128 is claimed.

## Next stages and fidelity gate

1. Reconstruct terrain from sparse height controls **and constrained breaklines**:
   road edges, retaining slopes, crop boundary and contact levels. Do not revive
   the inaccurate old terrain or disguise copied triangles as procedural code.
2. Rebuild roads from semantic boundaries/curves and longitudinal/crossfall
   profiles. Keep the upper Pok Fu Lam deck and lower tunnel separate. Share seam
   parameters between adjacent modules. Preserve all accepted boundary repairs.
3. Convert accepted building masses into semantic stepped/extruded components,
   then apply repeated façade elements only where supported by references.
4. Integrate and compare at fixed reference cameras. Retain the locked carpark
   perimeter and the existing camera-protection policy; this prototype is a plan
   viewer, not the final protected navigation implementation.
5. Optimise by error budgets, not an arbitrary triangle target. Preserve accepted
   geometry within the existing 10 mm height tolerance where applicable and report
   any unmet surface/outline tolerances rather than hiding them with LOD switches.

## Comparison protocol

Benchmark only after comparable scene coverage is available, or label a
component-only comparison explicitly. Pin the v128 release SHA and experimental
SHA, browser version, hardware, viewport, pixel ratio, camera, clipping, visible
layers and network/cache settings. Run five cold loads and five warm loads;
report median and range, actual transfer bytes, first visible geometry and
complete-scene readiness. Measure geometry-generation time separately from
network, JavaScript parsing and rendering. Use a repeatable orbit/pan/zoom path
for frame-time median/p95, long frames and memory where the browser supports it.

Report unique generated triangles, rendered triangles, draw calls and GPU buffer
bytes separately: instancing reduces draw calls, not necessarily rendered
triangles. Include fixed-camera visual checks, seam/gap checks, source confidence,
height and plan deviations. A smaller/faster incomplete scene is not a successful
replacement. No automatic deployment or merge is part of this experiment.

## Commands

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build:procedural`
- `python3 -m http.server --bind 127.0.0.1 4191 --directory dist-procedural`
- Open `http://127.0.0.1:4191/procedural.html`
- `node scripts/smoke-procedural.mjs` (supported Chromium environment required)

The original `npm run build` still verifies/copies the accepted public v128 release.
