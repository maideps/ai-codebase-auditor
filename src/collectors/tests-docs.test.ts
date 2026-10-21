import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createFixtureRepo, git } from "../testing/git-fixture.js";
import { collectTestsDocs, type TestsDocs } from "./tests-docs.js";

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

function measured(repo: string): TestsDocs {
  const result = collectTestsDocs(repo);
  if (result.status !== "measured") throw new Error(`expected a measurement, got: ${result.reason}`);
  return result.value;
}

const CONTRIBUTING = [
  "# Contributing",
  "",
  "- All changes must go through a pull request.",
  "* Never edit generated files in `gen/`.",
  "",
  "```sh",
  "npm test # must not count: inside a code block",
  "```",
  "Thanks for helping!",
  "",
].join("\n");

describe("collectTestsDocs on a polyglot repository", () => {
  const repo = repoWith({
    "README.md": "# A\n",
    "CONTRIBUTING.md": CONTRIBUTING,
    "AGENTS.md": "1. Always run `make check` before committing.\n",
    "docs/ARCHITECTURE.md": "Layers.\n",
    "docs/adr/0001-use-git.md": "Use git.\n",
    "docs/CODING_CONVENTIONS.md": "Do not use tabs.\nPrefer small files.\n",
    "src/lib/README.md": "lib\n",
    "src/app.test.ts": "t\n",
    "src/app.spec.js": "t\n",
    "src/__tests__/util.js": "t\n",
    "tests/test_models.py": "t\n",
    "pkg/server_test.go": "t\n",
    "spec/user_spec.rb": "t\n",
    "tests/UserTest.php": "t\n",
    "src/test/java/com/x/FooTest.java": "t\n",
    "test/integration.c": "t\n",
    "vendor/lib/thing_test.go": "t\n",
    "jest.config.js": "module.exports = {};\n",
    "vitest.e2e.config.ts": "export default {};\n",
    "phpunit.xml.dist": "<phpunit/>\n",
    "pyproject.toml": "[tool.pytest.ini_options]\naddopts = \"-q\"\n",
    "package.json": JSON.stringify({ scripts: { test: "jest" } }),
    ".github/workflows/ci.yml": "on: push\n",
    ".github/workflows/release.yaml": "on: tag\n",
    ".gitlab-ci.yml": "test: {}\n",
    Jenkinsfile: "pipeline {}\n",
  });

  it("finds test files by convention, skipping vendored code", () => {
    expect(measured(repo).tests.files).toEqual([
      { path: "pkg/server_test.go", convention: "*_test.go" },
      { path: "spec/user_spec.rb", convention: "*_spec.rb" },
      { path: "src/__tests__/util.js", convention: "__tests__/" },
      { path: "src/app.spec.js", convention: "*.test.* / *.spec.*" },
      { path: "src/app.test.ts", convention: "*.test.* / *.spec.*" },
      { path: "src/test/java/com/x/FooTest.java", convention: "*Test.java / *Tests.java / *IT.java" },
      { path: "test/integration.c", convention: "test directory" },
      { path: "tests/UserTest.php", convention: "*Test.php" },
      { path: "tests/test_models.py", convention: "test_*.py / *_test.py" },
    ]);
  });

  it("counts test files per convention", () => {
    expect(measured(repo).tests.conventions).toEqual([
      { convention: "*.test.* / *.spec.*", files: 2 },
      { convention: "*Test.java / *Tests.java / *IT.java", files: 1 },
      { convention: "*Test.php", files: 1 },
      { convention: "*_spec.rb", files: 1 },
      { convention: "*_test.go", files: 1 },
      { convention: "__tests__/", files: 1 },
      { convention: "test directory", files: 1 },
      { convention: "test_*.py / *_test.py", files: 1 },
    ]);
  });

  it("finds test runner configs, including ones declared inside manifests", () => {
    expect(measured(repo).tests.runnerConfigs).toEqual([
      { path: "jest.config.js", runner: "Jest" },
      { path: "package.json", runner: "npm test script" },
      { path: "phpunit.xml.dist", runner: "PHPUnit" },
      { path: "pyproject.toml", runner: "pytest" },
      { path: "vitest.e2e.config.ts", runner: "Vitest" },
    ]);
  });

  it("finds CI configuration by system", () => {
    expect(measured(repo).ci).toEqual([
      { path: ".github/workflows/ci.yml", system: "GitHub Actions" },
      { path: ".github/workflows/release.yaml", system: "GitHub Actions" },
      { path: ".gitlab-ci.yml", system: "GitLab CI" },
      { path: "Jenkinsfile", system: "Jenkins" },
    ]);
  });

  it("classifies documentation", () => {
    expect(measured(repo).docs).toEqual({
      readme: ["README.md"],
      moduleReadmes: ["src/lib/README.md"],
      contributing: ["CONTRIBUTING.md"],
      architecture: ["docs/ARCHITECTURE.md"],
      decisionRecords: ["docs/adr/0001-use-git.md"],
      conventions: ["docs/CODING_CONVENTIONS.md"],
      docsDirectory: ["docs/ARCHITECTURE.md", "docs/CODING_CONVENTIONS.md", "docs/adr/0001-use-git.md"],
      agentContext: ["AGENTS.md"],
    });
  });

  it("extracts stated rules with their location, outside code blocks and without soft wording", () => {
    // "Layers." and "Prefer small files." carry no rule keyword; the fenced line does but is code.
    expect(measured(repo).statedRules).toEqual([
      { path: "AGENTS.md", line: 1, text: "Always run `make check` before committing." },
      { path: "CONTRIBUTING.md", line: 3, text: "All changes must go through a pull request." },
      { path: "CONTRIBUTING.md", line: 4, text: "Never edit generated files in `gen/`." },
      { path: "docs/CODING_CONVENTIONS.md", line: 1, text: "Do not use tabs." },
    ]);
  });

  it("never runs anything but git ls-tree, and leaves the repository unchanged", () => {
    const before = snapshot(repo);
    const result = collectTestsDocs(repo);
    expect(result.evidence.commands).toEqual(["git rev-parse --verify -q HEAD", "git ls-tree -r -z HEAD"]);
    expect(snapshot(repo)).toEqual(before);
  });
});

