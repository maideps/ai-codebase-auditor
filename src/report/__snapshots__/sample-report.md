# AI-readiness audit: sample

| | |
|---|---|
| Target | `/repos/sample` at commit `0123456789ab` |
| Audit date | 2026-10-22 |
| Verdict | **adapt** (provisional: direct-api-calls not measured) |
| Readiness level | **1 of 5**, set by type-strictness (provisional) |
| Tool | ai-codebase-auditor 0.1.0 |

## Verdict

**adapt** (provisional: direct-api-calls not measured): adopt the harness with adaptations for the weak factors below.

Rule: 3 weak factors (score ≤ 2): type-strictness 1, documented-intent 2, dependency-currency 1

Triggered by: type-strictness 1, documented-intent 2, dependency-currency 1.

## Factor scores

| Factor | Class | Score | Rule |
|---|---|---|---|
| test-feedback | blocking | 5 | ratio 0.43 ≥ 0.3 with a runner config and CI |
| type-strictness | blocking | 1 | weighted typed share 0.00 |
| direct-api-calls | blocking | – | not measured: no collector signal yet: needs call-site analysis |
| file-size | constraining | 5 | lower of p90 40 lines (→ 5) and 0.00% of files over 1000 lines (→ 5) |
| module-boundaries | constraining | – | not measured: no collector signal yet: needs an import graph or co-change coupling |
| documented-intent | constraining | 2 | a README without written rules |
| observability | constraining | – | not measured: no collector signal yet: needs a logging and metrics detector |
| dev-deploy-simplicity | constraining | 5 | 4 of 4 signals: CI configured, test runner configured, runtime version declared, lock file committed |
| dependency-currency | constraining | 1 | worst runtime is end-of-life since 2023-04-30 |

Scores are never averaged; the lowest scored blocking factor sets the readiness level.

### test-feedback: Test presence and feedback speed

Score **5** (blocking). Rule: ratio 0.43 ≥ 0.3 with a runner config and CI.

Evidence:

- 3 test files for 7 source files: ratio 0.43
- test runner configs: jest.config.js
- CI: .github/workflows/ci.yml

Partial: feedback speed is not measured: the audit never runs tests.

### type-strictness: Type strictness

Score **1** (blocking). Rule: weighted typed share 0.00.

Evidence:

- typed share 0.00 of 270 source lines (strong 0, weak 0, checked dynamic 0, unchecked dynamic 270)
- type checkers: none

### direct-api-calls: Direct API calls

Not measured (blocking): no collector signal yet: needs call-site analysis.

### file-size: File size and context legibility

Score **5** (constraining). Rule: lower of p90 40 lines (→ 5) and 0.00% of files over 1000 lines (→ 5).

Evidence:

- 7 source files: p90 40 lines, 0 over 1000 lines (0.00%)
- largest: src/f0.js (40 lines), src/f1.js (40 lines), src/f2.js (40 lines), src/f3.js (40 lines), src/f4.js (40 lines)

### module-boundaries: Module boundary clarity

Not measured (constraining): no collector signal yet: needs an import graph or co-change coupling.

### documented-intent: Documented intent

Score **2** (constraining). Rule: a README without written rules.

Evidence:

- README: README.md; contributing: none; architecture: none; decision records: 0; conventions: none
- stated rules: 2 in 1 file
- agent context files (presence alone scores nothing): AGENTS.md

### observability: Observability

Not measured (constraining): no collector signal yet: needs a logging and metrics detector.

### dev-deploy-simplicity: Dev and deploy simplicity

Score **5** (constraining). Rule: 4 of 4 signals: CI configured, test runner configured, runtime version declared, lock file committed.

Evidence:

- CI: .github/workflows/ci.yml
- test runner configs: jest.config.js
- declared runtimes: node >=14 (package.json)
- lock files: package-lock.json

Partial: build scripts and containers are not detected yet.

### dependency-currency: Dependency and runtime currency

Score **1** (constraining). Rule: worst runtime is end-of-life since 2023-04-30.

Evidence:

- node >=14 (package.json, engines.node): cycle 14 end-of-life since 2023-04-30

Partial: package versions are not checked for age or vulnerabilities.

## Risk zones

Green: agents may edit. Yellow: add characterization tests first. Red: agents may only propose changes.

| Zone | Module | Source files | Red files | Reason |
|---|---|---|---|---|
| green | `src/(files)` | 6 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 40 lines, 0% over 1000 lines) |
| red | `src/auth` | 1 | 1 | every source file is on a red path: agents may only propose changes |

Red paths:

- `src/auth/` (auth)

Not zoned (no source files): test.

## Not measured

- factor `direct-api-calls`: no collector signal yet: needs call-site analysis
- factor `module-boundaries`: no collector signal yet: needs an import graph or co-change coupling
- factor `observability`: no collector signal yet: needs a logging and metrics detector
- manifest `go.mod`: not a supported manifest
- tool `scc`: test

## Signals

### Git history

1 non-merge commit (1 in the 12 months to 2026-10-21), 1 author, first none, last none, 0 tracked files.

Hotspots (most commits in the last 12 months):

None.

### Code structure

10 files, 0 lines; per file p50 0, p90 0, p99 0, max 0. Excluded: generated 1. scc: not used (test).

Largest files:

None.

### Tests and docs

- Test files: 3 (`*.test.* / *.spec.*` 3)
- Test runner configs: Jest (`jest.config.js`)
- CI: GitHub Actions (`.github/workflows/ci.yml`)
- Type checkers: none
- README: README.md; contributing: none; architecture: none; decision records: 0; conventions: none
- Agent context files (presence alone scores nothing): AGENTS.md
- Stated rules: 2

| File | Line | Rule |
|---|---|---|
| `AGENTS.md` | 1 | Never do thing 0. |
| `AGENTS.md` | 2 | Never do thing 1. |

### Dependencies

None.

| Runtime | Spec | Declared in | Cycle | Status | End of life |
|---|---|---|---|---|---|
| node | >=14 | `package.json` (engines.node) | 14 | end-of-life | 2023-04-30 |

## Method

- Factor config: `/tool/config/factors.json`
- Decision config: `/tool/config/decision.json`
- End-of-life table: `/tool/config/runtime-eol.json`, as of 2026-10-21 (1 day before the audit)
- Deferrals: none

Read-only commands run against the target:

- `git ls-tree -r -z HEAD`

Collector notes:

- none
