import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG_PATH, loadFactorConfig } from "../config/factors.js";
import { coChangeOf, collected, dependenciesOf, dynamicCallsOf, notMeasured, observabilityOf, sourceFiles, structureOf, testsDocsOf, type TestsDocsSpec } from "../testing/collected.js";
import { RULES, type RuleContext, type RuleOutcome } from "./rules.js";
import type { CollectorResults } from "./types.js";

const config = loadFactorConfig(DEFAULT_CONFIG_PATH);
if (!config.ok) throw new Error(config.errors.join("\n"));
const thresholdsOf = (id: string) => config.value.factors.find((factor) => factor.id === id)?.thresholds ?? {};
const today = "2026-10-21";

const modules = { splitShare: 0.5, maxDepth: 3 };

function run(id: string, results: CollectorResults, context: RuleContext = { modules }): RuleOutcome {
  const rule = RULES[id];
  if (!rule) throw new Error(`no rule ${id}`);
  return rule.score(results, thresholdsOf(id), today, context);
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

describe("direct-api-calls", () => {
  // n covered product files, the first `withSites` of them with one computed-target site each.
  const covered = (n: number, withSites: number, extra: Partial<CollectorResults> = {}) => {
    const files = Array.from({ length: n }, (_, index) => ({ path: `src/f${String(index).padStart(3, "0")}.py`, lines: 10, sites: index < withSites ? 1 : 0 }));
    return collected({ structure: structureOf(files), dynamicCalls: dynamicCallsOf(files), ...extra });
  };

  it.each([
    ["2% of files", 2, 5],
    ["3%", 3, 4],
    ["5%", 5, 4],
    ["6%", 6, 3],
    ["10%", 10, 3],
    ["11%", 11, 2],
    ["20%", 20, 2],
    ["21%", 21, 1],
  ])("%s with computed-target calls → %i", (_label, withSites, expected) => {
    expect(scoreOf("direct-api-calls", covered(100, withSites))).toBe(expected);
  });

  it("counts files, not sites: one dispatcher with many sites counts once", () => {
    const files = [{ path: "src/dispatch.rb", sites: 40 }, ...Array.from({ length: 49 }, (_, index) => ({ path: `src/m${index}.rb` }))];
    const results = collected({ structure: structureOf(files.map((file) => ({ path: file.path, lines: 10 }))), dynamicCalls: dynamicCallsOf(files) });
    const outcome = run("direct-api-calls", results);
    expect(outcome).toMatchObject({ status: "scored", score: 5, rule: "2.00% of 50 covered files have a computed-target call (40 sites)" });
  });

  it("leaves test files out of both counts", () => {
    const files = [...Array.from({ length: 20 }, (_, index) => ({ path: `src/f${index}.py` })), { path: "tests/test_mock.py", sites: 5 }];
    const results = collected({
      structure: structureOf(files.map((file) => ({ path: file.path, lines: 10 }))),
      testsDocs: testsDocsOf({ testFiles: ["tests/test_mock.py"] }),
      dynamicCalls: dynamicCallsOf(files),
    });
    expect(run("direct-api-calls", results)).toMatchObject({ status: "scored", score: 5, rule: "0.00% of 20 covered files have a computed-target call (0 sites)" });
  });

  it("cites the share, the constructs, the top files and sample sites", () => {
    const files = [
      { path: "app/a.rb", sites: 3, construct: "send by name" },
      { path: "app/b.rb", sites: 1, construct: "constantize by name" },
      ...Array.from({ length: 18 }, (_, index) => ({ path: `app/c${index}.rb` })),
    ];
    const outcome = run("direct-api-calls", collected({ structure: structureOf(files.map((file) => ({ path: file.path, lines: 10 }))), dynamicCalls: dynamicCallsOf(files) }));
    expect(outcome.status === "scored" && outcome.evidence).toEqual([
      "2 of 20 covered product files (10.00%) have computed-target calls: 4 sites",
      "by construct: send by name 3, constantize by name 1",
      "top files: app/a.rb (3), app/b.rb (1)",
      "sample sites: app/a.rb:1 send by name, app/b.rb:1 constantize by name, app/a.rb:2 send by name, app/a.rb:3 send by name",
      "covered languages hold 100.00% of 200 source lines",
    ]);
    expect(outcome.status === "scored" && outcome.partial).toBe("configuration-wired dispatch (dependency injection, XML mappings, callbacks by symbol, annotations) is not detected");
  });

  it("is not measured when covered languages hold less than half the source lines, naming the main uncovered one", () => {
    const python = Array.from({ length: 10 }, (_, index) => ({ path: `tools/t${index}.py`, lines: 10 }));
    const c = Array.from({ length: 20 }, (_, index) => ({ path: `src/m${index}.c`, lines: 10 }));
    const results = collected({ structure: structureOf([...python, ...c]), dynamicCalls: dynamicCallsOf(python) });
    expect(run("direct-api-calls", results)).toEqual({ status: "not-measured", reason: "covered languages hold 33.33% of source lines, below 50%; the main language, c (200 lines), has no dynamic-call rules" });
  });

  it("names uncovered languages as partial coverage when coverage is enough", () => {
    const python = Array.from({ length: 10 }, (_, index) => ({ path: `app/p${index}.py`, lines: 30 }));
    const results = collected({ structure: structureOf([...python, { path: "ext/fast.c", lines: 100 }]), dynamicCalls: dynamicCallsOf(python) });
    const outcome = run("direct-api-calls", results);
    expect(outcome.status === "scored" && outcome.partial).toBe(
      "configuration-wired dispatch (dependency injection, XML mappings, callbacks by symbol, annotations) is not detected; not covered: c (25.00% of source lines)",
    );
  });

  it("is not measured with fewer than 10 covered product files, or without the collector", () => {
    expect(run("direct-api-calls", covered(9, 0))).toEqual({ status: "not-measured", reason: "only 9 covered product files; at least 10 are needed" });
    expect(run("direct-api-calls", collected())).toEqual({ status: "not-measured", reason: "dynamic calls not measured (no dynamic-calls fixture)" });
  });
});

describe("module-boundaries", () => {
  // Three modules with source files: app, lib and web.
  const layout = structureOf([...sourceFiles(3, "rb", 10, "app"), ...sourceFiles(3, "rb", 10, "lib"), ...sourceFiles(3, "rb", 10, "web")]);
  // `cross` of `total` commits change app and lib; the rest change app alone. Newest first.
  const history = (total: number, cross: number) =>
    Array.from({ length: total }, (_, index) => (index < cross ? ["app/f0.rb", "lib/f0.rb"] : ["app/f1.rb"]));
  const results = (commits: string[][], extra: Partial<CollectorResults> = {}) => collected({ structure: layout, coChange: coChangeOf(commits), ...extra });

  it.each([
    ["10% of commits cross modules", 10, 5],
    ["11%", 11, 4],
    ["20%", 20, 4],
    ["21%", 21, 3],
    ["30%", 30, 3],
    ["31%", 31, 2],
    ["40%", 40, 2],
    ["41%", 41, 1],
  ])("%s (%i of 100) → %i", (_label, cross, expected) => {
    expect(scoreOf("module-boundaries", results(history(100, cross)))).toBe(expected);
  });

  it("uses only the latest 500 counted commits", () => {
    // 500 recent in-module commits, then 300 older cross-module ones outside the window.
    const commits = [...history(500, 0), ...history(300, 300)];
    expect(run("module-boundaries", results(commits))).toMatchObject({ status: "scored", score: 5, rule: "0.00% of the latest 500 commits change more than one module" });
  });

  it("leaves out tests, test paths, files outside current modules and mass edits", () => {
    const commits = [
      ["app/f0.rb", "test/app_test.rb"], // a test beside the code is normal work
      ["app/f0.rb", "spec/old/deleted_spec.rb"], // a deleted test, recognized by its test path
      ["app/f0.rb", "gone/old.rb"], // a directory that no longer exists
      ["docs/only.rb"], // no current module: not counted
      Array.from({ length: 51 }, (_, index) => `lib/gen${index}.rb`).concat(["app/f0.rb"]), // a mass edit
      ...history(49, 0),
    ];
    const outcome = run("module-boundaries", results(commits, { testsDocs: testsDocsOf({ testFiles: ["test/app_test.rb"] }) }));
    expect(outcome).toMatchObject({ status: "scored", score: 5 });
    expect(outcome.status === "scored" && outcome.evidence).toContain("skipped as mass edits (over 50 product source files): 1");
  });

  it("cites the share, the window, the coupled pairs and sample commits", () => {
    const commits = [
      ...Array.from({ length: 6 }, () => ["app/f0.rb", "lib/f0.rb"]),
      ...Array.from({ length: 2 }, () => ["lib/f1.rb", "web/f1.rb"]),
      ...history(42, 0),
    ];
    const outcome = run("module-boundaries", results(commits));
    expect(outcome).toMatchObject({ status: "scored", score: 4, rule: "16.00% of the latest 50 commits change more than one module" });
    expect(outcome.status === "scored" && outcome.evidence).toEqual([
      "8 of 50 commits (16.00%) change product source in two or more of 3 modules, 2025-11-13 to 2026-01-01",
      "skipped as mass edits (over 50 product source files): 0",
      "coupled pairs (at least 5 commits together): app + lib (6 together, 75% of lib's 8 commits)",
      "sample commits for app + lib: 0000000, 0000001, 0000002",
    ]);
    expect(outcome.status === "scored" && outcome.partial).toBe("coupling through imports, shared data or configuration is not measured, only changes made together");
  });

  it("is not measured with fewer than 50 counted commits, one module, no module settings, or without the collector", () => {
    expect(run("module-boundaries", results(history(49, 0)))).toEqual({ status: "not-measured", reason: "only 49 commits change product source in a current module; at least 50 are needed" });
    const oneModule = collected({ structure: structureOf(sourceFiles(3, "rb", 10, "app")), coChange: coChangeOf(history(60, 0)) });
    expect(run("module-boundaries", oneModule)).toEqual({ status: "not-measured", reason: "only one module (app): no boundaries to cross" });
    expect(run("module-boundaries", results(history(60, 0)), {})).toEqual({ status: "not-measured", reason: "module settings were not given" });
    expect(run("module-boundaries", collected({ structure: layout }))).toEqual({ status: "not-measured", reason: "co-change not measured (no co-change fixture)" });
  });
});

describe("observability", () => {
  // 100 product source files, the first `logging` of them with a logger call.
  const files = (logging: number, extra: { path: string; logging?: number; console?: number; integration?: string }[] = []) => [
    ...Array.from({ length: 100 }, (_, index) => ({ path: `app/f${String(index).padStart(3, "0")}.py`, logging: index < logging ? 1 : 0 })),
    ...extra,
  ];
  const manifest = (...names: string[]) => [{
    path: "requirements.txt", ecosystem: "pip" as const, runtimes: [], issues: [],
    dependencies: names.map((name) => ({ name, spec: null, scope: "runtime" as const })),
  }];
  const results = (logging: number, options: { extra?: Parameters<typeof files>[1]; configs?: Parameters<typeof observabilityOf>[1]; deps?: string[] } = {}) =>
    collected({
      structure: structureOf(files(logging, options.extra).map((file) => ({ path: file.path, lines: 10 }))),
      observability: observabilityOf(files(logging, options.extra), options.configs ?? []),
      dependencies: dependenciesOf([], manifest(...(options.deps ?? []))),
    });

  it.each([
    ["no logging, configuration or framework", 1, results(0)],
    ["logging calls in 1% of files", 2, results(1)],
    ["logging calls in 2% of files", 3, results(2)],
    ["sparse calls with a committed configuration", 3, results(1, { configs: [{ path: "logging.conf", kind: "configuration file" }] })],
    ["no calls, but a framework that logs by default", 3, results(0, { deps: ["Django"] })],
    // 3 of 101 files log: the extra file must not drop the share under 2%.
    ["logging plus an error reporter in an import", 4, results(3, { extra: [{ path: "app/err.py", integration: "import sentry_sdk" }] })],
    ["logging plus metrics in a manifest", 4, results(2, { deps: ["prometheus_client"] })],
    ["logging plus error reporting and metrics", 5, results(2, { deps: ["sentry-sdk", "prometheus_client"] })],
    ["an error reporter without logging adds one level", 2, results(0, { deps: ["sentry-sdk"] })],
    ["both integrations without logging still add only one", 2, results(0, { deps: ["sentry-sdk", "prometheus_client"] })],
  ])("%s → %i", (_label, expected, input) => {
    expect(scoreOf("observability", input)).toBe(expected);
  });

  it("leaves test files and development dependencies out", () => {
    const input = collected({
      structure: structureOf([...files(0), { path: "tests/test_x.py", lines: 10 }].map((file) => ({ path: file.path, lines: 10 }))),
      observability: observabilityOf([...files(0), { path: "tests/test_x.py", logging: 9, integration: "import sentry_sdk" }]),
      testsDocs: testsDocsOf({ testFiles: ["tests/test_x.py"] }),
      dependencies: dependenciesOf([], manifest().map((entry) => ({ ...entry, dependencies: [{ name: "sentry-sdk", spec: null, scope: "development" as const }] }))),
    });
    expect(scoreOf("observability", input)).toBe(1);
  });

  it("cites the share, configuration, framework, integrations and console-only files", () => {
    const input = results(3, {
      extra: [{ path: "ui/app.js", console: 4 }, { path: "app/trace.py", integration: "from opentelemetry import trace" }],
      configs: [{ path: "config/log4j2.xml", kind: "configuration file" }],
      deps: ["rails", "sentry-ruby"],
    });
    const outcome = run("observability", input);
    expect(outcome).toMatchObject({ status: "scored", score: 5, rule: "logging present (calls in 2.94% of files), with error reporting and metrics or tracing" });
    expect(outcome.status === "scored" && outcome.evidence).toEqual([
      "logging calls in 3 of 102 product source files (2.94%): logger call 3",
      "logging configuration: config/log4j2.xml (configuration file)",
      "logging framework: Rails (requirements.txt)",
      "error reporting: Sentry (requirements.txt)",
      "metrics or tracing: OpenTelemetry (app/trace.py:1)",
      "console output only, not counted as logging: 1 file",
    ]);
    expect(outcome.status === "scored" && outcome.partial).toBe(
      "whether logs and reports reach a place someone reads is not visible in the repository; swallowed exceptions are not detected",
    );
  });

  it("says when manifests could not be read, and is not measured without source or the collector", () => {
    const noDeps = collected({ structure: structureOf([{ path: "a.py", lines: 1 }]), observability: observabilityOf(files(2)), dependencies: notMeasured("git failed") });
    expect(run("observability", noDeps)).toMatchObject({ status: "scored", partial: expect.stringContaining("; manifests not read (dependencies not measured): integrations come from imports only") });
    expect(run("observability", collected({ observability: observabilityOf([]) }))).toEqual({ status: "not-measured", reason: "no product source files" });
    expect(run("observability", collected())).toEqual({ status: "not-measured", reason: "observability not measured (no observability fixture)" });
  });
});
