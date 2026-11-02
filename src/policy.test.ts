import { readFileSync, readdirSync } from "node:fs";
import { expect, test } from "vitest";
test("clay runtime excludes mesh loaders, texture loaders and external asset payloads", () => {
  for (const file of readdirSync(new URL(".", import.meta.url)).filter(
    (name) => name.endsWith(".ts") && !name.endsWith(".test.ts"),
  )) {
    const code = readFileSync(new URL(file, import.meta.url), "utf8");
    expect(code).not.toMatch(
      /GLTFLoader|OBJLoader|FBXLoader|TextureLoader|ImageBitmapLoader|data:image|data:application\/octet-stream/,
    );
    expect(code).not.toMatch(/https?:\/\//);
  }
});
