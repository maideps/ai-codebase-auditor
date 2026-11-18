// Reading a saved JSON report back: the schema and versions this tool can answer
// from (mcp) or compare (compare). Pure: callers read the file.

import type { Result } from "../result.js";
import { REPORT_SCHEMA, REPORT_SCHEMA_VERSION, type AuditReport } from "./model.js";

export const SUPPORTED_REPORT_VERSIONS: readonly number[] = [REPORT_SCHEMA_VERSION];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Checks a parsed JSON value is a report this version of the tool can read. */
export function parseSavedReport(raw: unknown, source: string): Result<AuditReport> {
  if (!isRecord(raw) || raw.schema !== REPORT_SCHEMA) {
    return { ok: false, errors: [`${source}: not an ai-codebase-auditor report (schema must be "${REPORT_SCHEMA}")`] };
  }
  if (typeof raw.schemaVersion !== "number" || !SUPPORTED_REPORT_VERSIONS.includes(raw.schemaVersion)) {
    return { ok: false, errors: [`${source}: report schemaVersion ${String(raw.schemaVersion)} is not supported (supported: ${SUPPORTED_REPORT_VERSIONS.join(", ")}); re-run the audit with this version`] };
  }
  for (const key of ["verdict", "readiness", "factors", "zones", "roadmap", "target"]) {
    if (!(key in raw)) return { ok: false, errors: [`${source}: report has no ${key}`] };
  }
  return { ok: true, value: raw as unknown as AuditReport };
}
