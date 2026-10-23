# Sprint Contract

**Feature ID:** feat-012
**Feature Name:** Module-boundaries collector
**Date:** 2026-10-23
**Estimated Duration:** 1 session
**Status:** coupling measure and thresholds reviewed and approved 2026-10-23 (decisions below); not implemented

## Review Decisions (2026-10-23)

All four open points were approved as recommended:
- **Measure:** the share of counted commits that change product source in two or more modules.
- **Thresholds:** 10/20/30/40% for scores 5 to 2.
- **Window:** the latest 500 counted commits, not measured under 50.
- **Zones:** the factor stays repository-wide; zones are unchanged.

## Settled During Implementation (recorded in D-016)

- **Rule context:** rules hold no default numbers, so scoring gets the module settings from the CLI. This is a new `RuleContext` argument, filled from `config/decision.json`. Without it, the factor is reported as not measured ("module settings were not given").
- **Collector output:** the collector keeps every commit's source files, newest first, from at most 5000 commits read. Tests, modules and mass edits are applied by the rule, which knows the tests-docs list and the modules.
- **A plan test changed meaning:** the prepare-first framing test now sets module-boundaries as not measured. With it measured at 5, weak tests give *adapt*, which is the point of the factor.

## What the Factor Means

`config/factors.json` defines module-boundaries as: *"Modules have clear edges, so a change can be scoped to one area."* The git history shows directly whether that holds: when changes usually stay inside one module, an agent can be given one module and finish its work there. When they usually spill into others, the agent needs a wider scope, and parallel agents on neighbouring modules collide.

The factor is constraining, but the verdict depends on it. *Prepare first* applies when tests are weak **and** boundaries are not established, and today an unmeasured factor counts as not established (`src/decision/verdict.ts:31`). Once measured, a repository with weak tests but a boundary score of 3 or more gets *adapt* instead.

## What I Will Build

- A collector, `src/collectors/co-change.ts`. It runs one read-only `git log` (non-merge commits, no rename detection, file names only) through the pinned git runner and keeps the files of the most recent commits that touch source code. Nothing else is read or run.
- A scoring rule for module-boundaries, thresholds in `config/factors.json`.
- A harness requirement and a roadmap step for the factor.
- A collector summary in `audit` output and a `coChange` signal in the report (`schemaVersion` 5).

## Proposed Measure

**Modules** are the same as the risk zones' modules. These are the top-level directories, split while one holds more than half the source files, down to depth 3 (`splitShare` and `maxDepth` in `config/decision.json`). The grouping moves from `decision/zones.ts` to a shared `src/modules.ts`, so zones and scoring cannot drift apart. A path in an older commit maps to the deepest current module that contains it; a path outside every current module is ignored.

**Files that count:** product source files only. Excluded:
- tests (the tests-docs list, plus test-path directories for files deleted since);
- docs, config and data files;
- vendored and generated paths.

A commit that touches both `app/` and `test/` is normal work, not a leaky boundary.

**Commits that count:** non-merge commits that change at least one product source file in a current module. A commit that changes more than **50** product source files is skipped as a mass edit (reformatting, license headers, imports of a library) and counted in the evidence.

**Window:** the most recent **500** counted commits, whatever their dates. A date window fails on dormant projects: moin-1.9 has only 12 commits in the last 24 months.

**Measure:** the **share of counted commits that change product source files in two or more modules**.

| Score | Share of cross-module commits |
|---|---|
| 5 | ≤ 10% |
| 4 | ≤ 20% |
| 3 | ≤ 30% |
| 2 | ≤ 40% |
| 1 | > 40% |

**Not measured:**
- fewer than **50** counted commits;
- fewer than 2 modules;
- a shallow clone;
- a repository with no commits.

**Evidence:**
- the share and the window (commit count and dates);
- the number of skipped mass edits;
- the top 5 coupled module pairs. A pair's strength is its commits together ÷ the smaller module's commits, and only pairs with at least 5 commits together are listed;
- 3 sample commit hashes for the strongest pair.

