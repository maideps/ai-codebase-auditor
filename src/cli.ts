#!/usr/bin/env node

// Command-line entry point: argument parsing, exit codes and wiring. The audit
// command validates its target, factor config, end-of-life table and optional
// deferrals, runs the seven collectors, scores every factor, decides the
// verdict and risk zones, plans the harness adaptation and the modernization
// roadmap, and with --out writes the Markdown and JSON report.

import { existsSync, readFileSync, realpathSync } from "node:fs";
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
import { DEFAULT_EOL_TABLE_PATH, loadRuntimeEolTable, type RuntimeEolTable } from "./config/runtime-eol.js";
import { DEFAULT_DECISION_CONFIG_PATH, loadDecisionConfig, type DecisionConfig } from "./config/decision.js";
import { decide } from "./decision/decide.js";
import { renderJson } from "./report/json.js";
import { renderMarkdown } from "./report/markdown.js";
import { renderSarif } from "./report/sarif.js";
import { buildHarnessFiles, HARNESS_DIR } from "./plan/files.js";
import { FAIL_ON_VALUES, isFailOn, verdictGate } from "./decision/gate.js";
import { buildReport } from "./report/model.js";
import { checkOutDir, writeOutFiles, writeReports } from "./report/write.js";
import type { Decision } from "./decision/types.js";
import { checkRequirementFactors, DEFAULT_HARNESS_REQUIREMENTS_PATH, loadHarnessRequirements, type HarnessRequirements } from "./config/harness-requirements.js";
import { buildPlan, type Plan } from "./plan/plan.js";
import { buildRoadmap, type RoadmapStep } from "./plan/roadmap.js";
import { checkThresholds, scoreFactors } from "./scoring/score.js";
import type { CollectorResults, Scoring } from "./scoring/types.js";
import type { Result } from "./result.js";
import { resolveTarget, type AuditTarget } from "./target.js";
import type { ServerInfo } from "./mcp/server.js";
import { parseSavedReport } from "./report/saved.js";
import { formatValidation, parseOutcomes, renderValidationJson, renderValidationMarkdown, validateZones, VALIDATION_FILES } from "./validate/validate.js";
import { auditedEntry, buildPortfolio, formatPortfolio, parseRepoList, PORTFOLIO_FILES, renderPortfolioJson, renderPortfolioMarkdown, type PortfolioEntry } from "./batch/batch.js";
import { COMPARISON_FILES, compareReports, formatComparison, renderComparisonJson, renderComparisonMarkdown } from "./compare/compare.js";
import { serveStdio } from "./mcp/stdio.js";
import type { AuditReport } from "./report/model.js";

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const EXIT_USAGE = 2;

