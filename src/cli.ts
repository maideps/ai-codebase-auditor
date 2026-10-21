#!/usr/bin/env node

// Command-line entry point: argument parsing, exit codes and wiring. The audit
// command validates its target, factor config and runtime end-of-life table,
// then runs the four collectors (git history, code structure, tests and docs,
// dependencies). Scoring arrives with feat-006.

import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { collectCodeStructure, type CodeStructure } from "./collectors/code-structure.js";
import { collectDependencies, type Dependencies, type RuntimeAssessment } from "./collectors/dependencies.js";
import { collectGitHistory, type GitHistory } from "./collectors/git-history.js";
import { collectTestsDocs, type TestsDocs } from "./collectors/tests-docs.js";
import type { Measurement } from "./collectors/types.js";
import { DEFAULT_CONFIG_PATH, loadFactorConfig, type FactorConfig } from "./config/factors.js";
import { DEFAULT_EOL_TABLE_PATH, loadRuntimeEolTable } from "./config/runtime-eol.js";
import { resolveTarget, type AuditTarget } from "./target.js";

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const EXIT_OK = 0;
const EXIT_USAGE = 2;

export const USAGE = `Usage: ai-codebase-auditor audit <repo-path> [--config <file>]
       ai-codebase-auditor --help | --version

Audits a local git repository for AI-agent readiness. The repository is only
read, never modified or executed.

Commands:
  audit <repo-path>      Audit the git working tree at <repo-path>

Options:
  -c, --config <file>    Factor configuration (default: config/factors.json)
  -h, --help             Show this help
  -v, --version          Show the version
`;

function usageError(errors: readonly string[]): CliResult {
  const lines = errors.map((error) => `error: ${error}`).join("\n");
  return { exitCode: EXIT_USAGE, stdout: "", stderr: `${lines}\n\nRun 'ai-codebase-auditor --help' for usage.\n` };
}

function formatGitHistory(history: Measurement<GitHistory>): string[] {
  if (history.status === "not-measured") return [`Git history: not measured (${history.reason})`];
  const { totals } = history.value;
  const day = (timestamp: string | null) => timestamp?.slice(0, 10) ?? "none";
  return [
    "Git history (non-merge commits):",
    `  commits: ${totals.commits} (${totals.commitsLastYear} in the last 12 months)`,
    `  authors: ${totals.authors}`,
    `  first commit: ${day(totals.firstCommit)}, last commit: ${day(totals.lastCommit)}`,
    `  tracked files: ${totals.trackedFiles}`,
  ];
}

function formatCodeStructure(structure: Measurement<CodeStructure>): string[] {
  if (structure.status === "not-measured") return [`Code structure: not measured (${structure.reason})`];
  const { distribution, excluded, modules, scc } = structure.value;
  const reasons = new Map<string, number>();
  for (const file of excluded) reasons.set(file.reason, (reasons.get(file.reason) ?? 0) + 1);
  const excludedDetail = [...reasons.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([reason, count]) => `${reason} ${count}`).join(", ");
  const over1000 = distribution.buckets.filter((bucket) => bucket.label === "1001-2000" || bucket.label === "2001+").reduce((sum, bucket) => sum + bucket.files, 0);
  const largestFile = distribution.largest[0];
  const largestModule = [...modules].sort((a, b) => b.lines - a.lines)[0];
  return [
    "Code structure (files tracked at HEAD):",
    `  files: ${distribution.files} measured, ${excluded.length} excluded${excludedDetail ? ` (${excludedDetail})` : ""}`,
    `  lines: ${distribution.totalLines} total; per file p50 ${distribution.p50Lines}, p90 ${distribution.p90Lines}, max ${distribution.maxLines}${largestFile ? ` (${largestFile.path})` : ""}`,
    `  files over 1000 lines: ${over1000}`,
    `  top-level modules: ${modules.length}${largestModule ? ` (largest: ${largestModule.name}, ${largestModule.lines} lines)` : ""}`,
    `  scc: ${scc.status === "used" ? "used for language, code lines and complexity" : `not used (${scc.reason})`}`,
  ];
}

