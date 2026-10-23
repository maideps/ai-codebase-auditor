import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { commitFixture, createFixtureRepo, git } from "../testing/git-fixture.js";
import { collectCoChange, type CoChange } from "./co-change.js";

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

function measured(repo: string, options = {}): CoChange {
  const result = collectCoChange(repo, options);
  if (result.status !== "measured") throw new Error(`expected a measurement, got: ${result.reason}`);
  return result.value;
}

const author = "a@example.com";

describe("collectCoChange", () => {
  const repo = createFixtureRepo([
    { author, date: "2026-01-01T00:00:00Z", files: { "app/a.rb": "1", "lib/b.rb": "1", "README.md": "r" } },
    { author, date: "2026-01-02T00:00:00Z", files: { "README.md": "docs only" } },
    { author, date: "2026-01-03T00:00:00Z", files: { "app/a.rb": "2", "vendor/x.rb": "v", "app/app.min.js": "m" } },
    { author, date: "2026-01-04T00:00:00Z", files: { "lib/b.rb": null, "lib/c.rb": "1" } },
  ]);
  const value = measured(repo);

  it("keeps the source files of each commit that touches source, newest first", () => {
    expect(value.commits.map((commit) => [commit.time, commit.files])).toEqual([
      ["2026-01-04T00:00:00.000Z", ["lib/b.rb", "lib/c.rb"]],
      ["2026-01-03T00:00:00.000Z", ["app/a.rb"]],
      ["2026-01-01T00:00:00.000Z", ["app/a.rb", "lib/b.rb"]],
    ]);
    for (const commit of value.commits) expect(commit.hash).toMatch(/^[0-9a-f]{40}$/);
  });

  it("counts every commit read, and whether the read was cut off", () => {
    expect(value).toMatchObject({ read: 4, truncated: false });
    expect(measured(repo, { maxCommits: 2 })).toMatchObject({ read: 2, truncated: true });
    expect(measured(repo, { maxCommits: 2 }).commits.map((commit) => commit.files)).toEqual([["lib/b.rb", "lib/c.rb"], ["app/a.rb"]]);
  });

  it("records the read-only command it ran", () => {
    const result = collectCoChange(repo);
    expect(result.evidence.commands.some((command) => command.startsWith("git log --no-merges --no-renames --name-only"))).toBe(true);
  });

  it("leaves the repository unchanged, including .git", () => {
    const before = snapshot(repo);
    collectCoChange(repo);
    expect(snapshot(repo)).toEqual(before);
  });
});

describe("collectCoChange edge cases", () => {
  it("leaves merge commits out", () => {
    const repo = createFixtureRepo([{ author, date: "2026-01-01T00:00:00Z", files: { "a.py": "1" } }]);
    git(repo, ["checkout", "-q", "-b", "side"]);
    commitFixture(repo, { author, date: "2026-02-01T00:00:00Z", files: { "b.py": "1" } });
    git(repo, ["checkout", "-q", "main"]);
    commitFixture(repo, { author, date: "2026-03-01T00:00:00Z", files: { "a.py": "2" } });
    git(repo, ["merge", "-q", "--no-ff", "-m", "merge side", "side"], { GIT_AUTHOR_NAME: "a", GIT_AUTHOR_EMAIL: author, GIT_COMMITTER_NAME: "a", GIT_COMMITTER_EMAIL: author });
    expect(measured(repo).commits).toHaveLength(3);
  });

  it("reports a shallow clone and an empty repository as not measured", () => {
    const source = createFixtureRepo([
      { author, date: "2026-01-01T00:00:00Z", files: { "a.py": "1" } },
      { author, date: "2026-02-01T00:00:00Z", files: { "a.py": "2" } },
    ]);
    const shallow = path.join(path.dirname(source), `${path.basename(source)}-shallow`);
    git(path.dirname(source), ["clone", "-q", "--depth", "1", `file://${source.replace(/\\/g, "/")}`, shallow]);
    expect(collectCoChange(shallow)).toMatchObject({ status: "not-measured", reason: "shallow clone: history is incomplete" });
    expect(collectCoChange(createFixtureRepo([]))).toMatchObject({ status: "not-measured", reason: "repository has no commits" });
  });
});
