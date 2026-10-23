// One scoring rule per factor: collector values in, a 1-5 score with its
// evidence out, or "not measured" with a reason. Thresholds come from
// config/factors.json; this file holds no default numbers.

import type { CodeStructure } from "../collectors/code-structure.js";
import type { TestsDocs } from "../collectors/tests-docs.js";
import type { Measurement } from "../collectors/types.js";
import { DYNAMIC_CALL_FAMILIES, isLockFile, isUnderTestPath, languageOf, SOURCE_EXTENSIONS, extensionOf } from "../file-kinds.js";
import { groupModules, moduleContaining, type ModuleSettings } from "../modules.js";
import type { CollectorResults } from "./types.js";

export type Thresholds = Readonly<Record<string, number>>;

export type RuleOutcome =
  | { status: "scored"; score: number; rule: string; evidence: string[]; partial?: string }
  | { status: "not-measured"; reason: string };

/** Settings a rule may need from outside its own thresholds. */
export interface RuleContext {
  /** How modules are split, shared with the risk zones (config/decision.json). */
  modules?: ModuleSettings;
}

export interface RuleSpec {
  /** Every threshold key the rule reads. */
  keys: readonly string[];
  /** Key groups whose values must not decrease, in order. */
  ascending?: readonly (readonly string[])[];
  /** Keys that must lie between 0 and 1. */
  unitInterval?: readonly string[];
  /** Keys that must be whole numbers. */
  wholeNumbers?: readonly string[];
  score(results: CollectorResults, thresholds: Thresholds, today: string, context: RuleContext): RuleOutcome;
}

