// Git-history collector: churn, authors and file age from read-only git
// commands. Feeds hotspot and risk-zone signals; it never writes to the target.

import { createGitRunner, GitError, hasCommits } from "./git.js";
import type { Evidence, Measurement } from "./types.js";

export interface FileHistory {
  path: string;
  commits: number;
  commitsLastYear: number;
  authors: number;
  /** ISO timestamps (UTC) of the author dates; null when no non-merge commit touched the file. */
  firstCommit: string | null;
  lastCommit: string | null;
}

export interface GitHistory {
  /** The commit measured: HEAD at the time of the audit. */
  head: string;
  window: { since: string; until: string };
  totals: {
    commits: number;
    commitsLastYear: number;
    authors: number;
    firstCommit: string | null;
    lastCommit: string | null;
    trackedFiles: number;
  };
  /** Files tracked at HEAD, sorted by path. */
  files: FileHistory[];
}

export interface GitHistoryOptions {
  /** End of the 12-month window; defaults to the current time. */
  now?: Date;
  /** Git executable; defaults to `git` on PATH. */
  gitBinary?: string;
}

interface Commit {
  time: number;
  author: string;
  files: string[];
}

const RECORD = "\x1e";
const FIELD = "\x1f";
const LOG_ARGS = ["log", "--no-merges", "--no-renames", "--name-only", "-z", `--format=${RECORD}%H${FIELD}%at${FIELD}%aE`, "HEAD"];

const NOTES = [
  "merge commits are excluded",
  "renames are not followed, so a renamed file's history starts at the rename",
  "authors are counted by email after .mailmap, case-insensitively",
  "dates are author dates",
];

function parseLog(stdout: string): Commit[] {
  return stdout
    .split(RECORD)
    .slice(1)
    .map((record) => {
      const [header = "", ...paths] = record.split("\0");
      const [, time = "0", author = ""] = header.split(FIELD);
      return {
        time: Number(time) * 1000,
        author: author.toLowerCase(),
        files: paths.map((file) => file.replace(/^\n/, "")).filter((file) => file.length > 0),
      };
    });
}

const iso = (time: number | undefined) => (time === undefined ? null : new Date(time).toISOString());

// A loop, not Math.min(...times): spreading a large history exceeds the
// engine's argument limit.
function range(times: readonly number[]): { first: string | null; last: string | null } {
  let first: number | undefined;
  let last: number | undefined;
  for (const time of times) {
    if (first === undefined || time < first) first = time;
    if (last === undefined || time > last) last = time;
  }
  return { first: iso(first), last: iso(last) };
}

export function collectGitHistory(repoPath: string, options: GitHistoryOptions = {}): Measurement<GitHistory> {
  const until = options.now ?? new Date();
  const since = new Date(until);
  since.setUTCFullYear(since.getUTCFullYear() - 1);
  const evidence: Evidence = { commands: [], notes: [...NOTES] };
  const git = createGitRunner(repoPath, options.gitBinary ?? "git", evidence);

  try {
    if (git(["rev-parse", "--is-shallow-repository"]).stdout.trim() === "true") {
      return { status: "not-measured", reason: "shallow clone: history is incomplete", evidence };
    }
    if (!hasCommits(git)) {
      return { status: "not-measured", reason: "repository has no commits", evidence };
    }
    const head = git(["rev-parse", "HEAD"]).stdout.trim();
    const tracked = git(["ls-tree", "-r", "-z", "--name-only", "HEAD"]).stdout.split("\0").filter(Boolean);
    const commits = parseLog(git(LOG_ARGS).stdout);
    return { status: "measured", value: { head, ...summarize(tracked, commits, since.getTime(), until.getTime()) }, evidence };
  } catch (error) {
    if (error instanceof GitError) return { status: "not-measured", reason: error.message, evidence };
    throw error;
  }
}

function summarize(tracked: string[], commits: Commit[], since: number, until: number): Omit<GitHistory, "head"> {
  const perFile = new Map<string, { times: number[]; authors: Set<string> }>(
    tracked.map((file) => [file, { times: [], authors: new Set() }]),
  );
  for (const commit of commits) {
    for (const file of commit.files) {
      const entry = perFile.get(file);
      if (!entry) continue; // deleted or renamed away before HEAD
      entry.times.push(commit.time);
      entry.authors.add(commit.author);
    }
  }
  const inWindow = (time: number) => time >= since && time <= until;
  const times = commits.map((commit) => commit.time);

  const files = [...perFile.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([file, entry]): FileHistory => {
      const { first, last } = range(entry.times);
      return {
        path: file,
        commits: entry.times.length,
        commitsLastYear: entry.times.filter(inWindow).length,
        authors: entry.authors.size,
        firstCommit: first,
        lastCommit: last,
      };
    });
  const overall = range(times);

  return {
    window: { since: new Date(since).toISOString(), until: new Date(until).toISOString() },
    totals: {
      commits: commits.length,
      commitsLastYear: times.filter(inWindow).length,
      authors: new Set(commits.map((commit) => commit.author)).size,
      firstCommit: overall.first,
      lastCommit: overall.last,
      trackedFiles: tracked.length,
    },
    files,
  };
}
