// The harness adaptation plan: which harness rules, context files and
// guardrails to change for this repository, and why. Every item cites what
// triggered it: a factor score, or a zone. Pure: no I/O.

import type { HarnessRequirements } from "../config/harness-requirements.js";
import type { Decision } from "../decision/types.js";
import { isLockFile, languageOf } from "../file-kinds.js";
import { sourceFiles, typedShare } from "../scoring/rules.js";
import type { CollectorResults, FactorScore, Scoring } from "../scoring/types.js";

export type PlanTrigger =
  | { kind: "factor"; factor: string; score: number }
  | { kind: "zone"; zone: "red" | "yellow"; count: number };

export interface PlanItem {
  /** A requirement id, or detected-stack, red-paths, yellow-modules. */
  id: string;
  level: "required" | "recommended";
  surfaces: string[];
  change: string;
  why: string;
  trigger: PlanTrigger;
  /** Repository-specific facts behind the item. */
  details: string[];
}

export interface Plan {
  harness: { name: string; version: string; commit: string | null };
  framing: string;
  items: PlanItem[];
  /** Requirements whose factor is not measured, so the assumption could not be checked. */
  notAssessed: { requirement: string; factor: string; reason: string }[];
}

export interface PlanInput {
  scoring: Scoring;
  decision: Decision;
  results: CollectorResults;
  requirements: HarnessRequirements;
  /** A score at or below this is weak; the next score up is borderline. Defaults to 2. */
  weakMax?: number;
}

const FRAMING = {
  "prepare-first": "Do not adopt the harness for feature work yet: complete the required items first, starting with test-feedback.",
  adapt: "Adopt the harness with these adaptations.",
  adopt: "Adopt the harness as is, with the guardrails and recommendations below.",
} as const;

const CHECKERS: Readonly<Record<string, string>> = {
  python: "mypy or Pyright",
  php: "PHPStan or Psalm",
  ruby: "Sorbet or Steep",
  javascript: "TypeScript checkJs",
};

// The harness runtime each language family needs, as its stack detection names them.
const STACK_OF_FAMILY: Readonly<Record<string, string>> = {
  python: "python", go: "go", rust: "rust",
  java: "jvm", kotlin: "jvm", scala: "jvm", groovy: "jvm",
  csharp: "dotnet", fsharp: "dotnet", vb: "dotnet",
  javascript: "node", typescript: "node",
};

// Ecosystems with a lock-file convention; Maven, Gradle and plain pip have none.
const LOCK_ECOSYSTEMS = new Set(["npm", "composer", "bundler"]);

export const DEV_SIGNALS = ["CI configured", "test runner configured", "runtime version declared", "lock file committed"] as const;
export type DevSignal = (typeof DEV_SIGNALS)[number];

/** The dev-deploy signals the repository lacks; the lock file only where its ecosystem uses one. */
export function missingDevSignals(results: CollectorResults): DevSignal[] {
  const missing: DevSignal[] = [];
  if (results.testsDocs.status === "measured") {
    if (results.testsDocs.value.ci.length === 0) missing.push("CI configured");
    if (results.testsDocs.value.tests.runnerConfigs.length === 0) missing.push("test runner configured");
  }
  if (results.dependencies.status === "measured") {
    const dependencies = results.dependencies.value;
    if (!dependencies.runtimes.some((runtime) => !runtime.testFixture)) missing.push("runtime version declared");
    const usesLocks = dependencies.manifests.some((manifest) => LOCK_ECOSYSTEMS.has(manifest.ecosystem));
    const hasLock = results.structure.status === "measured" && results.structure.value.excluded.some((file) => isLockFile(file.path));
    if (usesLocks && !hasLock) missing.push("lock file committed");
  }
  return missing;
}

/** The language family with the most source lines, or null. */
export function mainLanguage(results: CollectorResults): { family: string; lines: number } | null {
  if (results.structure.status !== "measured") return null;
  const testPaths = new Set(results.testsDocs.status === "measured" ? results.testsDocs.value.tests.files.map((file) => file.path) : []);
  const byFamily = new Map<string, number>();
  for (const file of sourceFiles(results.structure.value, testPaths)) {
    const family = languageOf(file.path)?.family;
    if (family) byFamily.set(family, (byFamily.get(family) ?? 0) + file.lines);
  }
  let best: { family: string; lines: number } | null = null;
  for (const [family, lines] of byFamily) if (!best || lines > best.lines) best = { family, lines };
  return best;
}

export interface HarnessStack {
  stack: string;
  marker: string | null;
  language: string | null;
  matches: boolean;
}

/**
 * What the harness's stack detection would pick, from root markers in its
 * order (Python, Go, Rust, JVM, .NET, then package.json), against the main
 * language. Null when the code structure is not measured.
 */
export function detectHarnessStack(results: CollectorResults): HarnessStack | null {
  if (results.structure.status !== "measured") return null;
  const structure = results.structure.value;
  const root = new Set([...structure.files, ...structure.excluded].map((file) => file.path).filter((path) => !path.includes("/")));
  const markers: [string, (name: string) => boolean][] = [
    ["python", (name) => name === "pyproject.toml" || name === "requirements.txt"],
    ["go", (name) => name === "go.mod"],
    ["rust", (name) => name === "Cargo.toml"],
    ["jvm", (name) => name === "pom.xml" || name === "build.gradle" || name === "build.gradle.kts"],
    ["dotnet", (name) => name.endsWith(".csproj") || name.endsWith(".sln")],
    ["node", (name) => name === "package.json"],
  ];
  let stack = "none";
  let marker: string | null = null;
  for (const [candidate, matches] of markers) {
    const found = [...root].sort().find(matches);
    if (found) {
      stack = candidate;
      marker = found;
      break;
    }
  }
  const language = mainLanguage(results)?.family ?? null;
  return { stack, marker, language, matches: language === null || STACK_OF_FAMILY[language] === stack };
}

