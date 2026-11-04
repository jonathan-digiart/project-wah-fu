/** One disposable worker per job. Manager concurrency bounds workers; abort terminates actual computation.
 * Node tests use nodeWorkerLoader; browser production uses browserWorkerLoader.
 */
function load(WorkerClass, job, { signal }, node = false) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(Error("Aborted"));
      return;
    }
    const worker = new WorkerClass(new URL("./worker.mjs", import.meta.url), {
      type: "module",
    });
    let done = false;
    const finish = (error, data) => {
      if (done) return;
      done = true;
      signal.removeEventListener("abort", abort);
      worker.terminate();
      error ? reject(error) : resolve(data);
    };
    const abort = () => finish(Error("Aborted"));
    signal.addEventListener("abort", abort, { once: true });
    const receive = (value) =>
      value.error ? finish(Error(value.error)) : finish(null, value.data);
    if (node) {
      worker.on("message", receive);
      worker.on("error", (e) => finish(e));
      worker.on("exit", (code) => {
        if (!done) finish(Error(`Worker exited ${code}`));
      });
    } else {
      worker.onmessage = (e) => receive(e.data);
      worker.onerror = (e) => finish(Error(e.message));
    }
    worker.postMessage(job);
  });
}
export const browserWorkerLoader = (job, options) => load(Worker, job, options);
export async function nodeWorkerLoader(job, options) {
  const { Worker } = await import("node:worker_threads");
  return load(Worker, job, options, true);
}
