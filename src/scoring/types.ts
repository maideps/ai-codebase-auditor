// Scoring inputs and outputs. Scoring is pure: it reads collector results and
// configuration, never the repository.

import type { CodeStructure } from "../collectors/code-structure.js";
import type { Dependencies } from "../collectors/dependencies.js";
import type { DynamicCalls } from "../collectors/dynamic-calls.js";
import type { GitHistory } from "../collectors/git-history.js";
import type { TestsDocs } from "../collectors/tests-docs.js";
import type { Measurement } from "../collectors/types.js";
import type { FactorClass } from "../config/factors.js";

export interface CollectorResults {
  history: Measurement<GitHistory>;
  structure: Measurement<CodeStructure>;
  testsDocs: Measurement<TestsDocs>;
  dependencies: Measurement<Dependencies>;
  dynamicCalls: Measurement<DynamicCalls>;
}

export interface DeferralOutcome {
  recorded: string;
  reason: string;
  revisitBy: string | null;
  applied: boolean;
  /** What the deferral did, or why it did nothing. */
  note: string;
}

export interface FactorScore {
  id: string;
  name: string;
  class: FactorClass;
  status: "scored" | "not-measured";
  /** Final score 1-5 after any deferral; null when not measured. */
  score: number | null;
  /** Score from the evidence alone, before any deferral. */
  baseScore: number | null;
  /** The rule that produced the score, in words. */
  rule: string | null;
  /** The collector values behind the score. */
  evidence: string[];
  /** What part of the factor the score does not cover. */
  partial: string | null;
  /** Why the factor is not measured. */
  reason: string | null;
  deferral: DeferralOutcome | null;
}

export interface Readiness {
  /** The lowest score among scored blocking factors; null when none is scored. */
  level: number | null;
  /** The blocking factor that set the level (first in config order on a tie). */
  setBy: string | null;
  /** True while any blocking factor is not measured. */
  provisional: boolean;
  unmeasuredBlocking: string[];
}

export interface Scoring {
  factors: FactorScore[];
  readiness: Readiness;
}
