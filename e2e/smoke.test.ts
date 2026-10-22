// Smoke run against the built CLI (dist/cli.js), as a user would invoke it.
// The e2e script builds first. Each run audits a throwaway git repository in a
// temp directory and checks the repository, .git included, is left exactly as
// it was.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { createFixtureRepo } from "../src/testing/git-fixture.js";

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
  repo = createFixtureRepo([
    {
      author: "a@example.com",
      date: "2023-05-01T00:00:00Z",
      files: {
        "README.md": "# target\n",
        "src/app.js": "1\n",
        "src/app.test.js": "t\n",
        "package.json": JSON.stringify({ engines: { node: ">=14" } }),
        ".travis.yml": "language: node_js\n",
        "vendor/lib.js": "v\n",
        "assets/logo.png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]),
      },
    },
    { author: "b@example.com", date: "2024-06-01T00:00:00Z", files: { "src/app.js": "2\n" } },
  ]);
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
  it("summarizes factors and every collector, and leaves the repository untouched", () => {
    const before = snapshot(repo);
    const result = run("audit", repo);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`Target: ${repo}`);
    expect(result.stdout).toContain("Factors: 9 (3 blocking, 6 constraining)");
    expect(result.stdout).toContain("  commits: 2 (");
    expect(result.stdout).toContain("  first commit: 2023-05-01, last commit: 2024-06-01");
    expect(result.stdout).toContain("  files: 5 measured, 2 excluded (binary 1, vendored 1)");
    expect(result.stdout).toContain("  test files: 1 (*.test.* / *.spec.* 1)");
    expect(result.stdout).toContain("  CI: Travis CI 1");
    expect(result.stdout).toContain("    node >=14 (package.json, engines.node): end-of-life since 2023-04-30");
    expect(result.stdout).toMatch(/Readiness level: [1-5] of 5, set by [a-z-]+ \(provisional: direct-api-calls not measured\)/);
    expect(result.stdout).toMatch(/Verdict: (adopt|adapt|prepare first) \(provisional: direct-api-calls not measured\)/);
    expect(result.stdout).toContain("Risk zones (green: agents may edit; yellow: characterization tests first; red: proposals only):");
    expect(snapshot(repo)).toEqual(before);
  });

  it("writes identical report files on two runs, outside the untouched target", () => {
    const before = snapshot(repo);
    const first = path.join(scratch, "report-1");
    const second = path.join(scratch, "report-2");
    expect(run("audit", repo, "--out", first).status).toBe(0);
    expect(run("audit", repo, "--out", second).status).toBe(0);
    for (const name of ["ai-readiness-report.md", "ai-readiness-report.json"]) {
      const a = readFileSync(path.join(first, name));
      expect(a.length).toBeGreaterThan(0);
      expect(a.equals(readFileSync(path.join(second, name)))).toBe(true);
    }
    const report = JSON.parse(readFileSync(path.join(first, "ai-readiness-report.json"), "utf8")) as { schemaVersion: number; verdict: { verdict: string } };
    expect(report.schemaVersion).toBe(1);
    expect(["adopt", "adapt", "prepare-first"]).toContain(report.verdict.verdict);
    expect(snapshot(repo)).toEqual(before);
  });

  it("refuses to write the report inside the target", () => {
    const result = run("audit", repo, "--out", path.join(repo, "report"));
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("is inside the audited repository");
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
