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
import { commitFixture, createFixtureRepo } from "../src/testing/git-fixture.js";

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
    expect(result.stdout).toContain("Factors: 9 (2 blocking, 7 constraining)");
    expect(result.stdout).toContain("  commits: 2 (");
    expect(result.stdout).toContain("  first commit: 2023-05-01, last commit: 2024-06-01");
    expect(result.stdout).toContain("  files: 5 measured, 2 excluded (binary 1, vendored 1)");
    expect(result.stdout).toContain("  test files: 1 (*.test.* / *.spec.* 1)");
    expect(result.stdout).toContain("  CI: Travis CI 1");
    expect(result.stdout).toContain("Dynamic calls (covered languages read statically, tests included; nothing is run):");
    expect(result.stdout).toContain("Observability (source and config read statically, tests included; nothing is run):\n  logging calls: 0 of 2 source files\n");
    expect(result.stdout).toContain("Co-change (git log of recent non-merge commits; nothing is run):\n  commits read: 2; with source files: 2, 2023-05-01 to 2024-06-01\n");
    expect(result.stdout).toContain("    node >=14 (package.json, engines.node): end-of-life since 2023-04-30");
    expect(result.stdout).toMatch(/Readiness level: [1-5] of 5, set by [a-z-]+ \(provisional: direct-api-calls not measured\)/);
    expect(result.stdout).toMatch(/Verdict: (adopt|adapt|prepare first) \(provisional: direct-api-calls not measured\)/);
    expect(result.stdout).toContain("Risk zones (green: agents may edit; yellow: characterization tests first; red: proposals only):");
    expect(result.stdout).toMatch(/Harness adaptation plan \(ai-harness-framework [0-9.]+\): /);
    expect(result.stdout).toContain("Modernization roadmap (by gain against effort):");
    expect(snapshot(repo)).toEqual(before);
  });

  it("writes identical report files on two runs, outside the untouched target", () => {
    const before = snapshot(repo);
    const first = path.join(scratch, "report-1");
    const second = path.join(scratch, "report-2");
    expect(run("audit", repo, "--out", first).status).toBe(0);
    expect(run("audit", repo, "--out", second).status).toBe(0);
    const harness = ["AGENTS.snippet.md", "README.md", "characterization-tests.md", "claude-settings.json", "roadmap-checks.json"].map((name) => `harness/${name}`);
    for (const name of ["ai-readiness-report.md", "ai-readiness-report.json", "ai-readiness-report.sarif", ...harness]) {
      const a = readFileSync(path.join(first, name));
      expect(a.length).toBeGreaterThan(0);
      expect(a.equals(readFileSync(path.join(second, name)))).toBe(true);
    }
    const report = JSON.parse(readFileSync(path.join(first, "ai-readiness-report.json"), "utf8")) as {
      schemaVersion: number;
      verdict: { verdict: string };
      plan: { framing: string; items: { trigger: { kind: string } }[] };
      roadmap: { factor: string }[];
    };
    expect(report.schemaVersion).toBe(7);
    expect(report.plan.framing.length).toBeGreaterThan(0);
    for (const item of report.plan.items) expect(["factor", "zone"]).toContain(item.trigger.kind);
    expect(Array.isArray(report.roadmap)).toBe(true);
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

describe("mcp", () => {
  it("serves a saved report over stdio: initialize, list the tools and call each one", () => {
    const out = path.join(scratch, "report-mcp");
    expect(run("audit", repo, "--out", out).status).toBe(0);
    const before = snapshot(repo);
    const messages = [
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "e2e", version: "1" } } },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_verdict", arguments: {} } },
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "get_factor", arguments: { id: "test-feedback" } } },
      { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "get_zone", arguments: { path: "src/app.js" } } },
      { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "list_red_paths", arguments: {} } },
      { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "list_yellow_paths", arguments: {} } },
      { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "get_roadmap", arguments: {} } },
    ];
    const result = spawnSync(process.execPath, [cli, "mcp", path.join(out, "ai-readiness-report.json")], {
      encoding: "utf8",
      input: messages.map((m) => JSON.stringify(m)).join("\n") + "\n",
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain("read-only over stdio");
    const responses = result.stdout.trim().split("\n").map((line) => JSON.parse(line) as { id: number; result?: { tools?: { name: string }[]; isError?: boolean; content?: { text: string }[]; protocolVersion?: string } });
    expect(responses.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(responses[0]?.result?.protocolVersion).toBe("2025-06-18");
    expect(responses[1]?.result?.tools?.map((t) => t.name)).toEqual(["get_verdict", "get_factor", "get_zone", "list_red_paths", "list_yellow_paths", "get_roadmap"]);
    for (const response of responses.slice(2)) expect(response.result?.isError).toBe(false);
    expect(JSON.parse(responses[4]?.result?.content?.[0]?.text ?? "{}")).toMatchObject({ path: "src/app.js", module: "src" });
    expect(snapshot(repo)).toEqual(before);
  });
});

