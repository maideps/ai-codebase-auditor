import { describe, expect, it } from "vitest";
import { DEFAULT_DECISION_CONFIG_PATH, loadDecisionConfig } from "../config/decision.js";
import { DEFAULT_CONFIG_PATH, loadFactorConfig } from "../config/factors.js";
import { DEFAULT_HARNESS_REQUIREMENTS_PATH, loadHarnessRequirements } from "../config/harness-requirements.js";
import { DEFAULT_EOL_TABLE_PATH, loadRuntimeEolTable } from "../config/runtime-eol.js";
import { decide } from "../decision/decide.js";
import { buildPlan } from "../plan/plan.js";
import { buildRoadmap } from "../plan/roadmap.js";
import { scoreFactors } from "../scoring/score.js";
import { collected, dependenciesOf, notMeasured, sourceFiles, structureOf, testsDocsOf } from "../testing/collected.js";
import { renderJson } from "./json.js";
import { cell, renderMarkdown } from "./markdown.js";
import { buildReport, type ReportInput } from "./model.js";

const factors = loadFactorConfig(DEFAULT_CONFIG_PATH);
const decisionConfig = loadDecisionConfig(DEFAULT_DECISION_CONFIG_PATH);
const requirements = loadHarnessRequirements(DEFAULT_HARNESS_REQUIREMENTS_PATH);
const eolTable = loadRuntimeEolTable(DEFAULT_EOL_TABLE_PATH);
if (!factors.ok || !decisionConfig.ok || !requirements.ok || !eolTable.ok) throw new Error("default config does not load");
const requirementValues = requirements.value;
const eolValues = eolTable.value;
const factorConfig = factors.value;
const decisionValues = decisionConfig.value;
const now = new Date("2026-10-22T09:00:00Z");

// A fixed, git-free audit: tested JavaScript with an auth directory, an end-of-life runtime and an unsupported manifest.
function sampleInput(): ReportInput {
  const results = collected({
    structure: structureOf(
      [...sourceFiles(6, "js", 40), { path: "src/auth/login.js", lines: 30 }, ...sourceFiles(3, "js", 5, "test")],
      [{ path: "package-lock.json", reason: "generated" }],
    ),
    testsDocs: testsDocsOf({
      testFiles: sourceFiles(3, "js", 5, "test").map((file) => file.path),
      runners: ["jest.config.js"],
      ci: [".github/workflows/ci.yml"],
      docs: { readme: ["README.md"], agentContext: ["AGENTS.md"] },
      rules: [{ path: "AGENTS.md", count: 2 }],
    }),
    dependencies: dependenciesOf([{ spec: ">=14", lowest: "14", cycle: "14", status: "end-of-life", eol: "2023-04-30" }]),
  });
  if (results.dependencies.status === "measured") results.dependencies.value.notMeasured.push({ path: "go.mod", reason: "not a supported manifest" });
  const scoring = scoreFactors(results, factorConfig, { now });
  const decision = decide(scoring, results, factorConfig, decisionValues);
  return {
    tool: { name: "ai-codebase-auditor", version: "0.1.0" },
    auditDate: "2026-10-22",
    targetPath: "/repos/sample",
    inputs: {
      factorConfig: "/tool/config/factors.json",
      decisionConfig: "/tool/config/decision.json",
      eolTable: { path: "/tool/config/runtime-eol.json", asOf: "2026-10-21" },
      deferrals: null,
      harnessRequirements: "/tool/config/harness-requirements.json",
    },
    collected: results,
    scoring,
    decision,
    plan: buildPlan({ scoring, decision, results, requirements: requirementValues, weakMax: decisionValues.weakMax }),
    roadmap: buildRoadmap({ scoring, results, factors: factorConfig, decisionConfig: decisionValues, eolTable: eolValues, auditDate: "2026-10-22" }),
  };
}

