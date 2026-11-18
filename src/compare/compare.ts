// Comparing two saved reports of the same repository: what moved between two
// audits. Pure: it reads two parsed reports and renders text, Markdown and JSON.

import type { AuditReport } from "../report/model.js";
import type { Result } from "../result.js";

export const COMPARISON_SCHEMA = "ai-codebase-auditor/comparison";
export const COMPARISON_SCHEMA_VERSION = 1;
export const COMPARISON_FILES = { markdown: "ai-readiness-compare.md", json: "ai-readiness-compare.json" } as const;

type Change = "raised" | "lowered" | "unchanged" | "now measured" | "no longer measured" | "added" | "removed";

export interface FactorChange {
  id: string;
  from: number | null;
  to: number | null;
  change: Change;
  ruleBefore: string | null;
  ruleAfter: string | null;
}

export interface ZoneChange {
  module: string;
  from: string | null;
  to: string | null;
}

export interface Comparison {
  schema: typeof COMPARISON_SCHEMA;
  schemaVersion: typeof COMPARISON_SCHEMA_VERSION;
  target: string;
  before: { auditDate: string; commit: string | null };
  after: { auditDate: string; commit: string | null };
  verdict: { from: string | null; to: string | null; changed: boolean; provisionalBefore: boolean; provisionalAfter: boolean };
  readiness: { from: number | null; to: number | null };
  factors: FactorChange[];
  /** Modules whose zone changed, appeared or disappeared. */
  zones: ZoneChange[];
  redPaths: { added: string[]; removed: string[] };
  yellowPaths: { added: string[]; removed: string[] };
  /** Roadmap steps of the earlier audit whose target score the later audit reached. */
  roadmapCompleted: { factor: string; from: number; to: number; action: string }[];
}

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const diff = (before: string[], after: string[]) => ({
  added: after.filter((item) => !before.includes(item)).sort(byText),
  removed: before.filter((item) => !after.includes(item)).sort(byText),
});

/** Refuses reports of different repositories; otherwise lists what changed from before to after. */
export function compareReports(before: AuditReport, after: AuditReport): Result<Comparison> {
  if (before.target.path !== after.target.path) {
    return { ok: false, errors: [`the reports are of different repositories: ${before.target.path} and ${after.target.path}`] };
  }
  const ids = [...new Set([...before.factors.map((f) => f.id), ...after.factors.map((f) => f.id)])];
  const factors = ids.map((id): FactorChange => {
    const a = before.factors.find((f) => f.id === id);
    const b = after.factors.find((f) => f.id === id);
    const from = a?.score ?? null;
    const to = b?.score ?? null;
    const change: Change =
      !a ? "added"
        : !b ? "removed"
          : from === null && to !== null ? "now measured"
            : from !== null && to === null ? "no longer measured"
              : from !== null && to !== null && to > from ? "raised"
                : from !== null && to !== null && to < from ? "lowered"
                  : "unchanged";
    return { id, from, to, change, ruleBefore: a?.rule ?? a?.reason ?? null, ruleAfter: b?.rule ?? b?.reason ?? null };
  });
  const zoneOf = (report: AuditReport) => new Map(report.zones.modules.map((m) => [m.module, m.zone as string]));
  const zonesBefore = zoneOf(before);
  const zonesAfter = zoneOf(after);
  const zones = [...new Set([...zonesBefore.keys(), ...zonesAfter.keys()])]
    .sort(byText)
    .map((module) => ({ module, from: zonesBefore.get(module) ?? null, to: zonesAfter.get(module) ?? null }))
    .filter((z) => z.from !== z.to);
  const redOf = (report: AuditReport) => report.zones.redPaths.map((r) => `${r.path}${r.kind === "directory" ? "/" : ""}`);
  const scoreAfter = new Map(after.factors.map((f) => [f.id, f.score]));
  const roadmapCompleted = before.roadmap
    .filter((step) => (scoreAfter.get(step.factor) ?? 0) >= step.to)
    .map((step) => ({ factor: step.factor, from: step.from, to: step.to, action: step.action }));
  return {
    ok: true,
    value: {
      schema: COMPARISON_SCHEMA,
      schemaVersion: COMPARISON_SCHEMA_VERSION,
      target: after.target.path,
      before: { auditDate: before.auditDate, commit: before.target.head },
      after: { auditDate: after.auditDate, commit: after.target.head },
      verdict: {
        from: before.verdict.verdict, to: after.verdict.verdict, changed: before.verdict.verdict !== after.verdict.verdict,
        provisionalBefore: before.verdict.provisional, provisionalAfter: after.verdict.provisional,
      },
      readiness: { from: before.readiness.level, to: after.readiness.level },
      factors,
      zones,
      redPaths: diff(redOf(before), redOf(after)),
      yellowPaths: diff(before.zones.yellowPaths.map((y) => y.path), after.zones.yellowPaths.map((y) => y.path)),
      roadmapCompleted,
    },
  };
}

