import { readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
const visit = (directory) =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? visit(path) : [path];
  });
const files = visit("dist-procedural");
for (const path of files)
  if (![".html", ".js", ".txt"].includes(extname(path)))
    throw new Error(`Unexpected non-code asset in procedural build: ${path}`);
for (const name of [
  "procedural.html",
  "DATA-ATTRIBUTION.txt",
  "THREE-LICENSE.txt",
  "EARCUT-LICENSE.txt",
])
  if (!files.includes(join("dist-procedural", name)))
    throw new Error(`Missing procedural entry or notice: ${name}`);
