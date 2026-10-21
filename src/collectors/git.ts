// Shared, hardened git runner for collectors. Not a collector itself: it only
// runs the read-only commands a collector asks for, pinned to the target.

import { spawnSync } from "node:child_process";
import path from "node:path";
import type { Evidence } from "./types.js";

/** An expected git failure that a collector reports as not measured. */
export class GitError extends Error {}

export type GitRunner = (args: readonly string[], allowedStatuses?: readonly number[]) => { status: number; stdout: string };

export function createGitRunner(repo: string, gitBinary: string, evidence: Evidence): GitRunner {
  // Pin git to the target: never search parent directories for a repository,
  // never inherit a GIT_DIR from the caller, never take optional locks.
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_CEILING_DIRECTORIES: path.dirname(repo), GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;

  return (args, allowedStatuses = [0]) => {
    evidence.commands.push(`git ${args.filter((arg) => !arg.startsWith("--format=")).join(" ")}`);
    const run = spawnSync(gitBinary, ["--no-pager", "-c", "core.fsmonitor=false", "-C", repo, ...args], {
      env,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 1024,
      windowsHide: true,
    });
    if (run.error) {
      const code = (run.error as NodeJS.ErrnoException).code;
      throw new GitError(code === "ENOENT" ? "git is not installed or not on PATH" : `git could not run (${code ?? run.error.message})`);
    }
    const status = run.status ?? 1;
    if (!allowedStatuses.includes(status)) {
      const message = run.stderr.trim().split(/\r?\n/)[0] ?? "";
      throw new GitError(`git failed: ${message || `exit code ${status}`}`);
    }
    return { status, stdout: run.stdout };
  };
}

/** True when HEAD resolves; false for a repository without commits. */
export function hasCommits(git: GitRunner): boolean {
  return git(["rev-parse", "--verify", "-q", "HEAD"], [0, 1]).status === 0;
}
