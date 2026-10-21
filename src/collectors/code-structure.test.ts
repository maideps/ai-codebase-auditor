import { mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createFixtureRepo, git } from "../testing/git-fixture.js";
import { collectCodeStructure, type CodeStructure, type CodeStructureOptions } from "./code-structure.js";

const noScc: CodeStructureOptions = { scc: { command: "scc-binary-that-does-not-exist" } };

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

// A fixture with known sizes plus every kind of file the collector must skip.
function knownRepo(): string {
  const repo = createFixtureRepo([
    {
      author: "a@example.com",
      date: "2026-01-01T00:00:00Z",
      files: {
        "README.md": "",
        "win.txt": "a\r\nb\r\n",
        "lib/c.py": "a\nb",
        "src/a.ts": "1\n2\n3\n",
        "src/b.ts": "x\n".repeat(1200),
        "vendor/jquery.js": "v\n",
        "node_modules/x/index.js": "n\n",
        "assets/logo.png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]),
        "package-lock.json": "{}\n",
        "dist/app.min.js": "m\n",
        "gone.txt": "g\n",
      },
    },
  ]);
  // A symlink and a submodule exist only in the tree, never on disk, so reading
  // either would mean the collector followed a link.
  const blob = git(repo, ["hash-object", "-w", "README.md"]).trim();
  git(repo, ["update-index", "--add", "--cacheinfo", `120000,${blob},link`]);
  git(repo, ["update-index", "--add", "--cacheinfo", "160000,1111111111111111111111111111111111111111,sub"]);
  git(repo, ["commit", "-q", "-m", "links"], {
    GIT_AUTHOR_NAME: "a",
    GIT_AUTHOR_EMAIL: "a@example.com",
    GIT_COMMITTER_NAME: "a",
    GIT_COMMITTER_EMAIL: "a@example.com",
  });
  rmSync(path.join(repo, "gone.txt"));
  return repo;
}

function measured(repo: string, options: CodeStructureOptions = noScc): CodeStructure {
  const result = collectCodeStructure(repo, options);
  if (result.status !== "measured") throw new Error(`expected a measurement, got: ${result.reason}`);
  return result.value;
}

describe("collectCodeStructure on a known tree", () => {
  const repo = knownRepo();

  it("counts lines and bytes per included file, sorted by path", () => {
    expect(measured(repo).files).toEqual([
      { path: "README.md", lines: 0, bytes: 0, language: null, code: null, complexity: null },
      { path: "lib/c.py", lines: 2, bytes: 3, language: null, code: null, complexity: null },
      { path: "src/a.ts", lines: 3, bytes: 6, language: null, code: null, complexity: null },
      { path: "src/b.ts", lines: 1200, bytes: 2400, language: null, code: null, complexity: null },
      { path: "win.txt", lines: 2, bytes: 6, language: null, code: null, complexity: null },
    ]);
  });

  it("lists every excluded file with its reason, never reading through links", () => {
    expect(measured(repo).excluded).toEqual([
      { path: "assets/logo.png", reason: "binary" },
      { path: "dist/app.min.js", reason: "generated" },
      { path: "gone.txt", reason: "missing" },
      { path: "link", reason: "symlink" },
      { path: "node_modules/x/index.js", reason: "vendored" },
      { path: "package-lock.json", reason: "generated" },
      { path: "sub", reason: "submodule" },
      { path: "vendor/jquery.js", reason: "vendored" },
    ]);
  });

  it("summarizes the file-size distribution with nearest-rank percentiles", () => {
    expect(measured(repo).distribution).toEqual({
      files: 5,
      totalLines: 1207,
      totalBytes: 2415,
      p50Lines: 2,
      p90Lines: 1200,
      p99Lines: 1200,
      maxLines: 1200,
      buckets: [
        { label: "0-200", files: 4 },
        { label: "201-500", files: 0 },
        { label: "501-1000", files: 0 },
        { label: "1001-2000", files: 1 },
        { label: "2001+", files: 0 },
      ],
      largest: [
        { path: "src/b.ts", lines: 1200 },
        { path: "src/a.ts", lines: 3 },
        { path: "lib/c.py", lines: 2 },
        { path: "win.txt", lines: 2 },
        { path: "README.md", lines: 0 },
      ],
    });
  });

  it("groups included files into top-level modules", () => {
    expect(measured(repo).modules).toEqual([
      { name: "(root)", files: 2, lines: 2, bytes: 6 },
      { name: "lib", files: 1, lines: 2, bytes: 3 },
      { name: "src", files: 2, lines: 1203, bytes: 2406 },
    ]);
  });

  it("records that scc was not installed and keeps scc-only fields null", () => {
    const result = collectCodeStructure(repo, noScc);
    expect(result.status === "measured" && result.value.scc).toEqual({
      status: "unavailable",
      reason: "scc is not installed or not on PATH",
    });
    expect(result.evidence.notes).toContain("line and byte counts come from the built-in counter");
  });

  it("leaves the repository unchanged, including .git", () => {
    const before = snapshot(repo);
    collectCodeStructure(repo, noScc);
    expect(snapshot(repo)).toEqual(before);
  });
});

