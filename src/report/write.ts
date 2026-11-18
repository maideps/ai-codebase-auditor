// Writing report files: only to the directory the user names with --out, and
// never into the audited repository, even through a link.

import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";

export const REPORT_FILES = { markdown: "ai-readiness-report.md", json: "ai-readiness-report.json", sarif: "ai-readiness-report.sarif" } as const;

export type ReportContents = Record<keyof typeof REPORT_FILES, string>;

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

/** Writes the three reports, plus extra files under outDir (relative, forward-slash paths that stay inside it). */
export function writeReports(outDir: string, contents: ReportContents, extra: readonly { path: string; content: string }[] = []): ReportContents {
  for (const file of extra) {
    if (path.isAbsolute(file.path) || file.path.split(/[\\/]/).includes("..")) throw new Error(`refusing to write ${file.path} outside ${outDir}`);
  }
  mkdirSync(outDir, { recursive: true });
  const written = {
    markdown: path.join(outDir, REPORT_FILES.markdown),
    json: path.join(outDir, REPORT_FILES.json),
    sarif: path.join(outDir, REPORT_FILES.sarif),
  };
  for (const kind of ["markdown", "json", "sarif"] as const) writeFileSync(written[kind], contents[kind], "utf8");
  for (const file of extra) {
    const target = path.join(outDir, ...file.path.split("/"));
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, file.content, "utf8");
  }
  return written;
}
