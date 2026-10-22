import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG_PATH, loadFactorConfig } from "../config/factors.js";
import { collected, dependenciesOf, notMeasured, sourceFiles, structureOf, testsDocsOf, type TestsDocsSpec } from "../testing/collected.js";
import { RULES, type RuleOutcome } from "./rules.js";
import type { CollectorResults } from "./types.js";

const config = loadFactorConfig(DEFAULT_CONFIG_PATH);
if (!config.ok) throw new Error(config.errors.join("\n"));
const thresholdsOf = (id: string) => config.value.factors.find((factor) => factor.id === id)?.thresholds ?? {};
const today = "2026-10-21";

function run(id: string, results: CollectorResults): RuleOutcome {
  const rule = RULES[id];
  if (!rule) throw new Error(`no rule ${id}`);
  return rule.score(results, thresholdsOf(id), today);
}
const scoreOf = (id: string, results: CollectorResults) => {
  const outcome = run(id, results);
  return outcome.status === "scored" ? outcome.score : null;
};

const tests = (n: number) => Array.from({ length: n }, (_, index) => `test/t${index}.test.js`);
const withTests = (testCount: number, sourceCount: number, runner: boolean, ci: boolean) =>
  collected({
    structure: structureOf([...sourceFiles(sourceCount, "js"), ...tests(testCount).map((path) => ({ path, lines: 5 }))]),
    testsDocs: testsDocsOf({ testFiles: tests(testCount), runners: runner ? ["jest.config.js"] : [], ci: ci ? [".github/workflows/ci.yml"] : [] }),
  });

describe("test-feedback", () => {
  it.each([
    ["no test files", 0, 20, true, true, 1],
    ["tests but no way to run them", 1, 20, false, false, 2],
    ["ratio just below 0.05", 1, 21, true, false, 2],
    ["ratio 0.05 with a runner", 1, 20, true, false, 3],
    ["ratio 0.05 with CI only", 1, 20, false, true, 3],
    ["ratio 0.15 with a runner but no CI", 3, 20, true, false, 3],
    ["ratio 0.15 with runner and CI", 3, 20, true, true, 4],
    ["ratio just below 0.30", 29, 100, true, true, 4],
    ["ratio 0.30 with runner and CI", 30, 100, true, true, 5],
  ])("%s → %i", (_label, testCount, sourceCount, runner, ci, expected) => {
    expect(scoreOf("test-feedback", withTests(testCount, sourceCount, runner, ci))).toBe(expected);
  });

  it("cites the ratio, runners and CI, and says speed is not measured", () => {
    const outcome = run("test-feedback", withTests(30, 100, true, true));
    expect(outcome).toMatchObject({ status: "scored", score: 5 });
    if (outcome.status !== "scored") return;
    expect(outcome.evidence).toContain("30 test files for 100 source files: ratio 0.30");
    expect(outcome.evidence).toContain("test runner configs: jest.config.js");
    expect(outcome.evidence).toContain("CI: .github/workflows/ci.yml");
    expect(outcome.partial).toBe("feedback speed is not measured: the audit never runs tests");
  });

  it("is not measured without source files or when a collector failed", () => {
    expect(run("test-feedback", collected({ structure: structureOf([]) }))).toEqual({ status: "not-measured", reason: "no source files" });
    expect(run("test-feedback", collected({ structure: notMeasured("git failed: x") }))).toEqual({
      status: "not-measured",
      reason: "code structure not measured (git failed: x)",
    });
    expect(run("test-feedback", collected({ testsDocs: notMeasured("repository has no commits") }))).toEqual({
      status: "not-measured",
      reason: "tests and docs not measured (repository has no commits)",
    });
  });
});

