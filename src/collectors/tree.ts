// Shared tree helpers for collectors: the files tracked at HEAD, the vendored
// path rule, and a file read that never follows a link out of the target.

import { closeSync, lstatSync, openSync, readFileSync, readSync, realpathSync } from "node:fs";
import path from "node:path";
import { isLockFile } from "../file-kinds.js";
import type { GitRunner } from "./git.js";

export interface TreeEntry {
  /** Git file mode: 100644/100755 regular, 120000 symlink, 160000 submodule. */
  mode: string;
  /** Path relative to the repository root, with forward slashes. */
  path: string;
}

/** Every entry of the tree at HEAD (`git ls-tree -r -z HEAD`). */
export function listTree(git: GitRunner): TreeEntry[] {
  return git(["ls-tree", "-r", "-z", "HEAD"])
    .stdout.split("\0")
    .filter(Boolean)
    .map((line) => ({ mode: line.slice(0, line.indexOf(" ")), path: line.slice(line.indexOf("\t") + 1) }));
}

export const VENDORED_SEGMENTS = new Set(["node_modules", "bower_components", "vendor", "vendors", "third_party", "third-party", "thirdparty", "Pods"]);

/** True when any directory on the path is a vendored-code directory. */
export function isVendored(filePath: string): boolean {
  return filePath.split("/").slice(0, -1).some((segment) => VENDORED_SEGMENTS.has(segment));
}

const GENERATED_PATTERN = /\.min\.(?:js|css)$|\.map$/;

/** True for lock files and build output that no one edits by hand. */
export function isGenerated(filePath: string): boolean {
  return isLockFile(filePath) || GENERATED_PATTERN.test(filePath.slice(filePath.lastIndexOf("/") + 1));
}

export type ReadSkip = "symlink" | "submodule" | "missing" | "binary";

const BINARY_SNIFF_BYTES = 8000;
// Files up to this size are read once and sniffed in memory; opening every file twice is slow on Windows.
const READ_ONCE_BYTES = 4 * 1024 * 1024;

const hasNul = (content: Buffer) => content.subarray(0, BINARY_SNIFF_BYTES).includes(0);

// Git's rule: a NUL byte in the first 8000 bytes means binary. Only those
// bytes are read, so large binaries are never loaded.
function isBinary(file: string): boolean {
  const fd = openSync(file, "r");
  try {
    const buffer = Buffer.alloc(BINARY_SNIFF_BYTES);
    const read = readSync(fd, buffer, 0, BINARY_SNIFF_BYTES, 0);
    return buffer.subarray(0, read).includes(0);
  } finally {
    closeSync(fd);
  }
}

/**
 * Reads a tracked file from the working tree. Symlinks and submodules are
 * recognized by tree mode and never opened; a regular file whose real path
 * leaves the target (through a linked directory) counts as a symlink. With
 * skipBinary, a binary file is reported instead of read.
 */
export function readTrackedFile(
  realRepo: string,
  repo: string,
  entry: TreeEntry,
  options: { skipBinary?: boolean } = {},
): { content: Buffer } | { skipped: ReadSkip } {
  if (entry.mode === "160000") return { skipped: "submodule" };
  if (entry.mode === "120000") return { skipped: "symlink" };
  const full = path.join(repo, ...entry.path.split("/"));
  let stats;
  try {
    stats = lstatSync(full);
  } catch {
    return { skipped: "missing" };
  }
  if (stats.isSymbolicLink()) return { skipped: "symlink" };
  if (!stats.isFile()) return { skipped: "missing" };
  if (path.relative(realRepo, realpathSync(full)).startsWith("..")) return { skipped: "symlink" };
  if (options.skipBinary && stats.size <= READ_ONCE_BYTES) {
    const content = readFileSync(full);
    return hasNul(content) ? { skipped: "binary" } : { content };
  }
  if (options.skipBinary && isBinary(full)) return { skipped: "binary" };
  return { content: readFileSync(full) };
}
