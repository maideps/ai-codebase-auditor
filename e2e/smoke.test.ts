// Smoke run against the built CLI (dist/cli.js), as a user would invoke it.
// The e2e script builds first. Once the audit command exists, extend this to
// audit a small fixture repository created in a temp directory.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

function run(...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

describe("built CLI", () => {
  it("prints the package version", () => {
    const result = run("--version");
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(pkg.version);
  });

  it("prints usage with --help", () => {
    const result = run("--help");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: ai-codebase-auditor");
  });

  it("exits 2 on an unknown argument", () => {
    const result = run("--nope");
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Unknown argument: --nope");
  });
});