function detailsFor(requirementId: string, factor: FactorScore, results: CollectorResults): string[] {
  switch (requirementId) {
    case "typed-changes": {
      if (results.structure.status !== "measured" || results.testsDocs.status !== "measured") return factor.evidence;
      const typed = typedShare(results.structure.value, results.testsDocs.value, {});
      let main: [string, number] | null = null;
      for (const entry of typed.uncheckedByFamily) if (!main || entry[1] > main[1]) main = entry;
      if (main) return [`main dynamic language: ${main[0]} (${main[1]} source lines); suggested checker: ${CHECKERS[main[0]] ?? "no common checker"}`];
      if (typed.typeScriptLines > 0 && !typed.strictTypeScript) return ["TypeScript is not strict: turn on strict in tsconfig.json"];
      return factor.evidence;
    }
    case "legible-context": {
      if (results.structure.status !== "measured") return factor.evidence;
      const testPaths = new Set(results.testsDocs.status === "measured" ? results.testsDocs.value.tests.files.map((file) => file.path) : []);
      const large = sourceFiles(results.structure.value, testPaths)
        .filter((file) => file.lines > 1000)
        .sort((a, b) => b.lines - a.lines || (a.path < b.path ? -1 : 1))
        .slice(0, 10);
      return large.length > 0 ? [`files over 1000 lines: ${large.map((file) => `${file.path} (${file.lines})`).join(", ")}`] : factor.evidence;
    }
    case "reproducible-runs": {
      const missing = missingDevSignals(results);
      return missing.length > 0 ? [`missing: ${missing.join(", ")}`] : factor.evidence;
    }
    default:
      return factor.evidence;
  }
}

function denyRules(path: string, kind: "directory" | "file"): string {
  const pattern = kind === "directory" ? `${path}/**` : path;
  return `Edit(${pattern}), Write(${pattern})`;
}

export function buildPlan(input: PlanInput): Plan {
  const { scoring, decision, results, requirements } = input;
  const weakMax = input.weakMax ?? 2;
  const harness = { name: requirements.harness.name, version: requirements.harness.version, commit: requirements.harness.commit ?? null };
  const notAssessed: Plan["notAssessed"] = [];
  const factorItems: PlanItem[] = [];

  for (const requirement of requirements.requirements) {
    const factor = scoring.factors.find((candidate) => candidate.id === requirement.factor);
    if (!factor || factor.score === null) {
      notAssessed.push({ requirement: requirement.id, factor: requirement.factor, reason: factor?.reason ?? "factor not configured" });
      continue;
    }
    const level = factor.score <= weakMax ? "required" : factor.score === weakMax + 1 ? "recommended" : null;
    if (!level) continue;
    factorItems.push({
      id: requirement.id,
      level,
      surfaces: requirement.surfaces,
      change: level === "required" ? requirement.required : requirement.recommended,
      why: requirement.why,
      trigger: { kind: "factor", factor: factor.id, score: factor.score },
      details: detailsFor(requirement.id, factor, results),
    });
  }

  // Required items citing test-feedback go first: verification gates everything else.
  const required = factorItems
    .filter((item) => item.level === "required")
    .sort((a, b) => Number(b.trigger.kind === "factor" && b.trigger.factor === "test-feedback") - Number(a.trigger.kind === "factor" && a.trigger.factor === "test-feedback"));
  const recommended = factorItems.filter((item) => item.level === "recommended");

  const stack = detectHarnessStack(results);
  const stackFactor = scoring.factors.find((factor) => factor.id === requirements.stackDetection.factor);
  if (stack && !stack.matches && stackFactor?.score !== null && stackFactor?.score !== undefined) {
    required.push({
      id: "detected-stack",
      level: "required",
      surfaces: requirements.stackDetection.surfaces,
      change: requirements.stackDetection.change,
      why: requirements.stackDetection.why,
      trigger: { kind: "factor", factor: stackFactor.id, score: stackFactor.score },
      details: [`the harness would detect ${stack.stack}${stack.marker ? ` (from ${stack.marker})` : ""}, but the main language is ${stack.language ?? "unknown"}`],
    });
  }

  const zones: PlanItem[] = [];
  const { redPaths, modules } = decision.zones;
  if (redPaths.length > 0) {
    zones.push({
      id: "red-paths",
      level: "required",
      surfaces: requirements.zones.red.surfaces,
      change: requirements.zones.red.change,
      why: requirements.zones.red.why,
      trigger: { kind: "zone", zone: "red", count: redPaths.length },
      details: redPaths.map((red) => `${red.path}${red.kind === "directory" ? "/" : ""} (${red.term}): deny ${denyRules(red.path, red.kind)}`),
    });
  }
  const yellow = modules.filter((module) => module.zone === "yellow");
  if (yellow.length > 0) {
    zones.push({
      id: "yellow-modules",
      level: "required",
      surfaces: requirements.zones.yellow.surfaces,
      change: requirements.zones.yellow.change,
      why: requirements.zones.yellow.why,
      trigger: { kind: "zone", zone: "yellow", count: yellow.length },
      details: yellow.map((module) => `${module.module}: ${module.reason}`),
    });
  }

  const verdict = decision.verdict.verdict;
  if (verdict === null) return { harness, framing: "No plan: there is no verdict to plan for.", items: [], notAssessed };
  // Zone guardrails are required items: under prepare first, agents still write tests near those paths.
  const items = verdict === "prepare-first" ? [...required, ...zones] : [...required, ...zones, ...recommended];
  return { harness, framing: FRAMING[verdict], items, notAssessed };
}
