import { transferables } from "../src/geometry.mjs";
import { validateGeometry, validateCompiled } from "./validation.mjs";
export function compileInWorker(
  data,
  { signal, generation },
  WorkerClass = Worker,
  node = false,
) {
  return new Promise((resolve, reject) => {
    validateGeometry(data);
    if (
      !signal ||
      typeof signal.aborted !== "boolean" ||
      typeof signal.addEventListener !== "function" ||
      typeof signal.removeEventListener !== "function"
    )
      throw Error("Invalid abort signal");
    if (!Number.isSafeInteger(generation) || generation < 0) {
      reject(Error("Invalid generation"));
      return;
    }
    if (signal.aborted) {
      reject(Error("Aborted"));
      return;
    }
    const worker = new WorkerClass(
      new URL("./collider-worker.mjs", import.meta.url),
      { type: "module" },
    );
    let done = false;
    const finish = (e, v) => {
      if (done) return;
      done = true;
      signal.removeEventListener("abort", abort);
      worker.terminate();
      e ? reject(e) : resolve(v);
    };
    const abort = () => finish(Error("Aborted"));
    signal.addEventListener("abort", abort, { once: true });
    const receive = (v) => {
      try {
        if (v.error) throw Error(v.error);
        if (v.generation !== generation)
          throw Error("Collider generation mismatch");
        validateGeometry(v.data);
        validateCompiled(v.solids);
        finish(null, v);
      } catch (e) {
        finish(e);
      }
    };
    if (node) {
      worker.on("message", receive);
      worker.on("error", (e) => finish(e));
      worker.on("exit", (code) => {
        if (!done) finish(Error("Worker exited " + code));
      });
    } else {
      worker.onmessage = (e) => receive(e.data);
      worker.onerror = (e) => finish(Error(e.message));
    }
    try {
      worker.postMessage({ data, generation }, transferables(data));
    } catch (e) {
      finish(e);
    }
  });
}