export const USAGE = `Usage: ai-codebase-auditor audit <repo-path> [--config <file>] [--deferrals <file>] [--harness <file>] [--out <dir>] [--fail-on <verdict>]
       ai-codebase-auditor audit-batch <list-file> --out <dir> [--config <file>] [--deferrals <file>] [--harness <file>]
       ai-codebase-auditor compare <before.json> <after.json> [--out <dir>]
       ai-codebase-auditor validate <report.json> <outcomes.json> [--out <dir>]
       ai-codebase-auditor mcp <report.json>
       ai-codebase-auditor --help | --version

Audits a local git repository for AI-agent readiness. The repository is only
read, never modified or executed.

Commands:
  audit <repo-path>      Audit the git working tree at <repo-path>
  audit-batch <list>     Audit every repository path in <list> (one per line) into <dir>/<name>/, plus a portfolio summary
  compare <a> <b>        Show what changed between two saved JSON reports of one repository
  validate <r> <o>       Compare a report's zones with agent task outcomes recorded by another tool
  mcp <report.json>      Serve a saved JSON report read-only to agents over MCP (stdio)

Options:
  -c, --config <file>    Factor configuration (default: config/factors.json)
  -d, --deferrals <file> Documented, dated deferrals that raise a gap's score by one level, up to 3
      --harness <file>   Harness requirements for the adaptation plan (default: config/harness-requirements.json)
  -o, --out <dir>        Write ai-readiness-report.md, .json and .sarif there (never inside the target)
      --fail-on <verdict> Exit 1 when the verdict is at or below adapt or prepare-first (for CI)
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
    ...(zones.yellowPaths.length > 0
      ? ["  yellow paths (hotspots with no test named after them):", ...zones.yellowPaths.map((yellow) => `    ${yellow.path} (${yellow.reason.replace(/; no test is named after it.*$/, "")})`)]
      : zones.note ? [] : [`  yellow paths: ${zones.hotspotNote ?? "none"}`]),
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

/** Everything an audit reads besides the target: loaded and validated once, reused per repository. */
interface AuditInputs {
  config: FactorConfig;
  configPath: string;
  eolTable: RuntimeEolTable;
  decisionConfig: DecisionConfig;
  requirements: HarnessRequirements;
  harnessPath: string;
  deferrals: Deferral[];
  deferralsPath: string | null;
}

interface AuditRun {
  report: AuditReport;
  decision: Decision;
  plan: Plan;
  roadmap: RoadmapStep[];
  summary: string;
}

// The audit date (UTC) is the unit of time: every date-based rule uses the end
// of that day, so two runs on the same day give the same report bytes.
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Collects, scores, decides and plans for one target; reads it, never writes to it. */
function auditOne(target: AuditTarget, inputs: AuditInputs, version: string, auditDate: string): AuditRun {
  const now = new Date(`${auditDate}T23:59:59.999Z`);
  const collected: CollectorResults = {
    history: collectGitHistory(target.path, { now }),
    structure: collectCodeStructure(target.path),
    testsDocs: collectTestsDocs(target.path),
    dependencies: collectDependencies(target.path, { table: inputs.eolTable, now }),
    dynamicCalls: collectDynamicCalls(target.path),
    coChange: collectCoChange(target.path),
    observability: collectObservability(target.path),
  };
  const scoring = scoreFactors(collected, inputs.config, { now, deferrals: inputs.deferrals, modules: inputs.decisionConfig });
  const decision = decide(scoring, collected, inputs.config, inputs.decisionConfig);
  const plan = buildPlan({ scoring, decision, results: collected, requirements: inputs.requirements, weakMax: inputs.decisionConfig.weakMax });
  const roadmap = buildRoadmap({ scoring, results: collected, factors: inputs.config, decisionConfig: inputs.decisionConfig, eolTable: inputs.eolTable, auditDate });
  const report = buildReport({
    tool: { name: "ai-codebase-auditor", version },
    auditDate,
    targetPath: target.path,
    inputs: {
      factorConfig: inputs.configPath,
      decisionConfig: DEFAULT_DECISION_CONFIG_PATH,
      eolTable: { path: DEFAULT_EOL_TABLE_PATH, asOf: inputs.eolTable.asOf },
      deferrals: inputs.deferralsPath,
      harnessRequirements: inputs.harnessPath,
    },
    collected,
    scoring,
    decision,
    plan,
    roadmap,
  });
  const summary = formatSummary(target, inputs.configPath, inputs.config, collected, scoring, decision, plan, roadmap);
  return { report, decision, plan, roadmap, summary };
}

/** Writes the three reports and the harness files; returns the lines that say where. */
function writeAuditFiles(outDir: string, run: AuditRun, inputs: AuditInputs): string {
  const { report } = run;
  const harnessFiles = buildHarnessFiles({ tool: report.tool, auditDate: report.auditDate, commit: report.target.head, verdict: run.decision.verdict.verdict, plan: run.plan, zones: run.decision.zones, roadmap: run.roadmap });
  const written = writeReports(outDir, { markdown: renderMarkdown(report), json: renderJson(report), sarif: renderSarif(report, inputs.decisionConfig.weakMax) }, harnessFiles);
  const harnessNames = harnessFiles.map((file) => file.path.slice(HARNESS_DIR.length + 1)).join(", ");
  return `Report written:
  ${written.markdown}
  ${written.json}
  ${written.sarif}
Harness files written (copy what fits; nothing was applied):
  ${path.join(outDir, HARNESS_DIR)}${path.sep} (${harnessNames})
