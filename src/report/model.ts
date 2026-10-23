// The report model: one object holding everything a report says, built in a
// fixed key order so both renderers and every run produce the same bytes.
// Summaries only: per-file lists stay out, except hotspots and largest files.

import type { CodeStructure } from "../collectors/code-structure.js";
import type { Dependencies, RuntimeAssessment } from "../collectors/dependencies.js";
import type { DynamicCalls } from "../collectors/dynamic-calls.js";
import type { GitHistory } from "../collectors/git-history.js";
import type { TestsDocs } from "../collectors/tests-docs.js";
import type { Measurement } from "../collectors/types.js";
import type { Decision, Verdict, Zones } from "../decision/types.js";
import type { Plan } from "../plan/plan.js";
import type { RoadmapStep } from "../plan/roadmap.js";
import type { CollectorResults, FactorScore, Readiness, Scoring } from "../scoring/types.js";

export const REPORT_SCHEMA = "ai-codebase-auditor/report";
export const REPORT_SCHEMA_VERSION = 4;

export interface ReportInput {
  tool: { name: string; version: string };
  /** YYYY-MM-DD: the date every time-based rule used. */
  auditDate: string;
  targetPath: string;
  inputs: {
    factorConfig: string;
    decisionConfig: string;
    eolTable: { path: string; asOf: string };
    deferrals: string | null;
    harnessRequirements: string;
  };
  collected: CollectorResults;
  scoring: Scoring;
  decision: Decision;
  plan: Plan;
  roadmap: RoadmapStep[];
}

export type NotMeasuredKind = "factor" | "collector" | "runtime" | "manifest" | "doc" | "tool";

export interface NotMeasuredItem {
  kind: NotMeasuredKind;
  id: string;
  reason: string;
}

type Signal<T> = ({ status: "measured" } & T) | { status: "not-measured"; reason: string };

