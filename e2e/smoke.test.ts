// Smoke run against the built CLI (dist/cli.js), as a user would invoke it.
// The e2e script builds first. Each run audits a throwaway git repository in a
// temp directory and checks the repository is left exactly as it was.

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

function run(...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

// Every path under dir with its size and modification time.
function snapshot(dir: string): string[] {
  const entries: string[] = [];
  const walk = (current: string) => {
    for (const name of readdirSync(current).sort()) {
      const full = path.join(current, name);
      const stats = statSync(full);
      entries.push(`${path.relative(dir, full)} ${stats.size} ${stats.mtimeMs}`);
      if (stats.isDirectory()) walk(full);
    }
  };
  walk(dir);
  return entries;
}

let repo: string;
let scratch: string;

beforeAll(() => {
  scratch = mkdtempSync(path.join(os.tmpdir(), "aca-e2e-"));
  repo = path.join(scratch, "target");
  execFileSync("git", ["init", "-q", repo]);
  writeFileSync(path.join(repo, "README.md"), "# target\n", "utf8");
});

describe("built CLI", () => {
  it("prints the package version", () => {
    const result = run("--version");
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(pkg.version);
  });

  it("prints usage with --help", () => {
    const result = run("--help");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: ai-codebase-auditor audit <repo-path>");
  });

  it("exits 2 on an unknown option", () => {
    const result = run("--nope");
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("error: unknown option --nope");
  });
});

describe("audit", () => {
  it("summarizes the default factors and leaves the repository untouched", () => {
    const before = snapshot(repo);
    const result = run("audit", repo);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`Target: ${repo}`);
    expect(result.stdout).toContain("Factors: 9 (3 blocking, 6 constraining)");
    expect(snapshot(repo)).toEqual(before);
  });

  it("exits 2 and names the problem for a broken config", () => {
    const broken = path.join(scratch, "broken.json");
    writeFileSync(broken, '{ "version": 1, "factors": [ { "id": "x" } ] }', "utf8");
    const result = run("audit", repo, "--config", broken);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(`error: ${broken}: factors[0].name must be a non-empty string`);
  });

  it("exits 2 for a directory that is not a repository", () => {
    const result = run("audit", scratch);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("is not the root of a git working tree");
  });
});
