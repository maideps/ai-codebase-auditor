// Deferrals: a team's documented, dated decision to live with a gap for now.
// Passed with `audit --deferrals <file>`; the scoring engine raises a deferred
// factor by one level, up to a cap, while the deferral is current.

import { readFileSync } from "node:fs";
import type { Result } from "../result.js";
import type { FactorConfig } from "./factors.js";

export interface Deferral {
  factor: string;
  /** When the deferral was decided, YYYY-MM-DD. */
  recorded: string;
  reason: string;
  /** After this date the deferral no longer applies, YYYY-MM-DD. */
  revisitBy?: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ROOT_KEYS = new Set(["version", "deferrals"]);
const ENTRY_KEYS = new Set(["factor", "recorded", "reason", "revisitBy"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseDeferrals(raw: unknown, source: string): Result<Deferral[]> {
  const errors: string[] = [];
  const report = (message: string) => errors.push(`${source}: ${message}`);
  if (!isRecord(raw)) return { ok: false, errors: [`${source}: must be a JSON object`] };
  for (const key of Object.keys(raw)) if (!ROOT_KEYS.has(key)) report(`unknown key ${key}`);
  if (raw.version !== 1) report("version must be 1");
  if (!Array.isArray(raw.deferrals)) {
    report("deferrals must be an array");
    return { ok: false, errors };
  }
  const deferrals: Deferral[] = [];
  raw.deferrals.forEach((entry: unknown, index) => {
    const at = `deferrals[${index}]`;
    if (!isRecord(entry)) {
      report(`${at} must be an object`);
      return;
    }
    for (const key of Object.keys(entry)) if (!ENTRY_KEYS.has(key)) report(`${at} has unknown key ${key}`);
    const { factor, recorded, reason, revisitBy } = entry;
    let valid = true;
    if (typeof factor !== "string" || !KEBAB_CASE.test(factor)) {
      report(`${at}.factor must be a kebab-case factor id`);
      valid = false;
    }
    if (typeof recorded !== "string" || !DATE.test(recorded)) {
      report(`${at}.recorded must be a YYYY-MM-DD date`);
      valid = false;
    }
    if (typeof reason !== "string" || reason.trim() === "") {
      report(`${at}.reason must be a non-empty string`);
      valid = false;
    }
    if (revisitBy !== undefined) {
      if (typeof revisitBy !== "string" || !DATE.test(revisitBy)) {
        report(`${at}.revisitBy must be a YYYY-MM-DD date`);
        valid = false;
      } else if (typeof recorded === "string" && revisitBy < recorded) {
        report(`${at}.revisitBy is before recorded`);
        valid = false;
      }
    }
    if (valid) {
      const deferral: Deferral = { factor: factor as string, recorded: recorded as string, reason: reason as string };
      if (typeof revisitBy === "string") deferral.revisitBy = revisitBy;
      deferrals.push(deferral);
    }
  });
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: deferrals };
}

/** Errors for deferrals that name a factor the config does not define. */
export function checkDeferralFactors(deferrals: readonly Deferral[], config: FactorConfig, source: string): string[] {
  const ids = new Set(config.factors.map((factor) => factor.id));
  return deferrals.flatMap((deferral, index) =>
    ids.has(deferral.factor) ? [] : [`${source}: deferrals[${index}].factor ${deferral.factor} is not a configured factor`],
  );
}

export function loadDeferrals(filePath: string): Result<Deferral[]> {
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return { ok: false, errors: [`${filePath}: ${code === "ENOENT" ? "file not found" : `cannot read file (${code ?? "unknown error"})`}`] };
  }
  try {
    return parseDeferrals(JSON.parse(text), filePath);
  } catch (error) {
    return { ok: false, errors: [`${filePath}: invalid JSON (${(error as Error).message})`] };
  }
}
