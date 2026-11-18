// The MCP stdio transport: one JSON-RPC message per line in, one per line out.
// It ends when the client closes stdin.

import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { AuditReport } from "../report/model.js";
import { handleLine, type ServerInfo } from "./server.js";

export function serveStdio(report: AuditReport, info: ServerInfo, input: Readable, output: Writable): Promise<void> {
  const lines = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY });
  lines.on("line", (line) => {
    if (line.trim() === "") return;
    const response = handleLine(report, info, line);
    if (response) output.write(`${JSON.stringify(response)}\n`);
  });
  return new Promise((resolve) => lines.once("close", resolve));
}
