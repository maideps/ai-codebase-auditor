#!/usr/bin/env node

// Command-line entry point: argument parsing, exit codes and wiring. The audit
// command validates its target and factor config, then runs the collectors
// built so far (git history); the rest arrive with feat-003 to feat-005.

import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { collectGitHistory, type GitHistory } from "./collectors/git-history.js";
import type { Measurement } from "./collectors/types.js";
import { DEFAULT_CONFIG_PATH, loadFactorConfig, type FactorConfig } from "./config/factors.js";
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

function formatSummary(target: AuditTarget, configPath: string, config: FactorConfig, history: Measurement<GitHistory>): string {
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
    ...formatGitHistory(history),
    "",
    "Not collected yet: code structure, tests and docs, dependencies. Nothing is scored yet.",
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
  if (!target.ok || !config.ok) {
    return usageError([...(target.ok ? [] : target.errors), ...(config.ok ? [] : config.errors)]);
  }
  const history = collectGitHistory(target.value.path);
  return { exitCode: EXIT_OK, stdout: formatSummary(target.value, configPath, config.value, history), stderr: "" };
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
