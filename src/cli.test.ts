import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readVersion, runCli, USAGE } from "./cli.js";
import { DEFAULT_HARNESS_REQUIREMENTS_PATH } from "./config/harness-requirements.js";
import { createFixtureRepo } from "./testing/git-fixture.js";

const root = mkdtempSync(path.join(os.tmpdir(), "aca-cli-"));
const repo = path.join(root, "repo");
mkdirSync(path.join(repo, ".git"), { recursive: true });

describe("runCli: help and version", () => {
  it("prints usage when called without arguments", () => {
    expect(runCli([], "1.2.3")).toEqual({ exitCode: 0, stdout: USAGE, stderr: "" });
  });

  it("prints usage for --help, -h and audit --help", () => {
    expect(runCli(["--help"], "1.2.3").stdout).toBe(USAGE);
    expect(runCli(["-h"], "1.2.3").stdout).toBe(USAGE);
    expect(runCli(["audit", "--help"], "1.2.3").stdout).toBe(USAGE);
  });

  it("prints the version for --version and -v", () => {
    expect(runCli(["--version"], "1.2.3")).toEqual({ exitCode: 0, stdout: "1.2.3\n", stderr: "" });
    expect(runCli(["-v"], "1.2.3").stdout).toBe("1.2.3\n");
  });

  it("rejects an unknown command with exit code 2 on stderr", () => {
    const result = runCli(["scan"], "1.2.3");
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("error: unknown command scan");
  });
});

