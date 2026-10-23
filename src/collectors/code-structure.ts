// Code-structure collector: file sizes, the size distribution and the
// top-level module layout of the files tracked at HEAD. Reads file content
// from the working tree, never through links, and never writes anything.

import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { createGitRunner, GitError, hasCommits } from "./git.js";
import { isGenerated, isVendored, listTree, readTrackedFile, VENDORED_SEGMENTS, type TreeEntry } from "./tree.js";
import type { Evidence, Measurement } from "./types.js";

export interface FileSize {
  path: string;
  lines: number;
  bytes: number;
  /** From scc when it ran and recognized the file; otherwise null. */
  language: string | null;
  code: number | null;
  complexity: number | null;
}

export type ExclusionReason = "vendored" | "generated" | "binary" | "symlink" | "submodule" | "missing";

export interface CodeStructure {
  /** Included files, sorted by path. */
  files: FileSize[];
  /** Tracked files left out of every count, sorted by path. */
  excluded: { path: string; reason: ExclusionReason }[];
  distribution: {
    files: number;
    totalLines: number;
    totalBytes: number;
    p50Lines: number;
    p90Lines: number;
    p99Lines: number;
    maxLines: number;
    buckets: { label: string; files: number }[];
    /** Up to ten largest files by lines, the evidence behind the upper percentiles. */
    largest: { path: string; lines: number }[];
  };
  /** Included files grouped by first path segment; files at the root are "(root)". */
  modules: { name: string; files: number; lines: number; bytes: number }[];
  scc: { status: "used" } | { status: "unavailable"; reason: string };
}

export interface CodeStructureOptions {
  /** Git executable; defaults to `git` on PATH. */
  gitBinary?: string;
  /** How to run scc; defaults to `scc` on PATH. */
  scc?: { command: string; args?: string[] };
}

const SCC_ARGS = ["--by-file", "--format", "json", "."];
const BUCKETS = [
  { label: "0-200", max: 200 },
  { label: "201-500", max: 500 },
  { label: "501-1000", max: 1000 },
  { label: "1001-2000", max: 2000 },
  { label: "2001+", max: Number.POSITIVE_INFINITY },
];

const NOTES = [
  "files are those tracked at HEAD; content is read from the working tree",
  "line and byte counts come from the built-in counter",
  "a file is binary when its first 8000 bytes contain a NUL byte, as git decides",
  `vendored: any path segment in ${[...VENDORED_SEGMENTS].join(", ")}`,
  "generated: lock files, *.min.js, *.min.css and *.map",
  "symlinks and submodules are never followed",
];

function classifyByPath(entry: TreeEntry): ExclusionReason | null {
  if (entry.mode === "160000") return "submodule";
  if (entry.mode === "120000") return "symlink";
  if (isVendored(entry.path)) return "vendored";
  if (isGenerated(entry.path)) return "generated";
  return null;
}

function countLines(content: Buffer): number {
  let lines = 0;
  for (const byte of content) if (byte === 0x0a) lines += 1;
  return content.length > 0 && content[content.length - 1] !== 0x0a ? lines + 1 : lines;
}

type Measured = { kind: "file"; file: FileSize } | { kind: "excluded"; reason: ExclusionReason };

function measureFile(realRepo: string, repo: string, entry: TreeEntry): Measured {
  const byPath = classifyByPath(entry);
  if (byPath) return { kind: "excluded", reason: byPath };
  const read = readTrackedFile(realRepo, repo, entry, { skipBinary: true });
  if ("skipped" in read) return { kind: "excluded", reason: read.skipped };
  const { content } = read;
  return {
    kind: "file",
    file: { path: entry.path, lines: countLines(content), bytes: content.length, language: null, code: null, complexity: null },
  };
}

interface SccFile {
  language: string;
  code: number;
  complexity: number;
}

function runScc(repo: string, options: CodeStructureOptions, evidence: Evidence): { status: "used"; files: Map<string, SccFile> } | { status: "unavailable"; reason: string } {
  const scc = options.scc ?? { command: "scc" };
  evidence.commands.push(`scc ${SCC_ARGS.join(" ")}`);
  const run = spawnSync(scc.command, [...(scc.args ?? []), ...SCC_ARGS], {
    cwd: repo,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 1024,
    windowsHide: true,
  });
  if (run.error) {
    const code = (run.error as NodeJS.ErrnoException).code;
    return { status: "unavailable", reason: code === "ENOENT" ? "scc is not installed or not on PATH" : `scc could not run (${code ?? run.error.message})` };
  }
  if (run.status !== 0) {
    const message = run.stderr.trim().split(/\r?\n/)[0] ?? "";
    return { status: "unavailable", reason: `scc failed: ${message || `exit code ${run.status ?? "unknown"}`}` };
  }
  try {
    return { status: "used", files: parseSccOutput(run.stdout) };
  } catch {
    return { status: "unavailable", reason: "scc output could not be parsed" };
  }
}

