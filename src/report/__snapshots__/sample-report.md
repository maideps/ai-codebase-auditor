# AI-readiness audit: sample

| | |
|---|---|
| Target | `/repos/sample` at commit `0123456789ab` |
| Audit date | 2026-10-22 |
| Verdict | **adapt** |
| Readiness level | **2 of 5**, set by direct-api-calls |
| Tool | ai-codebase-auditor 0.1.0 |

## Verdict

**adapt**: adopt the harness with adaptations for the weak factors below.

Rule: 4 weak factors (score ≤ 2): type-strictness 1, direct-api-calls 2, documented-intent 2, dependency-currency 1

Triggered by: type-strictness 1, direct-api-calls 2, documented-intent 2, dependency-currency 1.

## Factor scores

| Factor | Class | Score | Rule |
|---|---|---|---|
| test-feedback | blocking | 5 | ratio 0.30 ≥ 0.3 with a runner config and CI |
| type-strictness | constraining | 1 | weighted typed share 0.00 |
| direct-api-calls | blocking | 2 | 20.00% of 10 covered files have a computed-target call (3 sites) |
| file-size | constraining | 5 | lower of p90 40 lines (→ 5) and 0.00% of files over 1000 lines (→ 5) |
| module-boundaries | constraining | 5 | 10.00% of the latest 60 commits change more than one module |
| documented-intent | constraining | 2 | a README without written rules |
| observability | constraining | – | not measured: no collector signal yet: needs a logging and metrics detector |
| dev-deploy-simplicity | constraining | 5 | 4 of 4 signals: CI configured, test runner configured, runtime version declared, lock file committed |
| dependency-currency | constraining | 1 | worst runtime is end-of-life since 2023-04-30 |

Scores are never averaged; the lowest scored blocking factor sets the readiness level.

### test-feedback: Test presence and feedback speed

Score **5** (blocking). Rule: ratio 0.30 ≥ 0.3 with a runner config and CI.

Evidence:

- 3 test files for 10 source files: ratio 0.30
- test runner configs: jest.config.js
- CI: .github/workflows/ci.yml

Partial: feedback speed is not measured: the audit never runs tests.

### type-strictness: Type strictness

Score **1** (constraining). Rule: weighted typed share 0.00.

Evidence:

- typed share 0.00 of 390 source lines (strong 0, weak 0, checked dynamic 0, unchecked dynamic 390)
- type checkers: none

### direct-api-calls: Direct calls (visible at call site)

Score **2** (blocking). Rule: 20.00% of 10 covered files have a computed-target call (3 sites).

Evidence:

- 2 of 10 covered product files (20.00%) have computed-target calls: 3 sites
- by construct: computed call 2, eval or Function 1
- top files: src/f0.js (2), src/auth/login.js (1)
- sample sites: src/f0.js:1 computed call, src/auth/login.js:1 eval or Function, src/f0.js:2 computed call
- covered languages hold 100.00% of 390 source lines

Partial: configuration-wired dispatch (dependency injection, XML mappings, callbacks by symbol, annotations) is not detected.

### file-size: File size and context legibility

Score **5** (constraining). Rule: lower of p90 40 lines (→ 5) and 0.00% of files over 1000 lines (→ 5).

Evidence:

- 10 source files: p90 40 lines, 0 over 1000 lines (0.00%)
- largest: src/f0.js (40 lines), src/f1.js (40 lines), src/f2.js (40 lines), src/f3.js (40 lines), src/f4.js (40 lines)

### module-boundaries: Module boundary clarity

Score **5** (constraining). Rule: 10.00% of the latest 60 commits change more than one module.

Evidence:

- 6 of 60 commits (10.00%) change product source in two or more of 2 modules, 2025-11-03 to 2026-01-01
- skipped as mass edits (over 50 product source files): 0
- coupled pairs (at least 5 commits together): src/(files) + src/auth (6 together, 100% of src/auth's 6 commits)
- sample commits for src/(files) + src/auth: 0000000, 0000001, 0000002

Partial: coupling through imports, shared data or configuration is not measured, only changes made together.

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
| green | `src/(files)` | 9 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 40 lines, 0% over 1000 lines) |
| red | `src/auth` | 1 | 1 | every source file is on a red path: agents may only propose changes |

Red paths:

- `src/auth/` (auth)

Not zoned (no source files): test.

## Harness adaptation plan

For ai-harness-framework 0.5.0 (commit `7fb142a`). Adopt the harness with these adaptations.

| Level | Item | Trigger | Surfaces |
|---|---|---|---|
| required | typed-changes | type-strictness 1 | package.json typecheck script, DECISIONS.md |
| required | traceable-calls | direct-api-calls 2 | AGENTS.md, package.json lint script |
| required | written-intent | documented-intent 2 | AGENTS.md, docs/ARCHITECTURE.md |
| required | supported-runtime | dependency-currency 1 | CI, verification layers |
| required | detected-stack | test-feedback 5 | package.json layer scripts |
| required | red-paths | red zone: 1 path | AGENTS.md, .claude/settings.json |

### required: typed-changes

Trigger: type-strictness 1. Surfaces: `package.json typecheck script`, `DECISIONS.md`.

Change: Add a type checker for the main dynamic language in check mode, with a baseline so existing code passes and new code is checked; point the typecheck layer at it and record the baseline as a dated deferral.

