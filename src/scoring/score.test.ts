import { describe, expect, it } from "vitest";
import type { Deferral } from "../config/deferrals.js";
import { DEFAULT_CONFIG_PATH, loadFactorConfig, type FactorConfig } from "../config/factors.js";
import { collected, dependenciesOf, sourceFiles, structureOf, testsDocsOf } from "../testing/collected.js";
import { checkThresholds, scoreFactors } from "./score.js";

const loaded = loadFactorConfig(DEFAULT_CONFIG_PATH);
if (!loaded.ok) throw new Error(loaded.errors.join("\n"));
const config = loaded.value;
const now = new Date("2026-10-21T12:00:00Z");

// A repository: well tested JavaScript, no type checker, small files, a README.
const results = collected({
  structure: structureOf([...sourceFiles(10, "js"), ...sourceFiles(5, "js", 5, "test")]),
  testsDocs: testsDocsOf({
    testFiles: sourceFiles(5, "js", 5, "test").map((file) => file.path),
    runners: ["jest.config.js"],
    ci: [".github/workflows/ci.yml"],
    docs: { readme: ["README.md"] },
  }),
  dependencies: dependenciesOf([{ status: "end-of-life", eol: "2020-01-01" }]),
});

const factor = (scoring: ReturnType<typeof scoreFactors>, id: string) => scoring.factors.find((f) => f.id === id);

describe("scoreFactors", () => {
  it("scores every configured factor in config order", () => {
    const scoring = scoreFactors(results, config, { now });
    expect(scoring.factors.map((f) => [f.id, f.status, f.score])).toEqual([
      ["test-feedback", "scored", 5],
      ["type-strictness", "scored", 1],
      ["direct-api-calls", "not-measured", null],
      ["file-size", "scored", 5],
      ["module-boundaries", "not-measured", null],
      ["documented-intent", "scored", 2],
      ["observability", "not-measured", null],
      ["dev-deploy-simplicity", "scored", 4],
      ["dependency-currency", "scored", 1],
    ]);
  });

  it("sets readiness from the lowest scored blocking factor, never an average", () => {
    // type-strictness 1 is constraining, so the blocking test-feedback 5 sets the level.
    expect(scoreFactors(results, config, { now }).readiness).toEqual({
      level: 5,
      setBy: "test-feedback",
      provisional: true,
      unmeasuredBlocking: ["direct-api-calls"],
    });
  });

  it("lets a weak blocking factor set the level", () => {
    const weakTests = collected({ ...results, testsDocs: testsDocsOf({ testFiles: ["test/f0.js"], docs: { readme: ["README.md"] } }) });
    expect(scoreFactors(weakTests, config, { now }).readiness).toMatchObject({ level: 2, setBy: "test-feedback" });
  });

  it("ignores low constraining factors when setting readiness", () => {
    const typed = collected({ ...results, structure: structureOf([...sourceFiles(10, "java"), ...sourceFiles(5, "js", 5, "test")]) });
    const scoring = scoreFactors(typed, config, { now });
    expect(factor(scoring, "dependency-currency")?.score).toBe(1);
    expect(scoring.readiness).toMatchObject({ level: 5, setBy: "test-feedback" });
  });

  it("names the first factor in config order on a tie", () => {
    const tied: FactorConfig = {
      version: 1,
      factors: [
        { id: "file-size", name: "File size", class: "blocking", description: "d", thresholds: config.factors.find((f) => f.id === "file-size")?.thresholds ?? {} },
        { id: "test-feedback", name: "Tests", class: "blocking", description: "d", thresholds: config.factors.find((f) => f.id === "test-feedback")?.thresholds ?? {} },
      ],
    };
    expect(scoreFactors(results, tied, { now }).readiness).toEqual({ level: 5, setBy: "file-size", provisional: false, unmeasuredBlocking: [] });
  });

  it("has no level when no blocking factor is measured", () => {
    const onlyUnmeasured: FactorConfig = { version: 1, factors: [{ id: "direct-api-calls", name: "Direct API calls", class: "blocking", description: "d" }] };
    expect(scoreFactors(results, onlyUnmeasured, { now }).readiness).toEqual({
      level: null,
      setBy: null,
      provisional: true,
      unmeasuredBlocking: ["direct-api-calls"],
    });
  });

  it("explains why signal-less and unknown factors are not measured", () => {
    const custom: FactorConfig = { version: 1, factors: [...config.factors, { id: "team-custom", name: "Custom", class: "constraining", description: "d" }] };
    const scoring = scoreFactors(results, custom, { now });
    expect(factor(scoring, "direct-api-calls")?.reason).toBe("dynamic calls not measured (no dynamic-calls fixture)");
    expect(factor(scoring, "module-boundaries")?.reason).toBe("co-change not measured (no co-change fixture)");
    expect(factor(scoring, "observability")?.reason).toBe("observability not measured (no observability fixture)");
    expect(factor(scoring, "team-custom")?.reason).toBe("no scoring rule for factor team-custom");
  });
});