describe("runCli: audit", () => {
  it("prints the target and factor summary for a repository", () => {
    const result = runCli(["audit", repo], "1.2.3");
    expect(result.stderr).toBe("");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`Target: ${repo}`);
    expect(result.stdout).toContain("Factors: 9 (2 blocking, 7 constraining)");
    expect(result.stdout).toMatch(/blocking\s+test-feedback\s+-\s+not measured: code structure not measured \(git failed: .+\)/);
    expect(result.stdout).toContain("Readiness level: not determined (no blocking factor could be scored)");
    expect(result.stdout).toMatch(/Verdict: none\n {2}rule: no verdict: test-feedback is not measured \(code structure not measured \(git failed: .+\)\)/);
    expect(result.stdout).toMatch(/ {2}no zones: code structure not measured \(git failed: .+\)/);
    expect(result.stdout).toContain("Harness adaptation plan (ai-harness-framework 0.5.0): No plan: there is no verdict to plan for.\n  no items\n");
  });

  it("reports git-based collectors as not measured when git cannot read the target", () => {
    const result = runCli(["audit", repo], "1.2.3");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Git history: not measured \(git failed: .+\)/);
    expect(result.stdout).toMatch(/Code structure: not measured \(git failed: .+\)/);
    expect(result.stdout).toMatch(/Tests and docs: not measured \(git failed: .+\)/);
    expect(result.stdout).toMatch(/Dependencies: not measured \(git failed: .+\)/);
  });

  it("summarizes dependencies and runtime end of life for a real repository", () => {
    const real = createFixtureRepo([
      {
        author: "a@example.com",
        date: "2026-01-01T00:00:00Z",
        files: {
          "package.json": JSON.stringify({ engines: { node: ">=14" }, dependencies: { express: "^4.18.0" }, devDependencies: { jest: "29" } }),
          "requirements.txt": "Django==1.11.29\n",
          "go.mod": "module x\n",
        },
      },
    ]);
    const result = runCli(["audit", real], "1.2.3");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Dependencies (manifests read statically; nothing is installed):");
    expect(result.stdout).toContain("  manifests: 2 (npm 1, pip 1), 3 dependencies declared");
    expect(result.stdout).toContain("    node >=14 (package.json, engines.node): end-of-life since 2023-04-30");
    expect(result.stdout).toContain("  not measured: 1 (go.mod: not a supported manifest)");
    expect(result.stdout).toMatch(/ {2}end-of-life table: as of \d{4}-\d{2}-\d{2}/);
  });

  it("summarizes tests and docs of a real repository", () => {
    const real = createFixtureRepo([
      {
        author: "a@example.com",
        date: "2026-01-01T00:00:00Z",
        files: {
          "README.md": "# r\n",
          "AGENTS.md": "- Never push to main.\n",
          "src/app.ts": "x\n",
          "src/app.test.ts": "t\n",
          "tests/test_api.py": "t\n",
          ".github/workflows/ci.yml": "on: push\n",
          "pytest.ini": "[pytest]\n",
        },
      },
    ]);
    const result = runCli(["audit", real], "1.2.3");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Tests and docs (paths tracked at HEAD; nothing is run):");
    expect(result.stdout).toContain("  test files: 2 (*.test.* / *.spec.* 1, test_*.py / *_test.py 1)");
    expect(result.stdout).toContain("  test runner configs: pytest (pytest.ini)");
    expect(result.stdout).toContain("  CI: GitHub Actions 1");
    expect(result.stdout).toContain("  README: README.md; contributing: none");
    expect(result.stdout).toContain("  agent context: AGENTS.md (presence alone scores nothing)");
    expect(result.stdout).toContain("  stated rules: 1 lines in 1 files");
  });

  it("summarizes the git history of a real repository", () => {
    const real = createFixtureRepo([
      { author: "a@example.com", date: "2020-03-01T00:00:00Z", files: { "a.txt": "1" } },
      { author: "b@example.com", date: "2021-04-02T00:00:00Z", files: { "b.txt": "1" } },
    ]);
    const result = runCli(["audit", real], "1.2.3");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Git history (non-merge commits):");
    expect(result.stdout).toContain("  commits: 2 (0 in the last 12 months)");
    expect(result.stdout).toContain("  authors: 2");
    expect(result.stdout).toContain("  first commit: 2020-03-01, last commit: 2021-04-02");
    expect(result.stdout).toContain("  tracked files: 2");
  });

  it("summarizes the code structure of a real repository", () => {
    const real = createFixtureRepo([
      {
        author: "a@example.com",
        date: "2026-01-01T00:00:00Z",
        files: { "README.md": "r\n", "src/big.ts": "x\n".repeat(1500), "src/small.ts": "1\n2\n", "vendor/lib.js": "v\n" },
      },
    ]);
    const result = runCli(["audit", real], "1.2.3");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Code structure (files tracked at HEAD):");
    expect(result.stdout).toContain("  files: 3 measured, 1 excluded (vendored 1)");
    expect(result.stdout).toContain("  lines: 1503 total; per file p50 2, p90 1500, max 1500 (src/big.ts)");
    expect(result.stdout).toContain("  files over 1000 lines: 1");
    expect(result.stdout).toContain("  top-level modules: 2 (largest: src, 1502 lines)");
    expect(result.stdout).toMatch(/ {2}scc: (used for language, code lines and complexity|not used \(.+\))/);
  });

  it("resolves a relative target and --config against cwd", () => {
    const config = path.join(root, "one.json");
    writeFileSync(
      config,
      JSON.stringify({ version: 1, factors: [{ id: "only", name: "Only", class: "blocking", description: "d" }] }),
      "utf8",
    );
    const result = runCli(["audit", "repo", "--config", "one.json"], "1.2.3", root);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(`Config: ${config}`);
    expect(result.stdout).toContain("Factors: 1 (1 blocking, 0 constraining)");
    // The default harness requirements name factors this config leaves out: listed, not an error.
    expect(result.stdout).toContain("  not assessed: verifiable-changes, typed-changes, legible-context, written-intent, reproducible-runs, supported-runtime");
  });

  it("requires a repository path", () => {
    const result = runCli(["audit"], "1.2.3");
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("error: audit needs a repository path");
  });

  it("rejects more than one path", () => {
    const result = runCli(["audit", repo, "other"], "1.2.3");
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("error: audit takes one repository path, got 2");
  });

  it("rejects an unknown option", () => {
    const result = runCli(["audit", repo, "--fast"], "1.2.3");
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("--fast");
  });

  it("reports target and config problems together", () => {
    const broken = path.join(root, "broken.json");
    writeFileSync(broken, JSON.stringify({ version: 1, factors: [] }), "utf8");
    const missing = path.join(root, "missing");
    const result = runCli(["audit", missing, "--config", broken], "1.2.3");
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(`error: target ${missing} does not exist`);
    expect(result.stderr).toContain(`error: ${broken}: factors must be a non-empty array`);
  });
});