export interface AuditReport {
  schema: typeof REPORT_SCHEMA;
  schemaVersion: typeof REPORT_SCHEMA_VERSION;
  tool: { name: string; version: string };
  auditDate: string;
  target: { path: string; head: string | null };
  inputs: {
    factorConfig: string;
    decisionConfig: string;
    eolTable: { path: string; asOf: string; ageDays: number };
    deferrals: string | null;
    harnessRequirements: string;
  };
  verdict: Verdict;
  readiness: Readiness;
  factors: FactorScore[];
  zones: Zones;
  plan: Plan;
  roadmap: RoadmapStep[];
  notMeasured: NotMeasuredItem[];
  signals: {
    gitHistory: Signal<{
      head: string;
      window: GitHistory["window"];
      totals: GitHistory["totals"];
      hotspots: { path: string; commits: number; commitsLastYear: number; authors: number; lastCommit: string | null }[];
    }>;
    codeStructure: Signal<{
      distribution: CodeStructure["distribution"];
      modules: CodeStructure["modules"];
      excludedByReason: Record<string, number>;
      scc: CodeStructure["scc"];
    }>;
    testsDocs: Signal<{
      testFiles: number;
      conventions: TestsDocs["tests"]["conventions"];
      runnerConfigs: TestsDocs["tests"]["runnerConfigs"];
      ci: TestsDocs["ci"];
      docs: TestsDocs["docs"];
      typeCheckers: TestsDocs["typeCheckers"];
      statedRules: TestsDocs["statedRules"];
    }>;
    dependencies: Signal<{
      manifests: { path: string; ecosystem: string; dependencies: number; issues: string[] }[];
      runtimes: RuntimeAssessment[];
    }>;
    /** As the collector read them, tests included; the direct-api-calls score leaves tests out. */
    dynamicCalls: Signal<{
      coveredFiles: number;
      filesWithSites: number;
      sites: number;
      byFamily: { family: string; files: number; filesWithSites: number; sites: number }[];
      byConstruct: { construct: string; sites: number }[];
      /** Up to ten files with the most sites. */
      topFiles: { path: string; sites: number; constructs: string[] }[];
      skippedByReason: Record<string, number>;
    }>;
  };
  method: { commands: string[]; notes: string[] };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const KIND_ORDER: readonly NotMeasuredKind[] = ["factor", "collector", "runtime", "manifest", "doc", "tool"];
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function signal<T, S>(measurement: Measurement<T>, summarize: (value: T) => S): Signal<S> {
  return measurement.status === "measured" ? { status: "measured", ...summarize(measurement.value) } : { status: "not-measured", reason: measurement.reason };
}

function notMeasuredItems(input: ReportInput): NotMeasuredItem[] {
  const { collected, scoring } = input;
  const items: NotMeasuredItem[] = scoring.factors
    .filter((factor) => factor.status === "not-measured")
    .map((factor) => ({ kind: "factor", id: factor.id, reason: factor.reason ?? "not measured" }));
  const collectors: [string, Measurement<unknown>][] = [
    ["git-history", collected.history], ["code-structure", collected.structure],
    ["tests-docs", collected.testsDocs], ["dependencies", collected.dependencies], ["dynamic-calls", collected.dynamicCalls],
  ];
  for (const [id, measurement] of collectors) {
    if (measurement.status === "not-measured") items.push({ kind: "collector", id, reason: measurement.reason });
  }
  if (collected.dependencies.status === "measured") {
    for (const runtime of collected.dependencies.value.runtimes) {
      if (runtime.status === "unknown") items.push({ kind: "runtime", id: `${runtime.runtime} ${runtime.spec} (${runtime.source})`, reason: runtime.reason ?? "unknown" });
    }
    for (const manifest of collected.dependencies.value.notMeasured) items.push({ kind: "manifest", id: manifest.path, reason: manifest.reason });
  }
  if (collected.testsDocs.status === "measured") {
    for (const doc of collected.testsDocs.value.unreadDocs) items.push({ kind: "doc", id: doc.path, reason: doc.reason });
  }
  if (collected.structure.status === "measured" && collected.structure.value.scc.status === "unavailable") {
    items.push({ kind: "tool", id: "scc", reason: collected.structure.value.scc.reason });
  }
  // Factors keep config order; everything else sorts by id within its kind.
  return items.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || (a.kind === "factor" ? 0 : byText(a.id, b.id)));
}

const unique = (values: readonly string[]) => [...new Set(values)];

function summarizeDynamicCalls(dynamic: DynamicCalls) {
  const byFamily = new Map<string, { files: number; filesWithSites: number; sites: number }>();
  const byConstruct = new Map<string, number>();
  for (const file of dynamic.files) {
    const family = byFamily.get(file.family) ?? { files: 0, filesWithSites: 0, sites: 0 };
    family.files += 1;
    family.filesWithSites += file.sites.length > 0 ? 1 : 0;
    family.sites += file.sites.length;
    byFamily.set(file.family, family);
    for (const site of file.sites) byConstruct.set(site.construct, (byConstruct.get(site.construct) ?? 0) + 1);
  }
  const skippedByReason: Record<string, number> = {};
  for (const reason of [...new Set(dynamic.skipped.map((file) => file.reason))].sort(byText)) {
    skippedByReason[reason] = dynamic.skipped.filter((file) => file.reason === reason).length;
  }
  const withSites = dynamic.files.filter((file) => file.sites.length > 0);
  return {
    coveredFiles: dynamic.files.length,
    filesWithSites: withSites.length,
    sites: dynamic.files.reduce((sum, file) => sum + file.sites.length, 0),
    byFamily: [...byFamily.entries()].sort(([a], [b]) => byText(a, b)).map(([family, counts]) => ({ family, ...counts })),
    byConstruct: [...byConstruct.entries()].sort((a, b) => b[1] - a[1] || byText(a[0], b[0])).map(([construct, sites]) => ({ construct, sites })),
    topFiles: [...withSites]
      .sort((a, b) => b.sites.length - a.sites.length || byText(a.path, b.path))
      .slice(0, 10)
      .map((file) => ({ path: file.path, sites: file.sites.length, constructs: unique(file.sites.map((site) => site.construct)) })),
    skippedByReason,
  };
}

