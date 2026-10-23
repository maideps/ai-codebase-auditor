// Markdown rendering of the report model: the same content as the JSON file,
// laid out for people. Pure string building; no I/O, no clock.

import type { FactorScore } from "../scoring/types.js";
import type { AuditReport } from "./model.js";

const VERDICT_TEXT = {
  adopt: ["adopt", "the harness can be adopted as is."],
  adapt: ["adapt", "adopt the harness with adaptations for the weak factors below."],
  "prepare-first": ["prepare first", "make changes verifiable before letting agents edit: add characterization tests first."],
} as const;

/** A table cell: pipes escaped and line breaks flattened, so the row stays intact. */
export function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

const code = (text: string) => `\`${text.replace(/`/g, "'")}\``;
const list = (items: readonly string[]) => (items.length > 0 ? items.join(", ") : "none");
// An empty table would show only its header, so it says "None." instead.
const table = (header: readonly string[], rows: readonly (readonly string[])[]) =>
  rows.length === 0
    ? ["None."]
    : [`| ${header.join(" | ")} |`, `|${header.map(() => "---").join("|")}|`, ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`)];
// "1 author", "2 authors".
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function provisionalNote(report: AuditReport): string {
  return report.verdict.provisional ? ` (provisional: ${report.verdict.unmeasuredBlocking.join(", ")} not measured)` : "";
}

function headline(report: AuditReport): string[] {
  const folder = report.target.path.split(/[\\/]/).filter(Boolean).pop() ?? report.target.path;
  const verdict = report.verdict.verdict === null ? "none" : `**${VERDICT_TEXT[report.verdict.verdict][0]}**${provisionalNote(report)}`;
  const { level, setBy, provisional } = report.readiness;
  const readiness = level === null ? "not determined" : `**${level} of 5**, set by ${setBy ?? "?"}${provisional ? " (provisional)" : ""}`;
  return [
    `# AI-readiness audit: ${folder}`,
    "",
    "| | |",
    "|---|---|",
    `| Target | ${cell(`${code(report.target.path)}${report.target.head ? ` at commit ${code(report.target.head.slice(0, 12))}` : ""}`)} |`,
    `| Audit date | ${report.auditDate} |`,
    `| Verdict | ${cell(verdict)} |`,
    `| Readiness level | ${cell(readiness)} |`,
    `| Tool | ${report.tool.name} ${report.tool.version} |`,
  ];
}

function verdictSection(report: AuditReport): string[] {
  const { verdict } = report;
  const lead = verdict.verdict === null ? "**no verdict**." : `**${VERDICT_TEXT[verdict.verdict][0]}**${provisionalNote(report)}: ${VERDICT_TEXT[verdict.verdict][1]}`;
  return [
    "## Verdict",
    "",
    lead,
    "",
    `Rule: ${verdict.rule}`,
    "",
    `Triggered by: ${list(verdict.triggeredBy.map((t) => `${t.factor} ${t.score ?? "not measured"}`))}.`,
  ];
}

function factorSection(factor: FactorScore): string[] {
  const lines = [`### ${factor.id}: ${factor.name}`, ""];
  if (factor.score === null) {
    lines.push(`Not measured (${factor.class}): ${factor.reason ?? "no reason"}.`);
  } else {
    const base = factor.baseScore !== factor.score ? `, base ${factor.baseScore ?? "?"}` : "";
    lines.push(`Score **${factor.score}**${base} (${factor.class}). Rule: ${factor.rule ?? ""}.`);
    if (factor.evidence.length > 0) lines.push("", "Evidence:", "", ...factor.evidence.map((line) => `- ${line}`));
    if (factor.partial) lines.push("", `Partial: ${factor.partial}.`);
  }
  if (factor.deferral) {
    const revisit = factor.deferral.revisitBy ? `, revisit by ${factor.deferral.revisitBy}` : "";
    lines.push("", `Deferral recorded ${factor.deferral.recorded}${revisit}: ${factor.deferral.reason}. ${factor.deferral.applied ? "Applied" : "Not applied"}: ${factor.deferral.note}.`);
  }
  return lines;
}

function scoresSection(report: AuditReport): string[] {
  return [
    "## Factor scores",
    "",
    ...table(
      ["Factor", "Class", "Score", "Rule"],
      report.factors.map((f) => [f.id, f.class, f.score === null ? "–" : String(f.score), f.score === null ? `not measured: ${f.reason ?? ""}` : (f.rule ?? "")]),
    ),
    "",
    "Scores are never averaged; the lowest scored blocking factor sets the readiness level.",
    "",
    ...report.factors.flatMap((factor) => [...factorSection(factor), ""]).slice(0, -1),
  ];
}