function countBy<T>(items: readonly T[], key: (item: T) => string): string {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return [...counts.entries()].map(([name, count]) => `${name} ${count}`).join(", ");
}

function formatTestsDocs(testsDocs: Measurement<TestsDocs>): string[] {
  if (testsDocs.status === "not-measured") return [`Tests and docs: not measured (${testsDocs.reason})`];
  const { tests, ci, docs, statedRules } = testsDocs.value;
  const list = (paths: readonly string[]) => (paths.length > 0 ? paths.join(", ") : "none");
  const ruleFiles = new Set(statedRules.map((rule) => rule.path)).size;
  return [
    "Tests and docs (paths tracked at HEAD; nothing is run):",
    `  test files: ${tests.files.length}${tests.files.length > 0 ? ` (${tests.conventions.map((c) => `${c.convention} ${c.files}`).join(", ")})` : ""}`,
    `  test runner configs: ${tests.runnerConfigs.length > 0 ? tests.runnerConfigs.map((r) => `${r.runner} (${r.path})`).join(", ") : "none"}`,
    `  CI: ${ci.length > 0 ? countBy(ci, (file) => file.system) : "none"}`,
    `  README: ${list(docs.readme)}; contributing: ${list(docs.contributing)}`,
    `  architecture: ${docs.architecture.length}, decision records: ${docs.decisionRecords.length}, conventions: ${docs.conventions.length}, docs/ files: ${docs.docsDirectory.length}, module READMEs: ${docs.moduleReadmes.length}`,
    `  agent context: ${list(docs.agentContext)}${docs.agentContext.length > 0 ? " (presence alone scores nothing)" : ""}`,
    `  stated rules: ${statedRules.length} lines in ${ruleFiles} files`,
  ];
}

function formatRuntime(runtime: RuntimeAssessment): string {
  const status =
    runtime.status === "end-of-life" ? `end-of-life since ${runtime.eol ?? "?"}`
    : runtime.status === "supported" ? `supported until ${runtime.eol ?? "?"}`
    : `unknown (${runtime.reason ?? "no reason"})`;
  // A runtime file such as .nvmrc is its own declaration; don't name it twice.
  const where = runtime.source.endsWith(runtime.via) ? runtime.source : `${runtime.source}, ${runtime.via}`;
  return `    ${runtime.runtime} ${runtime.spec} (${where}): ${status}`;
}

function formatDependencies(dependencies: Measurement<Dependencies>): string[] {
  if (dependencies.status === "not-measured") return [`Dependencies: not measured (${dependencies.reason})`];
  const { manifests, runtimes, notMeasured, table } = dependencies.value;
  const declared = manifests.reduce((sum, manifest) => sum + manifest.dependencies.length, 0);
  const ecosystems = countBy(manifests, (manifest) => manifest.ecosystem);
  const shown = notMeasured.slice(0, 5).map((item) => `${item.path}: ${item.reason}`).join("; ");
  const more = notMeasured.length > 5 ? `; and ${notMeasured.length - 5} more` : "";
  return [
    "Dependencies (manifests read statically; nothing is installed):",
    `  manifests: ${manifests.length}${manifests.length > 0 ? ` (${ecosystems})` : ""}, ${declared} dependencies declared`,
    ...(runtimes.length > 0 ? ["  runtimes:", ...runtimes.map(formatRuntime)] : ["  runtimes: none declared"]),
    `  not measured: ${notMeasured.length > 0 ? `${notMeasured.length} (${shown}${more})` : "none"}`,
    `  end-of-life table: as of ${table.asOf}${table.ageDays > 365 ? " (more than a year old)" : ""}`,
  ];
}

