import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AuditReport } from "./model.js";
import { renderSarif } from "./sarif.js";

// The report snapshot: four weak factors, red src/auth, the yellow path src/engine.js.
const report = JSON.parse(readFileSync(new URL("./__snapshots__/sample-report.json", import.meta.url), "utf8")) as AuditReport;
const withYellowModules: AuditReport = {
  ...report,
  zones: {
    ...report.zones,
    modules: [
      ...report.zones.modules,
      { module: "(root)", zone: "yellow", reason: "root needs tests", sourceFiles: 1, redFiles: 0, hotspots: [] },
      { module: "lib/(files)", zone: "yellow", reason: "lib needs tests", sourceFiles: 2, redFiles: 0, hotspots: [] },
    ],
  },
};

const LEVELS = ["none", "note", "warning", "error"];

/** The SARIF 2.1.0 schema's required properties and constraints that this renderer uses; [] when the log meets them. */
function sarifProblems(log: unknown): string[] {
  const problems: string[] = [];
  const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
  if (!object(log)) return ["the log is not an object"];
  if (log.version !== "2.1.0") problems.push("version must be 2.1.0");
  if (typeof log.$schema !== "string") problems.push("$schema should name the 2.1.0 schema");
  if (!Array.isArray(log.runs)) return [...problems, "runs must be an array"];
  log.runs.forEach((run: unknown, r) => {
    if (!object(run) || !object(run.tool) || !object(run.tool.driver)) return problems.push(`runs[${r}].tool.driver is required`);
    const driver = run.tool.driver;
    if (typeof driver.name !== "string" || driver.name === "") problems.push(`runs[${r}].tool.driver.name is required`);
    const rules = Array.isArray(driver.rules) ? driver.rules : [];
    const ids = rules.map((rule: unknown) => (object(rule) ? rule.id : undefined));
    ids.forEach((id, i) => { if (typeof id !== "string") problems.push(`rules[${i}].id is required`); });
    if (new Set(ids).size !== ids.length) problems.push("rule ids must be unique");
    if (!Array.isArray(run.results)) return problems.push(`runs[${r}].results must be an array`);
    run.results.forEach((result: unknown, i) => {
      if (!object(result) || !object(result.message) || typeof result.message.text !== "string") return problems.push(`results[${i}].message.text is required`);
      if (typeof result.level !== "string" || !LEVELS.includes(result.level)) problems.push(`results[${i}].level must be one of ${LEVELS.join(", ")}`);
      if (typeof result.ruleIndex !== "number" || ids[result.ruleIndex] !== result.ruleId) problems.push(`results[${i}].ruleIndex must point at its ruleId`);
      if (result.locations !== undefined) {
        if (!Array.isArray(result.locations)) return problems.push(`results[${i}].locations must be an array`);
        for (const loc of result.locations) {
          const uri = object(loc) && object(loc.physicalLocation) && object(loc.physicalLocation.artifactLocation) ? loc.physicalLocation.artifactLocation.uri : undefined;
          if (typeof uri !== "string" || uri === "" || /\\/.test(uri)) problems.push(`results[${i}] has a location without a forward-slash uri`);
        }
      }
    });
    return undefined;
  });
  return problems;
}

describe("renderSarif", () => {
  it("meets the SARIF 2.1.0 structure, and the validator catches broken logs", () => {
    expect(sarifProblems(JSON.parse(renderSarif(withYellowModules, 2)))).toEqual([]);
    expect(sarifProblems({ version: "2.0.0", runs: [{ tool: { driver: { rules: [{ id: "a" }] } }, results: [{ ruleId: "b", ruleIndex: 0, level: "fatal", message: {} }] }] })).toEqual([
      "version must be 2.1.0",
      "$schema should name the 2.1.0 schema",
      "runs[0].tool.driver.name is required",
      "results[0].message.text is required",
    ]);
  });

  it("has one result per weak factor, yellow module, yellow path and red path, with levels by kind", () => {
    const log = JSON.parse(renderSarif(withYellowModules, 2)) as { runs: { results: { ruleId: string; level: string; message: { text: string }; locations?: { physicalLocation: { artifactLocation: { uri: string } } }[] }[]; tool: { driver: { rules: { id: string }[] } } }[] };
    const run = log.runs[0];
    if (!run) throw new Error("no run");
    const weak = report.factors.filter((f) => f.score !== null && f.score <= 2);
    expect(run.results.map((r) => [r.ruleId, r.level, r.locations?.[0]?.physicalLocation.artifactLocation.uri ?? null])).toEqual([
      ...weak.map((f) => [`factor/${f.id}`, f.class === "blocking" ? "error" : "warning", null]),
      ["zone/yellow-module", "warning", "."],
      ["zone/yellow-module", "warning", "lib/"],
      ["zone/yellow-path", "warning", "src/engine.js"],
      ["zone/red-path", "note", "src/auth/"],
    ]);
    expect(run.tool.driver.rules.map((r) => r.id)).toEqual([...weak.map((f) => `factor/${f.id}`), "zone/yellow-module", "zone/yellow-path", "zone/red-path"]);
    const typeStrictness = run.results.find((r) => r.ruleId === "factor/type-strictness");
    expect(typeStrictness?.message.text).toContain("Evidence: typed share 0.00");
  });

  it("follows weakMax and is deterministic", () => {
    const strict = JSON.parse(renderSarif(report, 1)) as { runs: { results: { ruleId: string }[] }[] };
    expect((strict.runs[0]?.results ?? []).filter((r) => r.ruleId.startsWith("factor/")).length).toBe(report.factors.filter((f) => f.score !== null && f.score <= 1).length);
    expect(renderSarif(report, 2)).toBe(renderSarif(report, 2));
  });

  it("matches the sample snapshot", async () => {
    await expect(renderSarif(report, 2)).toMatchFileSnapshot("./__snapshots__/sample-report.sarif");
  });
});
