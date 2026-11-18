// Hotspots: files in a module that are both long and changing often. One with no
// test named after it becomes a yellow path (characterization tests first),
// even inside a green module. Pure: it reads collected signals, never the repository.

import type { HotspotSettings } from "../config/decision.js";

export type { HotspotSettings };

export interface HotspotCandidate {
  path: string;
  commitsLastYear: number;
  lines: number;
  /** scc complexity when scc ran; evidence only, never part of the rule. */
  complexity: number | null;
}

export interface Hotspot extends HotspotCandidate {
  /** Test files named after this file; empty when none is. */
  testedBy: string[];
}

export interface ModuleHotspots {
  /** Most recent commits first, then by path. */
  hotspots: Hotspot[];
  /** The commit count a hotspot needs; null when no file changed in the window. */
  commitCut: number | null;
  /** The line count a hotspot needs. */
  lineCut: number;
}

const TEST_WORDS = new Set(["test", "tests", "spec", "specs"]);
const byPath = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The words of a file name without its extension: separators and camelCase split, lower-cased. */
export function nameWords(filePath: string): string[] {
  const name = (filePath.split("/").pop() ?? "").replace(/\.[^.]*$/, "");
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Test files named after a source file: once test words (test, tests, spec, specs) are
 * dropped, the test's name ends with the source file's name, as whole words. So
 * `notification_method_webpush_test.php` names `webpush.php`, and `issue_status_test.rb`
 * does not name `issue.rb`.
 */
export function testsNamedAfter(sourcePath: string, testPaths: readonly string[]): string[] {
  const source = nameWords(sourcePath);
  if (source.length === 0) return [];
  return testPaths
    .filter((testPath) => {
      const words = nameWords(testPath).filter((word) => !TEST_WORDS.has(word));
      const offset = words.length - source.length;
      return offset >= 0 && source.every((word, index) => words[offset + index] === word);
    })
    .sort(byPath);
}

// Nearest rank, as the zones' p90 file size: the value at ceil(q × n), counting from 1.
function percentileOf(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)] ?? 0;
}

/** The hotspots among one module's source files. */
export function findHotspots(files: readonly HotspotCandidate[], testPaths: readonly string[], settings: HotspotSettings): ModuleHotspots {
  const lineCut = Math.max(percentileOf(files.map((file) => file.lines), settings.percentile), settings.minLines);
  const changed = files.filter((file) => file.commitsLastYear > 0).map((file) => file.commitsLastYear);
  if (changed.length === 0) return { hotspots: [], commitCut: null, lineCut };
  const commitCut = Math.max(percentileOf(changed, settings.percentile), settings.minCommits);
  const hotspots = files
    .filter((file) => file.commitsLastYear >= commitCut && file.lines >= lineCut)
    .sort((a, b) => b.commitsLastYear - a.commitsLastYear || byPath(a.path, b.path))
    .map((file) => ({ path: file.path, commitsLastYear: file.commitsLastYear, lines: file.lines, complexity: file.complexity, testedBy: testsNamedAfter(file.path, testPaths) }));
  return { hotspots, commitCut, lineCut };
}
