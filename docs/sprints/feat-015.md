# Sprint Contract

**Feature ID:** feat-015
**Feature Name:** Knowledge risk in risk zones
**Date:** 2026-11-18
**Estimated Duration:** 1 session
**Status:** dropped 2026-11-18. Option 1 was chosen in review: feat-015 is removed from `feature_list.json`, and the result is recorded in D-020. Kept as the record of the survey.

## What the Feature Was Meant to Catch

feat-015 is declared to mark two kinds of file in green modules:
- **single-author files:** the whole history has one author, so knowledge sits with one person;
- **dormant files:** the last commit is older than a configured age while the rest of the module still changes.

A green module where such files hold more than a configured share of its lines would become yellow. The idea came from the October prior-art survey (Code Maat knowledge maps, D-018): code that no one active understands is riskier to hand to an agent.

## What the Calibration Clones Show (measured with a prototype, audit date 2026-11-18)

Share of the lines in each green module of 20 or more files. "Orphaned" is a third candidate added for comparison: no author of the file has committed anywhere in the repository in the last 12 months.

| Repository | Module | Single-author | Dormant > 5 years | Orphaned |
|---|---|---|---|---|
| moin-1.9 | `MoinMoin/action` | 0% | 92% | 0% |
| moin-1.9 | `MoinMoin/macro` | 0% | 89% | 0% |
| moin-1.9 | `MoinMoin/web` (252 files) | 0% | 0% | 0% |
| phpBB | `phpBB/develop` | 12% | 72% | 45% |
| phpBB | `phpBB/phpbb/db` (440 files) | 20% | 45% | 3% |
| phpBB | `phpBB/phpbb/install` | 13% | 34% | 11% |
| Redmine | `app` (340 files) | 14% | 0% | 0% |
| Redmine | `db` (331 files) | 10% | 77% | 0% |
| Struts | `core/src/main` (797 files) | 32% | 2% | 0% |
| Struts | `plugins` (592 files) | 44% | 6% | 1% |
| Struts | `apps` | 7% | 24% | 23% |

All green modules together: moin-1.9 0% / 9% / 0%, phpBB 13% / 23% / 7%, Redmine 11% / 5% / 0%, Struts 35% / 4% / 2%. DOOM has no green modules.

**Why the author signals measure how commits were made, not who knows the code:**
- **Renames reset history.** The collector does not follow renames (D-006). Struts moved its packages to `org.apache.struts2`, so many files start their history at the move. A sampled file has 1 author without `--follow` and 2 with it, and Struts's single-author shares (32–44%) are mostly this.
- **Bulk commits touch everything.** moin-1.9 has commits from 2014–2015 that changed about 1,900 files each (pep8 fixes, viewport meta tags). Every file therefore has several authors, and the one author active this year is among them. So moin-1.9 shows 0% single-author and 0% orphaned, although only 1 of its 46 authors committed in the last 12 months.
- **Committers, not contributors.** Redmine's history has 12 authors over 19,890 commits. Its core committers apply other people's patches under their own names, so 2 active committers appear on almost every file, and orphaned is 0%.

**Why dormancy measures stability, not risk:**
- **Migrations are append-only.** 77% of Redmine's `db` lines and much of phpBB's `db` are migrations, which are written once and never edited again.
- **Old plugin code is finished.** moin-1.9's `action` and `macro` are 89–92% dormant because one or two files changed this year while the rest has been stable for a decade. A file that has not changed in ten years is not the place agents get sent, and when they are, the hotspot rule (feat-014) and the tests decide the risk.

As declared, the rule would turn Struts's `plugins`, Redmine's `db`, moin-1.9's `action` and `macro`, and phpBB's `develop` yellow at any share threshold up to 40%. Every one of those would be for the reasons above. Listing the files as yellow paths instead (D-019) would produce hundreds of them.

## Options

1. **Drop feat-015 (proposed).** Remove it from `feature_list.json` and record the negative result as D-020, with this survey in the case study. The features that depend on it (feat-016, feat-019 and feat-024) would depend on feat-014 instead, which their behavior already relies on. Nothing in the product changes.
2. **Replace it with an informational signal.** The git-history summary would gain "authors active in the last 12 months" (moin-1.9: 1 of 46, phpBB: 15 of 358, Redmine: 2 of 12, Struts: 18 of 149), and each green module would get its orphaned-lines share as evidence. No zone, plan item or score would change. It's cheap and true, but on these clones orphaned shares are near 0 for the same bulk-commit reasons, so only the repository-level count tells anything.
3. **Build it as declared** with thresholds chosen from the table above. Not recommended: on the calibration set every module it would mark is a false positive.

## How I Will Verify (option 2 only)

- [ ] Layer 1: `npm run lint`
- [ ] Layer 2: `npm run test`; Layer 2b `npx vitest run src/decision/knowledge`. Fixture histories cover active and inactive authors at the 12-month edge, orphaned files, a shallow clone, and that zones, plan and scores are unchanged.
- [ ] Layer 3: `npm run check`, with the case study regenerated and the active-author counts checked against `git log`.

Option 1 needs no gate: the feature is removed rather than passed. Its removal and the dependency changes go through `npm run check`, which validates the feature graph.

## Dependencies

- [x] Depends on: feat-014 (passing)
- [ ] Blocked by: a decision on the options above