describe("collectTestsDocs type checkers", () => {
  it("detects type-checker configs per language, reading tsconfig through comments", () => {
    const value = measured(repoWith({
      "main.ts": "x\n",
      "tsconfig.json": '{\n  // project config, see https://example.com\n  "compilerOptions": { "strict": true }\n}\n',
      "web/tsconfig.json": '{ "compilerOptions": { "checkJs": true, /* loose */ "strict": false } }\n',
      "jsconfig.json": '{ "compilerOptions": { "checkJs": true } }\n',
      "mypy.ini": "[mypy]\n",
      "setup.cfg": "[mypy]\nstrict = True\n",
      "pyproject.toml": "[tool.pyright]\ntypeCheckingMode = \"strict\"\n",
      "pyrightconfig.json": "{}\n",
      "phpstan.neon.dist": "parameters:\n  level: 8\n",
      "psalm.xml": "<psalm/>\n",
      "sorbet/config": "--dir=.\n",
      Steepfile: "target :app do\nend\n",
    }));
    expect(value.typeCheckers).toEqual([
      { path: "Steepfile", checker: "Steep", language: "ruby" },
      { path: "jsconfig.json", checker: "checkJs", language: "javascript" },
      { path: "mypy.ini", checker: "mypy", language: "python" },
      { path: "phpstan.neon.dist", checker: "PHPStan", language: "php" },
      { path: "psalm.xml", checker: "Psalm", language: "php" },
      { path: "pyproject.toml", checker: "Pyright", language: "python" },
      { path: "pyrightconfig.json", checker: "Pyright", language: "python" },
      { path: "setup.cfg", checker: "mypy", language: "python" },
      { path: "sorbet/config", checker: "Sorbet", language: "ruby" },
      { path: "tsconfig.json", checker: "TypeScript (strict)", language: "typescript" },
      { path: "web/tsconfig.json", checker: "TypeScript", language: "typescript" },
      { path: "web/tsconfig.json", checker: "TypeScript checkJs", language: "javascript" },
    ]);
  });

  it("finds none in a repository without checker configs", () => {
    expect(measured(repoWith({ "app.py": "x\n", "pyproject.toml": "[tool.pytest.ini_options]\n" })).typeCheckers).toEqual([]);
  });
});

describe("collectTestsDocs on sparse repositories", () => {
  it("reports no tests when only the npm default test script exists", () => {
    const value = measured(repoWith({
      "README.rst": "Hello\n",
      "src/main.c": "int main(void) { return 0; }\n",
      "package.json": JSON.stringify({ scripts: { test: 'echo "Error: no test specified" && exit 1' } }),
    }));
    expect(value.tests).toEqual({ files: [], conventions: [], runnerConfigs: [] });
    expect(value.ci).toEqual([]);
    expect(value.docs.readme).toEqual(["README.rst"]);
    expect(value.statedRules).toEqual([]);
  });

  it("lists an agent context file without rules for presence only", () => {
    const result = collectTestsDocs(repoWith({ "main.c": "x\n", "CLAUDE.md": "# Project\n\nThis is a C project.\n" }));
    expect(result.status === "measured" && result.value.docs.agentContext).toEqual(["CLAUDE.md"]);
    expect(result.status === "measured" && result.value.statedRules).toEqual([]);
    expect(result.evidence.notes).toContain("agent context files are listed for presence only; presence alone scores nothing");
  });

  it("reports a repository without commits as not measured", () => {
    expect(collectTestsDocs(createFixtureRepo([]))).toMatchObject({ status: "not-measured", reason: "repository has no commits" });
  });

  it("does not read a rules file through a symlink", () => {
    const repo = repoWith({ "main.c": "x\n" });
    const blob = git(repo, ["hash-object", "-w", "main.c"]).trim();
    git(repo, ["update-index", "--add", "--cacheinfo", `120000,${blob},CONTRIBUTING.md`]);
    git(repo, ["commit", "-q", "-m", "link"], { GIT_AUTHOR_NAME: "a", GIT_AUTHOR_EMAIL: "a@example.com", GIT_COMMITTER_NAME: "a", GIT_COMMITTER_EMAIL: "a@example.com" });
    const value = measured(repo);
    expect(value.docs.contributing).toEqual(["CONTRIBUTING.md"]);
    expect(value.unreadDocs).toEqual([{ path: "CONTRIBUTING.md", reason: "symlink" }]);
  });
});