describe("runCli: scores", () => {
  // Plain JavaScript with tests, CI and a README: well tested, untyped.
  const scored = createFixtureRepo([
    {
      author: "a@example.com",
      date: "2026-01-01T00:00:00Z",
      files: {
        "README.md": "# r\n",
        "src/a.js": "a\n",
        "src/b.js": "b\n",
        "src/a.test.js": "t\n",
        "jest.config.js": "module.exports = {};\n",
        ".github/workflows/ci.yml": "on: push\n",
      },
    },
  ]);

  it("prints a score per factor and the readiness level set by the lowest blocking factor", () => {
    const result = runCli(["audit", scored], "1.2.3");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Scores (1-5; the lowest blocking factor sets the readiness level, never an average):");
    // a.js, b.js and jest.config.js are source files: 1 test file for 3.
    expect(result.stdout).toMatch(/blocking\s+test-feedback\s+5\s+ratio 0\.33/);
    expect(result.stdout).toMatch(/constraining\s+type-strictness\s+1\s+weighted typed share 0\.00/);
    expect(result.stdout).toMatch(/blocking\s+direct-api-calls\s+-\s+not measured: no collector signal yet/);
    expect(result.stdout).toContain("Readiness level: 5 of 5, set by test-feedback (provisional: direct-api-calls not measured)");
    // Tests score 5, but nothing is typed and the only doc is a README: adapt, with modules green.
    expect(result.stdout).toContain("Verdict: adapt (provisional: direct-api-calls not measured)");
    expect(result.stdout).toContain("  rule: 2 weak factors (score ≤ 2): type-strictness 1, documented-intent 2");
    expect(result.stdout).toMatch(/ {2}green {3}src +2 source files: test-feedback 5 ≥ 3/);
    expect(result.stdout).toContain("  red paths: none");
  });

  it("prints the harness adaptation plan and the roadmap, each item citing its trigger", () => {
    const result = runCli(["audit", scored], "1.2.3");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Harness adaptation plan (ai-harness-framework 0.5.0): Adopt the harness with these adaptations.");
    expect(result.stdout).toMatch(/ {2}required +typed-changes +type-strictness 1\n {2}required +written-intent +documented-intent 2\n/);
    // No root package.json or pyproject.toml: the harness would detect no stack.
    expect(result.stdout).toMatch(/ {2}required +detected-stack +test-feedback 5\n/);
    expect(result.stdout).toMatch(/ {2}recommended +reproducible-runs +dev-deploy-simplicity 3\n/);
    expect(result.stdout).toContain("  not assessed: supported-runtime");
    expect(result.stdout).toContain("Modernization roadmap (by gain against effort):\n  1. documented-intent 2→3 [S] write at least 3 project rules");
    expect(result.stdout).toContain("  2. type-strictness 1→3 [M] configure TypeScript checkJs for javascript with a baseline");
  });

  it("reads harness requirements from --harness and rejects unknown factors and invalid files", () => {
    const requirements = JSON.parse(readFileSync(DEFAULT_HARNESS_REQUIREMENTS_PATH, "utf8")) as {
      requirements: { factor: string }[];
    };
    const own = path.join(root, "own-requirements.json");
    writeFileSync(own, JSON.stringify({ ...requirements, harness: { name: "my-harness", version: "1.0.0" } }), "utf8");
    expect(runCli(["audit", scored, "--harness", own], "1.2.3").stdout).toContain("Harness adaptation plan (my-harness 1.0.0): ");
    const unknown = path.join(root, "unknown-requirement.json");
    const renamed = requirements.requirements.map((requirement, index) => (index === 1 ? { ...requirement, factor: "made-up" } : requirement));
    writeFileSync(unknown, JSON.stringify({ ...requirements, requirements: renamed }), "utf8");
    const unknownResult = runCli(["audit", scored, "--harness", unknown], "1.2.3");
    expect(unknownResult.exitCode).toBe(2);
    expect(unknownResult.stderr).toContain(`error: ${unknown}: requirements[1].factor made-up is not a configured factor`);
    const invalid = path.join(root, "invalid-requirements.json");
    writeFileSync(invalid, "{", "utf8");
    const invalidResult = runCli(["audit", scored, "--harness", invalid], "1.2.3");
    expect(invalidResult.exitCode).toBe(2);
    expect(invalidResult.stderr).toContain(`error: ${invalid}:`);
  });

  it("applies a current deferral and shows it", () => {
    const deferrals = path.join(root, "deferrals.json");
    writeFileSync(deferrals, JSON.stringify({ version: 1, deferrals: [{ factor: "type-strictness", recorded: "2026-09-01", reason: "adding JSDoc types" }] }), "utf8");
    const result = runCli(["audit", scored, "--deferrals", deferrals], "1.2.3");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/constraining\s+type-strictness\s+2\s/);
    expect(result.stdout).toContain("deferral recorded 2026-09-01 (adding JSDoc types): raised from 1 to 2");
    // type-strictness is constraining, so the deferral moves its score but not the readiness level.
    expect(result.stdout).toContain("Readiness level: 5 of 5, set by test-feedback");
  });

  it("rejects deferrals for unknown factors and invalid deferral files", () => {
    const unknown = path.join(root, "unknown-deferral.json");
    writeFileSync(unknown, JSON.stringify({ version: 1, deferrals: [{ factor: "made-up", recorded: "2026-09-01", reason: "r" }] }), "utf8");
    const unknownResult = runCli(["audit", scored, "--deferrals", unknown], "1.2.3");
    expect(unknownResult.exitCode).toBe(2);
    expect(unknownResult.stderr).toContain(`error: ${unknown}: deferrals[0].factor made-up is not a configured factor`);
    const invalid = path.join(root, "invalid-deferral.json");
    writeFileSync(invalid, JSON.stringify({ version: 1, deferrals: [{ factor: "file-size", recorded: "soon", reason: "r" }] }), "utf8");
    expect(runCli(["audit", scored, "-d", invalid], "1.2.3").stderr).toContain(`error: ${invalid}: deferrals[0].recorded must be a YYYY-MM-DD date`);
  });

  it("rejects thresholds a factor's rule cannot use", () => {
    const config = path.join(root, "bad-thresholds.json");
    writeFileSync(
      config,
      JSON.stringify({ version: 1, factors: [{ id: "test-feedback", name: "Tests", class: "blocking", description: "d", thresholds: { minRatio3: 0.05 } }] }),
      "utf8",
    );
    const result = runCli(["audit", scored, "--config", config], "1.2.3");
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(`error: ${config}: test-feedback thresholds.minRatio4 is missing`);
  });
});

