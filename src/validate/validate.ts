// Agreement between an audit's zones and agent task outcomes recorded elsewhere.
// The auditor never runs agents or the audited code: a separate runner records
// which files each task changed and whether it passed, and this module counts.
// Pure: it reads a parsed report and parsed outcomes.

import type { AuditReport } from "../report/model.js";
import { zoneOf } from "../report/zone-of.js";
import type { Result } from "../result.js";

export const OUTCOMES_SCHEMA = "ai-codebase-auditor/outcomes";
export const OUTCOMES_SCHEMA_VERSION = 1;
export const VALIDATION_SCHEMA = "ai-codebase-auditor/validation";
export const VALIDATION_SCHEMA_VERSION = 1;
export const VALIDATION_FILES = { markdown: "ai-readiness-validation.md", json: "ai-readiness-validation.json" } as const;
/** Fewer tasks than this in a zone give a count but no rate. */
export const MIN_TASKS_FOR_RATE = 5;

export interface OutcomeTask {
  id: string;
  /** Paths relative to the repository root. */
  filesChanged: string[];
  passed: boolean;
  model: string | null;
  harness: string | null;
}

export interface Outcomes {
  runner: string | null;
  tasks: OutcomeTask[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const optionalText = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);

/** Checks an outcomes file against the documented schema, naming every problem. */
export function parseOutcomes(raw: unknown, source: string): Result<Outcomes> {
  const errors: string[] = [];
  const report = (message: string) => errors.push(`${source}: ${message}`);
  if (!isRecord(raw)) return { ok: false, errors: [`${source}: must be a JSON object`] };
  if (raw.schema !== OUTCOMES_SCHEMA) report(`schema must be "${OUTCOMES_SCHEMA}"`);
  if (raw.schemaVersion !== OUTCOMES_SCHEMA_VERSION) report(`schemaVersion must be ${OUTCOMES_SCHEMA_VERSION}`);
  if (!Array.isArray(raw.tasks) || raw.tasks.length === 0) report("tasks must be a non-empty array");
  const tasks: OutcomeTask[] = [];
  const ids = new Set<string>();
  (Array.isArray(raw.tasks) ? raw.tasks : []).forEach((task: unknown, index) => {
    const at = `tasks[${index}]`;
    if (!isRecord(task)) return report(`${at} must be an object`);
    if (typeof task.id !== "string" || task.id === "") report(`${at}.id must be a non-empty string`);
    else if (ids.has(task.id)) report(`${at}.id duplicates ${task.id}`);
    else ids.add(task.id);
    const files = task.filesChanged;
    if (!Array.isArray(files) || files.length === 0 || files.some((file) => typeof file !== "string" || file === "")) report(`${at}.filesChanged must be a non-empty array of paths`);
    if (typeof task.passed !== "boolean") report(`${at}.passed must be true or false`);
    if (errors.length === 0) {
      tasks.push({ id: task.id as string, filesChanged: files as string[], passed: task.passed as boolean, model: optionalText(task.model), harness: optionalText(task.harness) });
    }
    return undefined;
  });
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { runner: optionalText(raw.runner), tasks } };
}

type ZoneKey = "green" | "yellow" | "red" | "unzoned";
const ZONES: readonly ZoneKey[] = ["green", "yellow", "red", "unzoned"];
const SEVERITY: Record<ZoneKey, number> = { unzoned: 0, green: 1, yellow: 2, red: 3 };

export interface ZoneOutcome {
  zone: ZoneKey | "all";
  tasks: number;
  passed: number;
  /** Null below MIN_TASKS_FOR_RATE. */
  rate: number | null;
  /** Wilson score interval at 95%; null with the rate. */
  interval: [number, number] | null;
}

