// Runtime end-of-life table: a dated snapshot of when each runtime version
// stops receiving support. The audit compares declared runtimes against it
// and never looks dates up over the network.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Result } from "../result.js";

export const RUNTIMES = ["node", "python", "php", "ruby", "java"] as const;
export type Runtime = (typeof RUNTIMES)[number];

export interface EolCycle {
  cycle: string;
  /** Last day of support, YYYY-MM-DD. */
  eol: string;
  /** Where this cycle's date comes from, when it differs from the runtime's source. */
  source?: string;
}

export interface RuntimeEolTable {
  version: 1;
  /** The date the table was checked against its sources. */
  asOf: string;
  note?: string;
  runtimes: Partial<Record<Runtime, { source: string; cycles: EolCycle[] }>>;
}

// config/ sits two levels above both src/config/ and dist/config/.
export const DEFAULT_EOL_TABLE_PATH = fileURLToPath(new URL("../../config/runtime-eol.json", import.meta.url));

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ROOT_KEYS = new Set(["version", "asOf", "note", "runtimes"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRuntime(value: string): value is Runtime {
  return (RUNTIMES as readonly string[]).includes(value);
}

export function parseRuntimeEolTable(raw: unknown, source: string): Result<RuntimeEolTable> {
  const errors: string[] = [];
  const report = (message: string) => errors.push(`${source}: ${message}`);
  if (!isRecord(raw)) return { ok: false, errors: [`${source}: must be a JSON object`] };
  for (const key of Object.keys(raw)) if (!ROOT_KEYS.has(key)) report(`unknown key ${key}`);
  if (raw.version !== 1) report("version must be 1");
  if (typeof raw.asOf !== "string" || !DATE.test(raw.asOf)) report("asOf must be a YYYY-MM-DD date");
  if (raw.note !== undefined && typeof raw.note !== "string") report("note must be a string");
  if (!isRecord(raw.runtimes)) {
    report("runtimes must be an object");
    return { ok: false, errors };
  }

  const runtimes: RuntimeEolTable["runtimes"] = {};
  for (const [name, entry] of Object.entries(raw.runtimes)) {
    const at = `runtimes.${name}`;
    if (!isRuntime(name)) {
      report(`${at} is not a known runtime`);
      continue;
    }
    if (!isRecord(entry)) {
      report(`${at} must be an object`);
      continue;
    }
    if (typeof entry.source !== "string" || entry.source.trim() === "") report(`${at}.source must be a non-empty string`);
    if (!Array.isArray(entry.cycles)) {
      report(`${at}.cycles must be an array`);
      continue;
    }
    const seen = new Set<string>();
    const cycles: EolCycle[] = [];
    entry.cycles.forEach((cycle: unknown, index) => {
      const cycleAt = `${at}.cycles[${index}]`;
      if (!isRecord(cycle)) {
        report(`${cycleAt} must be an object`);
        return;
      }
      if (typeof cycle.cycle !== "string" || cycle.cycle === "") report(`${cycleAt}.cycle must be a non-empty string`);
      else if (seen.has(cycle.cycle)) report(`${cycleAt}.cycle duplicates ${cycle.cycle}`);
      else seen.add(cycle.cycle);
      if (typeof cycle.eol !== "string" || !DATE.test(cycle.eol)) report(`${cycleAt}.eol must be a YYYY-MM-DD date`);
      if (cycle.source !== undefined && typeof cycle.source !== "string") report(`${cycleAt}.source must be a string`);
      if (typeof cycle.cycle === "string" && typeof cycle.eol === "string") {
        cycles.push(typeof cycle.source === "string" ? { cycle: cycle.cycle, eol: cycle.eol, source: cycle.source } : { cycle: cycle.cycle, eol: cycle.eol });
      }
    });
    runtimes[name] = { source: typeof entry.source === "string" ? entry.source : "", cycles };
  }

  if (errors.length > 0) return { ok: false, errors };
  const table: RuntimeEolTable = { version: 1, asOf: raw.asOf as string, runtimes };
  if (typeof raw.note === "string") table.note = raw.note;
  return { ok: true, value: table };
}

export function loadRuntimeEolTable(filePath: string): Result<RuntimeEolTable> {
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return { ok: false, errors: [`${filePath}: ${code === "ENOENT" ? "file not found" : `cannot read file (${code ?? "unknown error"})`}`] };
  }
  try {
    return parseRuntimeEolTable(JSON.parse(text), filePath);
  } catch (error) {
    return { ok: false, errors: [`${filePath}: invalid JSON (${(error as Error).message})`] };
  }
}
