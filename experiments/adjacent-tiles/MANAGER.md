# Experimental asynchronous tile lifecycle

This change stacks on the adjacent-tile geometry experiment. It adds no geographic sampler, production integration or release change. Apply it to the same directory, then run `npm test` for both groups or `node --test test/manager-worker.node.mjs` for this group alone. Root repository scripts remain unchanged.

## Contract

`TileManager` accepts a serializable geometry config, asynchronous `loader`, optional `prepare`, `install`, `detach`, `dispose` and telemetry `onChange` hooks. `request([{x,z,lod}], {anchor})` supplies the desired set and optional retained safe tile. `idle()` waits for current work, `snapshot()` exposes state, and `close()` starts teardown.

- Coarse geometry for the requested set is acquired before fine refinement. The optional policy selects fine candidates; callers retain control of requests.
- Worker generation transfers typed arrays off the browser render thread. Node worker tests exercise the same algorithm. Cancellation terminates workers; generation checks reject stale results even when custom loaders/preparation ignore cancellation.
- Active and cached counts, worker concurrency and geometry-array residency are bounded. Defaults are ten active, four cached, two jobs and 32 MiB geometry arrays. `geometryBytes` and `geometryBudgetBytes` exclude prepared GPU/BVH allocations; `transientJobCount` reports jobs outside residency. At most one transient result per job plus synchronous old/new installation overlap can exist. A real adapter must separately measure and bound its resource memory.
- `prepare(data,{signal,generation,lod})` returns prepared resources without activating them. It must clean partial allocations on failure. Stale completed resources are disposed.
- `install(next,previous)` must synchronously install rendering and full collision atomically or throw with the old scene unchanged. Opaque adapter state rollback is the adapter's responsibility. A failed fine install retains the current coarse surface. Cached-install failure falls back to a guarded rebuild.
- `detach(bundle)` removes scene/collider references before caching or release. `dispose(bundle)` releases nonactive handles. `onChange` is telemetry only, never the renderer swap.
- Failed detach during close is retained as owned and undisposed, with `lifecycleErrors`. `closeState` is open, blocked, draining or complete. Correct the adapter and retry close; only complete establishes teardown completion. Partial successful teardown and late prepare completion are tested.

Tile ownership is half-open: shared edges belong to the positive-address tile. Navigation queries reject an unavailable owner, including an outer maximum boundary even when its neighboring tile renders that edge.

`moveFixtureTerrainOnly` is explicitly a conservative synthetic-fixture guard. It rejects missing crossed tiles and raises the destination above the maximum traversed tile height. It is not terrain-following, swept collision or building/interior collision. Existing scene collision must remain in place until a real adapter is independently verified.

The lifecycle tests cover worker transfers, overview ordering, delayed/out-of-order completion, cancellation, cache/recycling bounds, prepare/install failure, downgrade, exact ownership, cached restore failure, partial close failure, retry and late completion. They make no browser performance or geographic acceptance claim.
