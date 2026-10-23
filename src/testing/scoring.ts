// Test-only builder for scoring results from plain factor scores, using the
// default factor config's classes and names. Excluded from the build.

import { DEFAULT_CONFIG_PATH, loadFactorConfig } from "../config/factors.js";
import type { FactorScore, Scoring } from "../scoring/types.js";

const loaded = loadFactorConfig(DEFAULT_CONFIG_PATH);
if (!loaded.ok) throw new Error(loaded.errors.join("\n"));
const factors = loaded.value.factors;

/** Scores for the given factors; others are not measured. null means not measured. */
export function scoringOf(scores: Record<string, number | null>, evidence: Record<string, string[]> = {}): Scoring {
  const list: FactorScore[] = factors.map((factor) => {
    const score = scores[factor.id] ?? null;
    return {
      id: factor.id, name: factor.name, class: factor.class,
      status: score === null ? "not-measured" : "scored", score, baseScore: score,
      rule: score === null ? null : "rule", evidence: evidence[factor.id] ?? [], partial: null,
      reason: score === null ? `${factor.id} not measured` : null, deferral: null,
    };
  });
  const blocking = list.filter((factor) => factor.class === "blocking");
  const scored = blocking.filter((factor) => factor.score !== null);
  const lowest = scored.reduce<FactorScore | null>((low, factor) => (low === null || (factor.score ?? 6) < (low.score ?? 6) ? factor : low), null);
  const unmeasuredBlocking = blocking.filter((factor) => factor.score === null).map((factor) => factor.id);
  return { factors: list, readiness: { level: lowest?.score ?? null, setBy: lowest?.id ?? null, provisional: unmeasuredBlocking.length > 0, unmeasuredBlocking } };
}
