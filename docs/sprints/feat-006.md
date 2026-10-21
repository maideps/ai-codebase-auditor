# Sprint Contract

**Feature ID:** feat-006
**Feature Name:** Scoring engine
**Date:** 2026-10-21
**Estimated Duration:** 1 session
**Status:** thresholds reviewed and approved 2026-10-21 (decisions below)

## Review Decisions (2026-10-21)

- **Type strictness: language mix plus type checkers.** The tests-and-docs detector also detects type-checker configs: `tsconfig.json` with `"strict": true`, `checkJs` in `tsconfig.json` or `jsconfig.json`, mypy (`mypy.ini`, `.mypy.ini`, `[mypy]` in `setup.cfg`, `[tool.mypy]` in `pyproject.toml`), Pyright (`pyrightconfig.json`, `[tool.pyright]`), PHPStan (`phpstan.neon` and `.dist` variants), Psalm (`psalm.xml`), Sorbet (`sorbet/config`) and Steep (`Steepfile`). Dynamic code in a language with a checker counts at **0.6**. TypeScript counts at **1.0** with a strict tsconfig and **0.8** without one. All weights are configurable.
- **Factors without a signal** (direct-api-calls, module-boundaries, observability) are not measured. Readiness is provisional while direct-api-calls is unmeasured.
- **Deferrals** raise a score by one level, capped at 3.
- **Other thresholds** are implemented as written.

Refinements needed to implement the rules exactly:
- documented-intent: score 2 is "a README or any other docs", and score 3 needs that base too. This closes the gap for a repository with docs but no README.
- dependency-currency: `warnMonths`, `eolYears2` and `eolYears1` are whole numbers, compared as calendar dates. For example, end-of-life for exactly 3 years scores 2, and only more than 3 years scores 1.

## What I Will Build

`scoreFactors(collected, config, options)` in `src/scoring/`: a pure function (it never reads the repository) that turns the four collectors' measurements into one `FactorScore` per configured factor, plus the readiness level.

- Each scored factor carries its score (1 to 5), the rule that produced it, and evidence lines citing the collector values behind it.
- A factor without evidence is `not-measured` with a reason, and never gets a guessed score.
- The readiness level is the lowest score among **scored blocking** factors. Scores are never averaged. When a blocking factor is not measured, the level is marked **provisional** and that factor is named.
- Thresholds move into `config/factors.json` (a `thresholds` object per factor), validated per factor. Code holds no default numbers.
- Deferrals come from an optional `--deferrals <file>` (see below).

"Source files" below means files from the code-structure collector with a programming-language extension that are not test files. JSON, SQL dumps, docs and other data files are left out.

## Proposed Thresholds

### test-feedback (blocking): test presence

Inputs:
- **ratio**: test files ÷ source files.
- **runner**: a test runner config exists.
- **CI**: a CI file exists.

| Score | Rule |
|---|---|
| 5 | ratio ≥ 0.30, runner config and CI |
| 4 | ratio ≥ 0.15, runner config and CI |
| 3 | ratio ≥ 0.05, and a runner config or CI |
| 2 | at least one test file |
| 1 | no test files |

Feedback speed is not measured, because the audit never runs tests. The score covers presence only, and says so.
Config: `minRatio3: 0.05`, `minRatio4: 0.15`, `minRatio5: 0.30`.

### type-strictness (blocking): typed share of source lines

