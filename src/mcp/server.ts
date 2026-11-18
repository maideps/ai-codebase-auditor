// A read-only MCP server over a saved audit report: agents ask for a path's zone,
// the verdict, a factor or the roadmap. It answers from the report alone; it never
// audits, reads the audited repository or runs anything. Pure: one JSON-RPC message
// in, at most one out. The stdio loop lives in stdio.ts.

import type { ModuleZone, RedPath, YellowPath, Zone } from "../decision/types.js";
import { REPORT_SCHEMA, REPORT_SCHEMA_VERSION, type AuditReport } from "../report/model.js";
import type { Result } from "../result.js";

export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;
export const SUPPORTED_REPORT_VERSIONS: readonly number[] = [REPORT_SCHEMA_VERSION];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Checks a parsed JSON value is a report this server can answer from. */
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

export interface ZoneAnswer {
  path: string;
  zone: Zone | null;
  /** The module the path falls in; null when none. */
  module: string | null;
  reason: string;
}

function normalize(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function moduleOf(modules: readonly ModuleZone[], filePath: string): ModuleZone | null {
  const directory = filePath.includes("/") ? filePath.slice(0, filePath.lastIndexOf("/")) : "";
  const matches = modules.filter((m) => {
    if (m.module === "(root)") return directory === "";
    if (m.module.endsWith("/(files)")) return directory === m.module.slice(0, -"/(files)".length);
    return filePath.startsWith(`${m.module}/`);
  });
  return matches.sort((a, b) => b.module.length - a.module.length)[0] ?? null;
}

const onRedPath = (red: RedPath, filePath: string) => (red.kind === "file" ? filePath === red.path : filePath.startsWith(`${red.path}/`) || filePath === red.path);

/** A path's zone: a red path wins over a yellow path, which wins over the module's zone. */
export function zoneOf(report: AuditReport, rawPath: string): ZoneAnswer {
  const filePath = normalize(rawPath);
  const module = moduleOf(report.zones.modules, filePath);
  const red = report.zones.redPaths.find((r) => onRedPath(r, filePath));
  if (red) {
    return { path: filePath, zone: "red", module: module?.module ?? null, reason: `on the red path ${red.path}${red.kind === "directory" ? "/" : ""} (${red.term}): agents may only propose changes` };
  }
  const yellow: YellowPath | undefined = report.zones.yellowPaths.find((y) => y.path === filePath);
  if (yellow) return { path: filePath, zone: "yellow", module: yellow.module, reason: yellow.reason };
  if (module) return { path: filePath, zone: module.zone, module: module.module, reason: module.reason };
  const why = report.zones.note ?? "not in any zoned module: tests, docs and directories without source files are not zoned";
  return { path: filePath, zone: null, module: null, reason: why };
}

interface Tool {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[]; additionalProperties: false };
  run: (report: AuditReport, args: Record<string, unknown>) => { ok: true; value: unknown } | { ok: false; error: string };
}

const noArgs = { type: "object" as const, properties: {}, additionalProperties: false as const };

