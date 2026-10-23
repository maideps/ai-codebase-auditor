import { describe, expect, it } from "vitest";
import { DEFAULT_DECISION_CONFIG_PATH, loadDecisionConfig } from "../config/decision.js";
import { DEFAULT_HARNESS_REQUIREMENTS_PATH, loadHarnessRequirements } from "../config/harness-requirements.js";
import { decideVerdict } from "../decision/verdict.js";
import type { Decision, Zones } from "../decision/types.js";
import { collected, dependenciesOf, sourceFiles, structureOf } from "../testing/collected.js";
import { scoringOf } from "../testing/scoring.js";
import type { CollectorResults, Scoring } from "../scoring/types.js";
import { buildPlan, detectHarnessStack, type Plan } from "./plan.js";

const requirementsLoaded = loadHarnessRequirements(DEFAULT_HARNESS_REQUIREMENTS_PATH);
const decisionLoaded = loadDecisionConfig(DEFAULT_DECISION_CONFIG_PATH);
if (!requirementsLoaded.ok || !decisionLoaded.ok) throw new Error("default config does not load");
const requirements = requirementsLoaded.value;
const decisionConfig = decisionLoaded.value;

const noZones: Zones = { modules: [], redPaths: [], unzoned: [], note: null };
const allGood = { "test-feedback": 5, "type-strictness": 5, "file-size": 5, "documented-intent": 5, "dev-deploy-simplicity": 5, "dependency-currency": 5 };

function plan(scores: Record<string, number | null>, options: { zones?: Zones; results?: CollectorResults } = {}): Plan {
  const scoring: Scoring = scoringOf(scores);
  const decision: Decision = { verdict: decideVerdict(scoring, decisionConfig), zones: options.zones ?? noZones };
  // A TypeScript repository with a package.json, so the stack check stays quiet unless a test sets up a mismatch.
  const results = options.results ?? collected({ structure: structureOf([...sourceFiles(5, "ts"), { path: "package.json", lines: 3 }]) });
  return buildPlan({ scoring, decision, results, requirements });
}

const ids = (p: Plan) => p.items.map((item) => `${item.level}:${item.id}`);

describe("buildPlan requirement levels", () => {
  it.each([
    ["verifiable-changes", "test-feedback"],
    ["typed-changes", "type-strictness"],
    ["legible-context", "file-size"],
    ["written-intent", "documented-intent"],
    ["reproducible-runs", "dev-deploy-simplicity"],
    ["supported-runtime", "dependency-currency"],
  ])("%s is required at 2, recommended at 3 and absent at 4 (%s)", (id, factor) => {
    // test-feedback ≤ 2 means prepare first, which keeps required items only; that is tested separately.
    const at = (score: number) => plan({ ...allGood, [factor]: score }).items.find((item) => item.id === id);
    if (factor !== "test-feedback") expect(at(2)).toMatchObject({ level: "required", trigger: { kind: "factor", factor, score: 2 } });
    expect(at(3)).toMatchObject({ level: "recommended", trigger: { kind: "factor", factor, score: 3 } });
    expect(at(4)).toBeUndefined();
  });

  it("lists requirements whose factor is not measured as not assessed", () => {
    expect(plan({ ...allGood, "dependency-currency": null }).notAssessed).toEqual([
      { requirement: "supported-runtime", factor: "dependency-currency", reason: "dependency-currency not measured" },
    ]);
  });

  it("copies the requirement's surfaces, change and reason", () => {
    const item = plan({ ...allGood, "type-strictness": 2 }).items.find((i) => i.id === "typed-changes");
    const source = requirements.requirements.find((r) => r.id === "typed-changes");
    expect(item).toMatchObject({ surfaces: source?.surfaces, change: source?.required, why: source?.why });
  });
});

describe("buildPlan framing by verdict", () => {
  const zones: Zones = {
    modules: [{ module: "src", zone: "yellow", reason: "test-feedback 2 < 3: add characterization tests before agents edit", sourceFiles: 5, redFiles: 0 }],
    redPaths: [{ path: "src/auth", kind: "directory", term: "auth" }],
    unzoned: [],
    note: null,
  };

  it("prepare first keeps only required items, test-feedback first, with the zone guardrails", () => {
    const p = plan({ ...allGood, "test-feedback": 1, "documented-intent": 2, "file-size": 3 }, { zones });
    expect(p.framing).toBe("Do not adopt the harness for feature work yet: complete the required items first, starting with test-feedback.");
    // Zone guardrails are required too: agents still write the characterization tests.
    expect(ids(p)).toEqual(["required:verifiable-changes", "required:written-intent", "required:red-paths", "required:yellow-modules"]);
  });

  it("adapt lists required items, then zone guardrails, then recommended items", () => {
    const p = plan({ ...allGood, "type-strictness": 1, "file-size": 3 }, { zones });
    expect(p.framing).toBe("Adopt the harness with these adaptations.");
    expect(ids(p)).toEqual(["required:typed-changes", "required:red-paths", "required:yellow-modules", "recommended:legible-context"]);
  });

  it("adopt keeps the zone guardrails and recommended items", () => {
    const p = plan({ ...allGood, "documented-intent": 3 }, { zones });
    expect(p.framing).toBe("Adopt the harness as is, with the guardrails and recommendations below.");
    expect(ids(p)).toEqual(["required:red-paths", "required:yellow-modules", "recommended:written-intent"]);
  });

  it("has no items without a verdict", () => {
    const p = plan({ ...allGood, "test-feedback": null });
    expect(p.framing).toBe("No plan: there is no verdict to plan for.");
    expect(p.items).toEqual([]);
  });
});

