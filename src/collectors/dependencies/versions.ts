// Version-spec handling for declared runtimes: the lowest version a spec
// allows, and the end-of-life cycle that version belongs to.

import type { Runtime } from "../../config/runtime-eol.js";

const VERSION = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/;
const NO_LOWER_BOUND = /^(?:<|<=|!=)/;
const LOWER_BOUND_OPERATOR = /^(?:>=|>|\^|~>|~=|~|===|==|=)/;

function compare(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

// The version a single clause guarantees as a minimum, or null.
function clauseLowerBound(clause: string): number[] | null {
  if (clause === "" || NO_LOWER_BOUND.test(clause)) return null;
  const match = VERSION.exec(clause.replace(LOWER_BOUND_OPERATOR, ""));
  if (!match) return null;
  return match.slice(1).filter((part): part is string => part !== undefined).map(Number);
}

/**
 * The lowest version a spec allows, keeping the parts it states ("3.7",
 * "14.0.0"). Alternatives (`||`, `|`) take the lowest; clauses joined by
 * commas or spaces take the highest lower bound. Null when nothing bounds
 * the spec from below (`*`, `latest`, `<4`).
 */
export function lowestVersion(spec: string): string | null {
  let lowest: number[] | null = null;
  for (const alternative of spec.split(/\|\|?/)) {
    // Glue operators to their versions so ">= 14.0.0 <20" splits into clauses.
    const clauses = alternative.replace(/(>=|<=|===|==|!=|~=|~>|>|<|\^|~|=)\s+/g, "$1").trim().split(/[\s,]+/);
    let bound: number[] | null = null;
    for (const clause of clauses) {
      const candidate = clauseLowerBound(clause);
      if (candidate && (!bound || compare(candidate, bound) > 0)) bound = candidate;
    }
    if (bound && (!lowest || compare(bound, lowest) < 0)) lowest = bound;
  }
  return lowest ? lowest.join(".") : null;
}

/**
 * The end-of-life cycle of a version: the major for Node.js and Java (Java
 * "1.8" is 8; versions before 5 keep the "1.x" name), major.minor for
 * Python, PHP and Ruby. Null when the version is too coarse.
 */
export function cycleFor(runtime: Runtime, version: string): string | null {
  const [major, minor] = version.split(".").map(Number);
  if (major === undefined || Number.isNaN(major)) return null;
  if (runtime === "node") return String(major);
  if (runtime === "java") {
    if (major !== 1) return String(major);
    if (minor === undefined) return null;
    return minor >= 5 ? String(minor) : `1.${minor}`;
  }
  return minor === undefined ? null : `${major}.${minor}`;
}
