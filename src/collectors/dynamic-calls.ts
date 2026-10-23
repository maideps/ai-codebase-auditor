// Dynamic-calls collector: call sites whose target is computed at run time
// (reflection, dispatch by name, eval, method_missing and similar), in the
// tracked source files of the covered languages. Reads file content from the
// working tree, never through links, and never writes or runs anything.

import { realpathSync } from "node:fs";
import { DYNAMIC_CALL_FAMILIES, languageOf, type DynamicFamily } from "../file-kinds.js";
import { findSites } from "./dynamic-calls/patterns.js";
import { createGitRunner, GitError, hasCommits } from "./git.js";
import { isGenerated, isVendored, listTree, readTrackedFile, type ReadSkip, type TreeEntry } from "./tree.js";
import type { Evidence, Measurement } from "./types.js";

export type { DynamicFamily };

export interface DynamicCallSite {
  line: number;
  construct: string;
  /** The site's line, trimmed and cut to 120 characters. */
  excerpt: string;
}

export interface DynamicCallFile {
  path: string;
  family: DynamicFamily;
  lines: number;
  sites: DynamicCallSite[];
}

export type DynamicSkipReason = "vendored" | "generated" | "minified" | ReadSkip;

export interface DynamicCalls {
  /** Every covered source file that was read, sites or not, sorted by path. */
  files: DynamicCallFile[];
  /** Covered source files left out, sorted by path. */
  skipped: { path: string; reason: DynamicSkipReason }[];
}

export interface DynamicCallsOptions {
  /** Git executable; defaults to `git` on PATH. */
  gitBinary?: string;
}

const MINIFIED_LINE = 1000;
const EXCERPT_LENGTH = 120;

const NOTES = [
  "files are those tracked at HEAD; content is read from the working tree; nothing is run",
  "covered languages: Python, PHP, Ruby, Java, JavaScript and TypeScript",
  "comments are removed and strings replaced before matching, so text inside strings never counts",
  "only calls whose target is computed count; a literal target is visible at the call site",
  `vendored and generated paths are skipped, and so are minified files (a line over ${MINIFIED_LINE} characters)`,
  "configuration-wired dispatch (dependency injection, XML mappings, callbacks by symbol, annotations) is not detected",
];

const byPath = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function familyOf(filePath: string): DynamicFamily | null {
  const language = languageOf(filePath);
  return language ? (DYNAMIC_CALL_FAMILIES[language.family] ?? null) : null;
}

type Read = { kind: "file"; file: DynamicCallFile } | { kind: "skipped"; reason: DynamicSkipReason };

function readFile(realRepo: string, repo: string, entry: TreeEntry, family: DynamicFamily): Read {
  if (isVendored(entry.path)) return { kind: "skipped", reason: "vendored" };
  if (isGenerated(entry.path)) return { kind: "skipped", reason: "generated" };
  const read = readTrackedFile(realRepo, repo, entry, { skipBinary: true });
  if ("skipped" in read) return { kind: "skipped", reason: read.skipped };
  const text = read.content.toString("utf8");
  const lines = text.split("\n");
  if (lines.some((line) => line.length > MINIFIED_LINE)) return { kind: "skipped", reason: "minified" };
  const sites = findSites(text, family).map((site) => ({ ...site, excerpt: (lines[site.line - 1] ?? "").trim().slice(0, EXCERPT_LENGTH) }));
  const count = text.endsWith("\n") ? lines.length - 1 : lines.length;
  return { kind: "file", file: { path: entry.path, family, lines: count, sites } };
}

export function collectDynamicCalls(repoPath: string, options: DynamicCallsOptions = {}): Measurement<DynamicCalls> {
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
  const files: DynamicCallFile[] = [];
  const skipped: DynamicCalls["skipped"] = [];
  for (const entry of entries) {
    const family = familyOf(entry.path);
    if (!family) continue;
    const result = readFile(realRepo, repoPath, entry, family);
    if (result.kind === "file") files.push(result.file);
    else skipped.push({ path: entry.path, reason: result.reason });
  }
  files.sort((a, b) => byPath(a.path, b.path));
  skipped.sort((a, b) => byPath(a.path, b.path));
  return { status: "measured", value: { files, skipped }, evidence };
}