`;
}

/** Loads and validates the configs an audit needs, from the --config, --deferrals and --harness values. */
function loadAuditInputs(values: { config?: string; deferrals?: string; harness?: string }, cwd: string): Result<AuditInputs> {
  const configPath = values.config === undefined ? DEFAULT_CONFIG_PATH : path.resolve(cwd, values.config);
  const config = loadFactorConfig(configPath);
  const eolTable = loadRuntimeEolTable(DEFAULT_EOL_TABLE_PATH);
  const decisionConfig = loadDecisionConfig(DEFAULT_DECISION_CONFIG_PATH);
  const harnessPath = values.harness === undefined ? DEFAULT_HARNESS_REQUIREMENTS_PATH : path.resolve(cwd, values.harness);
  const requirements = loadHarnessRequirements(harnessPath);
  const deferralsPath = values.deferrals === undefined ? null : path.resolve(cwd, values.deferrals);
  const deferrals: Result<Deferral[]> = deferralsPath === null ? { ok: true, value: [] } : loadDeferrals(deferralsPath);
  const errors = [
    ...(config.ok ? checkThresholds(config.value, configPath) : config.errors),
    ...(eolTable.ok ? [] : eolTable.errors),
    ...(decisionConfig.ok ? [] : decisionConfig.errors),
    // Only a user's own --harness file must name configured factors: the default
    // file meets a reduced --config, and the plan lists those as not assessed.
    ...(requirements.ok ? (config.ok && values.harness !== undefined ? checkRequirementFactors(requirements.value, config.value, harnessPath) : []) : requirements.errors),
    ...(deferrals.ok ? (config.ok && deferralsPath ? checkDeferralFactors(deferrals.value, config.value, deferralsPath) : []) : deferrals.errors),
  ];
  if (!config.ok || !eolTable.ok || !decisionConfig.ok || !requirements.ok || !deferrals.ok || errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { config: config.value, configPath, eolTable: eolTable.value, decisionConfig: decisionConfig.value, requirements: requirements.value, harnessPath, deferrals: deferrals.value, deferralsPath },
  };
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
        "fail-on": { type: "string" },
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

  const target = resolveTarget(repoPath, cwd);
  const loaded = loadAuditInputs(parsed.values, cwd);
  const outDir = parsed.values.out === undefined ? null : path.resolve(cwd, parsed.values.out);
  const failOnValue = parsed.values["fail-on"];
  const failOn = failOnValue !== undefined && isFailOn(failOnValue) ? failOnValue : null;
  const errors = [
    ...(failOnValue !== undefined && failOn === null ? [`--fail-on must be ${FAIL_ON_VALUES.join(" or ")}, got ${failOnValue}`] : []),
    ...(target.ok ? [] : target.errors),
    ...(target.ok && outDir ? checkOutDir(outDir, target.value.path) : []),
    ...(loaded.ok ? [] : loaded.errors),
  ];
  if (!target.ok || !loaded.ok || errors.length > 0) return usageError(errors);
  const inputs = loaded.value;
  const run = auditOne(target.value, inputs, version, todayUtc());
  const { decision } = run;
  const gate = failOn === null ? null : verdictGate(decision.verdict, failOn);
  const summary = run.summary + (gate ? `
${gate.line}
` : "");
  // Without --fail-on, exit codes are unchanged; with it, a failed gate exits 1 after any report is written.
  const gated = (result: CliResult): CliResult =>
    gate?.failed && result.exitCode === EXIT_OK ? { ...result, exitCode: EXIT_FAILURE, stderr: `${result.stderr}error: ${gate.line}
` } : result;
  if (outDir === null) return gated({ exitCode: EXIT_OK, stdout: summary, stderr: "" });
  try {
    return gated({ exitCode: EXIT_OK, stdout: `${summary}
${writeAuditFiles(outDir, run, inputs)}`, stderr: "" });
  } catch (error) {
    return { exitCode: EXIT_FAILURE, stdout: summary, stderr: `error: cannot write the report to ${outDir}: ${(error as Error).message}
