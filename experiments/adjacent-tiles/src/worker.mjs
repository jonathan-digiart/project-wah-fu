import { buildTile, transferables } from "./geometry.mjs";
const run = (job, send) => {
  try {
    const data = buildTile(job);
    send({ data }, transferables(data));
  } catch (e) {
    send({ error: String(e) }, []);
  }
};
if (typeof globalThis.postMessage === "function")
  globalThis.onmessage = (e) =>
    run(e.data, (value, transfers) => postMessage(value, transfers));
else {
  const { parentPort } = await import("node:worker_threads");
  parentPort.on("message", (job) =>
    run(job, (value, transfers) => parentPort.postMessage(value, transfers)),
  );
}