describe("type-strictness", () => {
  const mix = (files: { path: string; lines: number }[], checkers: TestsDocsSpec["checkers"] = []) =>
    collected({ structure: structureOf(files), testsDocs: testsDocsOf({ checkers }) });

  it.each([
    ["all Java", [{ path: "A.java", lines: 100 }], [], 5],
    ["all Ruby without a checker", [{ path: "a.rb", lines: 100 }], [], 1],
    ["all Ruby with Sorbet", [{ path: "a.rb", lines: 100 }], [{ path: "sorbet/config", checker: "Sorbet", language: "ruby" }], 3],
    ["all C", [{ path: "a.c", lines: 100 }], [], 4],
    ["TypeScript without a strict tsconfig", [{ path: "a.ts", lines: 100 }], [], 4],
    ["TypeScript with a strict tsconfig", [{ path: "a.ts", lines: 100 }], [{ path: "tsconfig.json", checker: "TypeScript (strict)", language: "typescript" }], 5],
    ["JavaScript with checkJs", [{ path: "a.js", lines: 100 }], [{ path: "jsconfig.json", checker: "checkJs", language: "javascript" }], 3],
    ["typed share exactly 0.85", [{ path: "A.java", lines: 85 }, { path: "a.py", lines: 15 }], [], 5],
    ["typed share 0.84", [{ path: "A.java", lines: 84 }, { path: "a.py", lines: 16 }], [], 4],
    ["typed share exactly 0.15", [{ path: "A.java", lines: 15 }, { path: "a.py", lines: 85 }], [], 2],
    ["typed share 0.14", [{ path: "A.java", lines: 14 }, { path: "a.py", lines: 86 }], [], 1],
  ] as const)("%s → %i", (_label, files, checkers, expected) => {
    expect(scoreOf("type-strictness", mix([...files], [...checkers]))).toBe(expected);
  });

  it("ignores data files and tests, and is not measured without source lines", () => {
    const results = collected({
      structure: structureOf([{ path: "data.json", lines: 1000 }, { path: "a.rb", lines: 0 }]),
      testsDocs: testsDocsOf(),
    });
    expect(run("type-strictness", results)).toEqual({ status: "not-measured", reason: "no source lines" });
  });

  it("cites the line split and the checkers", () => {
    const outcome = run("type-strictness", mix([{ path: "a.rb", lines: 100 }], [{ path: "Steepfile", checker: "Steep", language: "ruby" }]));
    expect(outcome.status === "scored" && outcome.evidence).toEqual([
      "typed share 0.60 of 100 source lines (strong 0, weak 0, checked dynamic 100, unchecked dynamic 0)",
      "type checkers: Steep (Steepfile)",
    ]);
  });
});

describe("file-size", () => {
  const sized = (lines: number[]) => collected({ structure: structureOf(lines.map((n, index) => ({ path: `src/f${index}.py`, lines: n }))) });
  // 20 files: nearest-rank p90 is the 18th value, so the large value fills ranks 18 to 20 (15% of files).
  const twenty = (p90: number) => [...Array<number>(17).fill(10), p90, p90, p90];

  it.each([
    ["p90 200", twenty(200), 5],
    ["p90 201", twenty(201), 4],
    ["p90 400", twenty(400), 4],
    ["p90 800", twenty(800), 3],
    ["p90 1500 with 15% over 1000 lines", twenty(1500), 2],
    ["p90 1501", twenty(1501), 1],
  ])("%s → %i", (_label, lines, expected) => {
    expect(scoreOf("file-size", sized(lines))).toBe(expected);
  });

  it.each([
    ["1% of files over 1000 lines", 1, 5],
    ["2% over 1000 lines", 2, 4],
    ["7% over 1000 lines", 7, 3],
    ["8% over 1000 lines", 8, 2],
    ["16% over 1000 lines", 16, 1],
  ])("%s → %i (score is the lower of the two metrics)", (_label, big, expected) => {
    expect(scoreOf("file-size", sized([...Array<number>(100 - big).fill(50), ...Array<number>(big).fill(1001)]))).toBe(expected);
  });

  it("cites the largest source files", () => {
    const outcome = run("file-size", sized([5000, 10, 20]));
    expect(outcome.status === "scored" && outcome.evidence).toContain("largest: src/f0.py (5000 lines), src/f2.py (20 lines), src/f1.py (10 lines)");
  });
});

describe("documented-intent", () => {
  const docs = (spec: TestsDocsSpec) => collected({ testsDocs: testsDocsOf(spec) });

  it.each([
    ["nothing", {}, 1],
    ["a README only", { docs: { readme: ["README.md"] } }, 2],
    ["docs but no README", { docs: { docsDirectory: ["docs/a.md"] } }, 2],
    ["README with 2 rules", { docs: { readme: ["README.md"] }, rules: [{ path: "AGENTS.md", count: 2 }] }, 2],
    ["README with 3 rules", { docs: { readme: ["README.md"] }, rules: [{ path: "AGENTS.md", count: 3 }] }, 3],
    ["README and CONTRIBUTING", { docs: { readme: ["README.md"], contributing: ["CONTRIBUTING.md"] } }, 3],
    ["an agent context file with no rules", { docs: { readme: ["README.md"], agentContext: ["AGENTS.md"] } }, 2],
    [
      "10 rules in one file with architecture",
      { docs: { readme: ["README.md"], architecture: ["ARCHITECTURE.md"] }, rules: [{ path: "AGENTS.md", count: 10 }] },
      3,
    ],
    [
      "10 rules in two files with architecture",
      { docs: { readme: ["README.md"], architecture: ["ARCHITECTURE.md"] }, rules: [{ path: "AGENTS.md", count: 5 }, { path: "CONTRIBUTING.md", count: 5 }] },
      4,
    ],
    [
      "25 rules in two files with architecture but no decisions",
      { docs: { readme: ["README.md"], architecture: ["A.md"] }, rules: [{ path: "AGENTS.md", count: 20 }, { path: "C.md", count: 5 }] },
      4,
    ],
    [
      "25 rules in two files with architecture and decisions",
      { docs: { readme: ["README.md"], architecture: ["A.md"], decisionRecords: ["docs/adr/1.md"] }, rules: [{ path: "AGENTS.md", count: 20 }, { path: "C.md", count: 5 }] },
      5,
    ],
  ] as const)("%s → %i", (_label, spec, expected) => {
    expect(scoreOf("documented-intent", docs(spec as TestsDocsSpec))).toBe(expected);
  });
});

