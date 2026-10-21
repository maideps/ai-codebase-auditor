// Test-only builders for collector measurements, so scoring tests state just
// the signals they care about. Excluded from the build.

import type { CodeStructure } from "../collectors/code-structure.js";
import type { Dependencies, RuntimeAssessment } from "../collectors/dependencies.js";
import type { GitHistory } from "../collectors/git-history.js";
import type { TestsDocs, TypeChecker } from "../collectors/tests-docs.js";
import type { Measurement } from "../collectors/types.js";
import type { CollectorResults } from "../scoring/types.js";

const evidence = { commands: ["git ls-tree -r -z HEAD"], notes: [] };

export function notMeasured<T>(reason: string): Measurement<T> {
  return { status: "not-measured", reason, evidence };
}

export function structureOf(files: { path: string; lines: number }[], excluded: CodeStructure["excluded"] = []): Measurement<CodeStructure> {
  return {
    status: "measured",
    evidence,
    value: {
      files: files.map((file) => ({ ...file, bytes: file.lines * 2, language: null, code: null, complexity: null })),
      excluded,
      distribution: { files: files.length, totalLines: 0, totalBytes: 0, p50Lines: 0, p90Lines: 0, p99Lines: 0, maxLines: 0, buckets: [], largest: [] },
      modules: [],
      scc: { status: "unavailable", reason: "test" },
    },
  };
}

/** n source files of the given extension, each with the given number of lines. */
export function sourceFiles(n: number, extension: string, lines = 10, directory = "src"): { path: string; lines: number }[] {
  return Array.from({ length: n }, (_, index) => ({ path: `${directory}/f${index}.${extension}`, lines }));
}

export interface TestsDocsSpec {
  testFiles?: string[];
  runners?: string[];
  ci?: string[];
  docs?: Partial<TestsDocs["docs"]>;
  /** Stated-rule counts per file. */
  rules?: { path: string; count: number }[];
  checkers?: TypeChecker[];
}

export function testsDocsOf(spec: TestsDocsSpec = {}): Measurement<TestsDocs> {
  return {
    status: "measured",
    evidence,
    value: {
      tests: {
        files: (spec.testFiles ?? []).map((path) => ({ path, convention: "*.test.* / *.spec.*" })),
        conventions: spec.testFiles?.length ? [{ convention: "*.test.* / *.spec.*", files: spec.testFiles.length }] : [],
        runnerConfigs: (spec.runners ?? []).map((path) => ({ path, runner: "Jest" })),
      },
      ci: (spec.ci ?? []).map((path) => ({ path, system: "GitHub Actions" })),
      docs: {
        readme: [], moduleReadmes: [], contributing: [], architecture: [], decisionRecords: [], conventions: [], docsDirectory: [], agentContext: [],
        ...spec.docs,
      },
      statedRules: (spec.rules ?? []).flatMap(({ path, count }) =>
        Array.from({ length: count }, (_, index) => ({ path, line: index + 1, text: `Never do thing ${index}.` })),
      ),
      unreadDocs: [],
      typeCheckers: spec.checkers ?? [],
    },
  };
}

export function dependenciesOf(runtimes: Partial<RuntimeAssessment>[]): Measurement<Dependencies> {
  return {
    status: "measured",
    evidence,
    value: {
      manifests: [],
      runtimes: runtimes.map((runtime) => ({
        runtime: "node", spec: "18", source: "package.json", via: "engines.node",
        lowest: "18", cycle: "18", status: "supported", eol: "2030-01-01", reason: null,
        ...runtime,
      })),
      notMeasured: [],
      table: { asOf: "2026-10-21", ageDays: 0 },
    },
  };
}

export function historyOf(): Measurement<GitHistory> {
  return {
    status: "measured",
    evidence,
    value: {
      window: { since: "2025-10-21T00:00:00.000Z", until: "2026-10-21T00:00:00.000Z" },
      totals: { commits: 1, commitsLastYear: 1, authors: 1, firstCommit: null, lastCommit: null, trackedFiles: 0 },
      files: [],
    },
  };
}

export function collected(parts: Partial<CollectorResults> = {}): CollectorResults {
  return {
    history: historyOf(),
    structure: structureOf(sourceFiles(10, "ts")),
    testsDocs: testsDocsOf(),
    dependencies: dependenciesOf([]),
    ...parts,
  };
}