function zonesSection(report: AuditReport): string[] {
  const { zones } = report;
  const lines = ["## Risk zones", "", "Green: agents may edit. Yellow: add characterization tests first. Red: agents may only propose changes.", ""];
  if (zones.note) return [...lines, `${zones.note}.`];
  lines.push(...table(["Zone", "Module", "Source files", "Red files", "Reason"], zones.modules.map((m) => [m.zone, code(m.module), String(m.sourceFiles), String(m.redFiles), m.reason])));
  lines.push("", "Red paths:", "");
  lines.push(...(zones.redPaths.length > 0 ? zones.redPaths.map((red) => `- ${code(`${red.path}${red.kind === "directory" ? "/" : ""}`)} (${red.term})`) : ["- none"]));
  if (zones.unzoned.length > 0) lines.push("", `Not zoned (no source files): ${zones.unzoned.join(", ")}.`);
  return lines;
}

function triggerText(item: AuditReport["plan"]["items"][number]): string {
  return item.trigger.kind === "factor"
    ? `${item.trigger.factor} ${item.trigger.score}`
    : `${item.trigger.zone} zone: ${count(item.trigger.count, item.trigger.zone === "red" ? "path" : "module")}`;
}

function planSection(report: AuditReport): string[] {
  const { plan } = report;
  const harness = `${plan.harness.name} ${plan.harness.version}${plan.harness.commit ? ` (commit ${code(plan.harness.commit)})` : ""}`;
  const lines = ["## Harness adaptation plan", "", `For ${harness}. ${plan.framing}`, ""];
  lines.push(...table(["Level", "Item", "Trigger", "Surfaces"], plan.items.map((item) => [item.level, item.id, triggerText(item), item.surfaces.join(", ")])));
  for (const item of plan.items) {
    lines.push("", `### ${item.level}: ${item.id}`, "", `Trigger: ${triggerText(item)}. Surfaces: ${item.surfaces.map(code).join(", ")}.`, "", `Change: ${item.change}`, "", `Why: ${item.why}`);
    if (item.details.length > 0) lines.push("", ...item.details.map((detail) => `- ${detail}`));
  }
  if (plan.notAssessed.length > 0) {
    lines.push("", "Not assessed (factor not measured):", "", ...plan.notAssessed.map((entry) => `- ${entry.requirement} (${entry.factor}): ${entry.reason}`));
  }
  return lines;
}

function roadmapSection(report: AuditReport): string[] {
  return [
    "## Modernization roadmap",
    "",
    "Ordered by priority: score gain (plus 1 when a weak factor leaves weak) × 2 for blocking factors ÷ effort (S 1, M 2, L 3).",
    "",
    ...table(
      ["#", "Factor", "Score", "Effort", "Priority", "Step", "Verdict after"],
      report.roadmap.map((step, index) => [String(index + 1), step.factor, `${step.from} → ${step.to}`, step.effort, String(step.priority), step.action, step.verdictAfter ?? "unchanged"]),
    ),
  ];
}

function notMeasuredSection(report: AuditReport): string[] {
  const lines = ["## Not measured", ""];
  if (report.notMeasured.length === 0) return [...lines, "Everything was measured."];
  return [...lines, ...report.notMeasured.map((item) => `- ${item.kind} ${code(item.id)}: ${item.reason}`)];
}