// scc --by-file --format json: an array of languages, each with a Files array.
function parseSccOutput(stdout: string): Map<string, SccFile> {
  const languages: unknown = JSON.parse(stdout);
  if (!Array.isArray(languages)) throw new Error("not an array");
  const files = new Map<string, SccFile>();
  for (const language of languages) {
    const entries: unknown = (language as { Files?: unknown }).Files;
    if (!Array.isArray(entries)) throw new Error("language without Files");
    for (const entry of entries as Record<string, unknown>[]) {
      const { Location, Language, Code, Complexity } = entry;
      if (typeof Location !== "string" || typeof Language !== "string" || typeof Code !== "number" || typeof Complexity !== "number") {
        throw new Error("unexpected file entry");
      }
      files.set(Location.replace(/\\/g, "/").replace(/^\.\//, ""), { language: Language, code: Code, complexity: Complexity });
    }
  }
  return files;
}

const byPath = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// Nearest-rank percentile over an ascending list.
function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)] ?? 0;
}

function summarize(files: FileSize[], excluded: CodeStructure["excluded"], scc: CodeStructure["scc"]): CodeStructure {
  const sortedLines = files.map((file) => file.lines).sort((a, b) => a - b);
  const modules = new Map<string, { files: number; lines: number; bytes: number }>();
  for (const file of files) {
    const name = file.path.includes("/") ? (file.path.split("/")[0] ?? "(root)") : "(root)";
    const entry = modules.get(name) ?? { files: 0, lines: 0, bytes: 0 };
    entry.files += 1;
    entry.lines += file.lines;
    entry.bytes += file.bytes;
    modules.set(name, entry);
  }
  let previousMax = -1;
  const buckets = BUCKETS.map(({ label, max }) => {
    const low = previousMax;
    previousMax = max;
    return { label, files: sortedLines.filter((lines) => lines > low && lines <= max).length };
  });
  return {
    files,
    excluded,
    distribution: {
      files: files.length,
      totalLines: sortedLines.reduce((sum, lines) => sum + lines, 0),
      totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
      p50Lines: percentile(sortedLines, 50),
      p90Lines: percentile(sortedLines, 90),
      p99Lines: percentile(sortedLines, 99),
      maxLines: sortedLines[sortedLines.length - 1] ?? 0,
      buckets,
      largest: [...files]
        .sort((a, b) => b.lines - a.lines || byPath(a.path, b.path))
        .slice(0, 10)
        .map((file) => ({ path: file.path, lines: file.lines })),
    },
    modules: [...modules.entries()].sort(([a], [b]) => byPath(a, b)).map(([name, entry]) => ({ name, ...entry })),
    scc,
  };
}

export function collectCodeStructure(repoPath: string, options: CodeStructureOptions = {}): Measurement<CodeStructure> {
  const evidence: Evidence = { commands: [], notes: [...NOTES] };
  const git = createGitRunner(repoPath, options.gitBinary ?? "git", evidence);
  let entries: TreeEntry[];
  try {
    if (!hasCommits(git)) return { status: "not-measured", reason: "repository has no commits", evidence };
    entries = listTree(git);
  } catch (error) {
    if (error instanceof GitError) return { status: "not-measured", reason: error.message, evidence };
    throw error;
  }

  const realRepo = realpathSync(repoPath);
  const files: FileSize[] = [];
  const excluded: CodeStructure["excluded"] = [];
  for (const entry of entries) {
    const result = measureFile(realRepo, repoPath, entry);
    if (result.kind === "file") files.push(result.file);
    else excluded.push({ path: entry.path, reason: result.reason });
  }
  files.sort((a, b) => byPath(a.path, b.path));
  excluded.sort((a, b) => byPath(a.path, b.path));

  const scc = runScc(repoPath, options, evidence);
  if (scc.status === "used") {
    evidence.notes.push("language, code lines and complexity come from scc");
    for (const file of files) {
      const found = scc.files.get(file.path);
      if (found) Object.assign(file, found);
    }
  }
  return { status: "measured", value: summarize(files, excluded, scc.status === "used" ? { status: "used" } : scc), evidence };
}
