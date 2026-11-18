// The installable package: npm pack, install the
// tarball into an empty project, and audit a fixture repository with the
// installed binary, as a user would after `npm install`.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { createFixtureRepo } from "../src/testing/git-fixture.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { name: string; version: string };

// npm is a .cmd shim on Windows, which spawn only finds through a shell.
function npm(args: string[], cwd: string) {
  return spawnSync("npm", args, { cwd, encoding: "utf8", shell: process.platform === "win32", env: { ...process.env, npm_config_audit: "false", npm_config_fund: "false", npm_config_update_notifier: "false" } });
}

let scratch: string;
let tarball: string;
let files: string[];

beforeAll(() => {
  scratch = mkdtempSync(path.join(os.tmpdir(), "aca-pkg-"));
  // --ignore-scripts: npm run e2e has just built dist/, and the prepack clean build would
  // delete it under the smoke tests running beside this file.
  const packed = npm(["pack", "--ignore-scripts", "--json", "--pack-destination", scratch], root);
  expect(packed.status, packed.stderr).toBe(0);
  const json = packed.stdout.slice(packed.stdout.indexOf("[\n"));
  const [entry] = JSON.parse(json) as { filename: string; files: { path: string }[] }[];
  if (!entry) throw new Error("npm pack printed no entry");
  tarball = path.join(scratch, entry.filename);
  files = entry.files.map((file) => file.path).sort();
}, 240_000);

describe("npm pack", () => {
  it("holds only the built code, config, skill, README, LICENSE and package.json", () => {
    expect(readdirSync(scratch)).toContain(path.basename(tarball));
    const tops = [...new Set(files.map((file) => (file.includes("/") ? `${file.split("/")[0]}/` : file)))].sort();
    expect(tops).toEqual(["LICENSE", "README.md", "config/", "dist/", "package.json"]);
    expect(files).toEqual(expect.arrayContaining([
      "dist/cli.js", "dist/mcp/server.js", "dist/report/sarif.js",
      "config/factors.json", "config/decision.json", "config/runtime-eol.json", "config/harness-requirements.json",
      "config/agent-skills/risk-zones/SKILL.md",
    ]));
    expect(files.filter((file) => /\.test\.|\/testing\//.test(file))).toEqual([]);
  });

  it("installs into an empty project and audits a repository with the installed binary", () => {
    const project = path.join(scratch, "project");
    const repo = createFixtureRepo([{ author: "a@example.com", date: "2024-01-01T00:00:00Z", files: { "src/app.js": "1\n", "src/app.test.js": "t\n" } }]);
    writeFileSync(path.join(scratch, "package.json"), "{}\n");
    const init = npm(["init", "-y"], scratch);
    expect(init.status, init.stderr).toBe(0);
    const install = npm(["install", "--no-save", "--offline", tarball], scratch);
    expect(install.status, install.stderr).toBe(0);
    const out = path.join(project, "reports");
    const run = npm(["exec", "--no", "--", "ai-codebase-auditor", "audit", repo, "--out", out], scratch);
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain("Verdict:");
    expect(readdirSync(out).sort()).toEqual(["ai-readiness-report.json", "ai-readiness-report.md", "ai-readiness-report.sarif"]);
    const version = npm(["exec", "--no", "--", "ai-codebase-auditor", "--version"], scratch);
    expect(version.stdout.trim()).toBe(pkg.version);
  }, 240_000);
});