**Partial:** coupling through imports, shared data or configuration is not measured, only changes made together.

## Plan and Roadmap Additions

- **Harness requirement `scoped-lanes`** (factor module-boundaries; surfaces `AGENTS.md` and feature lanes):
  - **Required (≤ 2):** in `AGENTS.md`, treat each strongly coupled module pair as one area. A feature that touches either module plans for both, and parallel lanes never take the two modules of a coupled pair. The harness's arch-002 does not stop two lanes from editing the same files.
  - **Recommended (3):** list the strongly coupled pairs in `AGENTS.md`.
- **Roadmap step:** "reduce cross-module changes from X% to Y%, starting with the most coupled pairs A + B (N commits together) and C + D". Effort is always L, because it is restructuring work.

## What This Would Produce on the Calibration Set (measured with a prototype)

| Repo | Counted commits (window) | Cross-module share | Score | Strongest pair | Verdict |
|---|---|---|---|---|---|
| DOOM | 2 | – | not measured: fewer than 50 commits | – | prepare first, unchanged |
| moin-1.9 | 500 (2010-01 to 2026-07) | 21.6% | 3 | `MoinMoin/(files)` + `MoinMoin/security`: 5 together, 56% | adapt, unchanged |
| phpBB | 500 (2025-04 to 2026-10) | 20.8% | 3 | `phpBB/phpbb/auth` + `phpBB/phpbb/ucp`: 9 together, 75% | adopt, unchanged |
| Struts | 500 (2023-10 to 2026-10) | 11.0% | 4 | `apps` + `core/src/main`: 11 together, 52% | adopt, unchanged |
| Redmine | 500 (2025-03 to 2026-10) | 15.4% | 4 | `app` + `db`: 10 together, 50% | adapt, unchanged |

No verdict or readiness level changes: the factor is constraining and none of the five is weak. DOOM stays *prepare first* because four commits say nothing about its structure. The shares are stable between a 250- and a 500-commit window, within 3 points for each repository.

## Open Points

1. **Measure:** the share of cross-module commits (proposed), or the strength of the most coupled pair, or the lower score of the two. The pair strength flags phpBB's auth + ucp (75%) sharply, but it rests on few commits.
2. **Thresholds:** the bands above (10/20/30/40%), or stricter bands (5/10/20/30%), which would score Struts 3 as well.
3. **Window:** the latest 500 counted commits with a minimum of 50 (proposed), or the last 24 months, which leaves moin-1.9 unmeasured with 12 commits.
4. **Zones:** keep the factor repository-wide (proposed), or also turn both modules of a pair over 50% strength yellow.

## How I Will Verify

- [ ] Layer 1 (static): `npm run lint`
- [ ] Layer 2 (runtime): `npm run test`, and Layer 2b `npx vitest run src/collectors/co-change`:
  - fixture repositories with known commit histories: in-module and cross-module commits, test-only and docs-only commits, mass edits, deleted directories, merges left out, a shallow clone;
  - the window and minimum-commit rules;
  - the score rule at each band edge, and pair strengths;
  - the shared module grouping, giving the same modules as the zones;
  - the requirement and the roadmap step;
  - an unchanged-target check.
- [x] Layer 3 (system): `npm run check`. The five case-study reports are regenerated, and the strongest pair in each repository is checked against its sample commits.

## Dependencies

- [x] Depends on: feat-011 (passing)
- [x] Blocked by: review of these rules (approved 2026-10-23)

## Risks

- **Modules are directories.** A repository whose real modules do not follow its directories, such as Java packages under one source root, scores on the wrong units. The zones share this limit.
- **History reflects how people worked, not only how the code is shaped.** One developer's habit of bundling changes raises the share.
- **A second `git log`:** git-history already reads the log. The new collector reads it again to stay independent, which costs a few seconds on large histories such as phpBB's 28,503 commits.

## Commit Plan

One commit for feat-012 (collector, shared modules, rule, config, requirement and roadmap step, report `schemaVersion` 5, CLI, tests, regenerated case study, docs, decision record), then one for the gate's evidence from the clean tree.
