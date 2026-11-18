import { readFileSync } from "node:fs";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import type { AuditReport } from "../report/model.js";
import { handleLine, handleMessage, parseSavedReport, SUPPORTED_PROTOCOL_VERSIONS, TOOLS, zoneOf } from "./server.js";
import { serveStdio } from "./stdio.js";

// The report snapshot: green src/(files) holding the yellow path src/engine.js, red src/auth.
const raw: unknown = JSON.parse(readFileSync(new URL("../report/__snapshots__/sample-report.json", import.meta.url), "utf8"));
const parsed = parseSavedReport(raw, "sample.json");
if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
const report = parsed.value;
const info = { name: "ai-codebase-auditor", version: "0.1.0" };

// A report whose modules include (root) and a plain directory module.
const wider: AuditReport = {
  ...report,
  zones: {
    ...report.zones,
    modules: [
      ...report.zones.modules,
      { module: "(root)", zone: "green", reason: "root ok", sourceFiles: 1, redFiles: 0, hotspots: [] },
      { module: "lib", zone: "yellow", reason: "lib needs tests", sourceFiles: 2, redFiles: 0, hotspots: [] },
      { module: "lib/deep", zone: "green", reason: "deep ok", sourceFiles: 2, redFiles: 0, hotspots: [] },
    ],
  },
};

function call(name: string, args: Record<string, unknown> = {}, from: AuditReport = report) {
  return handleMessage(from, info, { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name, arguments: args } });
}

function textOf(response: ReturnType<typeof call>): unknown {
  if (!response || !("result" in response)) throw new Error(`expected a result, got ${JSON.stringify(response)}`);
  const result = response.result as { content: { text: string }[]; isError: boolean };
  return result.isError ? { error: result.content[0]?.text } : JSON.parse(result.content[0]?.text ?? "null");
}

describe("parseSavedReport", () => {
  it.each([
    [{ schema: "other", schemaVersion: 7 }, 'sample.json: not an ai-codebase-auditor report (schema must be "ai-codebase-auditor/report")'],
    [{ schema: "ai-codebase-auditor/report", schemaVersion: 6 }, "sample.json: report schemaVersion 6 is not supported (supported: 7); re-run the audit with this version"],
    [{ schema: "ai-codebase-auditor/report", schemaVersion: 7 }, "sample.json: report has no verdict"],
    [[], 'sample.json: not an ai-codebase-auditor report (schema must be "ai-codebase-auditor/report")'],
  ])("refuses %j", (value, error) => {
    expect(parseSavedReport(value, "sample.json")).toEqual({ ok: false, errors: [error] });
  });
});

describe("zoneOf", () => {
  it("puts a red path above its green module", () => {
    expect(zoneOf(report, "src/auth/login.js")).toEqual({
      path: "src/auth/login.js", zone: "red", module: "src/auth", reason: "on the red path src/auth/ (auth): agents may only propose changes",
    });
  });

  it("puts a yellow path above its green module", () => {
    expect(zoneOf(report, "src/engine.js")).toMatchObject({ zone: "yellow", module: "src/(files)" });
  });

  it("gives other files their module's zone, with Windows separators and ./ accepted", () => {
    expect(zoneOf(report, ".\\src\\f1.js")).toMatchObject({ path: "src/f1.js", zone: "green", module: "src/(files)" });
  });

  it("matches (root), the longest directory module, and <dir>/(files) only for direct files", () => {
    expect(zoneOf(wider, "setup.py")).toMatchObject({ zone: "green", module: "(root)" });
    expect(zoneOf(wider, "lib/a.py")).toMatchObject({ zone: "yellow", module: "lib" });
    expect(zoneOf(wider, "lib/deep/b.py")).toMatchObject({ zone: "green", module: "lib/deep" });
    expect(zoneOf(wider, "src/sub/x.js")).toMatchObject({ zone: null, module: null });
  });

  it("says why a path is not zoned", () => {
    expect(zoneOf(report, "test/f0.js")).toEqual({
      path: "test/f0.js", zone: null, module: null, reason: "not in any zoned module: tests, docs and directories without source files are not zoned",
    });
  });
});

describe("handleMessage", () => {
  it("initializes with the client's protocol version when supported, else the newest", () => {
    for (const version of SUPPORTED_PROTOCOL_VERSIONS) {
      const response = handleMessage(report, info, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: version } });
      expect(response).toMatchObject({ id: 1, result: { protocolVersion: version, capabilities: { tools: {} }, serverInfo: info } });
    }
    expect(handleMessage(report, info, { jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } }))
      .toMatchObject({ result: { protocolVersion: "2025-06-18" } });
  });

  it("answers ping and lists every tool with an input schema", () => {
    expect(handleMessage(report, info, { jsonrpc: "2.0", id: 3, method: "ping" })).toEqual({ jsonrpc: "2.0", id: 3, result: {} });
    const listed = handleMessage(report, info, { jsonrpc: "2.0", id: 4, method: "tools/list" });
    expect(listed).toMatchObject({ result: { tools: TOOLS.map((t) => ({ name: t.name, inputSchema: t.inputSchema })) } });
    expect(TOOLS.map((t) => t.name)).toEqual(["get_verdict", "get_factor", "get_zone", "list_red_paths", "list_yellow_paths", "get_roadmap"]);
  });

  it("gives notifications no answer", () => {
    expect(handleMessage(report, info, { jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
  });

  it("returns JSON-RPC errors for unknown methods, unknown tools, missing arguments and bad input", () => {
    expect(handleMessage(report, info, { jsonrpc: "2.0", id: 5, method: "resources/list" })).toEqual({ jsonrpc: "2.0", id: 5, error: { code: -32601, message: "method not found: resources/list" } });
    expect(call("delete_everything")).toEqual({ jsonrpc: "2.0", id: 7, error: { code: -32602, message: "unknown tool delete_everything" } });
    expect(call("get_zone", {})).toEqual({ jsonrpc: "2.0", id: 7, error: { code: -32602, message: "get_zone needs path as a non-empty string" } });
    expect(handleLine(report, info, "{not json")).toEqual({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error: not JSON" } });
    expect(handleMessage(report, info, { id: 9, method: "ping" })).toMatchObject({ id: 9, error: { code: -32600 } });
  });

  it("answers every tool from the report", () => {
    expect(textOf(call("get_verdict"))).toEqual({ verdict: report.verdict, readiness: report.readiness, auditDate: report.auditDate, commit: report.target.head });
    expect(textOf(call("get_factor", { id: "test-feedback" }))).toEqual(report.factors.find((f) => f.id === "test-feedback"));
    expect(textOf(call("get_factor", { id: "nope" }))).toEqual({ error: `no factor nope; factors: ${report.factors.map((f) => f.id).join(", ")}` });
    expect(textOf(call("get_zone", { path: "src/auth/login.js" }))).toMatchObject({ zone: "red" });
    expect(textOf(call("list_red_paths"))).toEqual(report.zones.redPaths);
    expect(textOf(call("list_yellow_paths"))).toEqual(report.zones.yellowPaths);
    expect(textOf(call("get_roadmap"))).toEqual(report.roadmap);
  });
});

describe("serveStdio", () => {
  it("answers each request line and skips notifications and blank lines, until stdin closes", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
    const done = serveStdio(report, info, input, output);
    input.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" })}\n\n`);
    input.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\r\n`);
    input.end(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "get_zone", arguments: { path: "src/f1.js" } } })}\n`);
    await done;
    const lines = chunks.join("").trim().split("\n").map((line) => JSON.parse(line) as { id: number });
    expect(lines.map((line) => line.id)).toEqual([1, 2]);
  });
});