describe("deferrals", () => {
  const deferral = (factorId: string, extra: Partial<Deferral> = {}): Deferral => ({
    factor: factorId, recorded: "2026-09-01", reason: "migrating to TypeScript in Q1", ...extra,
  });
  const scored = (deferrals: Deferral[], id: string) => factor(scoreFactors(results, config, { now, deferrals }), id);

  it("raises a scored factor by one level and shows the base score", () => {
    expect(scored([deferral("type-strictness")], "type-strictness")).toMatchObject({
      score: 2,
      baseScore: 1,
      deferral: { applied: true, recorded: "2026-09-01", reason: "migrating to TypeScript in Q1", note: "raised from 1 to 2" },
    });
  });

  it("raises 2 to 3 but never above 3", () => {
    expect(scored([deferral("documented-intent")], "documented-intent")).toMatchObject({ score: 3, baseScore: 2 });
    const atCap = scored([deferral("dev-deploy-simplicity")], "dev-deploy-simplicity");
    expect(atCap).toMatchObject({ score: 4, baseScore: 4, deferral: { applied: false, note: "score 4 is at or above the deferral cap of 3" } });
  });

  it("does not apply an expired deferral, but keeps one due today", () => {
    expect(scored([deferral("type-strictness", { revisitBy: "2026-10-20" })], "type-strictness")).toMatchObject({
      score: 1,
      deferral: { applied: false, note: "expired: revisit date 2026-10-20 has passed" },
    });
    expect(scored([deferral("type-strictness", { revisitBy: "2026-10-21" })], "type-strictness")).toMatchObject({ score: 2 });
  });

  it("does not apply to a factor that is not measured", () => {
    expect(scored([deferral("observability")], "observability")).toMatchObject({
      status: "not-measured",
      score: null,
      deferral: { applied: false, note: "factor not measured" },
    });
  });

  it("can raise the readiness level through a blocking factor", () => {
    const weakTests = collected({ ...results, testsDocs: testsDocsOf({ testFiles: ["test/f0.js"], docs: { readme: ["README.md"] } }) });
    expect(scoreFactors(weakTests, config, { now, deferrals: [deferral("test-feedback")] }).readiness).toMatchObject({ level: 3, setBy: "test-feedback" });
  });
});

describe("checkThresholds", () => {
  const withThresholds = (id: string, thresholds: Record<string, number>): FactorConfig => ({
    version: 1,
    factors: [{ id, name: id, class: "blocking", description: "d", thresholds }],
  });

  it("accepts the default config", () => {
    expect(checkThresholds(config, "factors.json")).toEqual([]);
  });

  it.each([
    ["a missing key", withThresholds("test-feedback", { minRatio3: 0.05, minRatio4: 0.15 }), "factors.json: test-feedback thresholds.minRatio5 is missing"],
    ["descending cut points", withThresholds("test-feedback", { minRatio3: 0.2, minRatio4: 0.15, minRatio5: 0.3 }), "factors.json: test-feedback thresholds minRatio3, minRatio4, minRatio5 must not decrease"],
    ["an unknown key", withThresholds("documented-intent", { minRules3: 3, minRules4: 10, minRules5: 25, minRules6: 50 }), "factors.json: documented-intent thresholds.minRules6 is not used"],
    ["a weight above 1", withThresholds("type-strictness", { minShare2: 0.15, minShare3: 0.4, minShare4: 0.65, minShare5: 0.85, weightStrong: 1.5, weightWeak: 0.75, weightCheckedDynamic: 0.6, weightTypeScriptNonStrict: 0.8 }), "factors.json: type-strictness thresholds.weightStrong must be between 0 and 1"],
    ["fractional months", withThresholds("dependency-currency", { warnMonths: 1.5, eolYears2: 1, eolYears1: 3 }), "factors.json: dependency-currency thresholds.warnMonths must be a whole number"],
  ])("rejects %s", (_label, custom, expected) => {
    expect(checkThresholds(custom, "factors.json")).toContain(expected);
  });
});