describe("verdict gate", () => {
  it("exits 1 with --fail-on at or below the verdict, 0 above it or without the option, and 2 for a bad value", () => {
    const verdict = (JSON.parse(readFileSync(path.join(scratch, "report-1", "ai-readiness-report.json"), "utf8")) as { verdict: { verdict: string } }).verdict.verdict;
    const rank: Record<string, number> = { adopt: 3, adapt: 2, "prepare-first": 1 };
    expect(run("audit", repo).status).toBe(0);
    for (const level of ["adapt", "prepare-first"]) {
      const result = run("audit", repo, "--fail-on", level);
      expect(result.status).toBe((rank[verdict] ?? 0) <= (rank[level] ?? 0) ? 1 : 0);
      expect(result.stdout).toContain(`Verdict gate (--fail-on ${level}):`);
    }
    expect(run("audit", repo, "--fail-on", "never").status).toBe(2);
  });
});

describe("compare", () => {
  it("compares audits of one repository at two commits", () => {
    const evolving = createFixtureRepo([{ author: "a@example.com", date: "2024-01-01T00:00:00Z", files: { "src/app.js": "1\n" } }]);
    const first = path.join(scratch, "compare-1");
    expect(run("audit", evolving, "--out", first).status).toBe(0);
    commitFixture(evolving, { author: "a@example.com", date: "2024-02-01T00:00:00Z", files: { "src/app.test.js": "t\n", "src/auth/login.js": "l\n" } });
    const second = path.join(scratch, "compare-2");
    expect(run("audit", evolving, "--out", second).status).toBe(0);
    const out = path.join(scratch, "comparison");
    const result = run("compare", path.join(first, "ai-readiness-report.json"), path.join(second, "ai-readiness-report.json"), "--out", out);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("test-feedback: 1 → ");
    expect(result.stdout).toContain("Red paths: added src/auth/;");
    const comparison = JSON.parse(readFileSync(path.join(out, "ai-readiness-compare.json"), "utf8")) as { before: { commit: string }; after: { commit: string } };
    expect(comparison.before.commit).not.toBe(comparison.after.commit);
  });
});

describe("audit-batch", () => {
  it("audits a portfolio with one broken entry and leaves every repository untouched", () => {
    const second = createFixtureRepo([{ author: "b@example.com", date: "2024-03-01T00:00:00Z", files: { "app/main.py": "print(1)\n", "tests/test_main.py": "t\n" } }]);
    const beforeFirst = snapshot(repo);
    const beforeSecond = snapshot(second);
    const list = path.join(scratch, "portfolio.txt");
    writeFileSync(list, `${repo}\n${second}\n${path.join(scratch, "no-such-repo")}\n`);
    const out = path.join(scratch, "portfolio");
    const result = run("audit-batch", list, "--out", out);
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/^Portfolio \(3 repositories, audited \d{4}-\d{2}-\d{2}\): /);
    for (const dir of [path.basename(repo), path.basename(second)]) {
      expect(readdirSync(path.join(out, dir)).sort()).toEqual(["ai-readiness-report.json", "ai-readiness-report.md", "ai-readiness-report.sarif", "harness"]);
    }
    const portfolio = JSON.parse(readFileSync(path.join(out, "ai-readiness-portfolio.json"), "utf8")) as { counts: { failed: number } };
    expect(portfolio.counts.failed).toBe(1);
    expect(snapshot(repo)).toEqual(beforeFirst);
    expect(snapshot(second)).toEqual(beforeSecond);
  });
});

describe("validate", () => {
  it("validates a fresh report's zones against a recorded outcomes file", () => {
    const out = path.join(scratch, "report-validate");
    expect(run("audit", repo, "--out", out).status).toBe(0);
    const outcomes = path.join(scratch, "outcomes.json");
    writeFileSync(outcomes, JSON.stringify({
      schema: "ai-codebase-auditor/outcomes", schemaVersion: 1, runner: "e2e",
      tasks: [{ id: "a", filesChanged: ["src/app.js"], passed: true }, { id: "b", filesChanged: ["README.md"], passed: false }],
    }));
    const result = run("validate", path.join(out, "ai-readiness-report.json"), outcomes, "--out", path.join(scratch, "validation"));
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("against 2 recorded tasks from e2e");
    expect(result.stdout).toContain("Ordering green ≥ yellow ≥ red: not enough data");
  });
});
