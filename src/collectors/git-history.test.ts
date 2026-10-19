import { mkdirSync, mkdtempSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { commitFixture, createFixtureRepo, git } from "../testing/git-fixture.js";
import { collectGitHistory, type GitHistory } from "./git-history.js";

const now = new Date("2026-10-19T12:00:00Z");

function measured(repo: string): GitHistory {
  const result = collectGitHistory(repo, { now });
  if (result.status !== "measured") throw new Error(`expected a measurement, got: ${result.reason}`);
  return result.value;
}

function snapshot(dir: string): string[] {
  const entries: string[] = [];
  const walk = (current: string) => {
    for (const name of readdirSync(current).sort()) {
      const full = path.join(current, name);
      const stats = statSync(full);
      entries.push(`${path.relative(dir, full)} ${stats.size} ${stats.mtimeMs}`);
      if (stats.isDirectory()) walk(full);
    }
  };
  walk(dir);
  return entries;
}

describe("collectGitHistory on a known history", () => {
  const repo = createFixtureRepo([
    { author: "alice@example.com", date: "2024-01-15T10:00:00Z", files: { "a.txt": "1", "src/b.ts": "1" } },
    { author: "bob@example.com", date: "2025-12-01T10:00:00Z", files: { "a.txt": "2" } },
    { author: "Alice@Example.com", date: "2026-06-01T10:00:00Z", files: { "src/b.ts": "2", "gone.txt": "x" } },
    { author: "alice@example.com", date: "2026-07-01T10:00:00Z", files: { "gone.txt": null } },
  ]);

  it("counts repository totals, merging author emails case-insensitively", () => {
    expect(measured(repo).totals).toEqual({
      commits: 4,
      commitsLastYear: 3,
      authors: 2,
      firstCommit: "2024-01-15T10:00:00.000Z",
      lastCommit: "2026-07-01T10:00:00.000Z",
      trackedFiles: 2,
    });
  });

  it("reports one entry per file tracked at HEAD, sorted by path", () => {
    expect(measured(repo).files).toEqual([
      {
        path: "a.txt",
        commits: 2,
        commitsLastYear: 1,
        authors: 2,
        firstCommit: "2024-01-15T10:00:00.000Z",
        lastCommit: "2025-12-01T10:00:00.000Z",
      },
      {
        path: "src/b.ts",
        commits: 2,
        commitsLastYear: 1,
        authors: 1,
        firstCommit: "2024-01-15T10:00:00.000Z",
        lastCommit: "2026-06-01T10:00:00.000Z",
      },
    ]);
  });

  it("states the 12-month window it used", () => {
    expect(measured(repo).window).toEqual({ since: "2025-10-19T12:00:00.000Z", until: "2026-10-19T12:00:00.000Z" });
  });

  it("cites the read-only git commands it ran", () => {
    const result = collectGitHistory(repo, { now });
    expect(result.evidence.commands.some((command) => command.startsWith("git log --no-merges"))).toBe(true);
    expect(result.evidence.commands.every((command) => /^git (rev-parse|ls-tree|log) /.test(command))).toBe(true);
  });

  it("leaves the repository unchanged, including .git", () => {
    const before = snapshot(repo);
    collectGitHistory(repo, { now });
    expect(snapshot(repo)).toEqual(before);
  });
});

describe("collectGitHistory edge cases", () => {
  it("handles paths with spaces and non-ASCII characters", () => {
    const repo = createFixtureRepo([
      { author: "a@example.com", date: "2026-01-01T00:00:00Z", files: { "with space.txt": "1", "ñandú/ü.md": "1" } },
    ]);
    expect(measured(repo).files.map((file) => file.path)).toEqual(["with space.txt", "ñandú/ü.md"]);
  });

  it("does not count merge commits", () => {
    const repo = createFixtureRepo([{ author: "a@example.com", date: "2026-01-01T00:00:00Z", files: { "a.txt": "1" } }]);
    git(repo, ["checkout", "-q", "-b", "side"]);
    commitFixture(repo, { author: "b@example.com", date: "2026-02-01T00:00:00Z", files: { "b.txt": "1" } });
    git(repo, ["checkout", "-q", "main"]);
    commitFixture(repo, { author: "a@example.com", date: "2026-03-01T00:00:00Z", files: { "a.txt": "2" } });
    git(repo, ["merge", "-q", "--no-ff", "-m", "merge side", "side"], {
      GIT_AUTHOR_NAME: "a",
      GIT_AUTHOR_EMAIL: "a@example.com",
      GIT_COMMITTER_NAME: "a",
      GIT_COMMITTER_EMAIL: "a@example.com",
    });
    expect(measured(repo).totals.commits).toBe(3);
  });

  it("reports a repository without commits as not measured", () => {
    const repo = createFixtureRepo([]);
    expect(collectGitHistory(repo, { now })).toMatchObject({
      status: "not-measured",
      reason: "repository has no commits",
    });
  });

  it("reports a shallow clone as not measured instead of guessing", () => {
    const source = createFixtureRepo([
      { author: "a@example.com", date: "2026-01-01T00:00:00Z", files: { "a.txt": "1" } },
      { author: "a@example.com", date: "2026-02-01T00:00:00Z", files: { "a.txt": "2" } },
    ]);
    const shallow = path.join(path.dirname(source), `${path.basename(source)}-shallow`);
    git(path.dirname(source), ["clone", "-q", "--depth", "1", `file://${source.replace(/\\/g, "/")}`, shallow]);
    expect(collectGitHistory(shallow, { now })).toMatchObject({
      status: "not-measured",
      reason: "shallow clone: history is incomplete",
    });
  });

  it("reports a missing git binary as not measured", () => {
    const repo = createFixtureRepo([{ author: "a@example.com", date: "2026-01-01T00:00:00Z", files: { "a.txt": "1" } }]);
    expect(collectGitHistory(repo, { now, gitBinary: "git-binary-that-does-not-exist" })).toMatchObject({
      status: "not-measured",
      reason: "git is not installed or not on PATH",
    });
  });

  it("reports a broken repository as not measured with git's message", () => {
    const fake = mkdtempSync(path.join(os.tmpdir(), "aca-fake-repo-"));
    mkdirSync(path.join(fake, ".git"));
    const result = collectGitHistory(fake, { now });
    expect(result.status).toBe("not-measured");
    if (result.status === "not-measured") expect(result.reason).toMatch(/^git failed: /);
  });
});
