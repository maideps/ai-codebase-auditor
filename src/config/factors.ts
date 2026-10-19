// Factor configuration: which readiness factors exist and which are blocking.
// Kept in a file so a team can tune it; thresholds join the schema with the
// scoring engine (feat-006).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Result } from "../result.js";

export type FactorClass = "blocking" | "constraining";

export interface Factor {
  id: string;
  name: string;
  class: FactorClass;
  description: string;
}

export interface FactorConfig {
  version: 1;
  factors: Factor[];
}

// config/ sits two levels above both src/config/ and dist/config/.
export const DEFAULT_CONFIG_PATH = fileURLToPath(new URL("../../config/factors.json", import.meta.url));

const ROOT_KEYS = new Set(["version", "factors"]);
const FACTOR_KEYS = new Set(["id", "name", "class", "description"]);
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseFactorConfig(raw: unknown, source: string): Result<FactorConfig> {
  const errors: string[] = [];
  const report = (message: string) => errors.push(`${source}: ${message}`);

  if (!isRecord(raw)) {
    report("must be a JSON object");
    return { ok: false, errors };
  }
  for (const key of Object.keys(raw)) {
    if (!ROOT_KEYS.has(key)) report(`unknown key ${key}`);
  }
  if (raw.version !== 1) report("version must be 1");
  if (!Array.isArray(raw.factors) || raw.factors.length === 0) {
    report("factors must be a non-empty array");
    return { ok: false, errors };
  }

  const factors: Factor[] = [];
  const seenIds = new Set<string>();
  raw.factors.forEach((entry: unknown, index) => {
    const at = `factors[${index}]`;
    if (!isRecord(entry)) {
      report(`${at} must be an object`);
      return;
    }
    for (const key of Object.keys(entry)) {
      if (!FACTOR_KEYS.has(key)) report(`${at} has unknown key ${key}`);
    }
    const { id, name, description } = entry;
    const factorClass = entry.class;
    let valid = true;
    if (typeof id !== "string" || !KEBAB_CASE.test(id)) {
      report(`${at}.id must be a kebab-case string`);
      valid = false;
    } else if (seenIds.has(id)) {
      report(`${at}.id duplicates ${id}`);
      valid = false;
    } else {
      seenIds.add(id);
    }
    if (!isNonEmptyString(name)) {
      report(`${at}.name must be a non-empty string`);
      valid = false;
    }
    if (factorClass !== "blocking" && factorClass !== "constraining") {
      report(`${at}.class must be "blocking" or "constraining"`);
      valid = false;
    }
    if (!isNonEmptyString(description)) {
      report(`${at}.description must be a non-empty string`);
      valid = false;
    }
    if (valid) {
      factors.push({
        id: id as string,
        name: name as string,
        class: factorClass as FactorClass,
        description: description as string,
      });
    }
  });

  // The readiness level is set by the lowest blocking factor, so one must exist.
  const anyBlocking = raw.factors.some((entry: unknown) => isRecord(entry) && entry.class === "blocking");
  if (!anyBlocking) report("at least one factor must be blocking");

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: { version: 1, factors } };
}

export function loadFactorConfig(filePath: string): Result<FactorConfig> {
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return { ok: false, errors: [`${filePath}: ${code === "ENOENT" ? "file not found" : `cannot read file (${code ?? "unknown error"})`}`] };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { ok: false, errors: [`${filePath}: invalid JSON (${(error as Error).message})`] };
  }
  return parseFactorConfig(raw, filePath);
}