` };
  }
}

export interface McpStart {
  report: AuditReport;
  info: ServerInfo;
  source: string;
}

/** Validates `mcp <report.json>` and loads the report; the caller serves it over stdio. */
/** Reads and checks one saved report, for mcp and compare. */
function readSavedReport(cwd: string, reportPath: string): { report: AuditReport; source: string } | CliResult {
  const source = path.resolve(cwd, reportPath);
  let text: string;
  try {
    text = readFileSync(source, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return usageError([`${source}: ${code === "ENOENT" ? "file not found" : `cannot read file (${code ?? "unknown error"})`}`]);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return usageError([`${source}: invalid JSON (${(error as Error).message})`]);
  }
  const report = parseSavedReport(raw, source);
  return report.ok ? { report: report.value, source } : usageError(report.errors);
}

export function prepareMcp(args: readonly string[], version: string, cwd: string): McpStart | CliResult {
  const [reportPath, ...extra] = args;
  if (reportPath === undefined || reportPath.startsWith("-")) return usageError(["mcp needs the path of a saved ai-readiness-report.json"]);
  if (extra.length > 0) return usageError([`mcp takes one report path, got ${args.length}`]);
  const read = readSavedReport(cwd, reportPath);
  if ("exitCode" in read) return read;
  return { report: read.report, info: { name: "ai-codebase-auditor", version }, source: read.source };
}

function runCompare(args: readonly string[], cwd: string): CliResult {
  let parsed;
  try {
    parsed = parseArgs({ args: [...args], options: { out: { type: "string", short: "o" } }, allowPositionals: true, strict: true });
  } catch (error) {
    return usageError([(error as Error).message]);
  }
  const { positionals } = parsed;
  if (positionals.length !== 2) return usageError([`compare needs two saved reports, before and after, got ${positionals.length}`]);
  const [beforePath = "", afterPath = ""] = positionals;
  const before = readSavedReport(cwd, beforePath);
  const after = readSavedReport(cwd, afterPath);
  if ("exitCode" in before) return before;
  if ("exitCode" in after) return after;
  const comparison = compareReports(before.report, after.report);
  if (!comparison.ok) return usageError(comparison.errors);
  const text = formatComparison(comparison.value);
  if (parsed.values.out === undefined) return { exitCode: EXIT_OK, stdout: text, stderr: "" };
  const outDir = path.resolve(cwd, parsed.values.out);
  // Never inside the audited repository, when it exists on this machine.
  const target = comparison.value.target;
  const inside = existsSync(target) ? checkOutDir(outDir, target) : [];
  if (inside.length > 0) return usageError(inside);
  try {
    const [markdown, json] = writeOutFiles(outDir, [
      { name: COMPARISON_FILES.markdown, content: renderComparisonMarkdown(comparison.value) },
      { name: COMPARISON_FILES.json, content: renderComparisonJson(comparison.value) },
    ]);
    return { exitCode: EXIT_OK, stdout: `${text}
Comparison written:
  ${markdown}
  ${json}
`, stderr: "" };
  } catch (error) {
    return { exitCode: EXIT_FAILURE, stdout: text, stderr: `error: cannot write the comparison to ${outDir}: ${(error as Error).message}
` };
  }
}

function runBatch(args: readonly string[], version: string, cwd: string): CliResult {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...args],
      options: { config: { type: "string", short: "c" }, deferrals: { type: "string", short: "d" }, harness: { type: "string" }, out: { type: "string", short: "o" } },
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    return usageError([(error as Error).message]);
  }
  const { positionals } = parsed;
  if (positionals.length !== 1) return usageError([`audit-batch needs one list file of repository paths, got ${positionals.length}`]);
  if (parsed.values.out === undefined) return usageError(["audit-batch needs --out <dir> for the reports"]);
  const listPath = path.resolve(cwd, positionals[0] ?? "");
  let listText: string;
  try {
    listText = readFileSync(listPath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return usageError([`${listPath}: ${code === "ENOENT" ? "file not found" : `cannot read file (${code ?? "unknown error"})`}`]);
  }
  const listed = parseRepoList(listText, path.dirname(listPath));
  const loaded = loadAuditInputs(parsed.values, cwd);
  if (listed.length === 0) return usageError([`${listPath}: lists no repository paths`]);
  if (!loaded.ok) return usageError(loaded.errors);
  const outDir = path.resolve(cwd, parsed.values.out);
  const auditDate = todayUtc();
  // Each repository is audited on its own: a failure is recorded with its reason and the rest go on.
  const entries: PortfolioEntry[] = listed.map((repo) => {
    const failed = (error: string): PortfolioEntry => ({ status: "failed", folder: repo.folder, path: repo.path, error });
    const target = resolveTarget(repo.path, cwd);
    if (!target.ok) return failed(target.errors.join("; "));
    const repoOut = path.join(outDir, repo.folder);
    const inside = checkOutDir(repoOut, target.value.path);
    if (inside.length > 0) return failed(inside.join("; "));
    try {
      const run = auditOne(target.value, loaded.value, version, auditDate);
      writeAuditFiles(repoOut, run, loaded.value);
      return auditedEntry(repo, run.report, loaded.value.decisionConfig.weakMax);
    } catch (error) {
      return failed(`audit failed: ${(error as Error).message}`);
    }
  });
  const portfolio = buildPortfolio(entries, auditDate);
  const text = formatPortfolio(portfolio);
  try {
    const [markdown, json] = writeOutFiles(outDir, [
      { name: PORTFOLIO_FILES.markdown, content: renderPortfolioMarkdown(portfolio) },
      { name: PORTFOLIO_FILES.json, content: renderPortfolioJson(portfolio) },
    ]);
    const failures = portfolio.counts.failed;
    return {
      exitCode: failures > 0 ? EXIT_FAILURE : EXIT_OK,
      stdout: `${text}
