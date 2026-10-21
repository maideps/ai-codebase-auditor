import { describe, expect, it } from "vitest";
import { DEFAULT_DECISION_CONFIG_PATH, loadDecisionConfig } from "../config/decision.js";
import type { FactorScore, Scoring } from "../scoring/types.js";
import { decideVerdict } from "./verdict.js";

const loaded = loadDecisionConfig(DEFAULT_DECISION_CONFIG_PATH);
if (!loaded.ok) throw new Error(loaded.errors.join("\n"));
const config = loaded.value;

const BLOCKING = new Set(["test-feedback", "type-strictness", "direct-api-calls"]);

// A scoring result from factor scores; null means not measured.
function scoringOf(scores: Record<string, number | null>): Scoring {
  const factors: FactorScore[] = Object.entries(scores).map(([id, score]) => ({
    id, name: id, class: BLOCKING.has(id) ? "blocking" : "constraining",
    status: score === null ? "not-measured" : "scored", score, baseScore: score,
    rule: score === null ? null : "r", evidence: [], partial: null, reason: score === null ? `${id} reason` : null, deferral: null,
  }));
  const blocking = factors.filter((factor) => factor.class === "blocking");
  const scored = blocking.filter((factor) => factor.score !== null);
  const unmeasuredBlocking = blocking.filter((factor) => factor.score === null).map((factor) => factor.id);
  const lowest = scored.reduce<FactorScore | null>((low, factor) => (low === null || (factor.score ?? 6) < (low.score ?? 6) ? factor : low), null);
  return { factors, readiness: { level: lowest?.score ?? null, setBy: lowest?.id ?? null, provisional: unmeasuredBlocking.length > 0, unmeasuredBlocking } };
}

const healthy = { "test-feedback": 4, "type-strictness": 4, "direct-api-calls": null, "file-size": 4, "module-boundaries": null, "documented-intent": 3 };

describe("decideVerdict", () => {
  it("gives no verdict when test-feedback is not measured", () => {
    expect(decideVerdict(scoringOf({ ...healthy, "test-feedback": null }), config)).toEqual({
      verdict: null,
      rule: "no verdict: test-feedback is not measured (test-feedback reason)",
      triggeredBy: [{ factor: "test-feedback", score: null }],
      provisional: true,
      unmeasuredBlocking: ["test-feedback", "direct-api-calls"],
    });
  });

  it.each([
    ["no tests", 1],
    ["weak tests", 2],
  ])("prepares first with %s and boundaries not measured", (_label, testScore) => {
    expect(decideVerdict(scoringOf({ ...healthy, "test-feedback": testScore }), config)).toMatchObject({
      verdict: "prepare-first",
      rule: `test-feedback ${testScore} ≤ 2 and module boundaries not measured`,
      triggeredBy: [{ factor: "test-feedback", score: testScore }, { factor: "module-boundaries", score: null }],
    });
  });

  it("prepares first when measured boundaries are weak too", () => {
    expect(decideVerdict(scoringOf({ ...healthy, "test-feedback": 2, "module-boundaries": 2 }), config)).toMatchObject({
      verdict: "prepare-first",
      rule: "test-feedback 2 ≤ 2 and module boundaries weak (2)",
    });
  });

  it("adapts instead of preparing when tests are weak but measured boundaries are sound", () => {
    expect(decideVerdict(scoringOf({ ...healthy, "test-feedback": 2, "module-boundaries": 3 }), config)).toMatchObject({
      verdict: "adapt",
      triggeredBy: [{ factor: "test-feedback", score: 2 }],
    });
  });

  it("adapts on any weak factor, blocking or constraining, listing each", () => {
    expect(decideVerdict(scoringOf({ ...healthy, "type-strictness": 2, "documented-intent": 1 }), config)).toEqual({
      verdict: "adapt",
      rule: "2 weak factors (score ≤ 2): type-strictness 2, documented-intent 1",
      triggeredBy: [{ factor: "type-strictness", score: 2 }, { factor: "documented-intent", score: 1 }],
      provisional: true,
      unmeasuredBlocking: ["direct-api-calls"],
    });
  });

  it("adopts at score 3 everywhere, naming the blocking scores, provisional while a blocking factor is unmeasured", () => {
    expect(decideVerdict(scoringOf({ ...healthy, "test-feedback": 3, "type-strictness": 3, "file-size": 3 }), config)).toEqual({
      verdict: "adopt",
      rule: "no scored factor is weak (all ≥ 3)",
      triggeredBy: [{ factor: "test-feedback", score: 3 }, { factor: "type-strictness", score: 3 }],
      provisional: true,
      unmeasuredBlocking: ["direct-api-calls"],
    });
  });

  it("adopts without the provisional mark when every blocking factor is measured", () => {
    expect(decideVerdict(scoringOf({ ...healthy, "direct-api-calls": 5 }), config)).toMatchObject({ verdict: "adopt", provisional: false, unmeasuredBlocking: [] });
  });

  it("uses scores after deferrals", () => {
    const scoring = scoringOf({ ...healthy, "type-strictness": 3 });
    const deferred = scoring.factors.find((factor) => factor.id === "type-strictness");
    if (deferred) deferred.baseScore = 2;
    expect(decideVerdict(scoring, config).verdict).toBe("adopt");
  });
});
