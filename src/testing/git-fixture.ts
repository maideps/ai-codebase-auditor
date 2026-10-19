// Test-only helper: builds throwaway git repositories with known authors and
// dates. Excluded from the build (tsconfig.build.json). Git runs with an empty
// global config so the developer's own hooks, signing or templates never apply.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface FixtureCommit {
  /** Path → new content, or null to delete the file. */
  files: Record<string, string | null>;
  /** Author email; the name is derived from it. */
  author: string;
  /** ISO date used as both author and committer date. */
  date: string;
  message?: string;
}

const scratch = mkdtempSync(path.join(os.tmpdir(), "aca-git-fixture-"));
const emptyConfig = path.join(scratch, "empty.gitconfig");
writeFileSync(emptyConfig, "", "utf8");

export function fixtureGitEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...process.env, GIT_CONFIG_GLOBAL: emptyConfig, GIT_CONFIG_NOSYSTEM: "1", ...extra };
}

export function git(cwd: string, args: string[], env: Record<string, string> = {}): string {
  return execFileSync("git", ["-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main", ...args], {
    cwd,
    env: fixtureGitEnv(env),
    encoding: "utf8",
  });
}

export function commitFixture(repo: string, commit: FixtureCommit): void {
  for (const [file, content] of Object.entries(commit.files)) {
    const full = path.join(repo, file);
    if (content === null) {
      rmSync(full);
    } else {
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, content, "utf8");
    }
  }
  git(repo, ["add", "-A"]);
  const name = commit.author.split("@")[0] ?? commit.author;
  git(repo, ["commit", "-q", "--allow-empty", "-m", commit.message ?? `commit at ${commit.date}`], {
    GIT_AUTHOR_NAME: name,
    GIT_AUTHOR_EMAIL: commit.author,
    GIT_AUTHOR_DATE: commit.date,
    GIT_COMMITTER_NAME: name,
    GIT_COMMITTER_EMAIL: commit.author,
    GIT_COMMITTER_DATE: commit.date,
  });
}

/** Creates a repository under a fresh temp directory and applies the commits in order. */
export function createFixtureRepo(commits: readonly FixtureCommit[]): string {
  const repo = mkdtempSync(path.join(scratch, "repo-"));
  git(repo, ["init", "-q"]);
  for (const commit of commits) commitFixture(repo, commit);
  return repo;
}
