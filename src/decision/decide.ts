// The decision engine's entry point: verdict plus risk zones.

import type { DecisionConfig } from "../config/decision.js";
import type { FactorConfig } from "../config/factors.js";
import type { CollectorResults, Scoring } from "../scoring/types.js";
import type { Decision } from "./types.js";
import { decideVerdict } from "./verdict.js";
import { assignZones } from "./zones.js";

export function decide(scoring: Scoring, results: CollectorResults, factors: FactorConfig, config: DecisionConfig): Decision {
  return { verdict: decideVerdict(scoring, config), zones: assignZones(scoring, results, factors, config) };
}
