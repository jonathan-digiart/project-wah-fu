# Code-only reconstruction experiment (incomplete)

The owner requested a genuinely code-only, modular procedural reconstruction of
v128, using as few triangles as practicable, to compare size, loading efficiency
and runtime performance. The published v128 page remains untouched.

## Current milestone: strict-fidelity carpark surface

The viewer now includes a genuinely procedural Wah Ming carpark top, in addition
to the earlier envelope/plan scaffold. It reconstructs the original authoring
mechanism: a 1.5 m grid clipped to the locked footprint, named scalar elevation
levels, editable ridge-diagonal rules and 31 feature-aware macro cells. No saved
mesh vertex/index buffers are used. Each macro retains every original perimeter
station and generates a centre fan, reducing interior triangles without cracks.

- Regenerated reference: **1,616 triangles / 967 vertices**.
- Optimised surface: **1,260 triangles / 789 vertices**, **22.03% fewer triangles**.
- Continuous maximum height difference versus accepted source: **9.480587 mm**.
- All **316 boundary vertices and edges, including elevations, are bit-exact**
  between regenerated reference and optimised surface.
- One connected topological disk; no non-manifold/internal hanging edges,
  duplicate/degenerate/downward faces, overlaps or non-finite coordinates.
- Float32 perimeter deviation from source is 7.519 micrometres. Tiny missing/extra
  projected areas, each below 0.000276 square metres, are reported separately.

The continuous bound was checked at every source/candidate triangle-overlay
vertex, where the difference of affine surfaces reaches its extrema. The CI test
also compares the two code-generated surfaces continuously and checks their exact
shared boundary and topology. Evidence is in `procedural-evidence/`.

**Scope remains the isolated paving top.** Adjacent terrain, retaining supports,
external seam integration and the entire estate have not been reconstructed or
validated by this result. The public v128 scene is unchanged.

Earlier generic scattered-height experiments either increased triangle count at
10 mm fidelity or required a 50 mm relaxation for savings. These were not adopted
as the viewer's primary surface. The viewer now offers only the strict-fidelity
optimised surface and its code-generated reference; coarse variants are excluded from the repository model data and runtime build.

The current experimental build contains **seven files / 707,719 bytes**, including
Three.js, the scaffold, both lazy-loaded carpark authoring variants and the northern surface. The
178,683-byte pre-safety-guard QA archive is packaging size, not measured HTTP transfer. This is
still not a whole-estate size/performance comparison. Module-generation timings
are attached to the selected surface; they are hidden on Overview rather than
mislabelled as timings for a different view.

## Stage-1 foundation

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
reduction achieved at the same fidelity. At the first stage no accepted terrain or road surfaces were reconstructed;
the subsequent isolated carpark milestone above is the first exception. Earlier envelope parameters are not the
accepted detailed building geometry. In particular, the older 265-point terrain
scaffold has approximately 2.58 m mean error and 7.53 m p95 error; it is deliberately
not included in this experiment.

## Historical stage-1 measurements

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
and an isolated carpark-plan view. Final Mac Chrome retest of archive SHA-256
`b9d5137f93b6d51e4e33043cc1aebb47e6dc32583d332f2e220a15cdec95ffe6`
passed at desktop and 390×844: full estate fits (5,950 triangles / 125 draw calls),
full isolated carpark fits (146 / 1), repeated view switching works, and there
were no console warnings/errors. The one observed geometry-generation time was
10.6 ms; it is not a benchmark distribution. No load-time or FPS advantage over
v128 is claimed.

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

### Current carpark browser smoke

Mac Chrome verified the strict-fidelity build at desktop and 390×844: optimised
1,260 triangles / 1 draw, regenerated reference 1,616 / 1, full footprint visible,
repeated switches and per-surface timing labels correct. A deliberately delayed
lazy-module response did not override a newer Overview action. No console
warnings/errors occurred. Requests were only HTML and the two JavaScript modules,
plus the browser's unserved favicon request. This was functional smoke, not a
controlled performance benchmark. The local test server was stopped afterwards.

### Authoring-input safety review

The independent review reproduced an exterior-diagonal bug on a synthetic concave
quad. Conflicting authored ridges now reject rather than produce overlapping faces.
Input validation bounds cell/macro work, checks semantic key syntax and finite
simple outlines, and rejects Float32 vertex/face collapse. Profile interpolation
rejects nonfinite derived arithmetic. Regressions check oriented edge cancellation,
projected area, and the concave counterexample. All 99 tests pass. Both accepted
carpark geometry exports remain byte-identical after these validation changes;
their independent source-overlay results therefore remain applicable.

Automated desktop/portrait switching and delayed-import regressions are now defined
for both Chromium and WebKit in CI. They passed GitHub Actions run 44366159436 on commit ece3c5e; the
local cloud sandbox cannot launch browsers. This is distinct from the completed
Mac Chrome manual smoke above.

## Northern boundary constructive surface

The next isolated component reconstructs the original construction domain using
90 PCHIP levels, 584 named non-core lattice levels and 132 edge-profile stations.
World-XZ triangulation and final boundary-height constraints preserve the original
recipe without storing mesh XYZ or connectivity. The runtime produces 2,379
triangles versus 2,397 construction-owned source faces: a fidelity milestone,
not yet a meaningful compression improvement.

Independent continuous-overlay checks on actual Float32 output find maximum
5.232 mm height error (core 0.0191 mm), zero overlap, zero shared-edge steps,
zero non-manifold edges and zero unpaired internal edges. This is the isolated
surface, not verified attachment to neighbouring road/terrain components.

Ownership is explicit: obsolete outside-domain remnants are excluded. Those
microscopic old/new overlap slivers disagree by up to 36.38 mm at identical XZ,
so no claim is made to match both within 10 mm. Original numerical coverage
omission is 0.00015075 square metres; Float32 boundary symmetric difference is
0.00018114 square metres. The report records these exceptions rather than
silently treating them as exact coverage. Mac Chrome visual QA passed at desktop and 390×844: full framing, five header buttons, repeated surface switches, delayed north import race, correct per-component timings and no console warnings/errors. The QA server observed only HTML/JS requests (plus automatic favicon404), no images or model assets.

Independent read-only recheck reproduced the concave-ridge rejection and verified
both carpark hashes unchanged. No blocker remains for the trusted checked-in
pilot; this is not yet an arbitrary imported-JSON geometry editor.
