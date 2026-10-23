import { describe, expect, it } from "vitest";
import { DEFAULT_DECISION_CONFIG_PATH, loadDecisionConfig } from "../config/decision.js";
import { DEFAULT_CONFIG_PATH, loadFactorConfig } from "../config/factors.js";
import { DEFAULT_EOL_TABLE_PATH, loadRuntimeEolTable } from "../config/runtime-eol.js";
import { scoreFactors } from "../scoring/score.js";
import type { CollectorResults } from "../scoring/types.js";
import { coChangeOf, collected, dependenciesOf, dynamicCallsOf, observabilityOf, sourceFiles, structureOf, testsDocsOf, type TestsDocsSpec } from "../testing/collected.js";
import { buildRoadmap, type RoadmapStep } from "./roadmap.js";

const factors = loadFactorConfig(DEFAULT_CONFIG_PATH);
const decision = loadDecisionConfig(DEFAULT_DECISION_CONFIG_PATH);
const eol = loadRuntimeEolTable(DEFAULT_EOL_TABLE_PATH);
if (!factors.ok || !decision.ok || !eol.ok) throw new Error("default config does not load");
const factorConfig = factors.value;
const decisionConfig = decision.value;
const eolTable = eol.value;
const auditDate = "2026-10-22";

function roadmap(results: CollectorResults): RoadmapStep[] {
  const scoring = scoreFactors(results, factorConfig, { now: new Date(`${auditDate}T23:59:59.999Z`), modules: decisionConfig });
  return buildRoadmap({ scoring, results, factors: factorConfig, decisionConfig, eolTable, auditDate });
}
const stepFor = (steps: RoadmapStep[], factor: string) => steps.find((step) => step.factor === factor);
const tests = (n: number) => Array.from({ length: n }, (_, i) => ({ path: `test/t${i}.test.js`, lines: 5 }));
const withTests = (source: number, testCount: number, spec: TestsDocsSpec = {}) =>
  collected({
    structure: structureOf([...sourceFiles(source, "js"), ...tests(testCount)]),
    testsDocs: testsDocsOf({ testFiles: tests(testCount).map((t) => t.path), ...spec }),
  });
const runnerAndCi = { runners: ["jest.config.js"], ci: [".github/workflows/ci.yml"] };

describe("test-feedback steps", () => {
  it("starts a repository without tests at M effort: tests, a runner and CI", () => {
    expect(stepFor(roadmap(withTests(100, 0)), "test-feedback")).toMatchObject({
      from: 1, to: 3, effort: "M", action: "add 5 test files (to ratio 0.05), a test runner config and CI",
    });
  });

  it.each([
    ["a few tests to the next ratio", 20, 3, 4, 5, "add 3 test files (to ratio 0.3)", "S"],
    ["tens of tests", 1000, 10, 2, 3, "add 40 test files (to ratio 0.05)", "M"],
    ["hundreds of tests", 5000, 10, 2, 3, "add 240 test files (to ratio 0.05)", "L"],
  ])("sizes %s by the files needed", (_label, source, testCount, from, to, action, effort) => {
    expect(stepFor(roadmap(withTests(source, testCount, runnerAndCi)), "test-feedback")).toMatchObject({ from, to, action, effort });
  });
});

describe("type-strictness steps", () => {
  const typed = (files: { path: string; lines: number }[], spec: TestsDocsSpec = {}) => collected({ structure: structureOf(files), testsDocs: testsDocsOf(spec) });

  it("suggests the checker for the main dynamic language", () => {
    expect(stepFor(roadmap(typed([{ path: "app/a.rb", lines: 100 }])), "type-strictness")).toMatchObject({
      from: 1, to: 3, effort: "M", action: "configure Sorbet or Steep for ruby with a baseline (typed share 0.00 to 0.60)",
    });
  });

  it("suggests TypeScript strict when TypeScript is not strict", () => {
    expect(stepFor(roadmap(typed([{ path: "src/a.ts", lines: 100 }])), "type-strictness")).toMatchObject({
      from: 4, to: 5, action: "turn on strict in tsconfig.json (typed share 0.80 to 1.00)",
    });
  });

  it("has no step when nothing cheap raises the score", () => {
    expect(stepFor(roadmap(typed([{ path: "A.java", lines: 100 }])), "type-strictness")).toBeUndefined();
    const checkedPhp = typed([{ path: "a.php", lines: 100 }], { checkers: [{ path: "psalm.xml", checker: "Psalm", language: "php" }] });
    expect(stepFor(roadmap(checkedPhp), "type-strictness")).toBeUndefined();
  });
});

