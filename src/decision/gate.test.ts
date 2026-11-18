import { describe, expect, it } from "vitest";
import { isFailOn, verdictGate } from "./gate.js";
import type { Verdict, VerdictKind } from "./types.js";

const verdict = (kind: VerdictKind | null, unmeasured: string[] = []): Verdict => ({
  verdict: kind, rule: "r", triggeredBy: [], provisional: unmeasured.length > 0, unmeasuredBlocking: unmeasured,
});

describe("verdictGate", () => {
  it.each([
    ["adopt", "adapt", false],
    ["adapt", "adapt", true],
    ["prepare-first", "adapt", true],
    ["adopt", "prepare-first", false],
    ["adapt", "prepare-first", false],
    ["prepare-first", "prepare-first", true],
  ] as const)("verdict %s with --fail-on %s fails: %s", (kind, failOn, failed) => {
    expect(verdictGate(verdict(kind), failOn)).toEqual({
      failed,
      line: `Verdict gate (--fail-on ${failOn}): ${failed ? "FAIL" : "pass"}, verdict ${kind}`,
    });
  });

  it("says when the verdict is provisional", () => {
    expect(verdictGate(verdict("adopt", ["direct-api-calls"]), "adapt").line).toBe("Verdict gate (--fail-on adapt): pass, verdict adopt (provisional: direct-api-calls not measured)");
  });

  it("fails when there is no verdict", () => {
    expect(verdictGate(verdict(null), "prepare-first")).toEqual({ failed: true, line: "Verdict gate (--fail-on prepare-first): FAIL, no verdict could be reached" });
  });

  it("accepts only adapt and prepare-first", () => {
    expect(["adapt", "prepare-first", "adopt", "x"].map(isFailOn)).toEqual([true, true, false, false]);
  });
});
