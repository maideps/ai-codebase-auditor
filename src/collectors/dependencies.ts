// Dependency collector: dependency manifests and declared runtime versions,
// read statically from the files tracked at HEAD, with each declared runtime
// checked against a dated end-of-life table. Nothing is installed, resolved
// or looked up over the network.

import { realpathSync } from "node:fs";
import type { Runtime, RuntimeEolTable } from "../config/runtime-eol.js";
import { isSupportedManifest, isUnsupportedManifest, parseManifest, type ParsedManifest, type RuntimeDeclaration } from "./dependencies/parsers.js";
import { cycleFor, lowestVersion } from "./dependencies/versions.js";
import { isUnderTestPath } from "../file-kinds.js";
import { createGitRunner, GitError, hasCommits } from "./git.js";
import { isVendored, listTree, readTrackedFile, type TreeEntry } from "./tree.js";
import type { Evidence, Measurement } from "./types.js";

export interface RuntimeAssessment {
  runtime: Runtime;
  spec: string;
  /** The file that declares it. */
  source: string;
  via: string;
  /** The lowest version the spec allows. */
  lowest: string | null;
  cycle: string | null;
  status: "end-of-life" | "supported" | "unknown";
  /** The cycle's end-of-life date from the table. */
  eol: string | null;
  /** Why the status is unknown; null otherwise. */
  reason: string | null;
  /** Declared under a test or fixture directory: listed, but not the product's runtime. */
  testFixture: boolean;
}

export interface Dependencies {
  /** Parsed manifests and runtime files, sorted by path. */
  manifests: (ParsedManifest & { path: string })[];
  /** Every declared runtime, by file path then file order. */
  runtimes: RuntimeAssessment[];
  /** Manifests found but not parsed, with the reason. */
  notMeasured: { path: string; reason: string }[];
  table: { asOf: string; ageDays: number };
}

export interface DependenciesOptions {
  table: RuntimeEolTable;
  /** The audit date that end-of-life dates are compared with; defaults to now. */
  now?: Date;
  /** Git executable; defaults to `git` on PATH. */
  gitBinary?: string;
}

const MAX_MANIFEST_BYTES = 5 * 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;

function assess(declaration: RuntimeDeclaration, source: string, table: RuntimeEolTable, today: string): RuntimeAssessment {
  const base = { runtime: declaration.runtime, spec: declaration.spec, source, via: declaration.via };
  const testFixture = isUnderTestPath(source);
  const unknown = (lowest: string | null, cycle: string | null, reason: string): RuntimeAssessment => ({
    ...base, lowest, cycle, status: "unknown", eol: null, reason, testFixture,
  });
  const lowest = lowestVersion(declaration.spec);
  if (lowest === null) return unknown(null, null, "no lower version bound");
  const cycle = cycleFor(declaration.runtime, lowest);
  if (cycle === null) return unknown(lowest, null, `version ${lowest} is too coarse to match a cycle`);
  const row = table.runtimes[declaration.runtime]?.cycles.find((candidate) => candidate.cycle === cycle);
  if (!row) return unknown(lowest, cycle, `cycle ${cycle} is not in the end-of-life table`);
  // Support ends on the EOL date, so that day already counts as end of life.
  return { ...base, lowest, cycle, status: today >= row.eol ? "end-of-life" : "supported", eol: row.eol, reason: null, testFixture };
}

export function collectDependencies(repoPath: string, options: DependenciesOptions): Measurement<Dependencies> {
  const now = options.now ?? new Date();
  const ageDays = Math.floor((now.getTime() - Date.parse(`${options.table.asOf}T00:00:00Z`)) / DAY_MS);
  const evidence: Evidence = {
    commands: [],
    notes: [
      "manifests are files tracked at HEAD outside vendored directories, read as text; setup.py and build files are never executed",
      "nothing is installed or resolved; versions are as declared",
      "for a version range, the lowest declared version is assessed",
      "runtimes declared under test or fixture directories are marked testFixture and do not count as the product's runtime",
      `end-of-life dates come from the table as of ${options.table.asOf}; a runtime is end-of-life on or after its cycle's date`,
      "Maven dependencies include those declared in dependencyManagement and plugin blocks",
      ...(ageDays > 365 ? ["the end-of-life table is more than a year old; refresh it"] : []),
    ],
  };
  const git = createGitRunner(repoPath, options.gitBinary ?? "git", evidence);
  let entries: TreeEntry[];
  try {
    if (!hasCommits(git)) return { status: "not-measured", reason: "repository has no commits", evidence };
    entries = listTree(git).filter((entry) => !isVendored(entry.path));
  } catch (error) {
    if (error instanceof GitError) return { status: "not-measured", reason: error.message, evidence };
    throw error;
  }
  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const realRepo = realpathSync(repoPath);
  const today = now.toISOString().slice(0, 10);
  const manifests: Dependencies["manifests"] = [];
  const notMeasured: Dependencies["notMeasured"] = [];
  for (const entry of entries) {
    if (isUnsupportedManifest(entry.path)) {
      notMeasured.push({ path: entry.path, reason: "not a supported manifest" });
      continue;
    }
    if (!isSupportedManifest(entry.path)) continue;
    const file = readTrackedFile(realRepo, repoPath, entry, { skipBinary: true });
    if ("skipped" in file) notMeasured.push({ path: entry.path, reason: file.skipped });
    else if (file.content.length > MAX_MANIFEST_BYTES) notMeasured.push({ path: entry.path, reason: "too large" });
    else {
      const parsed = parseManifest(entry.path, file.content.toString("utf8"));
      if (parsed === null) continue;
      if ("error" in parsed) notMeasured.push({ path: entry.path, reason: parsed.error });
      else manifests.push({ path: entry.path, ...parsed });
    }
  }

  const runtimes = manifests.flatMap((parsed) => parsed.runtimes.map((declaration) => assess(declaration, parsed.path, options.table, today)));
  return { status: "measured", value: { manifests, runtimes, notMeasured, table: { asOf: options.table.asOf, ageDays } }, evidence };
}
