// Tests-and-docs detector: test files, test runner configs, CI configuration,
// documentation and the rules a project writes down for contributors and
// agents. Works from paths tracked at HEAD and a few small file reads; it
// never runs the target's tests or tools.

import { realpathSync } from "node:fs";
import { createGitRunner, GitError, hasCommits } from "./git.js";
import { isVendored, listTree, readTrackedFile, type ReadSkip, type TreeEntry } from "./tree.js";
import type { Evidence, Measurement } from "./types.js";

export interface StatedRule {
  path: string;
  /** 1-based line number in the file. */
  line: number;
  text: string;
}

export interface TestsDocs {
  tests: {
    files: { path: string; convention: string }[];
    conventions: { convention: string; files: number }[];
    runnerConfigs: { path: string; runner: string }[];
  };
  /** CI configuration files: CI is configured, not necessarily passing. */
  ci: { path: string; system: string }[];
  docs: {
    readme: string[];
    moduleReadmes: string[];
    contributing: string[];
    architecture: string[];
    decisionRecords: string[];
    conventions: string[];
    docsDirectory: string[];
    /** Listed for presence only; presence alone scores nothing. */
    agentContext: string[];
  };
  /** Rule-like lines from agent context, contributing, architecture and convention docs. */
  statedRules: StatedRule[];
  /** Rule documents that could not be read, with the reason. */
  unreadDocs: { path: string; reason: ReadSkip | "too-large" }[];
}

export interface TestsDocsOptions {
  /** Git executable; defaults to `git` on PATH. */
  gitBinary?: string;
}

// First match wins, so specific name conventions come before the catch-all
// "file in a test directory".
const TEST_CONVENTIONS: { convention: string; matches: (filePath: string, name: string) => boolean }[] = [
  { convention: "__tests__/", matches: (filePath) => filePath.split("/").includes("__tests__") },
  { convention: "*.test.* / *.spec.*", matches: (_, name) => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(name) },
  { convention: "test_*.py / *_test.py", matches: (_, name) => /^test_.*\.py$|_test\.py$/.test(name) },
  { convention: "*_test.go", matches: (_, name) => name.endsWith("_test.go") },
  { convention: "*_spec.rb", matches: (_, name) => name.endsWith("_spec.rb") },
  { convention: "*_test.rb", matches: (_, name) => name.endsWith("_test.rb") },
  { convention: "*Test.php", matches: (_, name) => name.endsWith("Test.php") },
  { convention: "*Test.java / *Tests.java / *IT.java", matches: (_, name) => /(?:Test|Tests|IT)\.java$/.test(name) },
  { convention: "*Test.kt / *Tests.kt", matches: (_, name) => /(?:Test|Tests)\.kt$/.test(name) },
  { convention: "*Test.cs / *Tests.cs", matches: (_, name) => /(?:Test|Tests)\.cs$/.test(name) },
  {
    convention: "test directory",
    matches: (filePath, name) =>
      filePath.split("/").slice(0, -1).some((segment) => TEST_DIRECTORIES.has(segment)) && SOURCE_EXTENSIONS.has(extension(name)),
  },
];
const TEST_DIRECTORIES = new Set(["test", "tests", "spec", "specs", "t"]);
const SOURCE_EXTENSIONS = new Set([
  "js", "jsx", "ts", "tsx", "mjs", "cjs", "py", "rb", "php", "java", "kt", "kts", "scala", "go", "rs", "c", "cc", "cpp", "cxx",
  "h", "hpp", "cs", "fs", "vb", "swift", "m", "mm", "pl", "t", "lua", "sh", "bats", "ex", "exs", "erl", "clj", "groovy", "dart", "r", "jl",
]);

const RUNNER_BY_NAME: { pattern: RegExp; runner: string }[] = [
  // Named variants such as vitest.e2e.config.ts count too.
  { pattern: /^jest(?:\.[\w-]+)?\.config\.(?:[cm]?[jt]s|json)$/, runner: "Jest" },
  { pattern: /^vitest(?:\.[\w-]+)?\.config\./, runner: "Vitest" },
  { pattern: /^karma\.conf\./, runner: "Karma" },
  { pattern: /^\.mocharc(?:\.|$)/, runner: "Mocha" },
  { pattern: /^cypress\.config\./, runner: "Cypress" },
  { pattern: /^playwright\.config\./, runner: "Playwright" },
  { pattern: /^(?:pytest\.ini|conftest\.py)$/, runner: "pytest" },
  { pattern: /^tox\.ini$/, runner: "tox" },
  { pattern: /^phpunit\.xml(?:\.dist)?$/, runner: "PHPUnit" },
  { pattern: /^\.rspec$/, runner: "RSpec" },
];
// npm init writes this placeholder; it declares no tests.
const NPM_DEFAULT_TEST = 'echo "Error: no test specified" && exit 1';

