#!/usr/bin/env node

// Command-line entry point: argument parsing, exit codes and wiring. The audit
// command validates its target, factor config, end-of-life table and optional
// deferrals, runs the seven collectors, scores every factor, decides the
// verdict and risk zones, plans the harness adaptation and the modernization
// roadmap, and with --out writes the Markdown and JSON report.

import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { collectCodeStructure, type CodeStructure } from "./collectors/code-structure.js";
import { collectDependencies, type Dependencies, type RuntimeAssessment } from "./collectors/dependencies.js";
import { collectDynamicCalls, type DynamicCalls } from "./collectors/dynamic-calls.js";
import { collectCoChange, type CoChange } from "./collectors/co-change.js";
import { collectObservability, type Observability } from "./collectors/observability.js";
import { collectGitHistory, type GitHistory } from "./collectors/git-history.js";
import { collectTestsDocs, type TestsDocs } from "./collectors/tests-docs.js";
import type { Measurement } from "./collectors/types.js";
import { DEFAULT_CONFIG_PATH, loadFactorConfig, type FactorConfig } from "./config/factors.js";
import { checkDeferralFactors, loadDeferrals, type Deferral } from "./config/deferrals.js";
import { DEFAULT_EOL_TABLE_PATH, loadRuntimeEolTable } from "./config/runtime-eol.js";
import { DEFAULT_DECISION_CONFIG_PATH, loadDecisionConfig } from "./config/decision.js";
import { decide } from "./decision/decide.js";
import { renderJson } from "./report/json.js";
import { renderMarkdown } from "./report/markdown.js";
import { buildReport } from "./report/model.js";
import { checkOutDir, writeReports } from "./report/write.js";
import type { Decision } from "./decision/types.js";
import { checkRequirementFactors, DEFAULT_HARNESS_REQUIREMENTS_PATH, loadHarnessRequirements } from "./config/harness-requirements.js";
import { buildPlan, type Plan } from "./plan/plan.js";
import { buildRoadmap, type RoadmapStep } from "./plan/roadmap.js";
import { checkThresholds, scoreFactors } from "./scoring/score.js";
import type { CollectorResults, Scoring } from "./scoring/types.js";
import type { Result } from "./result.js";
import { resolveTarget, type AuditTarget } from "./target.js";

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

