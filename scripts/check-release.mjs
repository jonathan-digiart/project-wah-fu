import "./check-legacy-release.mjs";
import { execFileSync } from "node:child_process";
execFileSync(
  "python3",
  [
    "verification/public-v128/verify-public-release.py",
    "dist",
    "verification/public-v128/FILE-MANIFEST.json",
  ],
  { stdio: "inherit" },
);
