import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { URL } from "node:url";
import console from "node:console";
const root = new URL("../dist/", import.meta.url);
const walk = (directory, prefix = "") =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(new URL(entry.name + "/", directory), prefix + entry.name + "/")
      : [prefix + entry.name],
  );
const files = walk(root).sort();
const required = [
  "index.html",
  "site-data.json",
  "THREE-LICENSE.txt",
  "EARCUT-LICENSE.txt",
  "DATA-ATTRIBUTION.txt",
];
for (const file of required) assert(files.includes(file), "Missing " + file);
for (const file of files) {
  assert(
    required.includes(file) || /^assets\/index-[\w-]+\.(js|css)$/.test(file),
    "Unexpected public file: " + file,
  );
  const content = readFileSync(new URL(file, root), "utf8");
  assert(
    !/\/Users\/|\/workspace\/|\/home\/agent\/|github_pat_|ghp_[A-Za-z0-9]{20}|BEGIN [A-Z ]*PRIVATE KEY/.test(
      content,
    ),
    "Private content in " + file,
  );
}
const data = JSON.parse(readFileSync(new URL("site-data.json", root)));
assert.equal(data.buildings.length, 124);
assert.equal(data.buildings.filter((b) => b.category !== "context").length, 18);
assert.equal(
  new Set(
    data.buildings
      .filter((b) => b.category === "context")
      .map((b) => b.sourceId ?? b.id),
  ).size,
  103,
);
assert(data.provenance.datasetUrl.startsWith("https://portal.csdi.gov.hk/"));
const allowed = new Set([
  "boundary",
  "interpolation",
  "review",
  "landRegions",
  "seaRegions",
  "seaHeight",
  "presentationBottom",
  "buildings",
  "terrainControls",
  "provenance",
]);
assert(Object.keys(data).every((key) => allowed.has(key)));
assert(
  data.terrainControls.every(
    (c) => Object.keys(c).sort().join(",") === "height,x,z",
  ),
);
for (const key of [
  "independentSamples",
  "contextMassing",
  "buildingFits",
  "publicExportBlocked",
  "sourceBounds",
])
  assert(
    !JSON.stringify(data).includes('"' + key + '"'),
    "Private audit key " + key,
  );
const html = readFileSync(new URL("index.html", root), "utf8");
assert(html.includes("Lands Department"));
assert(
  !/private review candidate|No\s+public release approval implied/.test(html),
);
const projectUrl = new URL("https://example.invalid/project-wah-fu/");
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (/^https?:/.test(match[1])) continue;
  const resolved = new URL(match[1], projectUrl);
  assert(resolved.pathname.startsWith("/project-wah-fu/"));
  const relative = resolved.pathname.slice("/project-wah-fu/".length);
  assert(files.includes(relative), "Broken subdirectory asset " + relative);
}
assert(
  readFileSync(new URL("THREE-LICENSE.txt", root), "utf8").includes(
    "MIT License",
  ),
);
assert(
  readFileSync(new URL("EARCUT-LICENSE.txt", root), "utf8").includes(
    "Copyright (c) 2024, Mapbox",
  ),
);
assert(
  readFileSync(new URL("DATA-ATTRIBUTION.txt", root), "utf8").includes(
    "https://portal.csdi.gov.hk/csdi-webpage/doc/TNC",
  ),
);
console.log(
  JSON.stringify(
    {
      publicFiles: files.map((file) => {
        const bytes = readFileSync(new URL(file, root));
        return {
          path: file,
          bytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        };
      }),
      checks:
        "allowlist, private-data exclusions, inventory, licence notices and project-subdirectory URLs passed",
    },
    null,
    2,
  ),
);