export interface Validation {
  schema: typeof VALIDATION_SCHEMA;
  schemaVersion: typeof VALIDATION_SCHEMA_VERSION;
  target: string;
  audit: { auditDate: string; commit: string | null; verdict: string | null; provisional: boolean };
  runner: string | null;
  models: string[];
  harnesses: string[];
  /** Each task in the zone of the riskiest file it changed. */
  byZone: ZoneOutcome[];
  overall: ZoneOutcome;
  /** Whether green ≥ yellow ≥ red holds among zones with enough tasks to rate. */
  ordering: { status: "holds" | "does not hold" | "not enough data"; detail: string };
  redTasks: { id: string; passed: boolean; redFiles: string[] }[];
  /** Changed paths outside every zoned module, with the tasks that changed them. */
  unzonedPaths: { path: string; tasks: string[] }[];
}

/** The Wilson score interval for k successes in n trials, at 95%. */
export function wilson(k: number, n: number): [number, number] {
  if (n === 0) return [0, 1];
  const z = 1.959963984540054;
  const p = k / n;
  const denominator = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denominator;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denominator;
  const round = (x: number) => Math.round(x * 1000) / 1000;
  return [round(Math.max(0, centre - half)), round(Math.min(1, centre + half))];
}

function outcome(zone: ZoneKey | "all", tasks: readonly OutcomeTask[]): ZoneOutcome {
  const passed = tasks.filter((task) => task.passed).length;
  const rated = tasks.length >= MIN_TASKS_FOR_RATE;
  return { zone, tasks: tasks.length, passed, rate: rated ? Math.round((passed / tasks.length) * 1000) / 1000 : null, interval: rated ? wilson(passed, tasks.length) : null };
}

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function validateZones(report: AuditReport, outcomes: Outcomes): Validation {
  const zoneTasks = new Map<ZoneKey, OutcomeTask[]>(ZONES.map((zone) => [zone, []]));
  const redTasks: Validation["redTasks"] = [];
  const unzoned = new Map<string, Set<string>>();
  for (const task of outcomes.tasks) {
    let worst: ZoneKey = "unzoned";
    const redFiles: string[] = [];
    for (const file of task.filesChanged) {
      const answer = zoneOf(report, file);
      const zone: ZoneKey = answer.zone ?? "unzoned";
      if (zone === "unzoned") unzoned.set(answer.path, (unzoned.get(answer.path) ?? new Set()).add(task.id));
      if (zone === "red") redFiles.push(answer.path);
      if (SEVERITY[zone] > SEVERITY[worst]) worst = zone;
    }
    zoneTasks.get(worst)?.push(task);
    if (redFiles.length > 0) redTasks.push({ id: task.id, passed: task.passed, redFiles: [...new Set(redFiles)].sort(byText) });
  }
  const byZone = ZONES.map((zone) => outcome(zone, zoneTasks.get(zone) ?? []));
  const rated = byZone.filter((z) => z.zone !== "unzoned" && z.rate !== null);
  let ordering: Validation["ordering"];
  if (rated.length < 2) {
    ordering = { status: "not enough data", detail: `fewer than two of green, yellow and red have ${MIN_TASKS_FOR_RATE} or more tasks` };
  } else {
    const broken = rated.slice(1).find((z, i) => (z.rate ?? 0) > (rated[i]?.rate ?? 0));
    const before = broken ? rated[rated.indexOf(broken) - 1] : undefined;
    ordering = broken && before
      ? { status: "does not hold", detail: `${broken.zone} ${broken.rate} > ${before.zone} ${before.rate}` }
      : { status: "holds", detail: rated.map((z) => `${z.zone} ${z.rate}`).join(" ≥ ") };
  }
  const distinct = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => v !== null))].sort(byText);
  return {
    schema: VALIDATION_SCHEMA,
    schemaVersion: VALIDATION_SCHEMA_VERSION,
    target: report.target.path,
    audit: { auditDate: report.auditDate, commit: report.target.head, verdict: report.verdict.verdict, provisional: report.verdict.provisional },
    runner: outcomes.runner,
    models: distinct(outcomes.tasks.map((t) => t.model)),
    harnesses: distinct(outcomes.tasks.map((t) => t.harness)),
    byZone,
    overall: outcome("all", outcomes.tasks),
    ordering,
    redTasks: redTasks.sort((a, b) => byText(a.id, b.id)),
    unzonedPaths: [...unzoned.entries()].sort(([a], [b]) => byText(a, b)).map(([path, ids]) => ({ path, tasks: [...ids].sort(byText) })),
  };
}

