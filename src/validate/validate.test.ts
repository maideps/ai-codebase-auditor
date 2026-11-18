import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AuditReport } from "../report/model.js";
import { formatValidation, parseOutcomes, renderValidationJson, renderValidationMarkdown, validateZones, wilson, type Outcomes, type OutcomeTask } from "./validate.js";

// The report snapshot: green src/(files) with the yellow path src/engine.js, red src/auth.
const report = JSON.parse(readFileSync(new URL("../report/__snapshots__/sample-report.json", import.meta.url), "utf8")) as AuditReport;

const task = (id: string, files: string[], passed: boolean, extra: Partial<OutcomeTask> = {}): OutcomeTask => ({ id, filesChanged: files, passed, model: "m1", harness: "h1", ...extra });
const tasks = (prefix: string, files: string[], passed: number, failed: number) => [
  ...Array.from({ length: passed }, (_, i) => task(`${prefix}-p${i}`, files, true)),
  ...Array.from({ length: failed }, (_, i) => task(`${prefix}-f${i}`, files, false)),
];

describe("parseOutcomes", () => {
  const valid = { schema: "ai-codebase-auditor/outcomes", schemaVersion: 1, runner: "probe 0.1", tasks: [{ id: "t1", filesChanged: ["src/f1.js"], passed: true, model: "m", harness: "h" }] };

  it("accepts the documented schema, with model, harness and runner optional", () => {
    expect(parseOutcomes(valid, "o.json")).toEqual({ ok: true, value: { runner: "probe 0.1", tasks: [{ id: "t1", filesChanged: ["src/f1.js"], passed: true, model: "m", harness: "h" }] } });
    const bare = { ...valid, runner: undefined, tasks: [{ id: "t1", filesChanged: ["a"], passed: false }] };
    expect(parseOutcomes(bare, "o.json")).toEqual({ ok: true, value: { runner: null, tasks: [{ id: "t1", filesChanged: ["a"], passed: false, model: null, harness: null }] } });
  });

  it.each([
    [{ ...valid, schema: "x" }, 'o.json: schema must be "ai-codebase-auditor/outcomes"'],
    [{ ...valid, schemaVersion: 2 }, "o.json: schemaVersion must be 1"],
    [{ ...valid, tasks: [] }, "o.json: tasks must be a non-empty array"],
    [{ ...valid, tasks: [{ id: "", filesChanged: ["a"], passed: true }] }, "o.json: tasks[0].id must be a non-empty string"],
    [{ ...valid, tasks: [{ id: "a", filesChanged: ["x"], passed: true }, { id: "a", filesChanged: ["x"], passed: true }] }, "o.json: tasks[1].id duplicates a"],
    [{ ...valid, tasks: [{ id: "a", filesChanged: [], passed: true }] }, "o.json: tasks[0].filesChanged must be a non-empty array of paths"],
    [{ ...valid, tasks: [{ id: "a", filesChanged: ["x"], passed: "yes" }] }, "o.json: tasks[0].passed must be true or false"],
  ])("rejects %j", (raw, error) => {
    const result = parseOutcomes(raw, "o.json");
    expect(result.ok ? [] : result.errors).toContain(error);
  });
});

describe("wilson", () => {
  it("gives the 95% Wilson interval, clamped to [0, 1]", () => {
    expect(wilson(8, 10)).toEqual([0.49, 0.943]);
    expect(wilson(0, 5)).toEqual([0, 0.434]);
    expect(wilson(5, 5)).toEqual([0.566, 1]);
    expect(wilson(0, 0)).toEqual([0, 1]);
  });
});

describe("validateZones", () => {
  it("counts each task in the zone of its riskiest file, and finds the ordering held", () => {
    const outcomes: Outcomes = {
      runner: "probe",
      tasks: [
        ...tasks("g", ["src/f1.js", "test/f1.test.js"], 9, 1),
        ...tasks("y", ["src/engine.js", "src/f2.js"], 3, 2),
        ...tasks("r", ["src/auth/login.js", "src/f3.js"], 1, 4),
      ],
    };
    const v = validateZones(report, outcomes);
    expect(v.byZone.map((z) => [z.zone, z.tasks, z.passed, z.rate])).toEqual([["green", 10, 9, 0.9], ["yellow", 5, 3, 0.6], ["red", 5, 1, 0.2], ["unzoned", 0, 0, null]]);
    expect(v.overall).toMatchObject({ zone: "all", tasks: 20, passed: 13, rate: 0.65 });
    expect(v.ordering).toEqual({ status: "holds", detail: "green 0.9 ≥ yellow 0.6 ≥ red 0.2" });
    expect(v.redTasks.map((t) => t.id)).toEqual(["r-f0", "r-f1", "r-f2", "r-f3", "r-p0"]);
    expect(v.redTasks[0]?.redFiles).toEqual(["src/auth/login.js"]);
    expect(v.unzonedPaths).toEqual([{ path: "test/f1.test.js", tasks: tasks("g", [], 9, 1).map((t) => t.id).sort() }]);
  });

  it("says when the ordering does not hold, naming the pair", () => {
    const v = validateZones(report, { runner: null, tasks: [...tasks("g", ["src/f1.js"], 2, 3), ...tasks("r", ["src/auth/x.js"], 4, 1)] });
    expect(v.ordering).toEqual({ status: "does not hold", detail: "red 0.8 > green 0.4" });
  });

  it("gives counts without rates for zones with too few tasks, and no ordering with fewer than two rated zones", () => {
    const v = validateZones(report, { runner: null, tasks: [...tasks("g", ["src/f1.js"], 4, 1), ...tasks("r", ["src/auth/x.js"], 1, 2)] });
    expect(v.byZone.find((z) => z.zone === "red")).toMatchObject({ tasks: 3, passed: 1, rate: null, interval: null });
    expect(v.ordering.status).toBe("not enough data");
    expect(formatValidation(v)).toContain("red      1 of 3 passed (too few tasks for a rate; 5 needed)");
  });

  it("counts tasks that change only unknown paths as unzoned, and notes mixed models", () => {
    const v = validateZones(report, { runner: null, tasks: [task("a", ["nowhere/x.py"], true), task("b", ["src/f1.js"], false, { model: "m2" })] });
    expect(v.byZone.find((z) => z.zone === "unzoned")).toMatchObject({ tasks: 1, passed: 1 });
    expect(v.unzonedPaths).toEqual([{ path: "nowhere/x.py", tasks: ["a"] }]);
    expect(v.models).toEqual(["m1", "m2"]);
    expect(formatValidation(v)).toContain("Note: the tasks mix 2 models and 1 harnesses");
  });

  it("renders Markdown and JSON with the same facts", () => {
    const v = validateZones(report, { runner: "probe", tasks: tasks("g", ["src/f1.js"], 5, 0) });
    expect(renderValidationMarkdown(v)).toContain("| green | 5 | 5 | 1 (0.566–1) |");
    expect(renderValidationMarkdown(v)).toContain("| all | 5 | 5 | 1 (0.566–1) |");
    expect(JSON.parse(renderValidationJson(v))).toEqual(v);
  });
});
