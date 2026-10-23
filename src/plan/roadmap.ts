// The modernization roadmap: one concrete step per factor that can rise,
// ordered by expected score gain against effort. Each step states the score it
// starts from, the score it reaches, and the evidence behind it. Pure: no I/O.

import type { DecisionConfig } from "../config/decision.js";
import type { FactorConfig } from "../config/factors.js";
import type { RuntimeEolTable } from "../config/runtime-eol.js";
import { decideVerdict } from "../decision/verdict.js";
import type { VerdictKind } from "../decision/types.js";
import { shift, sourceFiles, typedShare, typeScoreOf, type Thresholds } from "../scoring/rules.js";
import type { CollectorResults, FactorScore, Scoring } from "../scoring/types.js";
import { missingDevSignals, type DevSignal } from "./plan.js";

export type Effort = "S" | "M" | "L";

export interface RoadmapStep {
  factor: string;
  class: FactorScore["class"];
  from: number;
  to: number;
  action: string;
  effort: Effort;
  /** to − from. */
  gain: number;
  /** (gain, plus 1 when the step lifts a weak factor out of weak) × weight ÷ effort points. */
  priority: number;
  /** The verdict this step alone would produce, when it differs from today's; otherwise null. */
  verdictAfter: VerdictKind | null;
  /** The factor's evidence, the measurements the step starts from. */
  evidence: string[];
}

export interface RoadmapInput {
  scoring: Scoring;
  results: CollectorResults;
  factors: FactorConfig;
  decisionConfig: DecisionConfig;
  eolTable: RuntimeEolTable;
  /** YYYY-MM-DD */
  auditDate: string;
}

type Candidate = { to: number; action: string; effort: Effort } | null;

