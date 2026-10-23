// Harness requirements: what one agent harness assumes about a repository,
// tied to audit factors, with the adaptation to make when an assumption does
// not hold. A separate file, so a team using another harness can replace it.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Result } from "../result.js";
import type { FactorConfig } from "./factors.js";

export interface HarnessRequirement {
  id: string;
  /** The factor whose score decides whether the assumption holds. */
  factor: string;
  assumption: string;
  /** Harness files and settings the adaptation changes. */
  surfaces: string[];
  /** The change when the factor is weak. */
  required: string;
  /** The change when the factor is borderline. */
  recommended: string;
  why: string;
}

export interface GuardrailText {
  surfaces: string[];
  change: string;
  why: string;
}

export interface HarnessRequirements {
  version: 1;
  harness: { name: string; version: string; commit?: string; note?: string };
  requirements: HarnessRequirement[];
  /** Applies when the harness would not detect the repository's main language; cites this factor. */
  stackDetection: GuardrailText & { factor: string };
  zones: { red: GuardrailText; yellow: GuardrailText };
}

// config/ sits two levels above both src/config/ and dist/config/.
export const DEFAULT_HARNESS_REQUIREMENTS_PATH = fileURLToPath(new URL("../../config/harness-requirements.json", import.meta.url));

const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REQUIREMENT_KEYS = new Set(["id", "factor", "assumption", "surfaces", "required", "recommended", "why"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const isTextList = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0 && value.every(isText);

export function parseHarnessRequirements(raw: unknown, source: string): Result<HarnessRequirements> {
  const errors: string[] = [];
  const report = (message: string) => errors.push(`${source}: ${message}`);
  if (!isRecord(raw)) return { ok: false, errors: [`${source}: must be a JSON object`] };
  for (const key of Object.keys(raw)) if (!["version", "harness", "requirements", "stackDetection", "zones"].includes(key)) report(`unknown key ${key}`);
  if (raw.version !== 1) report("version must be 1");

  const harness = raw.harness;
  if (!isRecord(harness)) report("harness must be an object");
  else {
    if (!isText(harness.name)) report("harness.name must be a non-empty string");
    if (!isText(harness.version)) report("harness.version must be a non-empty string");
    for (const key of ["commit", "note"]) if (harness[key] !== undefined && !isText(harness[key])) report(`harness.${key} must be a non-empty string`);
  }

  const requirements: HarnessRequirement[] = [];
  if (!Array.isArray(raw.requirements) || raw.requirements.length === 0) report("requirements must be a non-empty array");
  else {
    const seen = new Set<string>();
    raw.requirements.forEach((entry: unknown, index) => {
      const at = `requirements[${index}]`;
      if (!isRecord(entry)) {
        report(`${at} must be an object`);
        return;
      }
      for (const key of Object.keys(entry)) if (!REQUIREMENT_KEYS.has(key)) report(`${at} has unknown key ${key}`);
      let valid = true;
      if (typeof entry.id !== "string" || !KEBAB_CASE.test(entry.id)) {
        report(`${at}.id must be a kebab-case id`);
        valid = false;
      } else if (seen.has(entry.id)) {
        report(`${at}.id duplicates ${entry.id}`);
        valid = false;
      } else seen.add(entry.id);
      if (typeof entry.factor !== "string" || !KEBAB_CASE.test(entry.factor)) {
        report(`${at}.factor must be a kebab-case factor id`);
        valid = false;
      }
      if (!isTextList(entry.surfaces)) {
        report(`${at}.surfaces must be a non-empty list of strings`);
        valid = false;
      }
      for (const key of ["assumption", "required", "recommended", "why"]) {
        if (!isText(entry[key])) {
          report(`${at}.${key} must be a non-empty string`);
          valid = false;
        }
      }
      if (valid) requirements.push(entry as unknown as HarnessRequirement);
    });
  }

  const guardrail = (value: unknown, at: string): boolean => {
    if (!isRecord(value)) {
      report(`${at} must be an object`);
      return false;
    }
    let valid = true;
    if (!isTextList(value.surfaces)) {
      report(`${at}.surfaces must be a non-empty list of strings`);
      valid = false;
    }
    for (const key of ["change", "why"]) {
      if (!isText(value[key])) {
        report(`${at}.${key} must be a non-empty string`);
        valid = false;
      }
    }
    return valid;
  };
  if (guardrail(raw.stackDetection, "stackDetection") && isRecord(raw.stackDetection) && !isText(raw.stackDetection.factor)) {
    report("stackDetection.factor must be a non-empty string");
  }
  if (!isRecord(raw.zones)) report("zones must be an object");
  else {
    guardrail(raw.zones.red, "zones.red");
    guardrail(raw.zones.yellow, "zones.yellow");
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { ...(raw as unknown as HarnessRequirements), requirements } };
}

/** Errors for requirements that name a factor the factor config does not define. */
export function checkRequirementFactors(requirements: HarnessRequirements, config: FactorConfig, source: string): string[] {
  const ids = new Set(config.factors.map((factor) => factor.id));
  const errors = requirements.requirements.flatMap((requirement, index) =>
    ids.has(requirement.factor) ? [] : [`${source}: requirements[${index}].factor ${requirement.factor} is not a configured factor`],
  );
  if (!ids.has(requirements.stackDetection.factor)) errors.push(`${source}: stackDetection.factor ${requirements.stackDetection.factor} is not a configured factor`);
  return errors;
}

export function loadHarnessRequirements(filePath: string): Result<HarnessRequirements> {
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return { ok: false, errors: [`${filePath}: ${code === "ENOENT" ? "file not found" : `cannot read file (${code ?? "unknown error"})`}`] };
  }
  try {
    return parseHarnessRequirements(JSON.parse(text), filePath);
  } catch (error) {
    return { ok: false, errors: [`${filePath}: invalid JSON (${(error as Error).message})`] };
  }
}
