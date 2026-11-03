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

test("review page supplies every required control before runtime binds handlers", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  for (const id of [
    "app",
    "status",
    "buildings",
    "context-buildings",
    "context-count",
    "context",
    "pan",
    "reset",
    "top",
    "selection-note",
    "terrain-note",
  ])
    expect(html).toContain(`id="${id}"`);
  expect(html).not.toContain('id="boundary"');
});

test("browser discovery excludes Vitest collision unit files", () => {
  const config = readFileSync(
    new URL("../playwright.config.ts", import.meta.url),
    "utf8",
  );
  expect(config).toContain('testMatch: "**/*.spec.ts"');
});