describe("report model", () => {
  it("carries the verdict, readiness, every factor and the not-measured items", () => {
    const report = buildReport(sampleInput());
    expect(report.schema).toBe("ai-codebase-auditor/report");
    expect(report.schemaVersion).toBe(3);
    expect(report.target).toEqual({ path: "/repos/sample", head: "0123456789abcdef0123456789abcdef01234567" });
    expect(report.inputs.eolTable).toEqual({ path: "/tool/config/runtime-eol.json", asOf: "2026-10-21", ageDays: 1 });
    expect(report.verdict.verdict).toBe("adapt");
    expect(report.factors.map((factor) => factor.id)).toEqual(factorConfig.factors.map((factor) => factor.id));
    expect(report.notMeasured).toEqual([
      { kind: "factor", id: "direct-api-calls", reason: "no collector signal yet: needs call-site analysis" },
      { kind: "factor", id: "module-boundaries", reason: "no collector signal yet: needs an import graph or co-change coupling" },
      { kind: "factor", id: "observability", reason: "no collector signal yet: needs a logging and metrics detector" },
      { kind: "manifest", id: "go.mod", reason: "not a supported manifest" },
      { kind: "tool", id: "scc", reason: "test" },
    ]);
  });

  it("lists collectors that could not run as not measured", () => {
    const input = sampleInput();
    input.collected.history = notMeasured("shallow clone: history is incomplete");
    const report = buildReport(input);
    expect(report.target.head).toBeNull();
    expect(report.signals.gitHistory).toEqual({ status: "not-measured", reason: "shallow clone: history is incomplete" });
    expect(report.notMeasured).toContainEqual({ kind: "collector", id: "git-history", reason: "shallow clone: history is incomplete" });
  });
});

describe("renderers", () => {
  it("renders the JSON report", async () => {
    await expect(renderJson(buildReport(sampleInput()))).toMatchFileSnapshot("./__snapshots__/sample-report.json");
  });

  it("renders the Markdown report", async () => {
    await expect(renderMarkdown(buildReport(sampleInput()))).toMatchFileSnapshot("./__snapshots__/sample-report.md");
  });

  it("is deterministic: two builds of the same input render identical bytes", () => {
    expect(renderJson(buildReport(sampleInput()))).toBe(renderJson(buildReport(sampleInput())));
    expect(renderMarkdown(buildReport(sampleInput()))).toBe(renderMarkdown(buildReport(sampleInput())));
  });

  it("puts the same content in both formats", () => {
    const report = buildReport(sampleInput());
    const markdown = renderMarkdown(report);
    const json = JSON.parse(renderJson(report)) as typeof report;
    expect(markdown).toContain(cell(json.verdict.rule));
    for (const factor of json.factors) {
      expect(markdown).toContain(`### ${factor.id}: ${factor.name}`);
      for (const line of factor.evidence) expect(markdown).toContain(line);
    }
    for (const item of json.notMeasured) expect(markdown).toContain(item.reason);
    for (const red of json.zones.redPaths) expect(markdown).toContain(red.path);
    expect(json.plan.items.length).toBeGreaterThan(0);
    for (const item of json.plan.items) {
      expect(markdown).toContain(`### ${item.level}: ${item.id}`);
      for (const detail of item.details) expect(markdown).toContain(detail);
    }
    expect(json.roadmap.length).toBeGreaterThan(0);
    for (const step of json.roadmap) expect(markdown).toContain(cell(step.action));
  });

  it("ends both files with a single LF and uses no CR", () => {
    const report = buildReport(sampleInput());
    for (const text of [renderJson(report), renderMarkdown(report)]) {
      expect(text.endsWith("\n")).toBe(true);
      expect(text.endsWith("\n\n")).toBe(false);
      expect(text.includes("\r")).toBe(false);
    }
  });
});

describe("cell", () => {
  it("escapes pipes and flattens newlines so a table row stays intact", () => {
    expect(cell("a|b\nc\r\nd")).toBe("a\\|b c d");
  });
});