/** Factors that exist in the model but have no collector signal yet. */
export const SIGNAL_LESS: Readonly<Record<string, string>> = {
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
export function sourceFiles(structure: CodeStructure, testPaths: ReadonlySet<string>) {
  return structure.files.filter((file) => SOURCE_EXTENSIONS.has(extensionOf(file.path)) && !testPaths.has(file.path));
}

// The first band whose limit the value meets; bands are [score, limit] from best to worst.
export function band(value: number, bands: readonly (readonly [number, number])[], better: "higher" | "lower"): number {
  for (const [score, limit] of bands) if (better === "higher" ? value >= limit : value <= limit) return score;
  return 1;
}

// Calendar arithmetic on YYYY-MM-DD dates, in UTC.
export function shift(date: string, years: number, months: number): string {
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

export interface TypedShare {
  share: number;
  total: number;
  lines: { strong: number; weak: number; checked: number; unchecked: number };
  /** Unchecked dynamic source lines per language family. */
  uncheckedByFamily: Map<string, number>;
  typeScriptLines: number;
  strictTypeScript: boolean;
}

/**
 * The weighted typed share of the source lines. The overrides answer "what
 * if": treat more language families as checked, or TypeScript as strict.
 */
export function typedShare(
  structure: CodeStructure,
  testsDocs: TestsDocs,
  thresholds: Thresholds,
  overrides: { checkedFamilies?: readonly string[]; strictTypeScript?: boolean } = {},
): TypedShare {
  const testPaths = new Set(testsDocs.tests.files.map((file) => file.path));
  const checked = new Set<string>([...testsDocs.typeCheckers.map((checker) => checker.language), ...(overrides.checkedFamilies ?? [])]);
  const strictTypeScript = overrides.strictTypeScript ?? testsDocs.typeCheckers.some((checker) => checker.checker === "TypeScript (strict)");
  const lines = { strong: 0, weak: 0, checked: 0, unchecked: 0 };
  const uncheckedByFamily = new Map<string, number>();
  let typeScriptLines = 0;
  let weighted = 0;
  for (const file of sourceFiles(structure, testPaths)) {
    const language = languageOf(file.path);
    if (!language) continue;
    if (language.typing === "strong") {
      lines.strong += file.lines;
      if (language.family === "typescript") typeScriptLines += file.lines;
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
      uncheckedByFamily.set(language.family, (uncheckedByFamily.get(language.family) ?? 0) + file.lines);
    }
  }
  const total = lines.strong + lines.weak + lines.checked + lines.unchecked;
  return { share: total === 0 ? 0 : weighted / total, total, lines, uncheckedByFamily, typeScriptLines, strictTypeScript };
}

/** The type-strictness score for a typed share. */
export function typeScoreOf(share: number, thresholds: Thresholds): number {
  return band(share, [[5, t(thresholds, "minShare5")], [4, t(thresholds, "minShare4")], [3, t(thresholds, "minShare3")], [2, t(thresholds, "minShare2")]], "higher");
}

const typeStrictness: RuleSpec = {
  keys: ["minShare2", "minShare3", "minShare4", "minShare5", "weightStrong", "weightWeak", "weightCheckedDynamic", "weightTypeScriptNonStrict"],
  ascending: [["minShare2", "minShare3", "minShare4", "minShare5"]],
  unitInterval: ["minShare2", "minShare3", "minShare4", "minShare5", "weightStrong", "weightWeak", "weightCheckedDynamic", "weightTypeScriptNonStrict"],
  score(results, thresholds) {
    const structure = need(results.structure, "code structure");
    if ("missing" in structure) return structure.missing;
    const testsDocs = need(results.testsDocs, "tests and docs");
    if ("missing" in testsDocs) return testsDocs.missing;
    const checkers = testsDocs.value.typeCheckers;
    const { share, total, lines } = typedShare(structure.value, testsDocs.value, thresholds);
    if (total === 0) return { status: "not-measured", reason: "no source lines" };
    const score = typeScoreOf(share, thresholds);
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

const DYNAMIC_PARTIAL = "configuration-wired dispatch (dependency injection, XML mappings, callbacks by symbol, annotations) is not detected";
const SAMPLE_SITES = 10;

export interface DynamicShare {
  /** Covered product files read by the collector (tests left out). */
  files: { path: string; sites: { line: number; construct: string }[] }[];
  withSites: number;
  share: number;
  sites: number;
}

/** The share of covered product files with at least one computed-target call site. */
export function dynamicShare(results: CollectorResults): DynamicShare | null {
  if (results.dynamicCalls.status !== "measured") return null;
  const testPaths = results.testsDocs.status === "measured" ? new Set(results.testsDocs.value.tests.files.map((file) => file.path)) : new Set<string>();
  const files = results.dynamicCalls.value.files.filter((file) => !testPaths.has(file.path));
  const withSites = files.filter((file) => file.sites.length > 0).length;
  return { files, withSites, share: files.length === 0 ? 0 : withSites / files.length, sites: files.reduce((sum, file) => sum + file.sites.length, 0) };
}

/** The direct-api-calls score for a share of files with computed-target calls. */
export function dynamicScoreOf(share: number, thresholds: Thresholds): number {
  return band(share, [[5, t(thresholds, "maxShareWithSites5")], [4, t(thresholds, "maxShareWithSites4")], [3, t(thresholds, "maxShareWithSites3")], [2, t(thresholds, "maxShareWithSites2")]], "lower");
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const directCalls: RuleSpec = {
  keys: ["maxShareWithSites5", "maxShareWithSites4", "maxShareWithSites3", "maxShareWithSites2", "minCoveredLineShare", "minCoveredFiles"],
  ascending: [["maxShareWithSites5", "maxShareWithSites4", "maxShareWithSites3", "maxShareWithSites2"]],
  unitInterval: ["maxShareWithSites5", "maxShareWithSites4", "maxShareWithSites3", "maxShareWithSites2", "minCoveredLineShare"],
  wholeNumbers: ["minCoveredFiles"],
  score(results, thresholds) {
    const dynamic = need(results.dynamicCalls, "dynamic calls");
    if ("missing" in dynamic) return dynamic.missing;
    const structure = need(results.structure, "code structure");
    if ("missing" in structure) return structure.missing;
    const testPaths = results.testsDocs.status === "measured" ? new Set(results.testsDocs.value.tests.files.map((file) => file.path)) : new Set<string>();

    // Coverage: the share of product source lines in languages with detection rules.
    let coveredLines = 0;
    const uncovered = new Map<string, number>();
    for (const file of sourceFiles(structure.value, testPaths)) {
      const family = languageOf(file.path)?.family ?? "";
      if (DYNAMIC_CALL_FAMILIES[family]) coveredLines += file.lines;
      else uncovered.set(family, (uncovered.get(family) ?? 0) + file.lines);
    }
    const totalLines = coveredLines + [...uncovered.values()].reduce((sum, lines) => sum + lines, 0);
    if (totalLines === 0) return { status: "not-measured", reason: "no source lines" };
    const coverage = coveredLines / totalLines;
    const byLines = [...uncovered.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    if (coverage < t(thresholds, "minCoveredLineShare")) {
      const [family, lines] = byLines[0] ?? ["unknown", 0];
      return {
        status: "not-measured",
        reason: `covered languages hold ${fixed(coverage * 100)}% of source lines, below ${t(thresholds, "minCoveredLineShare") * 100}%; the main language, ${family} (${lines} lines), has no dynamic-call rules`,
      };
    }

    const measured = dynamicShare(results);
    if (!measured) return { status: "not-measured", reason: "dynamic calls not measured" };
    const { files, withSites, share, sites } = measured;
    if (files.length < t(thresholds, "minCoveredFiles")) {
      return { status: "not-measured", reason: `only ${files.length} covered product files; at least ${t(thresholds, "minCoveredFiles")} are needed` };
    }

    const counts = new Map<string, number>();
    for (const file of files) for (const site of file.sites) counts.set(site.construct, (counts.get(site.construct) ?? 0) + 1);
    const ranked = files.filter((file) => file.sites.length > 0).sort((a, b) => b.sites.length - a.sites.length || (a.path < b.path ? -1 : 1));
    // Samples go round the top files, first sites first, so one file cannot fill the list.
    const samples: string[] = [];
    for (let round = 0; samples.length < SAMPLE_SITES && ranked.some((file) => file.sites.length > round); round += 1) {
      for (const file of ranked) {
        const site = file.sites[round];
        if (site && samples.length < SAMPLE_SITES) samples.push(`${file.path}:${site.line} ${site.construct}`);
      }
    }
    const notCovered = byLines.map(([family, lines]) => `${family} (${fixed((lines / totalLines) * 100)}% of source lines)`);
    return {
      status: "scored",
      score: dynamicScoreOf(share, thresholds),
      rule: `${fixed(share * 100)}% of ${files.length} covered files have a computed-target call (${plural(sites, "site")})`,
      evidence: [
        `${withSites} of ${files.length} covered product files (${fixed(share * 100)}%) have computed-target calls: ${plural(sites, "site")}`,
        ...(counts.size > 0 ? [`by construct: ${[...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([name, n]) => `${name} ${n}`).join(", ")}`] : []),
        ...(ranked.length > 0 ? [`top files: ${ranked.slice(0, 5).map((file) => `${file.path} (${file.sites.length})`).join(", ")}`] : []),
        ...(samples.length > 0 ? [`sample sites: ${samples.join(", ")}`] : []),
        `covered languages hold ${fixed(coverage * 100)}% of ${totalLines} source lines`,
      ],
      partial: notCovered.length > 0 ? `${DYNAMIC_PARTIAL}; not covered: ${notCovered.join(", ")}` : DYNAMIC_PARTIAL,
    };
  },
};

export interface CoChangePair {
  a: string;
  b: string;
  together: number;
  /** Commits together ÷ the commits of the module with fewer commits. */
  strength: number;
  /** The module with fewer commits, and its commit count. */
  smaller: string;
  smallerCommits: number;
  /** Hashes of the commits together, newest first. */
  hashes: string[];
}

export interface CoChangeMeasure {
  modules: string[];
  /** Counted commits in the window, newest first, with the modules each changed. */
  counted: { hash: string; time: string; modules: string[] }[];
  massEdits: number;
  crossCommits: number;
  share: number;
  /** Pairs with at least minPairCommits commits together, strongest first. */
  pairs: CoChangePair[];
}

/**
 * Commits mapped onto today's modules: product source only (tests, test paths
 * and files outside every current module left out), mass edits skipped, the
 * latest windowCommits counted.
 */
export function coChangeMeasure(results: CollectorResults, settings: ModuleSettings, thresholds: Thresholds): CoChangeMeasure | null {
  if (results.coChange.status !== "measured" || results.structure.status !== "measured") return null;
  const testPaths = results.testsDocs.status === "measured" ? new Set(results.testsDocs.value.tests.files.map((file) => file.path)) : new Set<string>();
  const modules = [...groupModules(sourceFiles(results.structure.value, testPaths).map((file) => file.path), settings).keys()].sort();
  const counted: CoChangeMeasure["counted"] = [];
  let massEdits = 0;
  for (const commit of results.coChange.value.commits) {
    if (counted.length >= t(thresholds, "windowCommits")) break;
    const product = commit.files.filter((file) => !testPaths.has(file) && !isUnderTestPath(file));
    const mapped = product.map((file) => moduleContaining(file, modules)).filter((name): name is string => name !== null);
    if (mapped.length === 0) continue;
    if (mapped.length > t(thresholds, "maxFilesPerCommit")) {
      massEdits += 1;
      continue;
    }
    counted.push({ hash: commit.hash, time: commit.time, modules: [...new Set(mapped)].sort() });
  }
  const perModule = new Map<string, number>();
  const together = new Map<string, string[]>();
  for (const commit of counted) {
    for (const name of commit.modules) perModule.set(name, (perModule.get(name) ?? 0) + 1);
    for (let i = 0; i < commit.modules.length; i += 1) {
      for (let j = i + 1; j < commit.modules.length; j += 1) {
        const key = `${commit.modules[i] ?? ""}\n${commit.modules[j] ?? ""}`;
        together.set(key, [...(together.get(key) ?? []), commit.hash]);
      }
    }
  }
  const pairs = [...together.entries()]
    .filter(([, hashes]) => hashes.length >= t(thresholds, "minPairCommits"))
    .map(([key, hashes]) => {
      const [a = "", b = ""] = key.split("\n");
      const [smaller, smallerCommits] = (perModule.get(a) ?? 0) <= (perModule.get(b) ?? 0) ? [a, perModule.get(a) ?? 0] : [b, perModule.get(b) ?? 0];
      return { a, b, together: hashes.length, strength: hashes.length / Math.max(1, smallerCommits), smaller, smallerCommits, hashes };
    })
    .sort((x, y) => y.strength - x.strength || y.together - x.together || (x.a + x.b < y.a + y.b ? -1 : 1));
  const crossCommits = counted.filter((commit) => commit.modules.length >= 2).length;
  return { modules, counted, massEdits, crossCommits, share: counted.length === 0 ? 0 : crossCommits / counted.length, pairs };
}

/** The module-boundaries score for a share of cross-module commits. */
export function boundaryScoreOf(share: number, thresholds: Thresholds): number {
  return band(share, [[5, t(thresholds, "maxCrossShare5")], [4, t(thresholds, "maxCrossShare4")], [3, t(thresholds, "maxCrossShare3")], [2, t(thresholds, "maxCrossShare2")]], "lower");
}

const percentWhole = (share: number) => `${Math.round(share * 100)}%`;
const COUPLING_PARTIAL = "coupling through imports, shared data or configuration is not measured, only changes made together";

const moduleBoundaries: RuleSpec = {
  keys: ["maxCrossShare5", "maxCrossShare4", "maxCrossShare3", "maxCrossShare2", "windowCommits", "minCommits", "maxFilesPerCommit", "minPairCommits"],
  ascending: [["maxCrossShare5", "maxCrossShare4", "maxCrossShare3", "maxCrossShare2"], ["minCommits", "windowCommits"]],
  unitInterval: ["maxCrossShare5", "maxCrossShare4", "maxCrossShare3", "maxCrossShare2"],
  wholeNumbers: ["windowCommits", "minCommits", "maxFilesPerCommit", "minPairCommits"],
  score(results, thresholds, _today, context) {
    const coChange = need(results.coChange, "co-change");
    if ("missing" in coChange) return coChange.missing;
    const structure = need(results.structure, "code structure");
    if ("missing" in structure) return structure.missing;
    if (!context.modules) return { status: "not-measured", reason: "module settings were not given" };
    const measured = coChangeMeasure(results, context.modules, thresholds);
    if (!measured) return { status: "not-measured", reason: "co-change not measured" };
    const { modules, counted, massEdits, crossCommits, share, pairs } = measured;
    if (modules.length < 2) return { status: "not-measured", reason: `only one module (${modules[0] ?? "none"}): no boundaries to cross` };
    if (counted.length < t(thresholds, "minCommits")) {
      return { status: "not-measured", reason: `only ${plural(counted.length, "commit")} ${counted.length === 1 ? "changes" : "change"} product source in a current module; at least ${t(thresholds, "minCommits")} are needed` };
    }
    const from = counted[counted.length - 1]?.time.slice(0, 10) ?? "?";
    const to = counted[0]?.time.slice(0, 10) ?? "?";
    const top = pairs.slice(0, 5);
    const strongest = top[0];
    return {
      status: "scored",
      score: boundaryScoreOf(share, thresholds),
      rule: `${fixed(share * 100)}% of the latest ${counted.length} commits change more than one module`,
      evidence: [
        `${crossCommits} of ${counted.length} commits (${fixed(share * 100)}%) change product source in two or more of ${modules.length} modules, ${from} to ${to}`,
        `skipped as mass edits (over ${t(thresholds, "maxFilesPerCommit")} product source files): ${massEdits}`,
        `coupled pairs (at least ${t(thresholds, "minPairCommits")} commits together): ${
          top.length > 0 ? top.map((pair) => `${pair.a} + ${pair.b} (${pair.together} together, ${percentWhole(pair.strength)} of ${pair.smaller}'s ${pair.smallerCommits} commits)`).join(", ") : "none"
        }`,
        ...(strongest ? [`sample commits for ${strongest.a} + ${strongest.b}: ${strongest.hashes.slice(0, 3).map((hash) => hash.slice(0, 7)).join(", ")}`] : []),
      ],
      partial: COUPLING_PARTIAL,
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
  "direct-api-calls": directCalls,
  "file-size": fileSize,
  "module-boundaries": moduleBoundaries,
  "documented-intent": documentedIntent,
  "dev-deploy-simplicity": devDeploySimplicity,
  "dependency-currency": dependencyCurrency,
};