describe("file-size steps", () => {
  it("splits the fewest large files that reach the next band", () => {
    const files = [...Array.from({ length: 92 }, (_, i) => ({ path: `src/f${i}.py`, lines: 50 })), ...Array.from({ length: 8 }, (_, i) => ({ path: `src/big${i}.py`, lines: 1001 }))];
    expect(stepFor(roadmap(collected({ structure: structureOf(files) })), "file-size")).toMatchObject({
      from: 2, to: 3, effort: "S", action: "split 1 of 8 files over 1000 lines (to 7% of files)",
    });
  });
});

describe("direct-api-calls steps", () => {
  // 100 covered product files, the first `withSites` with one computed-target site each.
  const dynamic = (withSites: number) => {
    const files = Array.from({ length: 100 }, (_, index) => ({ path: `src/f${String(index).padStart(3, "0")}.py`, lines: 10, sites: index < withSites ? 1 : 0 }));
    return collected({ structure: structureOf(files), dynamicCalls: dynamicCallsOf(files) });
  };

  it.each([
    ["a weak share to the score-3 band", 12, 2, 3, "make the computed-target calls explicit in 2 of 12 files (to 10% of files), starting with src/f000.py (1), src/f001.py (1), src/f002.py (1)", "S"],
    ["a very weak share", 40, 1, 3, "make the computed-target calls explicit in 30 of 40 files (to 10% of files), starting with src/f000.py (1), src/f001.py (1), src/f002.py (1)", "L"],
    ["a good share to the top band", 4, 4, 5, "make the computed-target calls explicit in 2 of 4 files (to 2% of files), starting with src/f000.py (1), src/f001.py (1), src/f002.py (1)", "S"],
  ])("sizes %s by the files to change", (_label, withSites, from, to, action, effort) => {
    expect(stepFor(roadmap(dynamic(withSites)), "direct-api-calls")).toMatchObject({ from, to, action, effort });
  });
});

describe("module-boundaries steps", () => {
  const layout = structureOf([...sourceFiles(3, "rb", 10, "app"), ...sourceFiles(3, "rb", 10, "lib"), ...sourceFiles(3, "rb", 10, "web")]);
  // `appLib` commits change app and lib, `libWeb` change lib and web, the rest of 100 change app alone.
  const history = (appLib: number, libWeb: number) => [
    ...Array.from({ length: appLib }, () => ["app/f0.rb", "lib/f0.rb"]),
    ...Array.from({ length: libWeb }, () => ["lib/f1.rb", "web/f1.rb"]),
    ...Array.from({ length: 100 - appLib - libWeb }, () => ["app/f1.rb"]),
  ];

  it("names the most coupled pairs and the share to reach, always at L effort", () => {
    const results = collected({ structure: layout, coChange: coChangeOf(history(25, 10)) });
    expect(stepFor(roadmap(results), "module-boundaries")).toMatchObject({
      from: 2, to: 3, effort: "L",
      action: "reduce cross-module changes from 35% to 30% of commits, starting with the most coupled pairs lib + web (10 commits together) and app + lib (25 commits together)",
    });
  });

  it("names no pair when none has the minimum commits together", () => {
    const pairs = [["app/f0.rb", "lib/f0.rb"], ["lib/f0.rb", "web/f0.rb"], ["app/f0.rb", "web/f0.rb"]];
    const commits = [...pairs.flatMap((pair) => Array.from({ length: 4 }, () => pair)), ...Array.from({ length: 88 }, () => ["app/f1.rb"])];
    expect(stepFor(roadmap(collected({ structure: layout, coChange: coChangeOf(commits) })), "module-boundaries")).toMatchObject({
      from: 4, to: 5, effort: "L", action: "reduce cross-module changes from 12% to 10% of commits",
    });
  });
});

describe("observability steps", () => {
  // 100 product files, `logging` of them logging, with optional integration imports.
  const observed = (logging: number, imports: string[] = []) => {
    const files = [
      ...Array.from({ length: 100 }, (_, index) => ({ path: `app/f${index}.py`, logging: index < logging ? 1 : 0 })),
      ...imports.map((integration, index) => ({ path: `app/i${index}.py`, integration })),
    ];
    return collected({ structure: structureOf(files.map((file) => ({ path: file.path, lines: 10 }))), observability: observabilityOf(files) });
  };

  it.each([
    ["no logging", observed(0), 1, 3, "add logging to the main code paths and commit its configuration"],
    ["sparse logging", observed(1), 2, 3, "add logging to the main code paths and commit its configuration"],
    ["logging without integrations", observed(10), 3, 4, "add an error reporter (for example Sentry)"],
    ["logging and an error reporter", observed(10, ["import sentry_sdk"]), 4, 5, "add metrics or tracing (for example OpenTelemetry)"],
    ["logging and metrics", observed(10, ["import prometheus_client"]), 4, 5, "add an error reporter (for example Sentry)"],
  ])("from %s", (_label, results, from, to, action) => {
    expect(stepFor(roadmap(results), "observability")).toMatchObject({ from, to, action, effort: "M" });
  });
});

