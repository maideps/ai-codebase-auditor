// One scoring rule per factor: collector values in, a 1-5 score with its
// evidence out, or "not measured" with a reason. Thresholds come from
// config/factors.json; this file holds no default numbers.

import type { CodeStructure } from "../collectors/code-structure.js";
import type { Measurement } from "../collectors/types.js";
import { isLockFile, languageOf, SOURCE_EXTENSIONS, extensionOf } from "../file-kinds.js";
import type { CollectorResults } from "./types.js";

export type Thresholds = Readonly<Record<string, number>>;

export type RuleOutcome =
  | { status: "scored"; score: number; rule: string; evidence: string[]; partial?: string }
  | { status: "not-measured"; reason: string };

export interface RuleSpec {
  /** Every threshold key the rule reads. */
  keys: readonly string[];
  /** Key groups whose values must not decrease, in order. */
  ascending?: readonly (readonly string[])[];
  /** Keys that must lie between 0 and 1. */
  unitInterval?: readonly string[];
  /** Keys that must be whole numbers. */
  wholeNumbers?: readonly string[];
  score(results: CollectorResults, thresholds: Thresholds, today: string): RuleOutcome;
}

/** Factors that exist in the model but have no collector signal yet. */
export const SIGNAL_LESS: Readonly<Record<string, string>> = {
  "direct-api-calls": "no collector signal yet: needs call-site analysis",
  "module-boundaries": "no collector signal yet: needs an import graph or co-change coupling",
  observability: "no collector signal yet: needs a logging and metrics detector",
};

const t = (thresholds: Thresholds, key: string): number => thresholds[key] ?? Number.NaN;
const fixed = (value: number) => value.toFixed(2);

function need<T>(measurement: Measurement<T>, label: string): { value: T } | { missing: RuleOutcome } {
  return measurement.status === "measured"
    ? { value: measurement.value }
    : { missing: { status: "not-measured", reason: `${label} not measured (${measurement.reason})` } };
}

// Code files that are not tests: the population size and typing rules apply to.
function sourceFiles(structure: CodeStructure, testPaths: ReadonlySet<string>) {
  return structure.files.filter((file) => SOURCE_EXTENSIONS.has(extensionOf(file.path)) && !testPaths.has(file.path));
}

// The first band whose limit the value meets; bands are [score, limit] from best to worst.
function band(value: number, bands: readonly (readonly [number, number])[], better: "higher" | "lower"): number {
  for (const [score, limit] of bands) if (better === "higher" ? value >= limit : value <= limit) return score;
  return 1;
}

// Calendar arithmetic on YYYY-MM-DD dates, in UTC.
function shift(date: string, years: number, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC((y ?? 0) + years, (m ?? 1) - 1 + months, d ?? 1)).toISOString().slice(0, 10);
}

const list = (items: readonly string[]) => (items.length > 0 ? items.join(", ") : "none");

const testFeedback: RuleSpec = {
  keys: ["minRatio3", "minRatio4", "minRatio5"],
  ascending: [["minRatio3", "minRatio4", "minRatio5"]],
  score(results, thresholds) {
    const structure = need(results.structure, "code structure");
    if ("missing" in structure) return structure.missing;
    const testsDocs = need(results.testsDocs, "tests and docs");
    if ("missing" in testsDocs) return testsDocs.missing;
    const testPaths = new Set(testsDocs.value.tests.files.map((file) => file.path));
    const source = sourceFiles(structure.value, testPaths).length;
    if (source === 0) return { status: "not-measured", reason: "no source files" };
    const tests = testPaths.size;
    const ratio = tests / source;
    const runner = testsDocs.value.tests.runnerConfigs.length > 0;
    const ci = testsDocs.value.ci.length > 0;
    const runnable = runner && ci ? "a runner config and CI" : runner ? "a runner config" : ci ? "CI" : "no runner config or CI";
    let score: number;
    let rule: string;
    if (tests === 0) [score, rule] = [1, "no test files"];
    else if (ratio >= t(thresholds, "minRatio5") && runner && ci) [score, rule] = [5, `ratio ${fixed(ratio)} ≥ ${t(thresholds, "minRatio5")} with a runner config and CI`];
    else if (ratio >= t(thresholds, "minRatio4") && runner && ci) [score, rule] = [4, `ratio ${fixed(ratio)} ≥ ${t(thresholds, "minRatio4")} with a runner config and CI`];
    else if (ratio >= t(thresholds, "minRatio3") && (runner || ci)) [score, rule] = [3, `ratio ${fixed(ratio)} ≥ ${t(thresholds, "minRatio3")} with ${runnable}`];
    else [score, rule] = [2, `test files present, but ratio ${fixed(ratio)} with ${runnable}`];
    return {
      status: "scored",
      score,
      rule,
      evidence: [
        `${tests} test files for ${source} source files: ratio ${fixed(ratio)}`,
        `test runner configs: ${list(testsDocs.value.tests.runnerConfigs.map((r) => r.path))}`,
        `CI: ${list(testsDocs.value.ci.map((c) => c.path))}`,
      ],
      partial: "feedback speed is not measured: the audit never runs tests",
    };
  },
};

