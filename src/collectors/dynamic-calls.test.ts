import { mkdtempSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createFixtureRepo, git } from "../testing/git-fixture.js";
import { collectDynamicCalls, type DynamicCalls } from "./dynamic-calls.js";

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

function knownRepo(): string {
  const repo = createFixtureRepo([
    {
      author: "a@example.com",
      date: "2026-01-01T00:00:00Z",
      files: {
        "app/plugins.py": "import importlib\n\ndef load(name):\n    return importlib.import_module(name)\n",
        "app/plain.py": "def f(x):\n    return getattr(x, 'name', None)  # literal: visible\n",
        "web/index.php": "<?php\n$handler = $_GET['h'];\n$handler();\n",
        "lib/model.rb": "class M\n  def method_missing(sym, *args)\n    super\n  end\nend\n",
        "src/Loader.java": "class Loader {\n  Object load(String n) throws Exception {\n    return Class.forName(n).getDeclaredConstructor().newInstance();\n  }\n}\n",
        "ui/app.ts": "export const run = (handlers: Record<string, () => void>, key: string) => handlers[key]();\n",
        "ui/app.min.js": "eval(x);\n",
        "ui/bundle.js": `var a=${"1".repeat(1200)};eval(a);\n`,
        "vendor/lib.rb": "x.send(name)\n",
        "native/main.c": "int main(void) { return 0; }\n",
        "README.md": "eval(x)\n",
        "assets/logo.php": Buffer.from([0x3c, 0x3f, 0x00, 0x01]),
      },
    },
  ]);
  const blob = git(repo, ["hash-object", "-w", "app/plugins.py"]).trim();
  git(repo, ["update-index", "--add", "--cacheinfo", `120000,${blob},link.py`]);
  git(repo, ["commit", "-q", "-m", "link"], { GIT_AUTHOR_NAME: "a", GIT_AUTHOR_EMAIL: "a@example.com", GIT_COMMITTER_NAME: "a", GIT_COMMITTER_EMAIL: "a@example.com" });
  return repo;
}

function measured(repo: string): DynamicCalls {
  const result = collectDynamicCalls(repo);
  if (result.status !== "measured") throw new Error(`expected a measurement, got: ${result.reason}`);
  return result.value;
}

describe("collectDynamicCalls on a repository with every covered language", () => {
  const repo = knownRepo();
  const value = measured(repo);

  it("reads every covered source file and records each computed-target site with its excerpt", () => {
    expect(value.files).toEqual([
      { path: "app/plain.py", family: "python", lines: 2, sites: [] },
      { path: "app/plugins.py", family: "python", lines: 4, sites: [{ line: 4, construct: "import by name", excerpt: "return importlib.import_module(name)" }] },
      { path: "lib/model.rb", family: "ruby", lines: 5, sites: [{ line: 2, construct: "method_missing", excerpt: "def method_missing(sym, *args)" }] },
      { path: "src/Loader.java", family: "java", lines: 5, sites: [{ line: 3, construct: "Class.forName by name", excerpt: "return Class.forName(n).getDeclaredConstructor().newInstance();" }] },
      { path: "ui/app.ts", family: "javascript", lines: 1, sites: [{ line: 1, construct: "computed call", excerpt: "export const run = (handlers: Record<string, () => void>, key: string) => handlers[key]();" }] },
      { path: "web/index.php", family: "php", lines: 3, sites: [{ line: 3, construct: "variable function", excerpt: "$handler();" }] },
    ]);
  });

  it("skips vendored, generated, minified, binary and linked files, and leaves other languages alone", () => {
    expect(value.skipped).toEqual([
      { path: "assets/logo.php", reason: "binary" },
      { path: "link.py", reason: "symlink" },
      { path: "ui/app.min.js", reason: "generated" },
      { path: "ui/bundle.js", reason: "minified" },
      { path: "vendor/lib.rb", reason: "vendored" },
    ]);
    expect(value.files.map((file) => file.path)).not.toContain("native/main.c");
  });

  it("records what it read and how", () => {
    const result = collectDynamicCalls(repo);
    expect(result.evidence.commands).toEqual(["git rev-parse --verify -q HEAD", "git ls-tree -r -z HEAD"]);
    expect(result.evidence.notes).toContain("only calls whose target is computed count; a literal target is visible at the call site");
  });

  it("leaves the repository unchanged, including .git", () => {
    const before = snapshot(repo);
    collectDynamicCalls(repo);
    expect(snapshot(repo)).toEqual(before);
  });
});

describe("collectDynamicCalls without a measurement", () => {
  it("reports an empty repository and a directory that is not a repository", () => {
    const empty = mkdtempSync(path.join(os.tmpdir(), "aca-dyn-empty-"));
    git(empty, ["init", "-q"]);
    expect(collectDynamicCalls(empty)).toMatchObject({ status: "not-measured", reason: "repository has no commits" });
    const plain = mkdtempSync(path.join(os.tmpdir(), "aca-dyn-plain-"));
    expect(collectDynamicCalls(plain)).toMatchObject({ status: "not-measured" });
  });
});