const rateText = (z: ZoneOutcome) =>
  z.rate === null ? `${z.passed} of ${z.tasks} passed (too few tasks for a rate; ${MIN_TASKS_FOR_RATE} needed)` : `${z.passed} of ${z.tasks} passed: ${z.rate} (95% interval ${z.interval?.[0]}–${z.interval?.[1]})`;

export function formatValidation(v: Validation): string {
  const lines = [
    `Validating the zones of ${v.target} (audited ${v.audit.auditDate}, commit ${v.audit.commit?.slice(0, 12) ?? "unknown"}) against ${v.overall.tasks} recorded tasks${v.runner ? ` from ${v.runner}` : ""}`,
    `Verdict ${v.audit.verdict ?? "none"}${v.audit.provisional ? " (provisional)" : ""}: ${rateText(v.overall)}`,
    ...v.byZone.map((z) => `  ${z.zone.padEnd(8)} ${rateText(z)}`),
    `Ordering green ≥ yellow ≥ red: ${v.ordering.status} (${v.ordering.detail})`,
    `Tasks touching red paths: ${v.redTasks.length === 0 ? "none" : v.redTasks.map((t) => `${t.id} (${t.passed ? "passed" : "failed"})`).join(", ")}`,
    ...(v.models.length > 1 || v.harnesses.length > 1 ? [`Note: the tasks mix ${v.models.length} models and ${v.harnesses.length} harnesses, so the rates mix them too`] : []),
    ...(v.unzonedPaths.length > 0 ? [`Paths outside every zoned module: ${v.unzonedPaths.length} (tests, docs, or paths the report does not know)`] : []),
  ];
  return `${lines.join("\n")}\n`;
}

export function renderValidationMarkdown(v: Validation): string {
  const cellRate = (z: ZoneOutcome) => (z.rate === null ? "too few tasks" : `${z.rate} (${z.interval?.[0]}–${z.interval?.[1]})`);
  const lines = [
    `# Zone validation: ${v.target}`,
    "",
    `Audit of ${v.audit.auditDate}, commit \`${v.audit.commit?.slice(0, 12) ?? "unknown"}\`, verdict ${v.audit.verdict ?? "none"}${v.audit.provisional ? " (provisional)" : ""}. ${v.overall.tasks} tasks${v.runner ? ` recorded by ${v.runner}` : ""}; models: ${v.models.join(", ") || "not recorded"}; harnesses: ${v.harnesses.join(", ") || "not recorded"}. Each task counts in the zone of the riskiest file it changed. Rates need ${MIN_TASKS_FOR_RATE} or more tasks; intervals are 95% Wilson intervals.`,
    "",
    "| Zone | Tasks | Passed | Rate (95% interval) |",
    "|---|---|---|---|",
    ...[...v.byZone, v.overall].map((z) => `| ${z.zone} | ${z.tasks} | ${z.passed} | ${cellRate(z)} |`),
    "",
    `**Ordering green ≥ yellow ≥ red:** ${v.ordering.status} (${v.ordering.detail}).`,
    "",
    "## Tasks touching red paths",
    "",
    ...(v.redTasks.length === 0 ? ["None."] : v.redTasks.map((t) => `- ${t.id}: ${t.passed ? "passed" : "failed"}; ${t.redFiles.map((f) => `\`${f}\``).join(", ")}`)),
    "",
    "## Paths outside every zoned module",
    "",
    ...(v.unzonedPaths.length === 0 ? ["None."] : v.unzonedPaths.map((p) => `- \`${p.path}\`: ${p.tasks.join(", ")}`)),
  ];
  return `${lines.join("\n")}\n`;
}

export function renderValidationJson(v: Validation): string {
  return `${JSON.stringify(v, null, 2)}\n`;
}