const CI_SYSTEMS: { matches: (filePath: string) => boolean; system: string }[] = [
  { matches: (p) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(p), system: "GitHub Actions" },
  { matches: (p) => p === ".gitlab-ci.yml", system: "GitLab CI" },
  { matches: (p) => p === ".travis.yml", system: "Travis CI" },
  { matches: (p) => p === ".circleci/config.yml", system: "CircleCI" },
  { matches: (p) => p === "Jenkinsfile" || p.endsWith("/Jenkinsfile"), system: "Jenkins" },
  { matches: (p) => p === "azure-pipelines.yml", system: "Azure Pipelines" },
  { matches: (p) => p === "appveyor.yml" || p === ".appveyor.yml", system: "AppVeyor" },
  { matches: (p) => p === "bitbucket-pipelines.yml", system: "Bitbucket Pipelines" },
  { matches: (p) => p === ".drone.yml", system: "Drone" },
  { matches: (p) => p === ".buildkite/pipeline.yml", system: "Buildkite" },
];

const DOC_EXTENSIONS = new Set(["md", "markdown", "rst", "txt", "adoc", "asciidoc", "org"]);
const AGENT_CONTEXT_NAMES = new Set(["agents.md", "claude.md", "gemini.md", "codex.md", ".cursorrules", ".windsurfrules"]);
const DECISION_DIRECTORIES = new Set(["adr", "adrs", "decisions", "decision-records"]);

const RULE_KEYWORDS = /\b(?:must|never|always|do not|don't|should not|shouldn't|required|forbidden|prohibited)\b/i;
const MAX_RULE_FILE_BYTES = 1024 * 1024;
const MAX_RULES_PER_FILE = 200;
const MAX_RULE_LENGTH = 200;

const NOTES = [
  "paths are those tracked at HEAD; vendored paths are ignored",
  "test files are matched by name and directory conventions; tests are never run",
  "CI files show that CI is configured, not that it passes",
  "agent context files are listed for presence only; presence alone scores nothing",
  "stated rules are lines with must, never, always, do not, should not, required, forbidden or prohibited in agent context, contributing, architecture and convention docs, outside code blocks; whether a rule is non-standard needs judgment",
];

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

const byPath = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function classifyDocs(paths: readonly string[]): TestsDocs["docs"] {
  const docs: TestsDocs["docs"] = {
    readme: [], moduleReadmes: [], contributing: [], architecture: [],
    decisionRecords: [], conventions: [], docsDirectory: [], agentContext: [],
  };
  for (const filePath of paths) {
    const segments = filePath.split("/");
    const name = segments[segments.length - 1] ?? "";
    const lower = name.toLowerCase();
    const isDoc = DOC_EXTENSIONS.has(extension(name));
    const atRoot = segments.length === 1;
    const isAgentContext =
      AGENT_CONTEXT_NAMES.has(lower) || filePath === ".github/copilot-instructions.md" || filePath.startsWith(".cursor/rules/");
    if (isAgentContext) docs.agentContext.push(filePath);
    if (/^readme(?:\.|$)/.test(lower)) (atRoot ? docs.readme : docs.moduleReadmes).push(filePath);
    if (/^contributing(?:\.|$)/.test(lower) && (atRoot || segments[0] === ".github" || segments[0] === "docs")) docs.contributing.push(filePath);
    if (!isDoc) continue;
    if (/^(?:architecture|design)(?:\.|$)/.test(lower)) docs.architecture.push(filePath);
    if (segments.slice(0, -1).some((segment) => DECISION_DIRECTORIES.has(segment.toLowerCase()))) docs.decisionRecords.push(filePath);
    if (!isAgentContext && /convention|standard|style|guideline|coding|rules/.test(lower)) docs.conventions.push(filePath);
    if (["docs", "doc", "documentation"].includes(segments[0] ?? "") && !atRoot) docs.docsDirectory.push(filePath);
  }
  for (const list of Object.values(docs)) list.sort(byPath);
  return docs;
}

