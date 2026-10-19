// The repository under audit. Checked statically: no git command runs here,
// and nothing in the target is written or executed.

import { existsSync, statSync } from "node:fs";
import path from "node:path";
import type { Result } from "./result.js";

export interface AuditTarget {
  /** Absolute path to the root of the git working tree. */
  path: string;
}

export function resolveTarget(input: string, cwd: string = process.cwd()): Result<AuditTarget> {
  const target = path.resolve(cwd, input);
  const stats = statSync(target, { throwIfNoEntry: false });
  if (!stats) return { ok: false, errors: [`target ${target} does not exist`] };
  if (!stats.isDirectory()) return { ok: false, errors: [`target ${target} is not a directory`] };
  // .git is a directory in a normal clone and a file in a linked worktree.
  if (!existsSync(path.join(target, ".git"))) {
    return { ok: false, errors: [`target ${target} is not the root of a git working tree (no .git entry)`] };
  }
  return { ok: true, value: { path: target } };
}