const typeStrictness: RuleSpec = {
  keys: ["minShare2", "minShare3", "minShare4", "minShare5", "weightStrong", "weightWeak", "weightCheckedDynamic", "weightTypeScriptNonStrict"],
  ascending: [["minShare2", "minShare3", "minShare4", "minShare5"]],
  unitInterval: ["minShare2", "minShare3", "minShare4", "minShare5", "weightStrong", "weightWeak", "weightCheckedDynamic", "weightTypeScriptNonStrict"],
  score(results, thresholds) {
    const structure = need(results.structure, "code structure");
    if ("missing" in structure) return structure.missing;
    const testsDocs = need(results.testsDocs, "tests and docs");
    if ("missing" in testsDocs) return testsDocs.missing;
    const testPaths = new Set(testsDocs.value.tests.files.map((file) => file.path));
    const checkers = testsDocs.value.typeCheckers;
    const checked = new Set<string>(checkers.map((checker) => checker.language));
    const strictTypeScript = checkers.some((checker) => checker.checker === "TypeScript (strict)");
    const lines = { strong: 0, weak: 0, checked: 0, unchecked: 0 };
    let weighted = 0;
    for (const file of sourceFiles(structure.value, testPaths)) {
      const language = languageOf(file.path);
      if (!language) continue;
      if (language.typing === "strong") {
        lines.strong += file.lines;
        const typeScriptLoose = language.family === "typescript" && !strictTypeScript;
        weighted += file.lines * t(thresholds, typeScriptLoose ? "weightTypeScriptNonStrict" : "weightStrong");
      } else if (language.typing === "weak") {
        lines.weak += file.lines;
        weighted += file.lines * t(thresholds, "weightWeak");
      } else if (checked.has(language.family)) {
        lines.checked += file.lines;
        weighted += file.lines * t(thresholds, "weightCheckedDynamic");
      } else {
        lines.unchecked += file.lines;
      }
    }
    const total = lines.strong + lines.weak + lines.checked + lines.unchecked;
    if (total === 0) return { status: "not-measured", reason: "no source lines" };
    const share = weighted / total;
    const score = band(share, [[5, t(thresholds, "minShare5")], [4, t(thresholds, "minShare4")], [3, t(thresholds, "minShare3")], [2, t(thresholds, "minShare2")]], "higher");
    return {
      status: "scored",
      score,
      rule: `weighted typed share ${fixed(share)}`,
      evidence: [
        `typed share ${fixed(share)} of ${total} source lines (strong ${lines.strong}, weak ${lines.weak}, checked dynamic ${lines.checked}, unchecked dynamic ${lines.unchecked})`,
        `type checkers: ${list(checkers.map((checker) => `${checker.checker} (${checker.path})`))}`,
      ],
    };
  },
};