Each source line is weighted by its language:
- **1.0**: statically typed (TypeScript, Java, Kotlin, Scala, Go, Rust, C#, F#, Swift, Dart).
- **0.75**: weakly static (C, C++, Objective-C).
- **0**: dynamic (JavaScript, Python, Ruby, PHP, Perl, Lua, shell and others).

| Score | Weighted typed share |
|---|---|
| 5 | ≥ 0.85 |
| 4 | ≥ 0.65 |
| 3 | ≥ 0.40 |
| 2 | ≥ 0.15 |
| 1 | < 0.15 |

Config: `minShare2: 0.15`, `minShare3: 0.40`, `minShare4: 0.65`, `minShare5: 0.85`.

**Open point A:** with language mix alone, every Ruby, PHP and Python repository scores 1 on a blocking factor. Redmine (expected *adopt*) and phpBB (expected *adapt*) would then both land at readiness 1. The options are in the review questions.

### file-size (constraining): context legibility

Two metrics over source files, and the score is the lower of the two:

| Score | p90 lines per file | Share of files over 1000 lines |
|---|---|---|
| 5 | ≤ 200 | ≤ 1% |
| 4 | ≤ 400 | ≤ 3% |
| 3 | ≤ 800 | ≤ 7% |
| 2 | ≤ 1500 | ≤ 15% |
| 1 | > 1500 | > 15% |

Evidence lists the largest files. Config: `maxP90Lines5..2` and `maxShareOver1000Lines5..2`.

### documented-intent (constraining): written rules, not context files

| Score | Rule |
|---|---|
| 5 | ≥ 25 stated rules in ≥ 2 files, an architecture doc and decision records |
| 4 | ≥ 10 stated rules in ≥ 2 files, and an architecture doc or decision records |
| 3 | a README, and either ≥ 3 stated rules or any of contributing, architecture, conventions or decision records |
| 2 | a README only |
| 1 | no README and no docs |

An agent context file adds nothing by itself (arXiv 2602.11988); only the rules written in it count. Config: `minRules3: 3`, `minRules4: 10`, `minRules5: 25`.

### dev-deploy-simplicity (constraining, partial)

Score = 1 + the number of these signals present:
1. CI configured.
2. A test runner configured.
3. A runtime version declared.
4. A lock file committed.

Marked **partial**: build scripts and containers (Makefile, Dockerfile, compose files) are not detected yet. No thresholds to configure.

### dependency-currency (constraining): runtime end of life

The worst declared runtime with a known status decides:

| Score | Rule |
|---|---|
| 5 | every runtime supported for more than 12 more months |
| 4 | all supported, but one reaches end of life within 12 months |
| 3 | one is end-of-life, for less than 1 year |
| 2 | one is end-of-life, for 1 to 3 years |
| 1 | one is end-of-life, for more than 3 years |

The factor is not measured when no runtime has a known status. The age and vulnerabilities of individual packages are not measured.
Config: `warnMonths: 12`, `eolYears2: 1`, `eolYears1: 3`.

### Not measured in this feature: no collector signal yet

- **direct-api-calls** (blocking): needs call-site analysis. Its absence makes every readiness level provisional for now.
- **module-boundaries** (constraining): needs an import graph or git co-change coupling.
- **observability** (constraining): needs a logging and metrics detector.

## Deferrals

`audit --deferrals <file>` takes JSON of this shape:

```json
{ "version": 1, "deferrals": [{ "factor": "...", "recorded": "YYYY-MM-DD", "reason": "...", "revisitBy": "YYYY-MM-DD" }] }
```

`revisitBy` is optional. A deferral raises a scored factor by one level, **capped at 3**: it acknowledges a gap without fixing it.

The score is reported as base score plus deferral, so the raise is visible. A deferral is reported but not applied when:
- its `revisitBy` date is before the audit date (expired);
- its factor is not measured.

Unknown factor ids and invalid dates are config errors (exit 2).

## Sanity check on the repositories available locally

The calibration repositories are not cloned yet (feat-009).

| Repo | test ratio | runner / CI | p90 lines | > 1000 lines | typed share | stated rules |
|---|---|---|---|---|---|---|
| ai-codebase-auditor | 0.50 | 3 / 1 | 322 | 2.8% | 0.34 (the harness's JavaScript scripts count) | 42 in 5 files |
| ai-harness-framework | 0.47 | 1 / 2 | 516 | 5.9% | 0.00 | 46 in 5 files |

Under the proposed thresholds:
- **ai-codebase-auditor**: test-feedback 5, type-strictness 2, file-size 4, documented-intent 5, dependency-currency 2 (`engines.node >=18` has been end-of-life for 1.5 years).
- **ai-harness-framework**: type-strictness 1, the language-mix problem from open point A.

## How I Will Verify

- [ ] Layer 1 (static): `npm run lint`
- [ ] Layer 2 (runtime): `npm run test`, and Layer 2b `npx vitest run src/scoring src/config`. Table-driven tests cover every threshold edge (just below, at, just above), each not-measured path, the deferral rule (raise, cap, expiry, unmeasured factor), the lowest-blocking-factor rule and provisional readiness, plus validation of thresholds and deferrals.
- [ ] Layer 3 (system): `npm run check`, with the e2e smoke run printing scores and the readiness level.

## Dependencies

- [x] Depends on: feat-002 to feat-005 (passing)
- [x] Blocked by: review of these thresholds

## Risks

- Thresholds are first guesses, checked on two small repos only. feat-009 calibration is where they get tested; every number lives in config so it can change without code changes.
- Language-based type strictness penalizes dynamic languages (open point A).
- Three factors are unmeasurable today, so readiness stays provisional until collectors exist for them.

## Commit Plan

One commit for feat-006 (scoring module, thresholds in config, deferrals loader, tests, CLI output, docs, decision record), then one for the gate's evidence from the clean tree.
