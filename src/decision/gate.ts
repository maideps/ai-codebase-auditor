// The CI verdict gate: --fail-on <adapt|prepare-first> fails when the verdict is at
// or below that level. Pure: the CLI turns a failure into exit code 1.

import type { Verdict, VerdictKind } from "./types.js";

export type FailOn = Exclude<VerdictKind, "adopt">;
export const FAIL_ON_VALUES: readonly FailOn[] = ["adapt", "prepare-first"];

// Higher is better: adopt passes every gate.
const RANK: Record<VerdictKind, number> = { adopt: 3, adapt: 2, "prepare-first": 1 };

export function isFailOn(value: string): value is FailOn {
  return (FAIL_ON_VALUES as readonly string[]).includes(value);
}

export interface GateOutcome {
  failed: boolean;
  /** One line for the summary, naming the verdict and whether it is provisional. */
  line: string;
}

export function verdictGate(verdict: Verdict, failOn: FailOn): GateOutcome {
  const provisional = verdict.provisional ? ` (provisional: ${verdict.unmeasuredBlocking.join(", ")} not measured)` : "";
  if (verdict.verdict === null) {
    return { failed: true, line: `Verdict gate (--fail-on ${failOn}): FAIL, no verdict could be reached` };
  }
  const failed = RANK[verdict.verdict] <= RANK[failOn];
  return { failed, line: `Verdict gate (--fail-on ${failOn}): ${failed ? "FAIL" : "pass"}, verdict ${verdict.verdict}${provisional}` };
}
