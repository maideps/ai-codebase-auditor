// Co-change collector: which source files changed together in each recent
// commit, from one read-only `git log`. The module-boundaries score maps these
// files onto modules; this collector only reads the history.

import { SOURCE_EXTENSIONS, extensionOf } from "../file-kinds.js";
import { createGitRunner, GitError, hasCommits } from "./git.js";
import { isGenerated, isVendored } from "./tree.js";
import type { Evidence, Measurement } from "./types.js";

export interface CoChangeCommit {
  hash: string;
  /** Author date, ISO 8601 in UTC. */
  time: string;
  /** Source files the commit added, changed or deleted, sorted; vendored and generated paths left out. */
  files: string[];
}

export interface CoChange {
  /** Commits that touch at least one source file, newest first. */
  commits: CoChangeCommit[];
  /** Non-merge commits read from the log, with or without source files. */
  read: number;
  /** True when the log was cut off at the read limit, so older commits exist. */
  truncated: boolean;
}

export interface CoChangeOptions {
  /** Git executable; defaults to `git` on PATH. */
  gitBinary?: string;
  /** The most recent non-merge commits to read; defaults to 5000. */
  maxCommits?: number;
}

const DEFAULT_MAX_COMMITS = 5000;
const RECORD = "\x1e";
const FIELD = "\x1f";

const NOTES = [
  "the most recent non-merge commits are read from git log; renames show as a delete and an add",
  "only source files count; vendored and generated paths are left out",
  "nothing is checked out, run or written",
];

const isSource = (filePath: string) => SOURCE_EXTENSIONS.has(extensionOf(filePath)) && !isVendored(filePath) && !isGenerated(filePath);

export function collectCoChange(repoPath: string, options: CoChangeOptions = {}): Measurement<CoChange> {
  const evidence: Evidence = { commands: [], notes: [...NOTES] };
  const git = createGitRunner(repoPath, options.gitBinary ?? "git", evidence);
  const maxCommits = options.maxCommits ?? DEFAULT_MAX_COMMITS;
  let log: string;
  try {
    if (git(["rev-parse", "--is-shallow-repository"]).stdout.trim() === "true") {
      return { status: "not-measured", reason: "shallow clone: history is incomplete", evidence };
    }
    if (!hasCommits(git)) return { status: "not-measured", reason: "repository has no commits", evidence };
    log = git(["log", "--no-merges", "--no-renames", "--name-only", "-z", `--max-count=${maxCommits}`, `--format=${RECORD}%H${FIELD}%at`, "HEAD"]).stdout;
  } catch (error) {
    if (error instanceof GitError) return { status: "not-measured", reason: error.message, evidence };
    throw error;
  }

  const records = log.split(RECORD).slice(1);
  const commits: CoChangeCommit[] = [];
  for (const record of records) {
    const [header = "", ...paths] = record.split("\0");
    const [hash = "", at = "0"] = header.split(FIELD);
    const files = paths.map((file) => file.replace(/^\n/, "")).filter((file) => file.length > 0 && isSource(file)).sort();
    if (files.length > 0) commits.push({ hash: hash.trim(), time: new Date(Number(at) * 1000).toISOString(), files });
  }
  return { status: "measured", value: { commits, read: records.length, truncated: records.length >= maxCommits }, evidence };
}