describe("collectCodeStructure with scc", () => {
  const repo = knownRepo();
  const scratch = mkdtempSync(path.join(os.tmpdir(), "aca-fake-scc-"));

  // Stand-in for scc: prints the given output and exits with the given code.
  function fakeScc(output: string, exitCode = 0): CodeStructureOptions {
    const script = path.join(scratch, `scc-${Math.random().toString(36).slice(2)}.mjs`);
    writeFileSync(script, `process.stdout.write(${JSON.stringify(output)}); process.stderr.write("scc stderr"); process.exit(${exitCode});\n`, "utf8");
    return { scc: { command: process.execPath, args: [script] } };
  }

  it("adds language, code lines and complexity from scc output, matching paths in any form", () => {
    const output = JSON.stringify([
      { Name: "TypeScript", Files: [
        { Location: "src/a.ts", Language: "TypeScript", Code: 3, Complexity: 1 },
        { Location: "./src/b.ts", Language: "TypeScript", Code: 1200, Complexity: 7 },
      ] },
      { Name: "Python", Files: [{ Location: "lib\\c.py", Language: "Python", Code: 2, Complexity: 0 }] },
      { Name: "JavaScript", Files: [{ Location: "vendor/jquery.js", Language: "JavaScript", Code: 1, Complexity: 0 }] },
    ]);
    const value = measured(repo, fakeScc(output));
    expect(value.scc).toEqual({ status: "used" });
    expect(value.files.find((file) => file.path === "src/b.ts")).toEqual({
      path: "src/b.ts", lines: 1200, bytes: 2400, language: "TypeScript", code: 1200, complexity: 7,
    });
    expect(value.files.find((file) => file.path === "lib/c.py")?.language).toBe("Python");
    expect(value.files.find((file) => file.path === "README.md")?.language).toBeNull();
    expect(value.files.some((file) => file.path === "vendor/jquery.js")).toBe(false);
  });

  it("cites the scc command it ran", () => {
    const result = collectCodeStructure(repo, fakeScc("[]"));
    expect(result.evidence.commands).toContain("scc --by-file --format json .");
  });

  it("reports a failing scc run and falls back to the built-in counter", () => {
    const value = measured(repo, fakeScc("", 3));
    expect(value.scc).toEqual({ status: "unavailable", reason: "scc failed: scc stderr" });
    expect(value.files).toHaveLength(5);
  });

  it("reports unparseable scc output", () => {
    expect(measured(repo, fakeScc("not json")).scc).toEqual({
      status: "unavailable",
      reason: "scc output could not be parsed",
    });
  });
});

describe("collectCodeStructure edge cases", () => {
  it("reports a repository without commits as not measured", () => {
    expect(collectCodeStructure(createFixtureRepo([]), noScc)).toMatchObject({
      status: "not-measured",
      reason: "repository has no commits",
    });
  });

  it("reports a missing git binary as not measured", () => {
    const repo = createFixtureRepo([{ author: "a@example.com", date: "2026-01-01T00:00:00Z", files: { "a.txt": "1" } }]);
    expect(collectCodeStructure(repo, { ...noScc, gitBinary: "git-binary-that-does-not-exist" })).toMatchObject({
      status: "not-measured",
      reason: "git is not installed or not on PATH",
    });
  });
});