function signalsSection(report: AuditReport): string[] {
  const { gitHistory, codeStructure, testsDocs, dependencies } = report.signals;
  const lines = ["## Signals", "", "### Git history", ""];
  if (gitHistory.status === "measured") {
    const t = gitHistory.totals;
    lines.push(
      `${count(t.commits, "non-merge commit")} (${t.commitsLastYear} in the 12 months to ${gitHistory.window.until.slice(0, 10)}), ${count(t.authors, "author")}, first ${t.firstCommit?.slice(0, 10) ?? "none"}, last ${t.lastCommit?.slice(0, 10) ?? "none"}, ${count(t.trackedFiles, "tracked file")}.`,
      "",
      "Hotspots (most commits in the last 12 months):",
      "",
      ...table(["File", "Commits (12 months)", "Commits", "Authors", "Last commit"], gitHistory.hotspots.map((h) => [code(h.path), String(h.commitsLastYear), String(h.commits), String(h.authors), h.lastCommit?.slice(0, 10) ?? "none"])),
    );
  } else lines.push(`Not measured: ${gitHistory.reason}.`);

  lines.push("", "### Code structure", "");
  if (codeStructure.status === "measured") {
    const d = codeStructure.distribution;
    const excluded = Object.entries(codeStructure.excludedByReason).map(([reason, count]) => `${reason} ${count}`);
    lines.push(
      `${count(d.files, "file")}, ${count(d.totalLines, "line")}; per file p50 ${d.p50Lines}, p90 ${d.p90Lines}, p99 ${d.p99Lines}, max ${d.maxLines}. Excluded: ${list(excluded)}. scc: ${codeStructure.scc.status === "used" ? "used" : `not used (${codeStructure.scc.reason})`}.`,
      "",
      "Largest files:",
      "",
      ...table(["File", "Lines"], d.largest.map((file) => [code(file.path), String(file.lines)])),
    );
  } else lines.push(`Not measured: ${codeStructure.reason}.`);

  lines.push("", "### Tests and docs", "");
  if (testsDocs.status === "measured") {
    lines.push(
      `- Test files: ${testsDocs.testFiles} (${list(testsDocs.conventions.map((c) => `${code(c.convention)} ${c.files}`))})`,
      `- Test runner configs: ${list(testsDocs.runnerConfigs.map((r) => `${r.runner} (${code(r.path)})`))}`,
      `- CI: ${list(testsDocs.ci.map((c) => `${c.system} (${code(c.path)})`))}`,
      `- Type checkers: ${list(testsDocs.typeCheckers.map((c) => `${c.checker} (${code(c.path)})`))}`,
      `- README: ${list(testsDocs.docs.readme)}; contributing: ${list(testsDocs.docs.contributing)}; architecture: ${list(testsDocs.docs.architecture)}; decision records: ${testsDocs.docs.decisionRecords.length}; conventions: ${list(testsDocs.docs.conventions)}`,
      `- Agent context files (presence alone scores nothing): ${list(testsDocs.docs.agentContext)}`,
      `- Stated rules: ${testsDocs.statedRules.length}`,
    );
    if (testsDocs.statedRules.length > 0) {
      lines.push("", ...table(["File", "Line", "Rule"], testsDocs.statedRules.map((rule) => [code(rule.path), String(rule.line), rule.text])));
    }
  } else lines.push(`Not measured: ${testsDocs.reason}.`);

  lines.push("", "### Dependencies", "");
  if (dependencies.status === "measured") {
    lines.push(
      ...table(["Manifest", "Ecosystem", "Dependencies", "Issues"], dependencies.manifests.map((m) => [code(m.path), m.ecosystem, String(m.dependencies), list(m.issues)])),
      "",
      ...table(
        ["Runtime", "Spec", "Declared in", "Cycle", "Status", "End of life"],
        dependencies.runtimes.map((r) => [r.runtime, r.spec, `${code(r.source)} (${r.via})${r.testFixture ? ", test fixture: not counted" : ""}`, r.cycle ?? "–", r.status === "unknown" ? `unknown: ${r.reason ?? ""}` : r.status, r.eol ?? "–"]),
      ),
    );
  } else lines.push(`Not measured: ${dependencies.reason}.`);
  return lines;
}

function methodSection(report: AuditReport): string[] {
  const { inputs } = report;
  return [
    "## Method",
    "",
    `- Factor config: ${code(inputs.factorConfig)}`,
    `- Decision config: ${code(inputs.decisionConfig)}`,
    `- End-of-life table: ${code(inputs.eolTable.path)}, as of ${inputs.eolTable.asOf} (${count(inputs.eolTable.ageDays, "day")} before the audit)`,
    `- Deferrals: ${inputs.deferrals ? code(inputs.deferrals) : "none"}`,
    `- Harness requirements: ${code(inputs.harnessRequirements)}`,
    "",
    "Read-only commands run against the target:",
    "",
    ...(report.method.commands.length > 0 ? report.method.commands.map((command) => `- ${code(command)}`) : ["- none"]),
    "",
    "Collector notes:",
    "",
    ...(report.method.notes.length > 0 ? report.method.notes.map((note) => `- ${note}`) : ["- none"]),
  ];
}

export function renderMarkdown(report: AuditReport): string {
  const sections = [
    headline(report), verdictSection(report), scoresSection(report), zonesSection(report),
    planSection(report), roadmapSection(report), notMeasuredSection(report), signalsSection(report), methodSection(report),
  ];
  return `${sections.map((lines) => lines.join("\n")).join("\n\n")}\n`;
}
