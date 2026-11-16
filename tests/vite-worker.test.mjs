import { test, expect } from "vitest";
import { build } from "vite";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("production build emits an inline worker's referenced asset", async () => {
  const root = await mkdtemp(join(tmpdir(), "wahfu-worker-"));
  try {
    await writeFile(
      join(root, "index.html"),
      '<script type="module" src="/main.js"></script>',
    );
    await writeFile(
      join(root, "main.js"),
      'import Worker from "./worker.js?worker&inline"; new Worker();',
    );
    await writeFile(
      join(root, "worker.js"),
      'import asset from "./payload.bin?url&no-inline"; postMessage(asset);',
    );
    await writeFile(join(root, "payload.bin"), "wahfu-worker-asset-fixture");
    const result = await build({
      root,
      configFile: false,
      logLevel: "silent",
      build: { write: false },
    });
    const outputs = Array.isArray(result) ? result : [result];
    const assets = outputs
      .flatMap((output) => output.output)
      .filter((item) => item.type === "asset");
    expect(
      assets.some(
        (asset) => String(asset.source) === "wahfu-worker-asset-fixture",
      ),
    ).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
