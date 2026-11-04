# Experimental asynchronous collision preparation

This is an isolated experiment stacked on the adjacent-tile manager. It does not modify or integrate with the production viewer or its camera controls. No source fidelity, geographic accuracy, performance guarantee, or deployment claim is made.

## API and ownership

- `compileInWorker(data, { signal, generation }, WorkerClass?, node?)` transfers tile geometry arrays into one disposable module worker, packs world-space triangles and builds the original collider's per-root BVH, then transfers geometry and compiled arrays back. The caller must restore its geometry handle from `result.data`; input arrays are detached while the request is pending. Cancelled requests terminate the worker and reject. Generation tags must match.
- `hydrateSolids(result.solids, mesh)` validates the bounded serialized tree and restores its Box3 instances. The mesh must use the returned geometry at its original world coordinates. Moving or modifying the mesh after preparation invalidates its compiled collider and requires recompilation.
- `createExteriorCollider(roots, { compiledSolids })` binds previously compiled roots without repacking triangles or rebuilding trees. Keep roots and compiled solids paired. These low-level binding/compilation functions expect trusted local objects; the worker boundary and hydration entry points perform protocol validation.
- Async prepare should produce only its own tile handle. At synchronous manager install, form the new aggregate from the **current** installed map and bind before changing the scene/current collision reference. Do not prepare an aggregate asynchronously against an old scene revision. Detach similarly removes the root from the current aggregate before releasing or caching its resources.
- The manager's job slot remains occupied through preparation, bounding total active workers by its concurrency limit. Workers are one per job, not a persistent pool. Do not launch unbounded independent calls.
- Cache entries retain their immutable compiled handles. Disposal releases renderer resources and references only after the root is absent from the current aggregate. Packed buffers and tree objects are JS-owned memory; there is no explicit collider disposal API or guaranteed garbage-collection deadline.

`compiled-collider.mjs` extracts only the core before `attachExteriorCamera` from the existing public collider and adds per-root compilation/aggregate binding. It deliberately excludes camera attachment/navigation code. The original `src/exterior-camera-collision.mjs` stays unchanged and is imported directly by parity tests. Continuous triangle sweep, containment, recovery, clearance and sliding remain the original algorithms, not a height clamp or endpoint-only test.

## Protocol bounds

Worker inputs require Float32 positions, Uint32 indices/cells/edges, finite coordinates within ±10,000,000, at most 100,000 vertices and 32,768 triangles, and four edges of at most 257 indices each. Tile addresses must be safe integers; origin, positive tile size and power-of-two grid subdivisions are checked. Cell ranges must be complete, contiguous, triangle-aligned and bounded, edge lengths/indices must match the grid, and declared geometry bytes must equal the actual array byte total. Geometry arrays must own exactly their backing buffers; packed collider positions are also dedicated, and leaf index views share one bounded index buffer. Oversized backing buffers and shared-memory buffers are unsupported. Compiled output requires exactly one root, bounded Float64 packed triangles, at most 16,383 tree nodes and depth 32, valid finite nested boxes, complete unique triangle IDs and leaf bounds containing their triangles. The bounds suit this tile experiment, not arbitrary large meshes.

Validation scans packed arrays and tree leaves on the receiving thread and again at public hydration. Its cost is intentionally explicit and needs browser measurement; the newly hardened staging is not byte-identical to earlier browser performance experiments.

## Tests

From the repository root:

`node --test experiments/adjacent-tiles/test/*.node.mjs experiments/adjacent-tiles/collision/*.node.mjs`

Focused tests cover actual Node workers and buffer transfer, two-job compilation, 26 continuous sweep/slide comparisons against the original public collider, active/pre-aborted cancellation, malformed geometry/tree rejection, generation mismatch and worker failure, concurrent aggregate completeness, cached detach/restore, stale async preparation and final resource disposal.

## Browser packaging and remaining work

All module code imports the repository's `three` package. A browser worker **does not inherit the document's import map**. A future browser integration must bundle `collider-worker.mjs` and its dependencies with the supported application bundler or provide valid worker-local package resolution; serving these raw files under a document-only import map is unsupported. No vendor copies, CDN dependencies or application entrypoint changes are supplied here.

A local synthetic browser prototype established lifecycle correctness and reduced repeated-run frame gaps when full aggregate BVH rebuilding moved off the main thread. That is not a benchmark for this hardened standalone package. Cold-start stalls remain unresolved. Geometry/normals, tree hydration and validation, GPU upload/shader work, collision queries, reporting and garbage collection still consume main-thread time. Measure compilation, hydration/validation, aggregate binding, commit and frame gaps separately before considering production integration. Aggregate binding must remain synchronous and transactionally paired with rendering.