describe("buildPlan details", () => {
  it("turns red paths into proposal-only entries with Claude Code deny rules", () => {
    const zones: Zones = { ...noZones, redPaths: [{ path: "web/app/Auth", kind: "directory", term: "auth" }, { path: "app/models/role.rb", kind: "file", term: "role" }] };
    const item = plan(allGood, { zones }).items.find((i) => i.id === "red-paths");
    expect(item).toMatchObject({ trigger: { kind: "zone", zone: "red", count: 2 } });
    expect(item?.details).toEqual([
      "web/app/Auth/ (auth): deny Edit(web/app/Auth/**), Write(web/app/Auth/**)",
      "app/models/role.rb (role): deny Edit(app/models/role.rb), Write(app/models/role.rb)",
    ]);
  });

  it("lists yellow modules with their reasons", () => {
    const zones: Zones = { ...noZones, modules: [{ module: "lib", zone: "yellow", reason: "files too large", sourceFiles: 3, redFiles: 0 }, { module: "src", zone: "green", reason: "ok", sourceFiles: 3, redFiles: 0 }] };
    const item = plan(allGood, { zones }).items.find((i) => i.id === "yellow-modules");
    expect(item).toMatchObject({ trigger: { kind: "zone", zone: "yellow", count: 1 }, details: ["lib: files too large"] });
  });

  it("names a checker for the main dynamic language", () => {
    const results = collected({ structure: structureOf([...sourceFiles(9, "rb", 50), ...sourceFiles(1, "js", 10), { path: "Gemfile", lines: 3 }, { path: "package.json", lines: 3 }]) });
    expect(plan({ ...allGood, "type-strictness": 1 }, { results }).items.find((i) => i.id === "typed-changes")?.details).toContain(
      "main dynamic language: ruby (450 source lines); suggested checker: Sorbet or Steep",
    );
  });

  it("lists the oversized files for legible-context", () => {
    const results = collected({ structure: structureOf([{ path: "src/big.py", lines: 4000 }, { path: "src/mid.py", lines: 1200 }, ...sourceFiles(3, "py"), { path: "pyproject.toml", lines: 3 }]) });
    expect(plan({ ...allGood, "file-size": 2 }, { results }).items.find((i) => i.id === "legible-context")?.details).toEqual([
      "files over 1000 lines: src/big.py (4000), src/mid.py (1200)",
    ]);
  });

  it("lists the missing signals for reproducible-runs, without a lock file for Maven", () => {
    // No CI, runner, runtime or lock file in the fixture; Maven has no lock-file convention.
    const maven = collected({
      structure: structureOf([...sourceFiles(3, "java"), { path: "pom.xml", lines: 3 }]),
      dependencies: dependenciesOf([], [{ path: "pom.xml", ecosystem: "maven", dependencies: [], runtimes: [], issues: [] }]),
    });
    expect(plan({ ...allGood, "dev-deploy-simplicity": 1 }, { results: maven }).items.find((i) => i.id === "reproducible-runs")?.details).toEqual([
      "missing: CI configured, test runner configured, runtime version declared",
    ]);
  });
});

describe("harness stack detection", () => {
  const withFiles = (files: { path: string; lines: number }[]) => collected({ structure: structureOf(files) });

  it.each([
    ["PHP taken for Node", [...sourceFiles(5, "php", 100), { path: "package.json", lines: 3 }], { stack: "node", marker: "package.json", language: "php", matches: false }],
    ["Python with only setup.py", [...sourceFiles(5, "py", 100), { path: "setup.py", lines: 30 }], { stack: "none", marker: null, language: "python", matches: false }],
    ["C without markers", sourceFiles(5, "c", 100), { stack: "none", marker: null, language: "c", matches: false }],
    ["Java with Maven", [...sourceFiles(5, "java", 100), { path: "pom.xml", lines: 30 }], { stack: "jvm", marker: "pom.xml", language: "java", matches: true }],
    ["TypeScript with package.json", [...sourceFiles(5, "ts", 100), { path: "package.json", lines: 3 }], { stack: "node", marker: "package.json", language: "typescript", matches: true }],
    ["Python with pyproject before package.json", [...sourceFiles(5, "py", 100), { path: "pyproject.toml", lines: 3 }, { path: "package.json", lines: 3 }], { stack: "python", marker: "pyproject.toml", language: "python", matches: true }],
  ])("%s", (_label, files, expected) => {
    expect(detectHarnessStack(withFiles(files))).toEqual(expected);
  });

  it("adds a required detected-stack item on a mismatch, citing test-feedback", () => {
    const results = withFiles([...sourceFiles(5, "php", 100), { path: "package.json", lines: 3 }]);
    const item = plan({ ...allGood, "test-feedback": 4 }, { results }).items.find((i) => i.id === "detected-stack");
    expect(item).toMatchObject({
      level: "required",
      trigger: { kind: "factor", factor: "test-feedback", score: 4 },
      details: ["the harness would detect node (from package.json), but the main language is php"],
    });
  });

  it("adds nothing when the harness detects the main language", () => {
    expect(plan(allGood).items.some((i) => i.id === "detected-stack")).toBe(false);
  });
});

describe("every plan item cites its trigger", () => {
  it("has a factor score or a zone for every item", () => {
    const zones: Zones = { ...noZones, redPaths: [{ path: "auth", kind: "directory", term: "auth" }] };
    const p = plan({ "test-feedback": 3, "type-strictness": 2, "file-size": 3, "documented-intent": 2, "dev-deploy-simplicity": 2, "dependency-currency": 1 }, { zones });
    expect(p.items.length).toBeGreaterThan(5);
    for (const item of p.items) {
      expect(item.trigger.kind === "zone" ? item.trigger.count > 0 : typeof item.trigger.score === "number").toBe(true);
    }
  });
});