Why: Dynamic code without a checker lets an agent's type mistakes through every static layer.

- main dynamic language: javascript (390 source lines); suggested checker: TypeScript checkJs

### required: traceable-calls

Trigger: direct-api-calls 2. Surfaces: `AGENTS.md`, `package.json lint script`.

Change: List the files with computed-target calls in AGENTS.md as "find every call target before editing", and add a lint rule to the lint layer that rejects new eval and computed-name calls (for example ESLint no-eval and no-implied-eval, RuboCop Security/Eval, Bandit B307).

Why: A call whose target is computed at run time does not show up when an agent searches for the method it renames or changes, so the agent breaks callers it never saw.

- files with computed-target calls: src/f0.js (2), src/auth/login.js (1)

### required: written-intent

Trigger: documented-intent 2. Surfaces: `AGENTS.md`, `docs/ARCHITECTURE.md`.

Change: Write the project's non-standard practices as rules in AGENTS.md, and fill docs/ARCHITECTURE.md by hand: the harness placeholder check passes generic template text (maideps/ai-harness-framework#23).

Why: Agents follow written rules; unwritten local conventions are exactly what they get wrong (arXiv 2602.11988).

- README: README.md; contributing: none; architecture: none; decision records: 0; conventions: none
- stated rules: 2 in 1 file
- agent context files (presence alone scores nothing): AGENTS.md

### required: supported-runtime

Trigger: dependency-currency 1. Surfaces: `CI`, `verification layers`.

Change: Run the verification layers under the declared legacy runtime (a container or a pinned toolchain in CI), separately from the harness's own Node 18 or later, and keep agents away from runtime-sensitive code paths without that toolchain.

Why: Code verified on a different runtime than it ships on is not verified.

- node >=14 (package.json, engines.node): cycle 14 end-of-life since 2023-04-30

### required: detected-stack

Trigger: test-feedback 5. Surfaces: `package.json layer scripts`.

Change: Declare each verification layer command explicitly in package.json scripts (for example phpunit, bin/rails test, make check), so no required layer reports only SKIP.

Why: The harness picks layer commands from root markers; when it does not detect the repository's main language, its layers run the wrong tool or SKIP, and a SKIP-only required layer fails verify-feature (D-029).

- the harness would detect none, but the main language is javascript

### required: red-paths

Trigger: red zone: 1 path. Surfaces: `AGENTS.md`, `.claude/settings.json`.

Change: List these paths as proposal-only in AGENTS.md, and add Claude Code permissions.deny rules so agents cannot edit them directly; agents propose diffs for a person to apply.

Why: Auth, billing, permission and secret code needs human review of every change.

- src/auth/ (auth): deny Edit(src/auth/**), Write(src/auth/**)

## Modernization roadmap

Ordered by priority: score gain (plus 1 when a weak factor leaves weak) × 2 for blocking factors ÷ effort (S 1, M 2, L 3).

| # | Factor | Score | Effort | Priority | Step | Verdict after |
|---|---|---|---|---|---|---|
| 1 | direct-api-calls | 2 → 3 | S | 4 | make the computed-target calls explicit in 1 of 2 files (to 10% of files), starting with src/f0.js (2), src/auth/login.js (1) | unchanged |
| 2 | dependency-currency | 1 → 5 | M | 2.5 | upgrade node from 14 to 24 | unchanged |
| 3 | documented-intent | 2 → 3 | S | 2 | write at least 3 project rules (AGENTS.md or CONTRIBUTING) | unchanged |
| 4 | type-strictness | 1 → 3 | M | 1.5 | configure TypeScript checkJs for javascript with a baseline (typed share 0.00 to 0.60) | unchanged |

## Not measured

- factor `observability`: no collector signal yet: needs a logging and metrics detector
- manifest `go.mod`: not a supported manifest
- tool `scc`: test

## Signals

### Git history

1 non-merge commit (1 in the 12 months to 2026-10-21), 1 author, first none, last none, 0 tracked files.

Hotspots (most commits in the last 12 months):

None.

### Code structure

13 files, 0 lines; per file p50 0, p90 0, p99 0, max 0. Excluded: generated 1. scc: not used (test).

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

### Dynamic calls

13 covered files read, tests included; 2 with computed-target calls, 3 sites. Skipped: minified 1.

| Language | Files | With sites | Sites |
|---|---|---|---|
| javascript | 13 | 2 | 3 |

| Construct | Sites |
|---|---|
| computed call | 2 |
| eval or Function | 1 |

Files with the most sites:

| File | Sites | Constructs |
|---|---|---|
| `src/f0.js` | 2 | computed call |
| `src/auth/login.js` | 1 | eval or Function |

### Co-change

60 non-merge commits read; 60 change source files, 2025-11-03 to 2026-01-01. The module-boundaries factor above maps them onto today's modules.

## Method

- Factor config: `/tool/config/factors.json`
- Decision config: `/tool/config/decision.json`
- End-of-life table: `/tool/config/runtime-eol.json`, as of 2026-10-21 (1 day before the audit)
- Deferrals: none
- Harness requirements: `/tool/config/harness-requirements.json`

Read-only commands run against the target:

- `git ls-tree -r -z HEAD`

Collector notes:

- none