Portfolio written:
  ${markdown}
  ${json}
`,
      stderr: failures > 0 ? `error: ${failures} of ${listed.length} repositories could not be audited; see the portfolio
` : "",
    };
  } catch (error) {
    return { exitCode: EXIT_FAILURE, stdout: text, stderr: `error: cannot write the portfolio to ${outDir}: ${(error as Error).message}
` };
  }
}

function runValidate(args: readonly string[], cwd: string): CliResult {
  let parsed;
  try {
    parsed = parseArgs({ args: [...args], options: { out: { type: "string", short: "o" } }, allowPositionals: true, strict: true });
  } catch (error) {
    return usageError([(error as Error).message]);
  }
  const { positionals } = parsed;
  if (positionals.length !== 2) return usageError([`validate needs a saved report and an outcomes file, got ${positionals.length}`]);
  const [reportPath = "", outcomesPath = ""] = positionals;
  const read = readSavedReport(cwd, reportPath);
  if ("exitCode" in read) return read;
  const outcomesSource = path.resolve(cwd, outcomesPath);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(outcomesSource, "utf8"));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return usageError([`${outcomesSource}: ${code === "ENOENT" ? "file not found" : code ? `cannot read file (${code})` : `invalid JSON (${(error as Error).message})`}`]);
  }
  const outcomes = parseOutcomes(raw, outcomesSource);
  if (!outcomes.ok) return usageError(outcomes.errors);
  const validation = validateZones(read.report, outcomes.value);
  const text = formatValidation(validation);
  if (parsed.values.out === undefined) return { exitCode: EXIT_OK, stdout: text, stderr: "" };
  const outDir = path.resolve(cwd, parsed.values.out);
  const inside = existsSync(validation.target) ? checkOutDir(outDir, validation.target) : [];
  if (inside.length > 0) return usageError(inside);
  try {
    const [markdown, json] = writeOutFiles(outDir, [
      { name: VALIDATION_FILES.markdown, content: renderValidationMarkdown(validation) },
      { name: VALIDATION_FILES.json, content: renderValidationJson(validation) },
    ]);
    return { exitCode: EXIT_OK, stdout: `${text}\nValidation written:\n  ${markdown}\n  ${json}\n`, stderr: "" };
  } catch (error) {
    return { exitCode: EXIT_FAILURE, stdout: text, stderr: `error: cannot write the validation to ${outDir}: ${(error as Error).message}\n` };
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
  if (command === "compare") return runCompare(rest, cwd);
  if (command === "audit-batch") return runBatch(rest, version, cwd);
  if (command === "validate") return runValidate(rest, cwd);
  if (command === "mcp") {
    // The server itself runs only as a process (see the main block); here the arguments and report are checked.
    const prepared = prepareMcp(rest, version, cwd);
    return "exitCode" in prepared ? prepared : { exitCode: EXIT_OK, stdout: "", stderr: `${prepared.source}: a valid report; the MCP server runs over stdio when started as a process
` };
  }
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
  const args = process.argv.slice(2);
  const prepared = args[0] === "mcp" ? prepareMcp(args.slice(1), readVersion(), process.cwd()) : null;
  if (prepared && !("exitCode" in prepared)) {
    // stdout carries the protocol, so the start-up note goes to stderr.
    process.stderr.write(`ai-codebase-auditor mcp: serving ${prepared.source} read-only over stdio
`);
    void serveStdio(prepared.report, prepared.info, process.stdin, process.stdout);
  } else {
    const result = prepared ?? runCli(args, readVersion());
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exitCode = result.exitCode;
  }
}