function extractRules(filePath: string, text: string): StatedRule[] {
  const rules: StatedRule[] = [];
  let inFence = false;
  text.split(/\r?\n/).forEach((raw, index) => {
    if (/^\s*(?:```|~~~)/.test(raw)) {
      inFence = !inFence;
      return;
    }
    if (inFence || rules.length >= MAX_RULES_PER_FILE) return;
    const line = raw.replace(/^\s*(?:>\s*)*(?:#+\s+|[-*+]\s+|\d+[.)]\s+)?/, "").trim();
    if (!line || !RULE_KEYWORDS.test(line)) return;
    rules.push({ path: filePath, line: index + 1, text: line.length > MAX_RULE_LENGTH ? `${line.slice(0, MAX_RULE_LENGTH - 1)}…` : line });
  });
  return rules;
}

function runnerFromManifest(name: string, content: string): string | null {
  if (name === "pyproject.toml" && content.includes("[tool.pytest")) return "pytest";
  if (name === "setup.cfg" && content.includes("[tool:pytest]")) return "pytest";
  if (name === "package.json") {
    try {
      const manifest: unknown = JSON.parse(content);
      const test = (manifest as { scripts?: { test?: unknown } } | null)?.scripts?.test;
      if (typeof test === "string" && test.trim() && test.trim() !== NPM_DEFAULT_TEST) return "npm test script";
    } catch {
      return null;
    }
  }
  return null;
}

export function collectTestsDocs(repoPath: string, options: TestsDocsOptions = {}): Measurement<TestsDocs> {
  const evidence: Evidence = { commands: [], notes: [...NOTES] };
  const git = createGitRunner(repoPath, options.gitBinary ?? "git", evidence);
  let entries: TreeEntry[];
  try {
    if (!hasCommits(git)) return { status: "not-measured", reason: "repository has no commits", evidence };
    entries = listTree(git).filter((entry) => !isVendored(entry.path));
  } catch (error) {
    if (error instanceof GitError) return { status: "not-measured", reason: error.message, evidence };
    throw error;
  }
  entries.sort((a, b) => byPath(a.path, b.path));
  const realRepo = realpathSync(repoPath);
  const read = (entry: TreeEntry) => readTrackedFile(realRepo, repoPath, entry, { skipBinary: true });

  const testFiles: TestsDocs["tests"]["files"] = [];
  const runnerConfigs: TestsDocs["tests"]["runnerConfigs"] = [];
  const ci: TestsDocs["ci"] = [];
  for (const entry of entries) {
    const name = entry.path.slice(entry.path.lastIndexOf("/") + 1);
    const convention = TEST_CONVENTIONS.find((candidate) => candidate.matches(entry.path, name));
    if (convention) testFiles.push({ path: entry.path, convention: convention.convention });
    const byName = RUNNER_BY_NAME.find((candidate) => candidate.pattern.test(name));
    if (byName) runnerConfigs.push({ path: entry.path, runner: byName.runner });
    else if (name === "pyproject.toml" || name === "setup.cfg" || name === "package.json") {
      const file = read(entry);
      const runner = "content" in file ? runnerFromManifest(name, file.content.toString("utf8")) : null;
      if (runner) runnerConfigs.push({ path: entry.path, runner });
    }
    const system = CI_SYSTEMS.find((candidate) => candidate.matches(entry.path));
    if (system) ci.push({ path: entry.path, system: system.system });
  }

  const counts = new Map<string, number>();
  for (const file of testFiles) counts.set(file.convention, (counts.get(file.convention) ?? 0) + 1);
  const docs = classifyDocs(entries.map((entry) => entry.path));

  const ruleSources = [...new Set([...docs.agentContext, ...docs.contributing, ...docs.architecture, ...docs.conventions])].sort(byPath);
  const byFile = new Map(entries.map((entry) => [entry.path, entry]));
  const statedRules: StatedRule[] = [];
  const unreadDocs: TestsDocs["unreadDocs"] = [];
  for (const source of ruleSources) {
    const entry = byFile.get(source);
    if (!entry) continue;
    const file = read(entry);
    if ("skipped" in file) unreadDocs.push({ path: source, reason: file.skipped });
    else if (file.content.length > MAX_RULE_FILE_BYTES) unreadDocs.push({ path: source, reason: "too-large" });
    else statedRules.push(...extractRules(source, file.content.toString("utf8")));
  }

  return {
    status: "measured",
    value: {
      tests: {
        files: testFiles,
        conventions: [...counts.entries()].sort(([a], [b]) => byPath(a, b)).map(([convention, files]) => ({ convention, files })),
        runnerConfigs,
      },
      ci,
      docs,
      statedRules,
      unreadDocs,
    },
    evidence,
  };
}
