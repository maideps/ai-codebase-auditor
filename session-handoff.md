# Session Handoff

Fill this at session end for large sessions; keep it current otherwise.

## Current Objective

- Goal: build the MVP audit pipeline one feature at a time (feat-001 to feat-008), calibrate it (feat-009), then add version 2 (feat-010).
- Current status: feat-001 to feat-009 passing. feat-010 (harness adaptation plan and modernization roadmap) is done and has been run through the gate; see `.harness/state/feat-010.json`. All ten declared features are built.
- Branch / commit: `main`; see `git log --oneline -5`.

## Completed This Session

- [x] Bootstrapped and adopted the harness; harness repo left unmodified by this session.
- [x] Filed harness gaps upstream: maideps/ai-harness-framework#23, #24, #25.
- [x] Declared feat-001 to feat-010 from `docs/HANDOFF.md`.
- [x] feat-001: `audit <repo-path> [--config <file>]`, target check, factor config loader, `config/factors.json`.
- [x] feat-002: git-history collector, `Measurement<T>`, git fixture helper, D-006.
- [x] feat-003 (2026-10-21): code-structure collector, shared `collectors/git.ts`, D-007.
- [x] feat-004 (2026-10-21): tests-and-docs detector, shared `collectors/tree.ts`, D-008.
- [x] feat-005 (2026-10-21): dependency collector, dated runtime EOL table from endoflife.date, D-009.
- [x] feat-006 (2026-10-21): scoring engine with reviewed thresholds, deferrals, type-checker detection, D-010.
- [x] feat-007 (2026-10-21): decision engine with reviewed verdict and zone rules, D-011.
- [x] feat-008 (2026-10-22): Markdown and JSON reports with --out, deterministic by audit date, HEAD commit recorded, D-012.
- [x] feat-009 (2026-10-22): calibration on DOOM, moin-1.9, phpBB, Struts and Redmine; reviewed labels; detector fixes and type-strictness constraining, D-013.
- [x] feat-010 (2026-10-22): harness adaptation plan and modernization roadmap from reviewed rules, `config/harness-requirements.json`, `--harness`, report schemaVersion 3, regenerated case study, D-014.

## Verification Evidence

| Check | Command | Result | Notes |
|---|---|---|---|
| Unit tests | `npx vitest run` | PASS, 384 tests | config, target, cli, all four collectors, scoring, deferrals, decision, plan, roadmap, report |
| Smoke | `npm run e2e` | PASS, 8 tests | audits a fixture repo, writes reports twice with identical bytes, refuses an out directory inside the target, and checks the target, .git included, is unchanged |
| Feature gates | `npm run verify-feature -- <id>` | feat-001 to feat-009 PASS (clean tree), feat-010 see shard | evidence in `.harness/state/<id>.json`, logs in `.harness/logs/<id>/` |
| Architecture | `npm run check-arch` | PASS, 6/6 at bdabc39 | |

## Files Changed