describe("dev-deploy-simplicity", () => {
  it.each([
    ["no signals", {}, [], [], 1],
    ["CI and a declared runtime", { ci: ["ci.yml"] }, [{}], [], 3],
    ["all four", { ci: ["ci.yml"], runners: ["jest.config.js"] }, [{}], [{ path: "package-lock.json", reason: "generated" as const }], 5],
  ])("%s → %i, marked partial", (_label, spec, runtimes, excluded, expected) => {
    const outcome = run("dev-deploy-simplicity", collected({
      testsDocs: testsDocsOf(spec),
      dependencies: dependenciesOf(runtimes),
      structure: structureOf(sourceFiles(1, "js"), excluded),
    }));
    expect(outcome).toMatchObject({ status: "scored", score: expected, partial: "build scripts and containers are not detected yet" });
  });

  it("is not measured when a needed collector failed", () => {
    expect(run("dev-deploy-simplicity", collected({ dependencies: notMeasured("git failed: x") }))).toEqual({
      status: "not-measured",
      reason: "dependencies not measured (git failed: x)",
    });
  });
});

describe("dependency-currency", () => {
  const runtimes = (...list: Parameters<typeof dependenciesOf>[0]) => collected({ dependencies: dependenciesOf(list) });

  it.each([
    ["supported beyond 12 months", [{ status: "supported", eol: "2027-10-22" }], 5],
    ["supported, end of life in exactly 12 months", [{ status: "supported", eol: "2027-10-21" }], 4],
    ["end-of-life for less than a year", [{ status: "end-of-life", eol: "2025-10-22" }], 3],
    ["end-of-life for exactly 1 year", [{ status: "end-of-life", eol: "2025-10-21" }], 2],
    ["end-of-life for exactly 3 years", [{ status: "end-of-life", eol: "2023-10-21" }], 2],
    ["end-of-life for more than 3 years", [{ status: "end-of-life", eol: "2023-10-20" }], 1],
    ["the worst runtime decides", [{ status: "supported", eol: "2030-01-01" }, { status: "end-of-life", eol: "2020-01-01" }], 1],
  ] as const)("%s → %i", (_label, list, expected) => {
    expect(scoreOf("dependency-currency", runtimes(...list))).toBe(expected);
  });

  it("is not measured without a runtime of known status", () => {
    expect(run("dependency-currency", runtimes())).toEqual({ status: "not-measured", reason: "no declared runtime with a known end-of-life status outside test fixtures" });
    expect(run("dependency-currency", runtimes({ status: "unknown", eol: null, reason: "no lower version bound" }))).toEqual({
      status: "not-measured",
      reason: "no declared runtime with a known end-of-life status outside test fixtures",
    });
  });

  it("ignores runtimes declared in test fixtures, but cites them", () => {
    const outcome = run("dependency-currency", runtimes(
      { runtime: "php", spec: "^8.2", source: "phpBB/composer.json", via: "require.php", cycle: "8.2", status: "supported", eol: "2030-01-01" },
      { runtime: "php", spec: ">=5.3", source: "tests/ext/composer.json", via: "require.php", cycle: "5.3", status: "end-of-life", eol: "2014-08-14", testFixture: true },
    ));
    expect(outcome).toMatchObject({ status: "scored", score: 5 });
    expect(outcome.status === "scored" && outcome.evidence).toContain("ignored as test fixtures: php >=5.3 (tests/ext/composer.json)");
  });

  it("is not measured when only test fixtures declare a runtime", () => {
    expect(run("dependency-currency", runtimes({ status: "end-of-life", eol: "2014-08-14", testFixture: true }))).toEqual({
      status: "not-measured",
      reason: "no declared runtime with a known end-of-life status outside test fixtures",
    });
  });

  it("cites the deciding runtime", () => {
    const outcome = run("dependency-currency", runtimes({ runtime: "python", spec: "2.7", source: "setup.py", via: "classifier", cycle: "2.7", status: "end-of-life", eol: "2020-01-01" }));
    expect(outcome.status === "scored" && outcome.evidence).toEqual(["python 2.7 (setup.py, classifier): cycle 2.7 end-of-life since 2020-01-01"]);
  });
});
