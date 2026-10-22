// The report model: one object holding everything a report says, built in a
// fixed key order so both renderers and every run produce the same bytes.
// Summaries only: per-file lists stay out, except hotspots and largest files.

import type { CodeStructure } from "../collectors/code-structure.js";
import type { Dependencies, RuntimeAssessment } from "../collectors/dependencies.js";
import type { GitHistory } from "../collectors/git-history.js";
import type { TestsDocs } from "../collectors/tests-docs.js";
import type { Measurement } from "../collectors/types.js";
import type { Decision, Verdict, Zones } from "../decision/types.js";
import type { CollectorResults, FactorScore, Readiness, Scoring } from "../scoring/types.js";

export const REPORT_SCHEMA = "ai-codebase-auditor/report";
export const REPORT_SCHEMA_VERSION = 2;

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
  };
  collected: CollectorResults;
  scoring: Scoring;
  decision: Decision;
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
  };
  verdict: Verdict;
  readiness: Readiness;
  factors: FactorScore[];
  zones: Zones;
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
    ["tests-docs", collected.testsDocs], ["dependencies", collected.dependencies],
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

export function buildReport(input: ReportInput): AuditReport {
  const { collected, scoring, decision } = input;
  const evidences = [collected.history, collected.structure, collected.testsDocs, collected.dependencies].map((m) => m.evidence);
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
    },
    method: { commands: unique(evidences.flatMap((evidence) => evidence.commands)), notes: unique(evidences.flatMap((evidence) => evidence.notes)) },
  };
}
