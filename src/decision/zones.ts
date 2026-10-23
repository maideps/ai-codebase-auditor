// Risk zones: modules are green (agents may edit autonomously) or yellow
// (characterization tests first), and paths naming auth, billing, permissions
// or secrets are red (agents may only propose changes).

import type { DecisionConfig } from "../config/decision.js";
import type { FactorConfig } from "../config/factors.js";
import { extensionOf, SOURCE_EXTENSIONS } from "../file-kinds.js";
import { groupModules, ROOT_MODULE } from "../modules.js";
import type { CollectorResults, Scoring } from "../scoring/types.js";
import type { ModuleZone, RedPath, Zones } from "./types.js";

// 7.1%, not a rounded 7% that hides being over a 7% limit; whole numbers stay whole.
const percent = (share: number) => {
  const value = Math.round(share * 1000) / 10; // 0.07 * 100 is 7.000000000000001 in floating point
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`;
};
const byPath = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// Words in a path segment: separators and camelCase split, trailing digits dropped ("oauth2" → "oauth").
function words(segment: string): string[] {
  return segment
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((word) => word.replace(/\d+$/, ""))
    .filter(Boolean);
}

/** The first red term found in a path, as a whole word of a directory or file name; null when none. */
export function redTermIn(filePath: string, terms: readonly string[]): string | null {
  const set = new Set(terms);
  const segments = filePath.split("/");
  for (const [index, segment] of segments.entries()) {
    const name = index === segments.length - 1 ? segment.replace(/\.[^.]+$/, "") : segment;
    const found = words(name).find((word) => set.has(word));
    if (found) return found;
  }
  return null;
}

// The red path to report for a file: its shallowest matching directory, else the file itself.
function redPathOf(filePath: string, terms: readonly string[]): RedPath | null {
  const segments = filePath.split("/");
  for (let depth = 1; depth < segments.length; depth += 1) {
    const term = redTermIn(segments.slice(0, depth).join("/"), terms);
    if (term) return { path: segments.slice(0, depth).join("/"), kind: "directory", term };
  }
  const term = redTermIn(filePath, terms);
  return term ? { path: filePath, kind: "file", term } : null;
}

export function assignZones(scoring: Scoring, results: CollectorResults, factors: FactorConfig, config: DecisionConfig): Zones {
  if (results.structure.status !== "measured") {
    return { modules: [], redPaths: [], unzoned: [], note: `no zones: code structure not measured (${results.structure.reason})` };
  }
  const structure = results.structure.value;
  const testPaths = new Set(results.testsDocs.status === "measured" ? results.testsDocs.value.tests.files.map((file) => file.path) : []);
  const source = structure.files.filter((file) => SOURCE_EXTENSIONS.has(extensionOf(file.path)) && !testPaths.has(file.path));
  const linesOf = new Map(source.map((file) => [file.path, file.lines]));

  const redPaths = new Map<string, RedPath>();
  const redFiles = new Set<string>();
  for (const file of source) {
    const red = redPathOf(file.path, config.redTerms);
    if (red) {
      redFiles.add(file.path);
      redPaths.set(red.path, red);
    }
  }

  // Zones read the evidence, not deferrals: a deferral does not add tests.
  const testScore = scoring.factors.find((factor) => factor.id === "test-feedback")?.baseScore ?? null;
  const sizeLimits = factors.factors.find((factor) => factor.id === "file-size")?.thresholds ?? {};
  const maxP90 = sizeLimits.maxP90Lines3 ?? Number.POSITIVE_INFINITY;
  const maxShare = sizeLimits.maxShareOver1000Lines3 ?? 1;

  const modules: ModuleZone[] = [...groupModules(source.map((file) => file.path), config).entries()]
    .sort(([a], [b]) => byPath(a, b))
    .map(([module, files]) => {
      const red = files.filter((file) => redFiles.has(file)).length;
      const zone = (z: ModuleZone["zone"], reason: string): ModuleZone => ({ module, zone: z, reason, sourceFiles: files.length, redFiles: red });
      if (red === files.length) return zone("red", "every source file is on a red path: agents may only propose changes");
      if (testScore === null || testScore < config.greenMinTestScore) {
        return zone("yellow", `test-feedback ${testScore ?? "not measured"} < ${config.greenMinTestScore}: add characterization tests before agents edit`);
      }
      const sorted = files.map((file) => linesOf.get(file) ?? 0).sort((a, b) => a - b);
      const p90 = sorted[Math.max(0, Math.ceil(0.9 * sorted.length) - 1)] ?? 0;
      const share = sorted.filter((lines) => lines > 1000).length / sorted.length;
      const problems = [
        ...(p90 > maxP90 ? [`p90 ${p90} lines > ${maxP90}`] : []),
        ...(share > maxShare ? [`${percent(share)} of files over 1000 lines > ${percent(maxShare)}`] : []),
      ];
      if (problems.length > 0) return zone("yellow", `files too large for unsupervised edits: ${problems.join("; ")}`);
      return zone("green", `test-feedback ${testScore} ≥ ${config.greenMinTestScore} and files are legible (p90 ${p90} lines, ${percent(share)} over 1000 lines)`);
    });

  const zonedTopLevel = new Set(source.map((file) => (file.path.includes("/") ? file.path.split("/")[0] : ROOT_MODULE)));
  const topLevel = new Set(structure.files.map((file) => (file.path.includes("/") ? file.path.split("/")[0] : ROOT_MODULE)));
  const unzoned = [...topLevel].filter((name): name is string => name !== undefined && !zonedTopLevel.has(name)).sort(byPath);

  return { modules, redPaths: [...redPaths.values()].sort((a, b) => byPath(a.path, b.path)), unzoned, note: null };
}