const short = (commit: string | null) => commit?.slice(0, 12) ?? "unknown";
const score = (value: number | null) => (value === null ? "not measured" : String(value));
const list = (items: string[]) => (items.length > 0 ? items.join(", ") : "none");

/** Plain lines for the terminal. */
export function formatComparison(c: Comparison): string {
  const changed = c.factors.filter((f) => f.change !== "unchanged");
  const lines = [
    `Comparing audits of ${c.target}`,
    `  before: ${c.before.auditDate}, commit ${short(c.before.commit)}`,
    `  after:  ${c.after.auditDate}, commit ${short(c.after.commit)}`,
    `Verdict: ${c.verdict.from ?? "none"} → ${c.verdict.to ?? "none"}${c.verdict.changed ? "" : " (unchanged)"}${c.verdict.provisionalAfter ? " (provisional)" : ""}`,
    `Readiness: ${score(c.readiness.from)} → ${score(c.readiness.to)}`,
    `Factors changed: ${changed.length === 0 ? "none" : ""}`,
    ...changed.map((f) => `  ${f.id}: ${score(f.from)} → ${score(f.to)} (${f.change})`),
    `Zones changed: ${c.zones.length === 0 ? "none" : ""}`,
    ...c.zones.map((z) => `  ${z.module}: ${z.from ?? "not zoned"} → ${z.to ?? "not zoned"}`),
    `Red paths: added ${list(c.redPaths.added)}; removed ${list(c.redPaths.removed)}`,
    `Yellow paths: added ${list(c.yellowPaths.added)}; removed ${list(c.yellowPaths.removed)}`,
    `Roadmap steps completed: ${c.roadmapCompleted.length === 0 ? "none" : ""}`,
    ...c.roadmapCompleted.map((s) => `  ${s.factor} ${s.from}→${s.to}: ${s.action}`),
  ];
  return `${lines.join("\n")}\n`;
}

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");

export function renderComparisonMarkdown(c: Comparison): string {
  const lines = [
    `# AI-readiness comparison: ${c.target}`,
    "",
    `Before: ${c.before.auditDate}, commit \`${short(c.before.commit)}\`. After: ${c.after.auditDate}, commit \`${short(c.after.commit)}\`.`,
    "",
    `**Verdict:** ${c.verdict.from ?? "none"} → ${c.verdict.to ?? "none"}${c.verdict.changed ? "" : " (unchanged)"}${c.verdict.provisionalAfter ? " (provisional)" : ""}. **Readiness:** ${score(c.readiness.from)} → ${score(c.readiness.to)}.`,
    "",
    "## Factors",
    "",
    "| Factor | Before | After | Change | Rule after |",
    "|---|---|---|---|---|",
    ...c.factors.map((f) => `| ${f.id} | ${score(f.from)} | ${score(f.to)} | ${f.change} | ${cell(f.ruleAfter ?? "")} |`),
    "",
    "## Zones",
    "",
    ...(c.zones.length === 0 ? ["No module changed zone."] : ["| Module | Before | After |", "|---|---|---|", ...c.zones.map((z) => `| \`${z.module}\` | ${z.from ?? "not zoned"} | ${z.to ?? "not zoned"} |`)]),
    "",
    `Red paths added: ${list(c.redPaths.added.map((p) => `\`${p}\``))}. Removed: ${list(c.redPaths.removed.map((p) => `\`${p}\``))}.`,
    "",
    `Yellow paths added: ${list(c.yellowPaths.added.map((p) => `\`${p}\``))}. Removed: ${list(c.yellowPaths.removed.map((p) => `\`${p}\``))}.`,
    "",
    "## Roadmap steps completed",
    "",
    ...(c.roadmapCompleted.length === 0 ? ["None."] : c.roadmapCompleted.map((s) => `- ${s.factor} ${s.from} → ${s.to}: ${s.action}`)),
  ];
  return `${lines.join("\n")}\n`;
}

export function renderComparisonJson(c: Comparison): string {
  return `${JSON.stringify(c, null, 2)}\n`;
}