- feat-010: `src/plan/` (plan, roadmap) and tests, `src/config/harness-requirements.ts` and test, `config/harness-requirements.json`, `src/scoring/rules.ts` (shared type-share and band helpers), `src/report/` (schemaVersion 3, plan and roadmap sections) and snapshots, `src/testing/` (scoring helper), `src/cli.ts`, `src/cli.test.ts`, `e2e/smoke.test.ts`, `docs/case-study/` (regenerated); docs, D-014, `docs/sprints/feat-010.md`, `progress/010-2026-10-22.md`
- feat-009: `docs/case-study/` (five reports, README, labels.json), `src/file-kinds.ts` (test paths), `src/collectors/tests-docs.ts` (build-tool runners, docs skip test paths), `src/collectors/dependencies.ts` (testFixture), `src/scoring/rules.ts`, `config/factors.json` (type-strictness constraining), `src/report/` (schemaVersion 2, fixture marking), tests and snapshots; docs, D-013, `docs/sprints/feat-009.md`, `progress/009-2026-10-22.md`
- feat-008: `src/report/` (model, json, markdown, write) with tests and snapshots, `src/collectors/git-history.ts` (HEAD), `src/testing/collected.ts`, `src/scoring/rules.ts` (plural), `src/cli.ts`, `src/cli.test.ts`, `e2e/smoke.test.ts`; docs, D-012, `docs/sprints/feat-008.md`, `progress/008-2026-10-22.md`
- feat-007: `src/decision/` and tests, `src/config/decision.ts` and test, `config/decision.json`, `src/cli.ts`, `src/cli.test.ts`, `e2e/smoke.test.ts`; docs, D-011, `docs/sprints/feat-007.md`, `progress/007-2026-10-21.md`
- feat-006: `src/scoring/` and tests, `src/config/deferrals.ts` and test, `src/config/factors.ts` (thresholds), `config/factors.json`, `src/file-kinds.ts`, `src/collectors/tests-docs.ts` (type checkers), `src/collectors/code-structure.ts`, `src/testing/collected.ts`, `src/cli.ts`, `src/cli.test.ts`, `e2e/smoke.test.ts`; docs, D-010, `docs/sprints/feat-006.md`, `progress/006-2026-10-21.md`
- feat-005: `src/collectors/dependencies.ts`, `src/collectors/dependencies/` (parsers, versions, toml) and tests, `src/config/runtime-eol.ts` and test, `config/runtime-eol.json`, `src/cli.ts`, `src/cli.test.ts`, `e2e/smoke.test.ts`, `vitest.config.ts`, `vitest.e2e.config.ts`; docs, D-009, `docs/sprints/feat-005.md`, `progress/005-2026-10-21.md`
- feat-004: `src/collectors/tests-docs.ts` and its tests, `src/collectors/tree.ts`, `src/collectors/code-structure.ts` (helpers moved out), `src/cli.ts`, `src/cli.test.ts`, `e2e/smoke.test.ts`; docs, D-008, `docs/sprints/feat-004.md`, `progress/004-2026-10-21.md`
- feat-003: `src/collectors/code-structure.ts` and its tests, `src/collectors/git.ts`, `src/collectors/git-history.ts` (runner moved out), `src/testing/git-fixture.ts` (binary content), `src/cli.ts`, `src/cli.test.ts`, `e2e/smoke.test.ts`; docs, D-007, `docs/sprints/feat-003.md`, `progress/003-2026-10-21.md`
- feat-002: `src/collectors/types.ts`, `src/collectors/git-history.ts` and its tests, `src/testing/git-fixture.ts`, `src/cli.ts`, `src/cli.test.ts`, `e2e/smoke.test.ts`, `tsconfig.build.json`
- Docs: `README.md`, `DECISIONS.md` (D-006), `docs/ARCHITECTURE.md`, `docs/USAGE.md`, `docs/TOOLS.md`, `docs/STANDARDS.md`, `docs/quality-document.md`, `docs/sprints/feat-002.md`, `progress/002-2026-10-19.md`

## Decisions Made

- D-001 to D-005 (adoption), D-006 (collector measurement type, git-history conventions, git hardening), D-007 (code-structure counting, exclusions, scc as enrichment), D-008 (path-based test and docs detection, stated rules), D-009 (static dependency parsing, dated EOL table), D-010 (scoring rules, provisional readiness, capped deferrals), D-011 (verdict rules, module splitting, red paths), D-012 (one report model, audit date as time unit, out-directory guard), D-013 (calibration changes), D-014 (plan and roadmap rules, separate harness requirements file).

## Blockers / Risks

- Chained layer scripts are not explicitly supported by the harness; recheck them after every `harness-upgrade` (#25).
- `harness-audit` reports the removed multi-repo templates as missing; worth adding to maideps/ai-harness-framework#24.
- Module dependency rules in `docs/ARCHITECTURE.md` are not yet encoded in `.harness/arch-rules.json`.
- scc is not installed here, so the scc path is tested only against a stand-in; check it against a real scc before relying on language or complexity.
- This project's own `package.json` declares `engines.node: ">=18"`, which the dependency collector reports as end-of-life since 2025-04-30 (see D-001); raising it is a separate decision.
- `config/runtime-eol.json` is a snapshot as of 2026-10-21; refresh it at least yearly (docs/USAGE.md).
- Readiness is provisional on every repository until direct-api-calls has a collector; today test-feedback alone sets it.
- Known calibration limits (bundled libraries under non-standard names, red-term and doc-name false positives) are listed in `docs/case-study/README.md`. Red-term false positives now also become `permissions.deny` suggestions in the plan.
- `config/harness-requirements.json` describes ai-harness-framework 0.5.0 (`7fb142a`); update it when the harness changes.
- Roadmap effort (S/M/L) comes from counts and ignores code difficulty.
- The calibration clones live in `D:\7-Maide\Projects\audit-targets\` (about 540 MB); drive D: had 11 GB free at the time.

## Next Session Startup

1. Read `AGENTS.md`.
2. Read `feature_list.json`, `PROGRESS.md`, and the latest note under `progress/`.
3. Review this handoff and `docs/HANDOFF.md`.
4. Run `npm run check` before editing.

## Recommended Next Step

- Add a direct-api-calls collector so readiness stops being provisional, or test one generated plan end to end on a copy of a calibration clone.
