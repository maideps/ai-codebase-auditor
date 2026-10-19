#!/usr/bin/env node

// Command-line entry point. The audit commands arrive with feat-001 (CLI
// skeleton and config loader); until then the CLI only answers --help and
// --version, which is enough for the e2e smoke run to exercise the build.

import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export const USAGE = `Usage: ai-codebase-auditor [options]

Options:
  -h, --help     Show this help
  -v, --version  Show the version
`;

export function runCli(args: readonly string[], version: string): CliResult {
  const [first] = args;
  if (first === undefined || first === "-h" || first === "--help") {
    return { exitCode: 0, stdout: USAGE, stderr: "" };
  }
  if (first === "-v" || first === "--version") {
    return { exitCode: 0, stdout: `${version}\n`, stderr: "" };
  }
  return { exitCode: 2, stdout: "", stderr: `Unknown argument: ${first}\n\n${USAGE}` };
}

// package.json sits one level above both src/ and dist/.
export function readVersion(): string {
  const manifest: unknown = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  if (typeof manifest === "object" && manifest !== null && "version" in manifest && typeof manifest.version === "string") {
    return manifest.version;
  }
  throw new Error("package.json has no version string");
}

function isMainModule(): boolean {
  const invoked = process.argv[1];
  if (invoked === undefined) return false;
  // npm installs bins as symlinks, so compare resolved paths.
  return realpathSync(path.resolve(invoked)) === realpathSync(fileURLToPath(import.meta.url));
}

if (isMainModule()) {
  const result = runCli(process.argv.slice(2), readVersion());
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}