const EFFORT_POINTS: Readonly<Record<Effort, number>> = { S: 1, M: 2, L: 3 };
const atLeast = (effort: Effort, floor: Effort): Effort => (EFFORT_POINTS[effort] >= EFFORT_POINTS[floor] ? effort : floor);
const bySize = (n: number, small: number, medium: number): Effort => (n <= small ? "S" : n <= medium ? "M" : "L");
// 0.3 × 20 must be 6, not 6.000000000000001.
const ceilSafe = (value: number) => Math.ceil(Number(value.toFixed(9)));
const fixed = (value: number) => value.toFixed(2);
const percent = (share: number) => {
  const value = Math.round(share * 1000) / 10;
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
};
const joinAnd = (parts: readonly string[]) =>
  parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1] ?? ""}`;

const CHECKERS: Readonly<Record<string, string>> = { python: "mypy or Pyright", php: "PHPStan or Psalm", ruby: "Sorbet or Steep", javascript: "TypeScript checkJs" };
// Languages whose first version number marks a breaking language change; Node.js and Java majors are release trains.
const LANGUAGE_MAJORS = new Set(["python", "php", "ruby"]);
const SIGNAL_PHRASE: Readonly<Record<DevSignal, string>> = {
  "CI configured": "CI",
  "test runner configured": "a test runner config",
  "runtime version declared": "a pinned runtime version",
  "lock file committed": "a lock file",
};

function testPathsOf(results: CollectorResults): Set<string> {
  return new Set(results.testsDocs.status === "measured" ? results.testsDocs.value.tests.files.map((file) => file.path) : []);
}

function testFeedbackStep(results: CollectorResults, from: number, t: Thresholds, weakMax: number): Candidate {
  if (results.structure.status !== "measured" || results.testsDocs.status !== "measured") return null;
  const testsDocs = results.testsDocs.value;
  const source = sourceFiles(results.structure.value, testPathsOf(results)).length;
  const tests = testsDocs.tests.files.length;
  const runner = testsDocs.tests.runnerConfigs.length > 0;
  const ci = testsDocs.ci.length > 0;
  const to = from <= weakMax ? weakMax + 1 : from + 1;
  const ratio = t[`minRatio${to}`];
  if (ratio === undefined) return null;
  const need = Math.max(0, ceilSafe(ratio * source) - tests);
  const missing = to === 3 ? (runner || ci ? [] : ["a test runner config", "CI"]) : [...(runner ? [] : ["a test runner config"]), ...(ci ? [] : ["CI"])];
  const parts = [...(need > 0 ? [`${need} test files (to ratio ${ratio})`] : []), ...missing];
  if (parts.length === 0) return null;
  let effort = bySize(need, 20, 100);
  if (missing.includes("CI")) effort = atLeast(effort, "M");
  if (tests === 0) effort = atLeast(effort, "M"); // the first tests also mean a test setup
  return { to, action: `add ${joinAnd(parts)}`, effort };
}

function typeStep(results: CollectorResults, from: number, t: Thresholds): Candidate {
  if (results.structure.status !== "measured" || results.testsDocs.status !== "measured") return null;
  const structure = results.structure.value;
  const testsDocs = results.testsDocs.value;
  const now = typedShare(structure, testsDocs, t);
  const options: { to: number; action: string }[] = [];
  let main: [string, number] | null = null;
  for (const entry of now.uncheckedByFamily) if (CHECKERS[entry[0]] && (!main || entry[1] > main[1])) main = entry;
  if (main) {
    const after = typedShare(structure, testsDocs, t, { checkedFamilies: [main[0]] }).share;
    options.push({ to: typeScoreOf(after, t), action: `configure ${CHECKERS[main[0]] ?? ""} for ${main[0]} with a baseline (typed share ${fixed(now.share)} to ${fixed(after)})` });
  }
  if (now.typeScriptLines > 0 && !now.strictTypeScript) {
    const after = typedShare(structure, testsDocs, t, { strictTypeScript: true }).share;
    options.push({ to: typeScoreOf(after, t), action: `turn on strict in tsconfig.json (typed share ${fixed(now.share)} to ${fixed(after)})` });
  }
  const best = options.reduce<{ to: number; action: string } | null>((top, option) => (!top || option.to > top.to ? option : top), null);
  return best && best.to > from ? { ...best, effort: "M" } : null;
}

function fileSizeStep(results: CollectorResults, from: number, t: Thresholds, weakMax: number): Candidate {
  if (results.structure.status !== "measured") return null;
  const files = sourceFiles(results.structure.value, testPathsOf(results));
  if (files.length === 0) return null;
  const to = from <= weakMax ? weakMax + 1 : from + 1;
  const maxShare = t[`maxShareOver1000Lines${to}`];
  const maxP90 = t[`maxP90Lines${to}`];
  if (maxShare === undefined || maxP90 === undefined) return null;
  const sorted = files.map((file) => file.lines).sort((a, b) => a - b);
  const p90 = sorted[Math.max(0, Math.ceil(0.9 * sorted.length) - 1)] ?? 0;
  const over = sorted.filter((lines) => lines > 1000).length;
  const allowed = Math.floor(Number((maxShare * files.length).toFixed(9)));
  const split = Math.max(0, over - allowed);
  const parts = [
    ...(split > 0 ? [`split ${split} of ${over} files over 1000 lines (to ${percent(allowed / files.length)} of files)`] : []),
    ...(p90 > maxP90 ? [`bring the p90 file length from ${p90} to ${maxP90} lines`] : []),
  ];
  if (parts.length === 0) return null;
  // A p90 over the limit means many long files, not a few outliers.
  return { to, action: parts.join(" and "), effort: p90 > maxP90 ? "L" : bySize(split, 5, 20) };
}

function documentedIntentStep(results: CollectorResults, from: number, t: Thresholds): Candidate {
  if (results.testsDocs.status !== "measured") return null;
  const { docs, statedRules } = results.testsDocs.value;
  const rules = statedRules.length;
  const ruleFiles = new Set(statedRules.map((rule) => rule.path)).size;
  const architecture = docs.architecture.length > 0;
  const decisions = docs.decisionRecords.length > 0;
  const to = from + 1;
  if (to === 2) return { to, action: "add a README", effort: "S" };
  if (to === 3) return { to, action: `write at least ${t.minRules3 ?? 3} project rules (AGENTS.md or CONTRIBUTING)`, effort: "S" };
  const target = t[`minRules${to}`];
  if (target === undefined || to > 5) return null;
  const more = Math.max(0, target - rules);
  const spread = ruleFiles < 2 ? ", across at least 2 files" : "";
  const rulesPart = more > 0 ? `write ${more} more rules${spread}` : spread ? "spread the rules across at least 2 files" : null;
  const docsPart =
    to === 4
      ? architecture || decisions ? null : "add an architecture doc or decision records"
      : [!architecture && "an architecture doc", !decisions && "decision records"].filter(Boolean).join(" and ") || null;
  const parts = [rulesPart, docsPart === null ? null : to === 4 ? docsPart : `add ${docsPart}`].filter((part): part is string => part !== null);
  return parts.length > 0 ? { to, action: parts.join(", and "), effort: "M" } : null;
}

function devDeployStep(results: CollectorResults, from: number): Candidate {
  const missing = missingDevSignals(results);
  if (missing.length === 0) return null;
  return {
    to: Math.min(5, from + missing.length),
    action: `add ${joinAnd(missing.map((signal) => SIGNAL_PHRASE[signal]))}`,
    effort: missing.includes("CI configured") ? "M" : "S",
  };
}

const cycleParts = (cycle: string) => cycle.split(".").map(Number);
function compareCycles(a: string, b: string): number {
  const x = cycleParts(a);
  const y = cycleParts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const difference = (x[i] ?? 0) - (y[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function dependencyStep(results: CollectorResults, input: RoadmapInput, t: Thresholds): Candidate {
  if (results.dependencies.status !== "measured") return null;
  const known = results.dependencies.value.runtimes.filter((runtime) => !runtime.testFixture && runtime.eol !== null && runtime.cycle !== null && runtime.status !== "unknown");
  // The runtime whose support ends first is the one holding the score down.
  const worst = known.reduce<(typeof known)[number] | null>((low, runtime) => (!low || (runtime.eol ?? "") < (low.eol ?? "") ? runtime : low), null);
  if (!worst?.cycle) return null;
  const horizon = shift(input.auditDate, 0, t.warnMonths ?? 12);
  const cycles = [...(input.eolTable.runtimes[worst.runtime]?.cycles ?? [])].sort((a, b) => compareCycles(a.cycle, b.cycle));
  const target = cycles.find((cycle) => compareCycles(cycle.cycle, worst.cycle ?? "") > 0 && cycle.eol > horizon);
  if (!target) return null;
  const majorJump = LANGUAGE_MAJORS.has(worst.runtime) && cycleParts(target.cycle)[0] !== cycleParts(worst.cycle)[0];
  return { to: 5, action: `upgrade ${worst.runtime} from ${worst.cycle} to ${target.cycle}`, effort: majorJump ? "L" : "M" };
}

export function buildRoadmap(input: RoadmapInput): RoadmapStep[] {
  const { scoring, results, factors, decisionConfig } = input;
  const weakMax = decisionConfig.weakMax;
  const current = decideVerdict(scoring, decisionConfig).verdict;
  const steps: { step: RoadmapStep; order: number }[] = [];

  scoring.factors.forEach((factor, order) => {
    if (factor.score === null || factor.score >= 5) return;
    const thresholds = factors.factors.find((candidate) => candidate.id === factor.id)?.thresholds ?? {};
    const from = factor.score;
    const candidate: Candidate =
      factor.id === "test-feedback" ? testFeedbackStep(results, from, thresholds, weakMax)
      : factor.id === "type-strictness" ? typeStep(results, from, thresholds)
      : factor.id === "file-size" ? fileSizeStep(results, from, thresholds, weakMax)
      : factor.id === "documented-intent" ? documentedIntentStep(results, from, thresholds)
      : factor.id === "dev-deploy-simplicity" ? devDeployStep(results, from)
      : factor.id === "dependency-currency" ? dependencyStep(results, input, thresholds)
      : null;
    if (!candidate || candidate.to <= from) return;

    const gain = candidate.to - from;
    const liftsWeak = from <= weakMax && candidate.to > weakMax ? 1 : 0;
    const weight = factor.class === "blocking" ? 2 : 1;
    const priority = Math.round(((gain + liftsWeak) * weight * 100) / EFFORT_POINTS[candidate.effort]) / 100;
    const after = decideVerdict(
      { ...scoring, factors: scoring.factors.map((other) => (other.id === factor.id ? { ...other, score: candidate.to } : other)) },
      decisionConfig,
    ).verdict;
    steps.push({
      step: {
        factor: factor.id, class: factor.class, from, to: candidate.to, action: candidate.action, effort: candidate.effort,
        gain, priority, verdictAfter: after !== current ? after : null, evidence: factor.evidence,
      },
      order,
    });
  });

  return steps
    .sort((a, b) => b.step.priority - a.step.priority || Number(b.step.class === "blocking") - Number(a.step.class === "blocking") || a.order - b.order)
    .map(({ step }) => step);
}
