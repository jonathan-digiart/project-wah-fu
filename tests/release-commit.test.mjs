import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { expect, test } from "vitest";

const policy = fileURLToPath(
  new URL("../scripts/select-release-commit.sh", import.meta.url),
);

test("release selection accepts main history and rejects unmerged or invalid commits", () => {
  const directory = mkdtempSync(join(tmpdir(), "wah-fu-release-policy-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim();
  const select = (value) =>
    spawnSync("bash", [policy], {
      cwd: directory,
      env: { ...process.env, RELEASE_COMMIT: value },
      encoding: "utf8",
    });
  try {
    git("init", "--initial-branch=main");
    git("config", "user.name", "Release policy test");
    git("config", "user.email", "release-policy@example.invalid");
    writeFileSync(join(directory, "fixture"), "approved baseline\n");
    git("add", "fixture");
    git("commit", "-m", "baseline");
    const baseline = git("rev-parse", "HEAD");
    git("commit", "--allow-empty", "-m", "approved main change");
    const main = git("rev-parse", "HEAD");
    git("update-ref", "refs/remotes/origin/main", main);
    git("checkout", "-b", "unmerged");
    writeFileSync(join(directory, "fixture"), "unreviewed branch code\n");
    git("commit", "-am", "unmerged code");
    const unmerged = git("rev-parse", "HEAD");
    git("checkout", "main");

    for (const rejected of [
      unmerged,
      "0".repeat(40),
      baseline.slice(0, 8),
      "main",
      "",
      `$(touch ${join(directory, "injected")})`,
    ]) {
      expect(select(rejected).status, rejected).not.toBe(0);
      expect(git("rev-parse", "HEAD")).toBe(main);
    }
    for (const approved of [baseline, main]) {
      expect(select(approved).status).toBe(0);
      expect(git("rev-parse", "HEAD")).toBe(approved);
      expect(git("show", "HEAD:fixture")).toBe("approved baseline");
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