interface Collected {
  history: Measurement<GitHistory>;
  structure: Measurement<CodeStructure>;
  testsDocs: Measurement<TestsDocs>;
  dependencies: Measurement<Dependencies>;
}

function formatSummary(target: AuditTarget, configPath: string, config: FactorConfig, collected: Collected): string {
  const blocking = config.factors.filter((factor) => factor.class === "blocking").length;
  const idWidth = Math.max(...config.factors.map((factor) => factor.id.length)) + 2;
  const rows = config.factors.map(
    (factor) => `  ${factor.class.padEnd(14)}${factor.id.padEnd(idWidth)}${factor.name}`,
  );
  return [
    `Target: ${target.path}`,
    `Config: ${configPath}`,
    `Factors: ${config.factors.length} (${blocking} blocking, ${config.factors.length - blocking} constraining)`,
    ...rows,
    "",
    ...formatGitHistory(collected.history),
    "",
    ...formatCodeStructure(collected.structure),
    "",
    ...formatTestsDocs(collected.testsDocs),
    "",
    ...formatDependencies(collected.dependencies),
    "",
    "Nothing is scored yet.",
    "",
  ].join("\n");
}

function runAudit(args: readonly string[], cwd: string): CliResult {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...args],
      options: {
        config: { type: "string", short: "c" },
        help: { type: "boolean", short: "h" },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    return usageError([(error as Error).message]);
  }
  if (parsed.values.help) return { exitCode: EXIT_OK, stdout: USAGE, stderr: "" };

  const { positionals } = parsed;
  const [repoPath] = positionals;
  if (repoPath === undefined) return usageError(["audit needs a repository path"]);
  if (positionals.length > 1) return usageError([`audit takes one repository path, got ${positionals.length}`]);

  const configPath = parsed.values.config === undefined ? DEFAULT_CONFIG_PATH : path.resolve(cwd, parsed.values.config);
  const target = resolveTarget(repoPath, cwd);
  const config = loadFactorConfig(configPath);
  const eolTable = loadRuntimeEolTable(DEFAULT_EOL_TABLE_PATH);
  if (!target.ok || !config.ok || !eolTable.ok) {
    return usageError([...(target.ok ? [] : target.errors), ...(config.ok ? [] : config.errors), ...(eolTable.ok ? [] : eolTable.errors)]);
  }
  const collected: Collected = {
    history: collectGitHistory(target.value.path),
    structure: collectCodeStructure(target.value.path),
    testsDocs: collectTestsDocs(target.value.path),
    dependencies: collectDependencies(target.value.path, { table: eolTable.value }),
  };
  return { exitCode: EXIT_OK, stdout: formatSummary(target.value, configPath, config.value, collected), stderr: "" };
}

export function runCli(args: readonly string[], version: string, cwd: string = process.cwd()): CliResult {
  const [command, ...rest] = args;
  if (command === undefined || command === "-h" || command === "--help") {
    return { exitCode: EXIT_OK, stdout: USAGE, stderr: "" };
  }
  if (command === "-v" || command === "--version") {
    return { exitCode: EXIT_OK, stdout: `${version}\n`, stderr: "" };
  }
  if (command === "audit") return runAudit(rest, cwd);
  return usageError([command.startsWith("-") ? `unknown option ${command}` : `unknown command ${command}`]);
}

// package.json sits one level above both src/ and dist/.
export function readVersion(): string {
  const manifest: unknown = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  if (typeof manifest === "object" && manifest !== null && "version" in manifest && typeof manifest.version === "string") {
    return manifest.version;
  }
  throw new Error("package.json has no version string");
}

function isMainModule(): boolean {
  const invoked = process.argv[1];
  if (invoked === undefined) return false;
  // npm installs bins as symlinks, so compare resolved paths.
  return realpathSync(path.resolve(invoked)) === realpathSync(fileURLToPath(import.meta.url));
}

if (isMainModule()) {
  const result = runCli(process.argv.slice(2), readVersion());
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}
