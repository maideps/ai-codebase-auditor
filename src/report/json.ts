// JSON rendering: the report model as-is, two-space indented, LF line ends.

import type { AuditReport } from "./model.js";

export function renderJson(report: AuditReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
