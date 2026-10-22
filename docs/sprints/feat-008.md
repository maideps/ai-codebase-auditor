# Sprint Contract

**Feature ID:** feat-008
**Feature Name:** Markdown and JSON report writers
**Date:** 2026-10-22
**Estimated Duration:** 1 session
**Status:** layout and schema reviewed and approved 2026-10-22 (decisions below)

## Review Decisions (2026-10-22)

All four open points approved as recommended:
- **Contents:** summaries only, with no per-file lists.
- **Audited commit:** add the HEAD commit to the git-history collector.
- **Without `--out`:** stdout only.
- **File names:** fixed, `ai-readiness-report.md` and `.json`.

The rest of the contract is implemented as written.

## What I Will Build

- **One report model, two renderers:**
  - `buildReport(...)` in `src/report/model.ts` assembles a single `AuditReport` model.
  - `renderJson` and `renderMarkdown` render that same model, so the two files carry the same content by construction.
- **`audit --out <dir>`** writes `<dir>/ai-readiness-report.md` and `<dir>/ai-readiness-report.json`, creating the directory if needed and overwriting earlier reports of the same name.
- **Out-directory guard:** an out directory that resolves inside the audited repository is an input error (exit 2), checked through real paths, so a symlinked directory cannot slip through.
- **Determinism:**
  - The CLI takes one audit date and passes it to every collector, to scoring and to the report. Today each collector reads the clock separately.
  - Object keys are built in a fixed order, arrays are already sorted, and line endings are LF.
  - Two runs on the same repository, configs and date produce identical bytes.

## Proposed JSON Schema (`schemaVersion: 1`)

```jsonc
{
  "schema": "ai-codebase-auditor/report",
  "schemaVersion": 1,
  "tool": { "name": "ai-codebase-auditor", "version": "0.1.0" },
  "auditDate": "2026-10-22",                 // the date every time-based rule used
  "target": { "path": "/abs/path/to/repo", "head": "<commit sha> | null" },
  "inputs": {
    "factorConfig": "/abs/config/factors.json",
    "decisionConfig": "/abs/config/decision.json",
    "eolTable": { "path": "/abs/config/runtime-eol.json", "asOf": "2026-10-21", "ageDays": 1 },
    "deferrals": "/abs/deferrals.json | null"
  },
  "verdict": { "verdict": "adapt | adopt | prepare-first | null", "rule": "…", "triggeredBy": [{ "factor": "…", "score": 2 }],
               "provisional": true, "unmeasuredBlocking": ["direct-api-calls"] },
  "readiness": { "level": 2, "setBy": "type-strictness", "provisional": true, "unmeasuredBlocking": ["direct-api-calls"] },
  "factors": [ { "id", "name", "class", "status", "score", "baseScore", "rule", "evidence": [], "partial", "reason", "deferral" } ],
  "zones": { "modules": [ { "module", "zone", "reason", "sourceFiles", "redFiles" } ],
             "redPaths": [ { "path", "kind", "term" } ], "unzoned": [], "note": null },
  "notMeasured": [ { "kind": "factor | collector | manifest | doc | tool", "id": "…", "reason": "…" } ],
  "signals": {
    "gitHistory":    { "status", "reason?", "window", "totals", "hotspots": [ top 10 files by commits in the last 12 months ] },
    "codeStructure": { "status", "reason?", "distribution", "modules", "excludedByReason": { "vendored": 3 }, "scc" },
    "testsDocs":     { "status", "reason?", "testFiles": n, "conventions", "runnerConfigs", "ci", "docs", "typeCheckers",
                       "statedRules": [ { "path", "line", "text" } ] },
    "dependencies":  { "status", "reason?", "manifests": [ { "path", "ecosystem", "dependencies": n, "issues" } ], "runtimes" }
  },
  "method": { "commands": [ every read-only command the collectors ran ], "notes": [ every collector caveat ] }
}
```

- **Summary only:** per-file lists (every file's size, every file's history) are left out, so phpBB's thousands of files don't turn the report into a data dump. The hotspot top 10 and the 10 largest files stay in.
- **Not-measured items gathered in one place:** unmeasured factors, collectors that could not run, unsupported or unparseable manifests, unread rule docs and an unused scc.

## Proposed Markdown Layout

```markdown
# AI-readiness audit: <repository folder name>

| | |
|---|---|
| Target | `<path>` at commit `<sha, 12 chars>` |
| Audit date | 2026-10-22 |
| Verdict | **adapt** (provisional: direct-api-calls not measured) |
| Readiness level | **2 of 5**, set by type-strictness (provisional) |
| Tool | ai-codebase-auditor 0.1.0 |

## Verdict
**adapt**: adopt the harness with adaptations for the weak factors below.
Rule: 2 weak factors (score ≤ 2): type-strictness 2, dependency-currency 2.

## Factor scores
| Factor | Class | Score | Rule |            ← one row per factor; "–" and the reason when not measured
Scores are never averaged; the lowest scored blocking factor sets the readiness level.

### test-feedback: Test presence and feedback speed   ← one section per factor
Score 5 (base 5). Rule … · Evidence (bullets) · Partial … · Deferral …

## Risk zones
| Zone | Module | Source files | Red files | Reason |
Red paths (agents may only propose changes): bullets · Not zoned: …

## Not measured
Bullets, grouped by kind.

## Signals
### Git history · ### Code structure · ### Tests and docs · ### Dependencies   ← short tables

## Method
Inputs (config paths, EOL table date, deferrals) · commands run · collector notes.
```

Each verdict has one line saying what it means:
- **adopt:** the harness can be adopted as is.
- **adapt:** adopt it with adaptations for the weak factors.
- **prepare first:** make changes verifiable before letting agents edit.

Table cells escape `|` and newlines.

## Open Points

1. **Report contents:** the summary-only JSON above, or per-file signals as well.
2. **Audited commit:** add the HEAD commit to the git-history collector (one more read-only `git rev-parse HEAD`). This makes a report traceable to exact code.
3. **Without `--out`:** print to stdout only and write no files, or write a default folder. A default folder risks landing inside the target when you run from it.
4. **File names:** fixed (`ai-readiness-report.md` and `.json`), or named after the repository and date.

## How I Will Verify

- [ ] Layer 1 (static): `npm run lint`
- [ ] Layer 2 (runtime): `npm run test`, and Layer 2b `npx vitest run src/report`:
  - file snapshots of both formats for a fixed, git-free input;
  - a determinism test (two renders, identical bytes);
  - escaping of `|` and newlines in table cells;
  - the out-directory guard (inside the target, a symlink into it, outside it).
- [ ] Layer 3 (system): `npm run check`, with the e2e smoke run auditing a fixture repository with `--out`, checking both files exist, two runs give identical bytes, and the target (`.git` included) is unchanged.

## Dependencies

- [x] Depends on: feat-007 (passing)
- [x] Blocked by: review of this layout and schema

## Risks

- Report bytes depend on absolute paths. Reports are reproducible on the same machine, not across machines; the relative content is.
- A schema change after calibration needs `schemaVersion` bumped.

## Commit Plan

One commit for feat-008 (report model, renderers, writer, `--out`, single audit date, HEAD commit if approved, tests and snapshots, docs, decision record), then one for the gate's evidence from the clean tree.