const fileSize: RuleSpec = {
  keys: ["maxP90Lines5", "maxP90Lines4", "maxP90Lines3", "maxP90Lines2", "maxShareOver1000Lines5", "maxShareOver1000Lines4", "maxShareOver1000Lines3", "maxShareOver1000Lines2"],
  ascending: [
    ["maxP90Lines5", "maxP90Lines4", "maxP90Lines3", "maxP90Lines2"],
    ["maxShareOver1000Lines5", "maxShareOver1000Lines4", "maxShareOver1000Lines3", "maxShareOver1000Lines2"],
  ],
  unitInterval: ["maxShareOver1000Lines5", "maxShareOver1000Lines4", "maxShareOver1000Lines3", "maxShareOver1000Lines2"],
  score(results, thresholds) {
    const structure = need(results.structure, "code structure");
    if ("missing" in structure) return structure.missing;
    const testPaths = results.testsDocs.status === "measured" ? new Set(results.testsDocs.value.tests.files.map((file) => file.path)) : new Set<string>();
    const files = sourceFiles(structure.value, testPaths);
    if (files.length === 0) return { status: "not-measured", reason: "no source files" };
    const sorted = files.map((file) => file.lines).sort((a, b) => a - b);
    const p90 = sorted[Math.max(0, Math.ceil(0.9 * sorted.length) - 1)] ?? 0;
    const over = sorted.filter((lines) => lines > 1000).length;
    const share = over / files.length;
    const byP90 = band(p90, [[5, t(thresholds, "maxP90Lines5")], [4, t(thresholds, "maxP90Lines4")], [3, t(thresholds, "maxP90Lines3")], [2, t(thresholds, "maxP90Lines2")]], "lower");
    const byShare = band(share, [[5, t(thresholds, "maxShareOver1000Lines5")], [4, t(thresholds, "maxShareOver1000Lines4")], [3, t(thresholds, "maxShareOver1000Lines3")], [2, t(thresholds, "maxShareOver1000Lines2")]], "lower");
    const largest = [...files].sort((a, b) => b.lines - a.lines || (a.path < b.path ? -1 : 1)).slice(0, 5);
    return {
      status: "scored",
      score: Math.min(byP90, byShare),
      rule: `lower of p90 ${p90} lines (→ ${byP90}) and ${fixed(share * 100)}% of files over 1000 lines (→ ${byShare})`,
      evidence: [
        `${files.length} source files: p90 ${p90} lines, ${over} over 1000 lines (${fixed(share * 100)}%)`,
        `largest: ${largest.map((file) => `${file.path} (${file.lines} lines)`).join(", ")}`,
      ],
    };
  },
};

const documentedIntent: RuleSpec = {
  keys: ["minRules3", "minRules4", "minRules5"],
  ascending: [["minRules3", "minRules4", "minRules5"]],
  wholeNumbers: ["minRules3", "minRules4", "minRules5"],
  score(results, thresholds) {
    const testsDocs = need(results.testsDocs, "tests and docs");
    if ("missing" in testsDocs) return testsDocs.missing;
    const { docs, statedRules } = testsDocs.value;
    const rules = statedRules.length;
    const ruleFiles = new Set(statedRules.map((rule) => rule.path)).size;
    const readme = docs.readme.length > 0;
    const anyDocs = readme || [docs.moduleReadmes, docs.contributing, docs.architecture, docs.decisionRecords, docs.conventions, docs.docsDirectory].some((paths) => paths.length > 0);
    const architecture = docs.architecture.length > 0;
    const decisions = docs.decisionRecords.length > 0;
    const guidance = docs.contributing.length > 0 || architecture || docs.conventions.length > 0 || decisions;
    let score: number;
    let rule: string;
    if (rules >= t(thresholds, "minRules5") && ruleFiles >= 2 && architecture && decisions) [score, rule] = [5, `${rules} stated rules in ${ruleFiles} files, with architecture docs and decision records`];
    else if (rules >= t(thresholds, "minRules4") && ruleFiles >= 2 && (architecture || decisions)) [score, rule] = [4, `${rules} stated rules in ${ruleFiles} files, with ${architecture ? "architecture docs" : "decision records"}`];
    else if (anyDocs && (rules >= t(thresholds, "minRules3") || guidance)) [score, rule] = [3, rules >= t(thresholds, "minRules3") ? `docs with ${rules} stated rules` : "docs with contributing, architecture, convention or decision docs"];
    else if (anyDocs) [score, rule] = [2, readme ? "a README without written rules" : "docs without a README or written rules"];
    else [score, rule] = [1, "no README and no docs"];
    return {
      status: "scored",
      score,
      rule,
      evidence: [
        `README: ${list(docs.readme)}; contributing: ${list(docs.contributing)}; architecture: ${list(docs.architecture)}; decision records: ${docs.decisionRecords.length}; conventions: ${list(docs.conventions)}`,
        `stated rules: ${rules} in ${ruleFiles} file${ruleFiles === 1 ? "" : "s"}`,
        `agent context files (presence alone scores nothing): ${list(docs.agentContext)}`,
      ],
    };
  },
};

