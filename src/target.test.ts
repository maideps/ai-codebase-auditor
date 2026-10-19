import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveTarget } from "./target.js";

const root = mkdtempSync(path.join(os.tmpdir(), "aca-target-"));

function dirWith(name: string, gitEntry?: "dir" | "file"): string {
  const dir = path.join(root, name);
  mkdirSync(dir, { recursive: true });
  if (gitEntry === "dir") mkdirSync(path.join(dir, ".git"));
  if (gitEntry === "file") writeFileSync(path.join(dir, ".git"), "gitdir: ../elsewhere\n", "utf8");
  return dir;
}

describe("resolveTarget", () => {
  it("accepts a repository root with a .git directory", () => {
    const repo = dirWith("repo", "dir");
    expect(resolveTarget(repo)).toEqual({ ok: true, value: { path: repo } });
  });

  it("accepts a worktree whose .git is a file", () => {
    const worktree = dirWith("worktree", "file");
    expect(resolveTarget(worktree)).toEqual({ ok: true, value: { path: worktree } });
  });

  it("resolves a relative path against the given cwd", () => {
    const repo = dirWith("relative", "dir");
    expect(resolveTarget("relative", root)).toEqual({ ok: true, value: { path: repo } });
  });

  it("rejects a missing path", () => {
    const missing = path.join(root, "nope");
    expect(resolveTarget(missing)).toEqual({ ok: false, errors: [`target ${missing} does not exist`] });
  });

  it("rejects a file", () => {
    const file = path.join(root, "file.txt");
    writeFileSync(file, "x", "utf8");
    expect(resolveTarget(file)).toEqual({ ok: false, errors: [`target ${file} is not a directory`] });
  });

  it("rejects a directory that is not a repository root", () => {
    const plain = dirWith("plain");
    expect(resolveTarget(plain)).toEqual({
      ok: false,
      errors: [`target ${plain} is not the root of a git working tree (no .git entry)`],
    });
  });
});
