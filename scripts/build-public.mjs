import { URL } from "node:url";
import { cpSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
const source = new URL("../release/public-v128/", import.meta.url);
const output = new URL("../dist/", import.meta.url);
execFileSync(
  "python3",
  [
    "verification/public-v128/verify-public-release.py",
    "release/public-v128",
    "verification/public-v128/FILE-MANIFEST.json",
  ],
  { stdio: "inherit" },
);
rmSync(output, { recursive: true, force: true });
cpSync(source, output, { recursive: true, dereference: false });
