// The verdict rules, evaluated in order; the first that applies decides.
//   0. no verdict   test-feedback is not measured
//   1. prepare first  test-feedback is weak and module boundaries are not established
//   2. adapt        any scored factor is weak
//   3. adopt        no scored factor is weak
// Verdicts use final scores, so a current deferral counts.

import type { DecisionConfig } from "../config/decision.js";
import type { FactorScore, Scoring } from "../scoring/types.js";
import type { Verdict } from "./types.js";

const scoreOf = (factor: FactorScore | undefined) => ({ factor: factor?.id ?? "", score: factor?.score ?? null });

export function decideVerdict(scoring: Scoring, config: DecisionConfig): Verdict {
  const { provisional, unmeasuredBlocking } = scoring.readiness;
  const base = { provisional, unmeasuredBlocking };
  const weak = (factor: FactorScore | undefined) => factor?.score !== null && factor?.score !== undefined && factor.score <= config.weakMax;
  const tests = scoring.factors.find((factor) => factor.id === "test-feedback");
  const boundaries = scoring.factors.find((factor) => factor.id === "module-boundaries");

  if (!tests || tests.score === null) {
    return {
      ...base,
      verdict: null,
      rule: `no verdict: test-feedback is ${tests ? `not measured (${tests.reason ?? "no reason"})` : "not configured"}`,
      triggeredBy: [{ factor: "test-feedback", score: null }],
    };
  }

  // Boundaries without a signal count as not established.
  const boundariesMissing = !boundaries || boundaries.score === null || weak(boundaries);
  if (weak(tests) && boundariesMissing) {
    const state = !boundaries || boundaries.score === null ? "not measured" : `weak (${boundaries.score})`;
    return {
      ...base,
      verdict: "prepare-first",
      rule: `test-feedback ${tests.score} ≤ ${config.weakMax} and module boundaries ${state}`,
      triggeredBy: [scoreOf(tests), { factor: "module-boundaries", score: boundaries?.score ?? null }],
    };
  }

  const weakFactors = scoring.factors.filter(weak);
  if (weakFactors.length > 0) {
    return {
      ...base,
      verdict: "adapt",
      rule: `${weakFactors.length} weak factor${weakFactors.length === 1 ? "" : "s"} (score ≤ ${config.weakMax}): ${weakFactors.map((f) => `${f.id} ${f.score ?? "?"}`).join(", ")}`,
      triggeredBy: weakFactors.map(scoreOf),
    };
  }

  return {
    ...base,
    verdict: "adopt",
    rule: `no scored factor is weak (all ≥ ${config.weakMax + 1})`,
    triggeredBy: scoring.factors.filter((factor) => factor.class === "blocking" && factor.score !== null).map(scoreOf),
  };
}