export const USAGE = `Usage: ai-codebase-auditor audit <repo-path> [--config <file>] [--deferrals <file>] [--harness <file>] [--out <dir>]
       ai-codebase-auditor --help | --version

Audits a local git repository for AI-agent readiness. The repository is only
read, never modified or executed.

Commands:
  audit <repo-path>      Audit the git working tree at <repo-path>

Options:
  -c, --config <file>    Factor configuration (default: config/factors.json)
  -d, --deferrals <file> Documented, dated deferrals that raise a gap's score by one level, up to 3
      --harness <file>   Harness requirements for the adaptation plan (default: config/harness-requirements.json)
  -o, --out <dir>        Write ai-readiness-report.md and .json there (never inside the target)
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

function formatDynamicCalls(dynamicCalls: Measurement<DynamicCalls>): string[] {
  if (dynamicCalls.status === "not-measured") return [`Dynamic calls: not measured (${dynamicCalls.reason})`];
  const { files, skipped } = dynamicCalls.value;
  const withSites = files.filter((file) => file.sites.length > 0);
  const sites = files.flatMap((file) => file.sites);
  const byCount = (counts: string) => counts.split(", ").sort((a, b) => Number(b.slice(b.lastIndexOf(" "))) - Number(a.slice(a.lastIndexOf(" ")))).join(", ");
  return [
    "Dynamic calls (covered languages read statically, tests included; nothing is run):",
    `  covered files: ${files.length}${files.length > 0 ? ` (${byCount(countBy(files, (f) => f.family))})` : ""}, ${withSites.length} with computed-target calls, ${sites.length} sites`,
    `  constructs: ${sites.length > 0 ? byCount(countBy(sites, (site) => site.construct)) : "none"}`,
    `  skipped: ${skipped.length > 0 ? countBy(skipped, (f) => f.reason) : "none"}`,
  ];
}

function formatObservability(observability: Measurement<Observability>): string[] {
  if (observability.status === "not-measured") return [`Observability: not measured (${observability.reason})`];
  const { files, configs } = observability.value;
  const logging = files.filter((file) => file.logging.length > 0);
  const forms = new Map<string, number>();
  for (const file of files) for (const { form, calls } of file.logging) forms.set(form, (forms.get(form) ?? 0) + calls);
  const imports = files.flatMap((file) => file.integrations.map((integration) => `${integration.name} (${file.path}:${integration.line})`));
  const consoleOnly = files.filter((file) => file.logging.length === 0 && file.console > 0).length;
  return [
    "Observability (source and config read statically, tests included; nothing is run):",
    `  logging calls: ${logging.length} of ${files.length} source files${forms.size > 0 ? ` (${[...forms.entries()].sort((a, b) => b[1] - a[1]).map(([form, calls]) => `${form} ${calls}`).join(", ")})` : ""}`,
    `  logging configuration: ${configs.length > 0 ? configs.map((config) => config.path).join(", ") : "none"}`,
    `  integration imports: ${imports.length > 0 ? imports.slice(0, 5).join(", ") + (imports.length > 5 ? `, and ${imports.length - 5} more` : "") : "none"}`,
    `  console output only: ${consoleOnly} file${consoleOnly === 1 ? "" : "s"}`,
  ];
}

function formatCoChange(coChange: Measurement<CoChange>): string[] {
  if (coChange.status === "not-measured") return [`Co-change: not measured (${coChange.reason})`];
  const { commits, read, truncated } = coChange.value;
  const span = commits.length > 0 ? `, ${commits[commits.length - 1]?.time.slice(0, 10) ?? "?"} to ${commits[0]?.time.slice(0, 10) ?? "?"}` : "";
  return [
    "Co-change (git log of recent non-merge commits; nothing is run):",
    `  commits read: ${read}${truncated ? " (cut off at the read limit)" : ""}; with source files: ${commits.length}${span}`,
  ];
}

function formatScores(scoring: Scoring): string[] {
  const idWidth = Math.max(...scoring.factors.map((factor) => factor.id.length)) + 2;
  const rows = scoring.factors.flatMap((factor) => {
    const head = `  ${factor.class.padEnd(14)}${factor.id.padEnd(idWidth)}`;
    const lines = [factor.score === null ? `${head}-  not measured: ${factor.reason ?? ""}` : `${head}${factor.score}  ${factor.rule ?? ""}`];
    if (factor.partial) lines.push(`${" ".repeat(head.length + 3)}partial: ${factor.partial}`);
    if (factor.deferral) {
      lines.push(`${" ".repeat(head.length + 3)}deferral recorded ${factor.deferral.recorded} (${factor.deferral.reason}): ${factor.deferral.note}`);
    }
    return lines;
  });
  const { level, setBy, provisional, unmeasuredBlocking } = scoring.readiness;
  const readiness =
    level === null
      ? "Readiness level: not determined (no blocking factor could be scored)"
      : `Readiness level: ${level} of 5, set by ${setBy ?? "?"}${provisional ? ` (provisional: ${unmeasuredBlocking.join(", ")} not measured)` : ""}`;
  return [
    "Scores (1-5; the lowest blocking factor sets the readiness level, never an average):",
    ...rows,
    "",
    readiness,
  ];
}

const VERDICT_LABEL = { adopt: "adopt", adapt: "adapt", "prepare-first": "prepare first" } as const;

function formatDecision(decision: Decision): string[] {
  const { verdict, zones } = decision;
  const provisional = verdict.provisional ? ` (provisional: ${verdict.unmeasuredBlocking.join(", ")} not measured)` : "";
  const head = verdict.verdict === null ? "Verdict: none" : `Verdict: ${VERDICT_LABEL[verdict.verdict]}${provisional}`;
  const width = Math.max(0, ...zones.modules.map((module) => module.module.length)) + 2;
  return [
    head,
    `  rule: ${verdict.rule}`,
    "",
    "Risk zones (green: agents may edit; yellow: characterization tests first; red: proposals only):",
    ...(zones.note ? [`  ${zones.note}`] : []),
    ...zones.modules.map(
      (module) =>
        `  ${module.zone.padEnd(8)}${module.module.padEnd(width)}${module.sourceFiles} source file${module.sourceFiles === 1 ? "" : "s"}${module.redFiles > 0 ? `, ${module.redFiles} red` : ""}: ${module.reason}`,
    ),
    ...(zones.redPaths.length > 0
      ? ["  red paths:", ...zones.redPaths.map((red) => `    ${red.path}${red.kind === "directory" ? "/" : ""} (${red.term})`)]
      : zones.note ? [] : ["  red paths: none"]),
    ...(zones.unzoned.length > 0 ? [`  not zoned (no source files): ${zones.unzoned.join(", ")}`] : []),
  ];
}

function formatPlan(plan: Plan, roadmap: readonly RoadmapStep[]): string[] {
  const trigger = (item: Plan["items"][number]) =>
    item.trigger.kind === "factor" ? `${item.trigger.factor} ${item.trigger.score}` : `${item.trigger.zone} zone, ${item.trigger.count}`;
  const width = Math.max(0, ...plan.items.map((item) => item.id.length)) + 2;
  return [
    `Harness adaptation plan (${plan.harness.name} ${plan.harness.version}): ${plan.framing}`,
    ...(plan.items.length > 0 ? plan.items.map((item) => `  ${item.level.padEnd(13)}${item.id.padEnd(width)}${trigger(item)}`) : ["  no items"]),
    ...(plan.notAssessed.length > 0 ? [`  not assessed: ${plan.notAssessed.map((entry) => entry.requirement).join(", ")}`] : []),
    "",
    "Modernization roadmap (by gain against effort):",
    ...(roadmap.length > 0
      ? roadmap.slice(0, 5).map((step, index) => `  ${index + 1}. ${step.factor} ${step.from}→${step.to} [${step.effort}] ${step.action}${step.verdictAfter ? ` (verdict after: ${step.verdictAfter})` : ""}`)
      : ["  no steps"]),
    ...(roadmap.length > 5 ? [`  … and ${roadmap.length - 5} more in the report`] : []),
  ];
}

function formatSummary(
  target: AuditTarget,
  configPath: string,
  config: FactorConfig,
  collected: CollectorResults,
  scoring: Scoring,
  decision: Decision,
  plan: Plan,
  roadmap: readonly RoadmapStep[],
): string {
  const blocking = config.factors.filter((factor) => factor.class === "blocking").length;
  return [
    `Target: ${target.path}`,
    `Config: ${configPath}`,
    `Factors: ${config.factors.length} (${blocking} blocking, ${config.factors.length - blocking} constraining)`,
    "",
    ...formatGitHistory(collected.history),
    "",
    ...formatCodeStructure(collected.structure),
    "",
    ...formatTestsDocs(collected.testsDocs),
    "",
    ...formatDependencies(collected.dependencies),
    "",
    ...formatDynamicCalls(collected.dynamicCalls),
    "",
    ...formatCoChange(collected.coChange),
    "",
    ...formatObservability(collected.observability),
    "",
    ...formatScores(scoring),
    "",
    ...formatDecision(decision),
    "",
    ...formatPlan(plan, roadmap),
    "",
  ].join("\n");
}

function runAudit(args: readonly string[], version: string, cwd: string): CliResult {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...args],
      options: {
        config: { type: "string", short: "c" },
        deferrals: { type: "string", short: "d" },
        out: { type: "string", short: "o" },
        harness: { type: "string" },
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
  const decisionConfig = loadDecisionConfig(DEFAULT_DECISION_CONFIG_PATH);
  const harnessPath = parsed.values.harness === undefined ? DEFAULT_HARNESS_REQUIREMENTS_PATH : path.resolve(cwd, parsed.values.harness);
  const requirements = loadHarnessRequirements(harnessPath);
  const deferralsPath = parsed.values.deferrals === undefined ? null : path.resolve(cwd, parsed.values.deferrals);
  const deferrals: Result<Deferral[]> = deferralsPath === null ? { ok: true, value: [] } : loadDeferrals(deferralsPath);
  const outDir = parsed.values.out === undefined ? null : path.resolve(cwd, parsed.values.out);
  const errors = [
    ...(target.ok ? [] : target.errors),
    ...(target.ok && outDir ? checkOutDir(outDir, target.value.path) : []),
    ...(config.ok ? checkThresholds(config.value, configPath) : config.errors),
    ...(eolTable.ok ? [] : eolTable.errors),
    ...(decisionConfig.ok ? [] : decisionConfig.errors),
    // Only a user's own --harness file must name configured factors: the default
    // file meets a reduced --config, and the plan lists those as not assessed.
    ...(requirements.ok ? (config.ok && parsed.values.harness !== undefined ? checkRequirementFactors(requirements.value, config.value, harnessPath) : []) : requirements.errors),
    ...(deferrals.ok ? (config.ok && deferralsPath ? checkDeferralFactors(deferrals.value, config.value, deferralsPath) : []) : deferrals.errors),
  ];
  if (!target.ok || !config.ok || !eolTable.ok || !decisionConfig.ok || !requirements.ok || !deferrals.ok || errors.length > 0) return usageError(errors);
  // The audit date (UTC) is the unit of time: every date-based rule uses the end
  // of that day, so two runs on the same day give the same report bytes.
  const auditDate = new Date().toISOString().slice(0, 10);
  const now = new Date(`${auditDate}T23:59:59.999Z`);
  const collected: CollectorResults = {
    history: collectGitHistory(target.value.path, { now }),
    structure: collectCodeStructure(target.value.path),
    testsDocs: collectTestsDocs(target.value.path),
    dependencies: collectDependencies(target.value.path, { table: eolTable.value, now }),
    dynamicCalls: collectDynamicCalls(target.value.path),
    coChange: collectCoChange(target.value.path),
    observability: collectObservability(target.value.path),
  };
  const scoring = scoreFactors(collected, config.value, { now, deferrals: deferrals.value, modules: decisionConfig.value });
  const decision = decide(scoring, collected, config.value, decisionConfig.value);
  const plan = buildPlan({ scoring, decision, results: collected, requirements: requirements.value, weakMax: decisionConfig.value.weakMax });
  const roadmap = buildRoadmap({ scoring, results: collected, factors: config.value, decisionConfig: decisionConfig.value, eolTable: eolTable.value, auditDate });
  const summary = formatSummary(target.value, configPath, config.value, collected, scoring, decision, plan, roadmap);
  if (outDir === null) return { exitCode: EXIT_OK, stdout: summary, stderr: "" };

  const report = buildReport({
    tool: { name: "ai-codebase-auditor", version },
    auditDate,
    targetPath: target.value.path,
    inputs: {
      factorConfig: configPath,
      decisionConfig: DEFAULT_DECISION_CONFIG_PATH,
      eolTable: { path: DEFAULT_EOL_TABLE_PATH, asOf: eolTable.value.asOf },
      deferrals: deferralsPath,
      harnessRequirements: harnessPath,
    },
    collected,
    scoring,
    decision,
    plan,
    roadmap,
  });
  try {
    const written = writeReports(outDir, { markdown: renderMarkdown(report), json: renderJson(report) });
    return { exitCode: EXIT_OK, stdout: `${summary}\nReport written:\n  ${written.markdown}\n  ${written.json}\n`, stderr: "" };
  } catch (error) {
    return { exitCode: EXIT_FAILURE, stdout: summary, stderr: `error: cannot write the report to ${outDir}: ${(error as Error).message}\n` };
  }
}

export function runCli(args: readonly string[], version: string, cwd: string = process.cwd()): CliResult {
  const [command, ...rest] = args;
  if (command === undefined || command === "-h" || command === "--help") {
    return { exitCode: EXIT_OK, stdout: USAGE, stderr: "" };
  }
  if (command === "-v" || command === "--version") {
    return { exitCode: EXIT_OK, stdout: `${version}\n`, stderr: "" };
  }
  if (command === "audit") return runAudit(rest, version, cwd);
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