export const TOOLS: readonly Tool[] = [
  {
    name: "get_verdict",
    description: "The audit's verdict (adopt, adapt or prepare-first) with the rule that fired, the readiness level, the audit date and the audited commit. Check the date and commit: the report may be older than the code.",
    inputSchema: noArgs,
    run: (report) => ({ ok: true, value: { verdict: report.verdict, readiness: report.readiness, auditDate: report.auditDate, commit: report.target.head } }),
  },
  {
    name: "get_factor",
    description: "One readiness factor's score (1-5), class, rule and evidence, by id (for example test-feedback or type-strictness).",
    inputSchema: { type: "object", properties: { id: { type: "string", description: "The factor id" } }, required: ["id"], additionalProperties: false },
    run: (report, args) => {
      const factor = report.factors.find((f) => f.id === args.id);
      return factor ? { ok: true, value: factor } : { ok: false, error: `no factor ${String(args.id)}; factors: ${report.factors.map((f) => f.id).join(", ")}` };
    },
  },
  {
    name: "get_zone",
    description: "Ask before editing a file. Returns its zone: green (agents may edit), yellow (add characterization tests first) or red (propose changes only; do not edit), with the reason. Paths are relative to the repository root. Reports hold no per-file lists, so a test file inside a module directory gets that module's zone.",
    inputSchema: { type: "object", properties: { path: { type: "string", description: "A file or directory path relative to the repository root" } }, required: ["path"], additionalProperties: false },
    run: (report, args) => ({ ok: true, value: zoneOf(report, String(args.path)) }),
  },
  {
    name: "list_red_paths",
    description: "Paths where agents may only propose changes (auth, billing, permissions, secrets and similar).",
    inputSchema: noArgs,
    run: (report) => ({ ok: true, value: report.zones.redPaths }),
  },
  {
    name: "list_yellow_paths",
    description: "Files inside green modules that need characterization tests before agents edit them (long, often-changed files with no test named after them).",
    inputSchema: noArgs,
    run: (report) => ({ ok: true, value: report.zones.yellowPaths }),
  },
  {
    name: "get_roadmap",
    description: "The modernization roadmap: one step per factor below 5, ordered by gain against effort, with the verdict each step would lead to.",
    inputSchema: noArgs,
    run: (report) => ({ ok: true, value: report.roadmap }),
  },
];

type Id = string | number | null;
export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: Id; result: unknown }
  | { jsonrpc: "2.0"; id: Id; error: { code: number; message: string } };

const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;

const reply = (id: Id, result: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, result });
const fail = (id: Id, code: number, message: string): JsonRpcResponse => ({ jsonrpc: "2.0", id, error: { code, message } });

export interface ServerInfo {
  name: string;
  version: string;
}

/** The answer to one line from the client; null for notifications, which get none. */
export function handleLine(report: AuditReport, info: ServerInfo, line: string): JsonRpcResponse | null {
  let message: unknown;
  try {
    message = JSON.parse(line);
  } catch {
    return fail(null, PARSE_ERROR, "parse error: not JSON");
  }
  return handleMessage(report, info, message);
}

export function handleMessage(report: AuditReport, info: ServerInfo, message: unknown): JsonRpcResponse | null {
  if (!isRecord(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    const id = isRecord(message) && (typeof message.id === "string" || typeof message.id === "number") ? message.id : null;
    return fail(id, INVALID_REQUEST, "invalid request: expected a JSON-RPC 2.0 object with a method");
  }
  if (!("id" in message)) return null; // a notification, such as notifications/initialized
  const id = message.id as Id;
  const params = isRecord(message.params) ? message.params : {};
  switch (message.method) {
    case "initialize": {
      const requested = params.protocolVersion;
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.find((version) => version === requested) ?? SUPPORTED_PROTOCOL_VERSIONS[0];
      return reply(id, {
        protocolVersion,
        capabilities: { tools: {} },
        serverInfo: info,
        instructions: `Read-only answers from the audit report of ${report.target.path} (commit ${report.target.head ?? "unknown"}, audited ${report.auditDate}). Call get_zone before editing a file.`,
      });
    }
    case "ping":
      return reply(id, {});
    case "tools/list":
      return reply(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool) return fail(id, INVALID_PARAMS, `unknown tool ${String(params.name)}`);
      const args = isRecord(params.arguments) ? params.arguments : {};
      const missing = (tool.inputSchema.required ?? []).filter((key) => typeof args[key] !== "string" || args[key] === "");
      if (missing.length > 0) return fail(id, INVALID_PARAMS, `${tool.name} needs ${missing.join(", ")} as a non-empty string`);
      const outcome = tool.run(report, args);
      return outcome.ok
        ? reply(id, { content: [{ type: "text", text: JSON.stringify(outcome.value, null, 2) }], isError: false })
        : reply(id, { content: [{ type: "text", text: outcome.error }], isError: true });
    }
    default:
      return fail(id, METHOD_NOT_FOUND, `method not found: ${message.method}`);
  }
}
