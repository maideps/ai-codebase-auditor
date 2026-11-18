# Sprint Contract

**Feature ID:** feat-014
**Feature Name:** Hotspots in risk zones
**Date:** 2026-11-18
**Estimated Duration:** 1 session
**Status:** open points reviewed and approved 2026-11-18, all as proposed (decisions below); not implemented

## Review Decisions (2026-11-18)

- **Zone effect:** (b). An untested hotspot is a yellow path inside its green module, and the module stays green. feat-014's declared behavior in `feature_list.json` was reworded to say so before implementation.
- **Thresholds:** 90th percentile, at least 4 commits in 12 months and at least 300 lines.
- **Complexity:** length only. scc complexity is evidence when it ran.
- **Scope:** green modules only.

## Settled During Implementation (recorded in D-019)

- **Test-name matching is a suffix match:** once test words are dropped, the test's name must *end with* the file's name, as whole words, not just contain it. Otherwise `issue_status_test.rb` would name `issue.rb`. On the calibration set this adds phpBB's two language files to the yellow paths. They are labeled FP: string tables.
- **Red files are left out** of the hotspot candidates and percentiles. They are proposals only already.
- **Plan:** a required `yellow-paths` item, using the yellow guardrail from `config/harness-requirements.json`. That text now says "modules and files".
- **Report:** `signals.gitHistory.hotspots` (the ten most changed files) was renamed `mostChanged`, so "hotspots" means only the zone hotspots. `config/decision.json` holds the thresholds as a `hotspots` object, and `HotspotSettings` lives in `src/config/decision.ts` because `config` depends on nothing else in `src/`.
- **Counts:** commits are counted with side branches, as the collector always has (D-006). phpBB's `install.php` has 9 commits only under `git log --full-history`.
- **Case study:** regenerated on 2026-11-18. Every yellow path was checked against its clone, and the labels are in `docs/case-study/labels.json`: 6 TP and 8 FP (6 tested under another name, 2 string tables).

## What the Feature Means

Zones today come from the test-feedback score, file size and red-path names (`src/decision/zones.ts`). The git-history collector already counts commits per file over the last 12 months, and the code-structure collector counts lines, but no zone uses them. A hotspot is a file that is both large and changing often. Agents are most likely to be sent there, and a wrong change there costs the most. If no test is named after it, its current behavior is not pinned, so characterization tests should come first, even inside a green module.

Factor scores and the verdict do not change (D-018). The minimal-pair study (arXiv 2605.20049) found that cleaner code changed agent cost, not pass rate, so hotspots guide *where* to be careful, not *whether* agents may work.

## Proposed Rule

A product source file in a **green** module is a **hotspot** when both hold:
- its commits in the last 12 months are at or above the module's 90th percentile among files changed in that window, and at least **4**;
- its length is at or above the module's 90th percentile, and at least **300** lines.

A hotspot is **untested** when no test file's name contains the source file's name as whole words (`webpush.php` matches `notification_method_webpush_test.php`; `StrutsConstants.java` matches `StrutsConstantsTest.java`). Words split on separators and camelCase, as red-path terms already do; `test`, `tests`, `spec` and `specs` are ignored.

All four numbers go in `config/decision.json` (`hotspotPercentile`, `hotspotMinCommits`, `hotspotMinLines`), validated like the other decision settings.

**Not measured:** history not measured (no git, shallow clone or no commits), or the window holds no commits. The report says so and why. Dormant repositories such as DOOM have no hotspots by design: nothing is changing. Dormant code is feat-015's subject.

## What It Would Produce on the Calibration Set (measured with a prototype, audit date 2026-10-23)

| Repo | Hotspots | Untested | Untested hotspots |
|---|---|---|---|
| DOOM | 0 | 0 | none: no commits since 2024-01-16 |
| moin-1.9 | 2 | 2 | `MoinMoin/action/info.py` (6 commits, 397 lines), `MoinMoin/macro/MonthCalendar.py` (4, 498) |
| phpBB | 6 | 2 | `build/code_sniffer/.../UnusedUseSniff.php` (8, 501), `phpBB/phpbb/storage/controller/attachment.php` (5, 642) |
| Redmine | 12 | 4 | `app/assets/javascripts/application-legacy.js` (9, 1570), `app/controllers/application_controller.rb` (8, 834), `app/javascript/controllers/gantt/chart_controller.js` (10, 462), `lib/redmine/preparation.rb` (11, 441) |
| Struts | 13 | 4 | `StrutsConstants.java` (18, 865), `DefaultConfiguration.java` (9, 739), `StrutsParameterAuthorizer.java` (5, 391), `AbstractLocalizedTextProvider.java` (4, 935) |

