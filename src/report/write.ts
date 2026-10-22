// Writing report files: only to the directory the user names with --out, and
// never into the audited repository, even through a link.

import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";

export const REPORT_FILES = { markdown: "ai-readiness-report.md", json: "ai-readiness-report.json" } as const;

// The real path of a directory that may not exist yet: resolve its nearest
// existing ancestor, then add back the missing part.
function realPathOf(directory: string): string {
  let existing = path.resolve(directory);
  const missing: string[] = [];
  while (!existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) break;
    missing.unshift(path.basename(existing));
    existing = parent;
  }
  return path.join(realpathSync(existing), ...missing);
}

/** Errors when the out directory resolves to the target or anything inside it. */
export function checkOutDir(outDir: string, targetPath: string): string[] {
  const relative = path.relative(realpathSync(targetPath), realPathOf(outDir));
  const inside = relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  return inside ? [`out directory ${outDir} is inside the audited repository ${targetPath}`] : [];
}

export function writeReports(outDir: string, contents: { markdown: string; json: string }): { markdown: string; json: string } {
  mkdirSync(outDir, { recursive: true });
  const written = { markdown: path.join(outDir, REPORT_FILES.markdown), json: path.join(outDir, REPORT_FILES.json) };
  writeFileSync(written.markdown, contents.markdown, "utf8");
  writeFileSync(written.json, contents.json, "utf8");
  return written;
}
