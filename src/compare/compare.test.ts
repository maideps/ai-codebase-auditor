import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AuditReport } from "../report/model.js";
import { compareReports, formatComparison, renderComparisonJson, renderComparisonMarkdown, type Comparison } from "./compare.js";

const base = JSON.parse(readFileSync(new URL("../report/__snapshots__/sample-report.json", import.meta.url), "utf8")) as AuditReport;

function compared(before: AuditReport, after: AuditReport): Comparison {
  const result = compareReports(before, after);
  if (!result.ok) throw new Error(result.errors.join("\n"));
  return result.value;
}

// A later audit: type-strictness 1 → 3, test-feedback 4 → 3, direct-api-calls no longer measured,
// a new yellow module, src/auth no longer red, the yellow path fixed.
const later: AuditReport = {
  ...base,
  auditDate: "2026-12-01",
  target: { ...base.target, head: "f".repeat(40) },
  verdict: { ...base.verdict, verdict: "adopt" },
  readiness: { ...base.readiness, level: 3 },
  factors: base.factors.map((f) =>
    f.id === "type-strictness" ? { ...f, score: 3, rule: "typed share 0.60" }
      : f.id === "test-feedback" ? { ...f, score: 3 }
        : f.id === "direct-api-calls" ? { ...f, score: null, status: "not-measured", rule: null, reason: "no covered language" }
          : f),
  zones: {
    ...base.zones,
    modules: [...base.zones.modules.filter((m) => m.module !== "src/auth"), { module: "lib", zone: "yellow", reason: "r", sourceFiles: 1, redFiles: 0, hotspots: [] }],
    redPaths: [{ path: "lib/billing.rb", kind: "file", term: "billing" }],
    yellowPaths: [],
  },
};

describe("compareReports", () => {
  it("finds nothing changed between a report and itself", () => {
    const c = compared(base, base);
    expect(c.verdict.changed).toBe(false);
    expect(c.factors.every((f) => f.change === "unchanged")).toBe(true);
    expect([c.zones, c.redPaths, c.yellowPaths]).toEqual([[], { added: [], removed: [] }, { added: [], removed: [] }]);
    expect(formatComparison(c)).toContain("Factors changed: none\n");
  });

  it("names raised, lowered and no-longer-measured factors, zone moves, path changes and completed steps", () => {
    const c = compared(base, later);
    expect(c.before.commit).toBe(base.target.head);
    expect(c.after).toEqual({ auditDate: "2026-12-01", commit: "f".repeat(40) });
    expect(c.verdict).toMatchObject({ from: base.verdict.verdict, to: "adopt", changed: true });
    const change = Object.fromEntries(c.factors.map((f) => [f.id, `${f.from}→${f.to} ${f.change}`]));
    expect(change["type-strictness"]).toBe("1→3 raised");
    expect(change["test-feedback"]).toBe("4→3 lowered");
    expect(change["direct-api-calls"]).toBe("2→null no longer measured");
    expect(c.factors.find((f) => f.id === "direct-api-calls")?.ruleAfter).toBe("no covered language");
    expect(c.zones).toEqual([{ module: "lib", from: null, to: "yellow" }, { module: "src/auth", from: "red", to: null }]);
    expect(c.redPaths).toEqual({ added: ["lib/billing.rb"], removed: ["src/auth/"] });
    expect(c.yellowPaths).toEqual({ added: [], removed: ["src/engine.js"] });
    expect(c.roadmapCompleted.map((s) => s.factor)).toContain("type-strictness");
    expect(c.roadmapCompleted.map((s) => s.factor)).not.toContain("dependency-currency");
  });

  it("refuses reports of different repositories", () => {
    expect(compareReports(base, { ...later, target: { ...later.target, path: "/repos/other" } })).toEqual({
      ok: false, errors: ["the reports are of different repositories: /repos/sample and /repos/other"],
    });
  });

  it("renders text, Markdown and JSON with the same facts, deterministically", () => {
    const c = compared(base, later);
    const text = formatComparison(c);
    const markdown = renderComparisonMarkdown(c);
    expect(text).toContain("  type-strictness: 1 → 3 (raised)\n");
    expect(text).toContain("  src/auth: red → not zoned\n");
    expect(markdown).toContain("| type-strictness | 1 | 3 | raised | typed share 0.60 |");
    expect(markdown).toContain("Red paths added: `lib/billing.rb`. Removed: `src/auth/`.");
    expect(JSON.parse(renderComparisonJson(c))).toEqual(c);
    expect(renderComparisonMarkdown(compared(base, later))).toBe(markdown);
  });
});