describe("runCli: report files", () => {
  const target = createFixtureRepo([
    { author: "a@example.com", date: "2026-01-01T00:00:00Z", files: { "README.md": "# r\n", "src/a.js": "a\n", "src/a.test.js": "t\n" } },
  ]);

  it("writes the Markdown and JSON report to --out and says where", () => {
    const out = path.join(root, "reports");
    const result = runCli(["audit", target, "--out", out], "1.2.3");
    expect(result.exitCode).toBe(0);
    const markdown = path.join(out, "ai-readiness-report.md");
    const json = path.join(out, "ai-readiness-report.json");
    expect(result.stdout).toContain(`Report written:\n  ${markdown}\n  ${json}\n`);
    expect(readFileSync(markdown, "utf8")).toMatch(/^# AI-readiness audit: /);
    const report = JSON.parse(readFileSync(json, "utf8")) as { tool: { version: string }; target: { path: string; head: string } };
    expect(report.tool.version).toBe("1.2.3");
    expect(report.target.path).toBe(target);
    expect(report.target.head).toMatch(/^[0-9a-f]{40}$/);
  });

  it("writes no files without --out", () => {
    const result = runCli(["audit", target], "1.2.3", root);
    expect(result.stdout).not.toContain("Report written");
  });

  it("refuses an out directory inside the audited repository", () => {
    const inside = path.join(target, "reports");
    const result = runCli(["audit", target, "-o", inside], "1.2.3");
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain(`error: out directory ${inside} is inside the audited repository ${target}`);
    expect(existsSync(inside)).toBe(false);
  });
});

describe("readVersion", () => {
  it("reads a semver version from package.json", () => {
    expect(readVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
