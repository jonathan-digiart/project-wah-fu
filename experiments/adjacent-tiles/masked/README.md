# Experimental semantic-masked tiles

This opt-in protocol extends the adjacent-tile experiment with actual terrain triangles clipped to synthetic semantic land polygons. It is not installed in the production viewer. No site geometry, private source data, heightmaps, geographic fidelity, phone acceptance, or browser/GPU acceptance is included or claimed.

Run all adjacent-tile tests with `npm --prefix experiments/adjacent-tiles test`. The test command includes `test/*.node.mjs`, `collision/*.node.mjs`, and `masked/*.node.mjs`; root Vitest does not discover these Node-specific files.

## Explicit geometry protocol

The `semantic-masked-triangles-v1` discriminant selects an unstructured variant. It carries Float32 xyz positions, Uint32 indices and source-facet identifiers, packed Float64 semantic mask triangles, Float64 tile bounds, and a byte count. There are no fabricated regular-grid `cells` or `edges`. Untagged grid geometry retains the existing validator and default height query.

The validator requires exactly those fields, dedicated transferable ArrayBuffers, valid index/length/coordinate ranges, upward nondegenerate terrain triangles, positive mask triangles, and exact typed-buffer byte accounting. Protocol caps are 100,000 vertices, 32,768 output triangles, 4,096 mask triangles, 8 MiB typed payload and absolute coordinates within 10,000,000. These caps are not a numerical-precision guarantee over the entire range. Masks must be valid disjoint polygon partitions; self-intersection/union repair and proof that arbitrary untrusted mesh coverage equals a supplied mask are not implemented.

`triangulateRegions` uses the existing bare `three` dependency. It copies and normalizes outer/hole rings before triangulation, removing consecutive duplicate and closing coordinates without mutating the caller. This prevents closed-hole index drift. Nonconsecutive repeated vertices and degenerate rings are rejected. Synthetic regressions cover equivalent open/closed rings, duplicates, holes and islands.

`buildMasked` clips actual Float32 source facets, interpolates their heights, and preserves canonical shared perimeter coordinates. It does not evaluate a substitute height sampler. Float32 boundaries approximate real semantic coordinates; strict zero-ULP geometric containment is not claimed.

## Query and navigation safety

The manager's optional `heightQuery` hook defaults to its existing grid implementation. `heightQuery` from `adapter.mjs` dispatches masked payloads to actual-triangle barycentric queries with authoritative semantic rejection. Missing tiles, holes, outside-land coordinates, query errors and nonfinite results return null. Half-open tile ownership is unchanged, including masked/regular neighbors.

**Masked navigation remains blocked.** The existing `moveFixtureTerrainOnly` method returns `coverage-policy-required` whenever a segment touches a masked tile. A separate segment-coverage and sea policy is required before enabling movement; empty collision geometry does not mean safe navigation and null is never silently converted to zero height. The raw collider is only a triangle-collision primitive, not a navigation availability authority.

**Same-LOD mask invalidation remains pending.** Existing cache identity is tile/lod, not mask revision. Tests replace geometry through existing LOD transitions. Changing a mask does not automatically refresh an already-resident tile at the same LOD.

## Worker and ownership

The existing collision worker compiles actual output triangles with the existing BVH compiler. Only a validated empty masked tile may produce an empty solids array. Hydration accepts an optional geometry payload for this case; existing two-argument grid hydration retains its behavior.

The local adapter prepares a complete Three geometry/collider pair, builds a candidate snapshot and commits its reference synchronously. Empty replacement clears previous collision solids before old resources are disposed. Stale empty results cannot clear newer land. Tests cover cancellation, out-of-order preparation, install rollback, malformed data, four-way holes and mixed ownership.

**Ownership evidence is CPU-only.** These Node tests inspect Three objects and collider snapshots; they do not exercise renderer frames, GPU resources, production scene installation or device performance.

## Memory accounting and limits

The manager geometry budget includes all five typed payload buffers, including packed mask triangles and bounds. Each prepared resource separately exposes `geometryBufferBytes` and `colliderBufferBytes`.

This is **not a total-memory bound**. Collider/BVH packed buffers are excluded from the manager geometry budget, as are tree object nodes, compiler and validation temporaries, query indexes and their construction temporaries, Three objects/materials, candidate snapshots, worker heaps, in-flight results and future GPU memory. `colliderBufferBytes` counts distinct packed collider buffers only, not object overhead. Concurrency limits jobs; payload caps do not bound total worker process memory. The exhaustive diagnostic helper remains available for correctness comparisons; runtime manager queries use the prepared indexes described below.

Before production use: independently review protocol/ownership, define mask revision invalidation and sea/coverage policy, optimize queries, integrate and test actual browser workers/renderers, and establish appropriate source-fidelity and device-performance acceptance separately.

## Reusable bounded query indexes

The wire payload is unchanged. During preparation, after the collision worker returns, the adapter builds reusable uniform-bin indexes over actual terrain triangles and packed semantic triangles. Index construction and validation run synchronously on the caller/main thread, not in the collision worker. Runtime queries use packed arithmetic without per-query mask reconstruction. Candidate IDs retain original order, preserving exhaustive first-triangle semantics; bin bounds include the numerical acceptance bands used by exhaustive queries.

The data-identity lookup stays available while cached resources remain owned. Disposal, including release of stale prepared results, deletes it. Unprepared masked geometry returns null. Both owned and in-flight preparation identities are rejected before any worker transfer, preventing a duplicate request from detaching live geometry arrays.

Indexes are capped at 64 bins per axis, 1,048,576 combined triangle/mask overlap entries and 8 MiB retained typed buffers. `queryOptions.maxEntries` may lower the entry cap. Cap failure rejects preparation without replacing existing resources. Tests cover large-facet overlap growth, invalid offsets/IDs/byte counts, and cache/disposal/stale ownership behavior.

Each resource reports `queryIndexBytes` for its two offsets arrays and two ID arrays, and `queryIndexBuildMs` for synchronous construction plus validation. These index bytes are **additional prepared memory excluded from the geometry-only manager budget**, alongside separately reported collider buffers. Temporary construction ranges/counts/cursors and object overhead remain excluded from total-memory claims.

Local synthetic CPU observations with 100 deterministic queries, including nine hole points, showed a fine64 index retaining 175,228 bytes and completing the query batch in approximately 0.034–0.053 ms. Construction took approximately 16 ms cold and 6.7–7.3 ms across warm builds. Coarse8 and fine32 indexes retained 7,764 and 56,160 bytes respectively. These observations are not browser/device thresholds or performance guarantees. **Main-thread preparation scheduling and worst-case build latency remain an integration gate**, even though the repeated query cost is greatly reduced.

Tests compare indexed heights exactly against exhaustive actual-triangle queries over thousands of deterministic interior, vertex, bin-boundary, hole-boundary and slanted-boundary points, including noninteger signed origins. The existing masked-navigation block, pending same-LOD invalidation, CPU-only ownership evidence and memory exclusions still apply.
