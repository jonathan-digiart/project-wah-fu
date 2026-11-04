import { BufferGeometry, BufferAttribute, Mesh } from "three";
import { compileExteriorRoots } from "./compiled-collider.mjs";
import {
  serializeSolids,
  colliderTransfers,
} from "./collider-serialization.mjs";
import { transferables } from "../src/geometry.mjs";
import { validateGeometry, validateCompiled } from "./validation.mjs";
function run({ data, generation }, send) {
  try {
    validateGeometry(data);
    if (!Number.isSafeInteger(generation) || generation < 0)
      throw Error("Invalid generation");
    const start = globalThis.performance.now();
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(data.positions, 3));
    geometry.setIndex(new BufferAttribute(data.indices, 1));
    const root = new Mesh(geometry);
    const solids = serializeSolids(compileExteriorRoots([root]));
    validateCompiled(solids);
    send(
      {
        data,
        solids,
        generation,
        compileMs: globalThis.performance.now() - start,
      },
      [...transferables(data), ...colliderTransfers(solids)],
    );
  } catch (e) {
    send({ error: String(e) }, []);
  }
}
if (typeof globalThis.postMessage === "function")
  globalThis.onmessage = (e) => run(e.data, (v, t) => postMessage(v, t));
else {
  const { parentPort } = await import("node:worker_threads");
  parentPort.on("message", (m) =>
    run(m, (v, t) => parentPort.postMessage(v, t)),
  );
}
