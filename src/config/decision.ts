// Decision configuration: what counts as a weak score, when a module is green,
// how modules are split, and which path terms mark red (proposals-only) code.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Result } from "../result.js";

export interface DecisionConfig {
  version: 1;
  /** A score at or below this is weak. */
  weakMax: number;
  /** The repository's test-feedback base score a module needs to be green. */
  greenMinTestScore: number;
  /** A module holding more than this share of source files is split into its subdirectories. */
  splitShare: number;
  /** Deepest module path, in directory levels. */
  maxDepth: number;
  /** Whole-word path terms that make a path red. */
  redTerms: string[];
}

// config/ sits two levels above both src/config/ and dist/config/.
export const DEFAULT_DECISION_CONFIG_PATH = fileURLToPath(new URL("../../config/decision.json", import.meta.url));

const KEYS = new Set(["version", "weakMax", "greenMinTestScore", "splitShare", "maxDepth", "redTerms"]);
const WORD = /^[a-z0-9]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const wholeIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

export function parseDecisionConfig(raw: unknown, source: string): Result<DecisionConfig> {
  const errors: string[] = [];
  const report = (message: string) => errors.push(`${source}: ${message}`);
  if (!isRecord(raw)) return { ok: false, errors: [`${source}: must be a JSON object`] };
  for (const key of Object.keys(raw)) if (!KEYS.has(key)) report(`unknown key ${key}`);
  if (raw.version !== 1) report("version must be 1");
  if (!wholeIn(raw.weakMax, 1, 4)) report("weakMax must be a whole number from 1 to 4");
  if (!wholeIn(raw.greenMinTestScore, 1, 5)) report("greenMinTestScore must be a whole number from 1 to 5");
  if (typeof raw.splitShare !== "number" || !(raw.splitShare > 0 && raw.splitShare <= 1)) report("splitShare must be above 0 and at most 1");
  if (!wholeIn(raw.maxDepth, 1, Number.MAX_SAFE_INTEGER)) report("maxDepth must be a whole number of at least 1");
  const terms: string[] = [];
  if (!Array.isArray(raw.redTerms) || raw.redTerms.length === 0) report("redTerms must be a non-empty array");
  else {
    raw.redTerms.forEach((term: unknown, index) => {
      if (typeof term !== "string" || !WORD.test(term)) report(`redTerms[${index}] must be a lower-case word`);
      else if (terms.includes(term)) report(`redTerms[${index}] duplicates ${term}`);
      else terms.push(term);
    });
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      version: 1,
      weakMax: raw.weakMax as number,
      greenMinTestScore: raw.greenMinTestScore as number,
      splitShare: raw.splitShare as number,
      maxDepth: raw.maxDepth as number,
      redTerms: terms,
    },
  };
}

export function loadDecisionConfig(filePath: string): Result<DecisionConfig> {
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return { ok: false, errors: [`${filePath}: ${code === "ENOENT" ? "file not found" : `cannot read file (${code ?? "unknown error"})`}`] };
  }
  try {
    return parseDecisionConfig(JSON.parse(text), filePath);
  } catch (error) {
    return { ok: false, errors: [`${filePath}: invalid JSON (${(error as Error).message})`] };
  }
}
