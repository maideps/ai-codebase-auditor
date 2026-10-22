import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_EOL_TABLE_PATH, loadRuntimeEolTable, type RuntimeEolTable } from "../config/runtime-eol.js";
import { createFixtureRepo } from "../testing/git-fixture.js";
import { collectDependencies, type Dependencies } from "./dependencies.js";

const loaded = loadRuntimeEolTable(DEFAULT_EOL_TABLE_PATH);
if (!loaded.ok) throw new Error(loaded.errors.join("\n"));
const table: RuntimeEolTable = loaded.value;
const now = new Date("2026-10-21T12:00:00Z");

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

function repoWith(files: Record<string, string>): string {
  return createFixtureRepo([{ author: "a@example.com", date: "2026-01-01T00:00:00Z", files }]);
}

function measured(repo: string): Dependencies {
  const result = collectDependencies(repo, { table, now });
  if (result.status !== "measured") throw new Error(`expected a measurement, got: ${result.reason}`);
  return result.value;
}

describe("collectDependencies on a mixed repository", () => {
  const repo = repoWith({
    "package.json": JSON.stringify({ engines: { node: ">=14" }, dependencies: { express: "^4.18.0" } }),
    ".python-version": "3.12.1\n",
    "requirements.txt": "Django==1.11.29\n",
    "web/composer.json": JSON.stringify({ require: { php: "^8.1" } }),
    "node_modules/left-pad/package.json": JSON.stringify({ engines: { node: ">=0.10" } }),
    "broken/package.json": "{ nope",
    "go.mod": "module x\n",
    ".ruby-version": "latest\n",
  });

  it("lists parsed manifests with their dependencies, skipping vendored ones", () => {
    expect(measured(repo).manifests.map((m) => [m.path, m.ecosystem, m.dependencies.length])).toEqual([
      [".python-version", "runtime-file", 0],
      [".ruby-version", "runtime-file", 0],
      ["package.json", "npm", 1],
      ["requirements.txt", "pip", 1],
      ["web/composer.json", "composer", 0],
    ]);
  });

  it("lists unsupported and unparseable manifests as not measured", () => {
    expect(measured(repo).notMeasured).toEqual([
      { path: "broken/package.json", reason: "invalid JSON" },
      { path: "go.mod", reason: "not a supported manifest" },
    ]);
  });

  it("assesses each declared runtime against the dated table", () => {
    expect(measured(repo).runtimes).toEqual([
      {
        runtime: "python", spec: "3.12.1", source: ".python-version", via: ".python-version",
        lowest: "3.12.1", cycle: "3.12", status: "supported", eol: "2028-10-31", reason: null, testFixture: false,
      },
      {
        runtime: "ruby", spec: "latest", source: ".ruby-version", via: ".ruby-version",
        lowest: null, cycle: null, status: "unknown", eol: null, reason: "no lower version bound", testFixture: false,
      },
      {
        runtime: "node", spec: ">=14", source: "package.json", via: "engines.node",
        lowest: "14", cycle: "14", status: "end-of-life", eol: "2023-04-30", reason: null, testFixture: false,
      },
      {
        runtime: "php", spec: "^8.1", source: "web/composer.json", via: "require.php",
        lowest: "8.1", cycle: "8.1", status: "end-of-life", eol: "2025-12-31", reason: null, testFixture: false,
      },
    ]);
  });

  it("states the table date and its age", () => {
    expect(measured(repo).table).toEqual({ asOf: table.asOf, ageDays: 0 });
  });

  it("runs only git and leaves the repository unchanged", () => {
    const before = snapshot(repo);
    const result = collectDependencies(repo, { table, now });
    expect(result.evidence.commands).toEqual(["git rev-parse --verify -q HEAD", "git ls-tree -r -z HEAD"]);
    expect(result.evidence.notes).toContain("nothing is installed or resolved; versions are as declared");
    expect(snapshot(repo)).toEqual(before);
  });
});

describe("collectDependencies edge cases", () => {
  it("marks a cycle missing from the table as unknown", () => {
    const value = measured(repoWith({ ".nvmrc": "3\n" }));
    expect(value.runtimes[0]).toMatchObject({ cycle: "3", status: "unknown", reason: "cycle 3 is not in the end-of-life table" });
  });

  it("marks a too-coarse version as unknown", () => {
    const value = measured(repoWith({ "pyproject.toml": '[project]\nrequires-python = ">=3"\n' }));
    expect(value.runtimes[0]).toMatchObject({ lowest: "3", cycle: null, status: "unknown", reason: "version 3 is too coarse to match a cycle" });
  });

  it("marks runtimes declared under test or fixture directories", () => {
    const value = measured(repoWith({
      "app/composer.json": JSON.stringify({ require: { php: "^8.2" } }),
      "tests/extension/ext/foo/composer.json": JSON.stringify({ require: { php: ">=5.3" } }),
      "spec/fixtures/package.json": JSON.stringify({ engines: { node: ">=0.10" } }),
      "testdata/.nvmrc": "8\n",
    }));
    expect(value.runtimes.map((r) => [r.source, r.testFixture])).toEqual([
      ["app/composer.json", false],
      ["spec/fixtures/package.json", true],
      ["testdata/.nvmrc", true],
      ["tests/extension/ext/foo/composer.json", true],
    ]);
  });

  it("treats the end-of-life date itself as end of life", () => {
    const value = collectDependencies(repoWith({ ".python-version": "3.10\n" }), { table, now: new Date("2026-10-01T00:00:00Z") });
    expect(value.status === "measured" && value.value.runtimes[0]?.status).toBe("end-of-life");
  });

  it("reports a repository without commits as not measured", () => {
    expect(collectDependencies(createFixtureRepo([]), { table, now })).toMatchObject({
      status: "not-measured",
      reason: "repository has no commits",
    });
  });
});
