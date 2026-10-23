// The scoring engine: one score per configured factor, deferrals applied,
// and the readiness level set by the lowest scored blocking factor. Scores are
// never averaged.

import type { Deferral } from "../config/deferrals.js";
import type { Factor, FactorConfig } from "../config/factors.js";
import type { ModuleSettings } from "../modules.js";
import { RULES, SIGNAL_LESS, type RuleContext } from "./rules.js";
import type { CollectorResults, DeferralOutcome, FactorScore, Readiness, Scoring } from "./types.js";

/** A deferral can lift a score by one level, but never above this. */
export const DEFERRAL_CAP = 3;

export interface ScoringOptions {
  /** The audit date that deferrals and end-of-life dates are compared with. */
  now?: Date;
  deferrals?: readonly Deferral[];
  /** How modules are split, from config/decision.json; module-boundaries is not measured without it. */
  modules?: ModuleSettings;
}

/** Errors for thresholds a factor's rule needs but the config gets wrong. */
export function checkThresholds(config: FactorConfig, source: string): string[] {
  const errors: string[] = [];
  for (const factor of config.factors) {
    const rule = RULES[factor.id];
    if (!rule) continue;
    const thresholds = factor.thresholds ?? {};
    const at = `${source}: ${factor.id} thresholds`;
    for (const key of rule.keys) if (thresholds[key] === undefined) errors.push(`${at}.${key} is missing`);
    for (const key of Object.keys(thresholds)) if (!rule.keys.includes(key)) errors.push(`${at}.${key} is not used`);
    for (const group of rule.ascending ?? []) {
      const values = group.map((key) => thresholds[key]);
      if (values.every((value) => value !== undefined) && values.some((value, index) => index > 0 && (value as number) < (values[index - 1] as number))) {
        errors.push(`${at} ${group.join(", ")} must not decrease`);
      }
    }
    for (const key of rule.unitInterval ?? []) {
      const value = thresholds[key];
      if (value !== undefined && (value < 0 || value > 1)) errors.push(`${at}.${key} must be between 0 and 1`);
    }
    for (const key of rule.wholeNumbers ?? []) {
      const value = thresholds[key];
      if (value !== undefined && !Number.isInteger(value)) errors.push(`${at}.${key} must be a whole number`);
    }
  }
  return errors;
}

function applyDeferral(deferrals: readonly Deferral[], factor: Factor, baseScore: number | null, today: string): { score: number | null; outcome: DeferralOutcome | null } {
  const matching = deferrals.filter((deferral) => deferral.factor === factor.id);
  if (matching.length === 0) return { score: baseScore, outcome: null };
  const current = matching.find((deferral) => deferral.revisitBy === undefined || deferral.revisitBy >= today);
  const chosen = current ?? matching[0];
  if (!chosen) return { score: baseScore, outcome: null };
  const outcome = (applied: boolean, note: string): DeferralOutcome => ({
    recorded: chosen.recorded, reason: chosen.reason, revisitBy: chosen.revisitBy ?? null, applied, note,
  });
  if (baseScore === null) return { score: null, outcome: outcome(false, "factor not measured") };
  if (!current) return { score: baseScore, outcome: outcome(false, `expired: revisit date ${chosen.revisitBy ?? "?"} has passed`) };
  if (baseScore >= DEFERRAL_CAP) return { score: baseScore, outcome: outcome(false, `score ${baseScore} is at or above the deferral cap of ${DEFERRAL_CAP}`) };
  return { score: baseScore + 1, outcome: outcome(true, `raised from ${baseScore} to ${baseScore + 1}`) };
}

function scoreFactor(results: CollectorResults, factor: Factor, today: string, deferrals: readonly Deferral[], context: RuleContext): FactorScore {
  const base = { id: factor.id, name: factor.name, class: factor.class };
  const rule = RULES[factor.id];
  const outcome = rule
    ? rule.score(results, factor.thresholds ?? {}, today, context)
    : { status: "not-measured" as const, reason: SIGNAL_LESS[factor.id] ?? `no scoring rule for factor ${factor.id}` };
  if (outcome.status === "not-measured") {
    return {
      ...base, status: "not-measured", score: null, baseScore: null, rule: null, evidence: [], partial: null,
      reason: outcome.reason, deferral: applyDeferral(deferrals, factor, null, today).outcome,
    };
  }
  const deferred = applyDeferral(deferrals, factor, outcome.score, today);
  return {
    ...base, status: "scored", score: deferred.score, baseScore: outcome.score, rule: outcome.rule, evidence: outcome.evidence,
    partial: outcome.partial ?? null, reason: null, deferral: deferred.outcome,
  };
}

function readinessOf(factors: readonly FactorScore[]): Readiness {
  const blocking = factors.filter((factor) => factor.class === "blocking");
  const unmeasuredBlocking = blocking.filter((factor) => factor.score === null).map((factor) => factor.id);
  let level: number | null = null;
  let setBy: string | null = null;
  for (const factor of blocking) {
    if (factor.score !== null && (level === null || factor.score < level)) {
      level = factor.score;
      setBy = factor.id;
    }
  }
  return { level, setBy, provisional: unmeasuredBlocking.length > 0, unmeasuredBlocking };
}

export function scoreFactors(results: CollectorResults, config: FactorConfig, options: ScoringOptions = {}): Scoring {
  const today = (options.now ?? new Date()).toISOString().slice(0, 10);
  const factors = config.factors.map((factor) => scoreFactor(results, factor, today, options.deferrals ?? [], options.modules ? { modules: options.modules } : {}));
  return { factors, readiness: readinessOf(factors) };
}