describe("documented-intent steps", () => {
  it.each([
    ["no docs", {}, 1, 2, "add a README", "S"],
    ["a README only", { docs: { readme: ["README.md"] } }, 2, 3, "write at least 3 project rules (AGENTS.md or CONTRIBUTING)", "S"],
    ["three rules in one file", { docs: { readme: ["README.md"] }, rules: [{ path: "AGENTS.md", count: 3 }] }, 3, 4, "write 7 more rules, across at least 2 files, and add an architecture doc or decision records", "M"],
  ] as const)("from %s", (_label, spec, from, to, action, effort) => {
    expect(stepFor(roadmap(collected({ testsDocs: testsDocsOf(spec as TestsDocsSpec) })), "documented-intent")).toMatchObject({ from, to, action, effort });
  });
});

describe("dev-deploy-simplicity steps", () => {
  it("adds every missing signal", () => {
    const npm = collected({ dependencies: dependenciesOf([], [{ path: "package.json", ecosystem: "npm", dependencies: [], runtimes: [], issues: [] }]) });
    expect(stepFor(roadmap(npm), "dev-deploy-simplicity")).toMatchObject({
      from: 1, to: 5, effort: "M", action: "add CI, a test runner config, a pinned runtime version and a lock file",
    });
  });

  it("does not ask a Maven project for a lock file", () => {
    const maven = collected({
      testsDocs: testsDocsOf(runnerAndCi),
      dependencies: dependenciesOf([{ runtime: "java", spec: "17", source: "pom.xml", via: "maven.compiler.release", cycle: "17", eol: "2027-10-31" }], [
        { path: "pom.xml", ecosystem: "maven", dependencies: [], runtimes: [], issues: [] },
      ]),
    });
    expect(stepFor(roadmap(maven), "dev-deploy-simplicity")).toBeUndefined();
  });
});

describe("dependency-currency steps", () => {
  it.each([
    ["Python 2.7 to the oldest cycle supported past 12 months", "python", "2.7", "2.7", "2020-01-01", "upgrade python from 2.7 to 3.11", "L"],
    ["Node 18 across release trains", "node", ">=18", "18", "2025-04-30", "upgrade node from 18 to 24", "M"],
  ] as const)("%s", (_label, runtime, spec, cycle, eolDate, action, effort) => {
    const results = collected({ dependencies: dependenciesOf([{ runtime, spec, cycle, lowest: cycle, status: "end-of-life", eol: eolDate }]) });
    expect(stepFor(roadmap(results), "dependency-currency")).toMatchObject({ to: 5, action, effort });
  });
});

describe("ordering", () => {
  it("orders by gain times weight over effort, with the formula's inputs on each step", () => {
    const steps = roadmap(withTests(100, 0));
    for (let i = 1; i < steps.length; i += 1) expect((steps[i - 1]?.priority ?? 0) >= (steps[i]?.priority ?? 0)).toBe(true);
    // test-feedback 1→3 at M: gain 2, plus 1 for leaving weak, times 2 for blocking, over 2.
    expect(steps[0]).toMatchObject({ factor: "test-feedback", gain: 2, priority: 3 });
  });

  it("marks the step that changes the verdict", () => {
    // Well tested, documented Ruby: only type-strictness is weak, so fixing it turns adapt into adopt.
    const results = collected({
      structure: structureOf([...sourceFiles(10, "rb", 50), ...tests(5)]),
      testsDocs: testsDocsOf({ testFiles: tests(5).map((t) => t.path), ...runnerAndCi, docs: { readme: ["README.md"], contributing: ["CONTRIBUTING.md"] } }),
      dependencies: dependenciesOf([{ runtime: "ruby", spec: "3.3", cycle: "3.3", eol: "2028-03-31" }], [{ path: "Gemfile", ecosystem: "bundler", dependencies: [], runtimes: [], issues: [] }]),
    });
    const steps = roadmap(results);
    expect(stepFor(steps, "type-strictness")).toMatchObject({ from: 1, to: 3, verdictAfter: "adopt" });
    expect(steps.filter((step) => step.verdictAfter !== null).map((step) => step.factor)).toEqual(["type-strictness"]);
  });

  it("cites the factor's score and evidence on every step", () => {
    for (const step of roadmap(withTests(100, 0))) {
      expect(typeof step.from).toBe("number");
      expect(step.evidence.length).toBeGreaterThan(0);
    }
  });
});
