import { BufferGeometry, BufferAttribute, Mesh } from "three";
import { compileInWorker } from "../collision/collider-loader.mjs";
import {
  hydrateSolids,
  colliderTransfers,
} from "../collision/collider-serialization.mjs";
import { createExteriorCollider } from "../collision/compiled-collider.mjs";
import { heightOnTile } from "../src/geometry.mjs";
import { MASKED } from "./protocol.mjs";
import { buildQueryIndex, indexedHeight } from "./query-index.mjs";
const queryIndexes = new WeakMap(),
  preparedData = new WeakSet(),
  preparingData = new WeakSet();
export const hasPreparedQuery = (data) => queryIndexes.has(data);
export const heightQuery = (d, x, z) =>
  d.geometryKind === MASKED
    ? queryIndexes.has(d)
      ? indexedHeight(queryIndexes.get(d), x, z)
      : null
    : heightOnTile(d, x, z);
/** Local CPU/Three ownership adapter. No GPU renderer or production scene is installed. */
export function createOwnershipAdapter({
  WorkerClass,
  node = false,
  beforeCommit = () => {},
  queryOptions = {},
}) {
  let snapshot = {
    live: new Map(),
    roots: [],
    solids: [],
    collider: createExteriorCollider([], { compiledSolids: [] }),
  };
  const stats = { allocated: 0, disposed: 0, commits: 0 };
  function candidate(live) {
    const roots = [...live.values()].map((r) => r.mesh),
      solids = [...live.values()].flatMap((r) => r.solids);
    return {
      live,
      roots,
      solids,
      collider: createExteriorCollider(roots, { compiledSolids: solids }),
    };
  }
  function commit(next) {
    beforeCommit(next);
    snapshot = next;
    stats.commits++;
  }
  return {
    stats,
    get snapshot() {
      return snapshot;
    },
    async prepare(data, context) {
      if (preparedData.has(data) || preparingData.has(data))
        throw Error("Duplicate prepared data identity");
      preparingData.add(data);
      try {
        const result = await compileInWorker(data, context, WorkerClass, node);
        Object.assign(data, result.data); // Restores worker-transferred geometry to the manager-owned identity.
        const indexStart = globalThis.performance.now();
        const queryIndex =
            data.geometryKind === MASKED
              ? buildQueryIndex(data, queryOptions)
              : null,
          queryIndexBuildMs = globalThis.performance.now() - indexStart;
        const geometry = new BufferGeometry();
        geometry.setAttribute(
          "position",
          new BufferAttribute(data.positions, 3),
        );
        geometry.setIndex(new BufferAttribute(data.indices, 1));
        const mesh = new Mesh(geometry);
        try {
          const solids = hydrateSolids(result.solids, mesh, data);
          const r = {
            geometry,
            mesh,
            solids,
            dead: false,
            data,
            queryIndex,
            queryIndexBytes: queryIndex?.bytes ?? 0,
            queryIndexBuildMs,
            geometryBufferBytes: data.bytes,
            colliderBufferBytes: colliderTransfers(solids).reduce(
              (n, b) => n + b.byteLength,
              0,
            ),
          };
          if (queryIndex) queryIndexes.set(data, queryIndex);
          preparedData.add(data);
          stats.allocated++;
          return r;
        } catch (e) {
          geometry.dispose();
          mesh.material.dispose();
          throw e;
        }
      } finally {
        preparingData.delete(data);
      }
    },
    install(bundle, old) {
      if (!bundle.resources || bundle.resources.dead)
        throw Error("Invalid resources");
      if (old && snapshot.live.get(bundle.key) !== old.resources)
        throw Error("Old owner mismatch");
      const live = new Map(snapshot.live);
      live.set(bundle.key, bundle.resources);
      commit(candidate(live));
    },
    detach(bundle) {
      const live = new Map(snapshot.live);
      if (live.get(bundle.key) !== bundle.resources)
        throw Error("Detach owner mismatch");
      live.delete(bundle.key);
      commit(candidate(live));
    },
    dispose(bundle) {
      const r = bundle.resources;
      if (!r) return;
      if (
        r.dead ||
        [...snapshot.live.values()].includes(r) ||
        snapshot.solids.some((s) => s.root === r.mesh)
      )
        throw Error("Disposing live resources");
      r.dead = true;
      queryIndexes.delete(r.data);
      preparedData.delete(r.data);
      r.queryIndex = null;
      r.geometry.dispose();
      r.mesh.material.dispose();
      r.solids = [];
      stats.disposed++;
    },
  };
}