Without the 4-commit and 300-line floors, the percentile alone flagged one-file modules (phpBB's root `eslint.config.mjs`, 2 commits, 67 lines) and 11 of phpBB's 59 green modules. A stricter variant (6 commits, 400 lines) drops both moin-1.9 files and leaves Struts with 2 hotspots.

Matching by name has a known limit: `StrutsConstants.java` has no test named after it, but 27 Struts tests reference it. "Untested" therefore means "no test named after it". The report wording says that, not "has no tests".

## Open Points

1. **What an untested hotspot does to its module.**
   - **(a) As declared in feat-014:** the whole module becomes yellow. On the calibration set that turns Redmine's `app` (340 files) and `lib` (142), Struts's `core/src/main` (797), moin-1.9's `action` and `macro`, and phpBB's `build` and `storage` yellow, each because of one to four files.
   - **(b) Proposed:** the module stays green, and each untested hotspot is listed as a **yellow path** inside it, the way red paths already sit inside green modules: characterization tests before agents edit that file. The zone keeps meaning "most of this module is safe", and the guardrail lands on the files that need it.

   (b) changes feat-014's declared behavior ("a green module … becomes yellow"). If you approve it, I'll update the declaration in `feature_list.json` before writing code. That's how the harness expects a behavior change to happen.
2. **Thresholds:** 90th percentile with floors of 4 commits and 300 lines (proposed), or 6 commits and 400 lines.
3. **Complexity:** scc is not installed here and was not used for the case study, and zones would differ between machines with and without it. Proposed: the rule uses **length only**, and scc complexity is shown as evidence when it ran. The alternative is complexity when available, else length, which the declaration allows but which makes zones depend on the machine.
4. **Yellow and red modules:** hotspots are computed only for green modules (proposed). Yellow modules already need characterization tests everywhere, and red files are proposals only.

## What I Will Build (with the proposals above)

- `src/decision/hotspots.ts`: the hotspot rule and test-name matching, as pure functions over the collected signals.
- `assignZones` calls it for green modules. Each `ModuleZone` gains `hotspots: { path, commitsLastYear, lines, complexity, testedBy }[]`. `Zones` gains `yellowPaths` (untested hotspots, with module and reason) and a `hotspotNote` when history is not measured.
- The harness plan: untested hotspots join the existing zone guardrail as files that need characterization tests first. Red paths keep their `permissions.deny` entries. Hotspots get no deny entry: agents may still edit them after tests exist.
- The roadmap: no new step, because no score changes.
- The report gets `schemaVersion` 7, a "Hotspots" table for the green modules in the Markdown risk-zones section, yellow paths beside red paths, and the existing 12-month list kept as "most changed files".
- Docs: `docs/USAGE.md` (zones), the README's risk-zones lines, a decision record (D-019) and a case-study section.

## How I Will Verify

- [ ] Layer 1 (static): `npm run lint`
- [ ] Layer 2 (runtime): `npm run test`, and Layer 2b `npx vitest run src/decision/hotspots`:
  - each threshold edge: percentile ties, exactly 4 commits, exactly 300 lines, modules with one file or no changed files;
  - test-name matching: suffix, prefix and camelCase forms, words ignored, no partial-word match (`db` must not match `dbal_test`);
  - history not measured, and a shallow clone;
  - zones: a green module keeps green with a yellow path; yellow and red modules get no hotspots; scores and the verdict are unchanged;
  - config validation of the new settings.
- [ ] Layer 3 (system): `npm run check`. The five case-study reports are regenerated, and every untested hotspot is checked against its clone (is there really no test named after it, and is it really large and changing).

## Dependencies

- [x] Depends on: feat-002, feat-003, feat-007 (passing)
- [ ] Blocked by: review of the open points above

## Risks

- **Name matching misses indirect tests** (constants files, classes tested through callers). The report says "no test named after it", and the case study counts how many listed files have indirect tests.
- **The 12-month window ends at the audit date**, so a repository that paused a year ago shows no hotspots even though its last active year had some. That's intended: hotspots describe current change.
- **Percentiles are per module.** Module boundaries come from `groupModules`, so a module split changes the cut. The floors limit the effect.

## Commit Plan

One commit for feat-014 (rule, zones, plan, report `schemaVersion` 7, tests, regenerated case study, docs, D-019, and the updated declaration if (b) is approved), then one for the gate's evidence from the clean tree.