export function buildReport(input: ReportInput): AuditReport {
  const { collected, scoring, decision } = input;
  const evidences = [collected.history, collected.structure, collected.testsDocs, collected.dependencies, collected.dynamicCalls].map((m) => m.evidence);
  return {
    schema: REPORT_SCHEMA,
    schemaVersion: REPORT_SCHEMA_VERSION,
    tool: { name: input.tool.name, version: input.tool.version },
    auditDate: input.auditDate,
    target: { path: input.targetPath, head: collected.history.status === "measured" ? collected.history.value.head : null },
    inputs: {
      factorConfig: input.inputs.factorConfig,
      decisionConfig: input.inputs.decisionConfig,
      eolTable: {
        path: input.inputs.eolTable.path,
        asOf: input.inputs.eolTable.asOf,
        ageDays: Math.floor((Date.parse(`${input.auditDate}T00:00:00Z`) - Date.parse(`${input.inputs.eolTable.asOf}T00:00:00Z`)) / DAY_MS),
      },
      deferrals: input.inputs.deferrals,
      harnessRequirements: input.inputs.harnessRequirements,
    },
    // Rebuilt in schema order: the decision engine's own key order is an implementation detail.
    verdict: {
      verdict: decision.verdict.verdict,
      rule: decision.verdict.rule,
      triggeredBy: decision.verdict.triggeredBy,
      provisional: decision.verdict.provisional,
      unmeasuredBlocking: decision.verdict.unmeasuredBlocking,
    },
    readiness: scoring.readiness,
    factors: scoring.factors,
    zones: decision.zones,
    plan: input.plan,
    roadmap: input.roadmap,
    notMeasured: notMeasuredItems(input),
    signals: {
      gitHistory: signal(collected.history, (history) => ({
        head: history.head,
        window: history.window,
        totals: history.totals,
        hotspots: [...history.files]
          .sort((a, b) => b.commitsLastYear - a.commitsLastYear || b.commits - a.commits || byText(a.path, b.path))
          .slice(0, 10)
          .map((file) => ({ path: file.path, commits: file.commits, commitsLastYear: file.commitsLastYear, authors: file.authors, lastCommit: file.lastCommit })),
      })),
      codeStructure: signal(collected.structure, (structure) => {
        const excludedByReason: Record<string, number> = {};
        for (const reason of [...new Set(structure.excluded.map((file) => file.reason))].sort(byText)) {
          excludedByReason[reason] = structure.excluded.filter((file) => file.reason === reason).length;
        }
        return { distribution: structure.distribution, modules: structure.modules, excludedByReason, scc: structure.scc };
      }),
      testsDocs: signal(collected.testsDocs, (testsDocs) => ({
        testFiles: testsDocs.tests.files.length,
        conventions: testsDocs.tests.conventions,
        runnerConfigs: testsDocs.tests.runnerConfigs,
        ci: testsDocs.ci,
        docs: testsDocs.docs,
        typeCheckers: testsDocs.typeCheckers,
        statedRules: testsDocs.statedRules,
      })),
      dependencies: signal(collected.dependencies, (dependencies: Dependencies) => ({
        manifests: dependencies.manifests.map((manifest) => ({
          path: manifest.path, ecosystem: manifest.ecosystem, dependencies: manifest.dependencies.length, issues: manifest.issues,
        })),
        runtimes: dependencies.runtimes,
      })),
      dynamicCalls: signal(collected.dynamicCalls, summarizeDynamicCalls),
    },
    method: { commands: unique(evidences.flatMap((evidence) => evidence.commands)), notes: unique(evidences.flatMap((evidence) => evidence.notes)) },
  };
}