const devDeploySimplicity: RuleSpec = {
  keys: [],
  score(results) {
    const testsDocs = need(results.testsDocs, "tests and docs");
    if ("missing" in testsDocs) return testsDocs.missing;
    const dependencies = need(results.dependencies, "dependencies");
    if ("missing" in dependencies) return dependencies.missing;
    const structure = need(results.structure, "code structure");
    if ("missing" in structure) return structure.missing;
    const lockFiles = structure.value.excluded.filter((file) => isLockFile(file.path)).map((file) => file.path);
    const signals: [string, boolean][] = [
      ["CI configured", testsDocs.value.ci.length > 0],
      ["test runner configured", testsDocs.value.tests.runnerConfigs.length > 0],
      ["runtime version declared", dependencies.value.runtimes.some((runtime) => !runtime.testFixture)],
      ["lock file committed", lockFiles.length > 0],
    ];
    const present = signals.filter(([, found]) => found).map(([name]) => name);
    return {
      status: "scored",
      score: 1 + present.length,
      rule: `${present.length} of ${signals.length} signals: ${list(present)}`,
      evidence: [
        `CI: ${list(testsDocs.value.ci.map((c) => c.path))}`,
        `test runner configs: ${list(testsDocs.value.tests.runnerConfigs.map((r) => r.path))}`,
        `declared runtimes: ${list(dependencies.value.runtimes.map((r) => `${r.runtime} ${r.spec} (${r.source})`))}`,
        `lock files: ${list(lockFiles)}`,
      ],
      partial: "build scripts and containers are not detected yet",
    };
  },
};

const dependencyCurrency: RuleSpec = {
  keys: ["warnMonths", "eolYears2", "eolYears1"],
  ascending: [["eolYears2", "eolYears1"]],
  wholeNumbers: ["warnMonths", "eolYears2", "eolYears1"],
  score(results, thresholds, today) {
    const dependencies = need(results.dependencies, "dependencies");
    if ("missing" in dependencies) return dependencies.missing;
    // Test fixtures declare runtimes for their test inputs, not for the product.
    const fixtures = dependencies.value.runtimes.filter((runtime) => runtime.testFixture);
    const known = dependencies.value.runtimes.filter((runtime) => !runtime.testFixture && runtime.status !== "unknown" && runtime.eol !== null);
    if (known.length === 0) return { status: "not-measured", reason: "no declared runtime with a known end-of-life status outside test fixtures" };
    const scoreOf = (eol: string): number => {
      if (today >= eol) {
        if (today > shift(eol, t(thresholds, "eolYears1"), 0)) return 1;
        if (today >= shift(eol, t(thresholds, "eolYears2"), 0)) return 2;
        return 3;
      }
      return eol <= shift(today, 0, t(thresholds, "warnMonths")) ? 4 : 5;
    };
    // The worst runtime decides; ties go to the first declared.
    let worst = known[0];
    for (const runtime of known) if (runtime.eol && worst?.eol && scoreOf(runtime.eol) < scoreOf(worst.eol)) worst = runtime;
    if (!worst?.eol) return { status: "not-measured", reason: "no declared runtime with a known end-of-life status outside test fixtures" };
    const score = scoreOf(worst.eol);
    const describe = (runtime: (typeof known)[number]) =>
      `${runtime.runtime} ${runtime.spec} (${runtime.source}, ${runtime.via}): cycle ${runtime.cycle ?? "?"} ${runtime.status === "end-of-life" ? "end-of-life since" : "supported until"} ${runtime.eol ?? "?"}`;
    return {
      status: "scored",
      score,
      rule: score <= 3 ? `worst runtime is end-of-life since ${worst.eol}` : score === 4 ? `a runtime reaches end of life on ${worst.eol}, within ${t(thresholds, "warnMonths")} months` : `every runtime is supported past ${t(thresholds, "warnMonths")} months`,
      evidence: [
        describe(worst),
        ...known.filter((runtime) => runtime !== worst).map(describe),
        ...(fixtures.length > 0 ? [`ignored as test fixtures: ${fixtures.map((runtime) => `${runtime.runtime} ${runtime.spec} (${runtime.source})`).join(", ")}`] : []),
      ],
      partial: "package versions are not checked for age or vulnerabilities",
    };
  },
};

export const RULES: Readonly<Record<string, RuleSpec>> = {
  "test-feedback": testFeedback,
  "type-strictness": typeStrictness,
  "file-size": fileSize,
  "documented-intent": documentedIntent,
  "dev-deploy-simplicity": devDeploySimplicity,
  "dependency-currency": dependencyCurrency,
};
