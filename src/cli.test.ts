import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readVersion, runCli, USAGE } from "./cli.js";
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
    expect(result.stdout).toContain("Factors: 9 (3 blocking, 6 constraining)");
    expect(result.stdout).toMatch(/blocking\s+test-feedback\s+Test presence and feedback speed/);
    expect(result.stdout).toContain("Not collected yet: code structure, tests and docs, dependencies.");
  });

  it("reports git history as not measured when git cannot read the target", () => {
    const result = runCli(["audit", repo], "1.2.3");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Git history: not measured \(git failed: .+\)/);
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

describe("readVersion", () => {
  it("reads a semver version from package.json", () => {
    expect(readVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
