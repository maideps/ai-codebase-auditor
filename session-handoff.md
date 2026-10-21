# Session Handoff

Fill this at session end for large sessions; keep it current otherwise.

## Current Objective

- Goal: build the MVP audit pipeline one feature at a time (feat-001 to feat-008), then calibrate (feat-009).
- Current status: feat-001 to feat-005 passing. feat-006 (scoring engine) implemented and run through the gate; see `.harness/state/feat-006.json`. The decision engine (feat-007) is next.
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

## Verification Evidence

| Check | Command | Result | Notes |
|---|---|---|---|
| Unit tests | `npx vitest run` | PASS, 255 tests | config, target, cli, all four collectors, scoring, deferrals |
| Smoke | `npm run e2e` | PASS, 6 tests | audits a fixture repo with history, a test file, a CI file, a declared Node.js runtime, a vendored and a binary file, and checks it, .git included, is unchanged |
| Feature gates | `npm run verify-feature -- <id>` | feat-001 to feat-005 PASS (clean tree), feat-006 see shard | evidence in `.harness/state/<id>.json`, logs in `.harness/logs/<id>/` |
| Architecture | `npm run check-arch` | PASS, 6/6 at bdabc39 | |

## Files Changed

- feat-006: `src/scoring/` and tests, `src/config/deferrals.ts` and test, `src/config/factors.ts` (thresholds), `config/factors.json`, `src/file-kinds.ts`, `src/collectors/tests-docs.ts` (type checkers), `src/collectors/code-structure.ts`, `src/testing/collected.ts`, `src/cli.ts`, `src/cli.test.ts`, `e2e/smoke.test.ts`; docs, D-010, `docs/sprints/feat-006.md`, `progress/006-2026-10-21.md`
- feat-005: `src/collectors/dependencies.ts`, `src/collectors/dependencies/` (parsers, versions, toml) and tests, `src/config/runtime-eol.ts` and test, `config/runtime-eol.json`, `src/cli.ts`, `src/cli.test.ts`, `e2e/smoke.test.ts`, `vitest.config.ts`, `vitest.e2e.config.ts`; docs, D-009, `docs/sprints/feat-005.md`, `progress/005-2026-10-21.md`
- feat-004: `src/collectors/tests-docs.ts` and its tests, `src/collectors/tree.ts`, `src/collectors/code-structure.ts` (helpers moved out), `src/cli.ts`, `src/cli.test.ts`, `e2e/smoke.test.ts`; docs, D-008, `docs/sprints/feat-004.md`, `progress/004-2026-10-21.md`
- feat-003: `src/collectors/code-structure.ts` and its tests, `src/collectors/git.ts`, `src/collectors/git-history.ts` (runner moved out), `src/testing/git-fixture.ts` (binary content), `src/cli.ts`, `src/cli.test.ts`, `e2e/smoke.test.ts`; docs, D-007, `docs/sprints/feat-003.md`, `progress/003-2026-10-21.md`
- feat-002: `src/collectors/types.ts`, `src/collectors/git-history.ts` and its tests, `src/testing/git-fixture.ts`, `src/cli.ts`, `src/cli.test.ts`, `e2e/smoke.test.ts`, `tsconfig.build.json`
- Docs: `README.md`, `DECISIONS.md` (D-006), `docs/ARCHITECTURE.md`, `docs/USAGE.md`, `docs/TOOLS.md`, `docs/STANDARDS.md`, `docs/quality-document.md`, `docs/sprints/feat-002.md`, `progress/002-2026-10-19.md`

## Decisions Made

- D-001 to D-005 (adoption), D-006 (collector measurement type, git-history conventions, git hardening), D-007 (code-structure counting, exclusions, scc as enrichment), D-008 (path-based test and docs detection, stated rules), D-009 (static dependency parsing, dated EOL table), D-010 (scoring rules, provisional readiness, capped deferrals).

## Blockers / Risks

- Chained layer scripts are not explicitly supported by the harness; recheck them after every `harness-upgrade` (#25).
- `harness-audit` reports the removed multi-repo templates as missing; worth adding to maideps/ai-harness-framework#24.
- Module dependency rules in `docs/ARCHITECTURE.md` are not yet encoded in `.harness/arch-rules.json`.
- Git history holds the whole log in memory and code structure reads every included file; check both on the large calibration repositories (feat-009).
- scc is not installed here, so the scc path is tested only against a stand-in; check it against a real scc before relying on language or complexity.
- This project's own `package.json` declares `engines.node: ">=18"`, which the dependency collector reports as end-of-life since 2025-04-30 (see D-001); raising it is a separate decision.
- `config/runtime-eol.json` is a snapshot as of 2026-10-21; refresh it at least yearly (docs/USAGE.md).
- Readiness is provisional on every repository until direct-api-calls has a collector; thresholds are first guesses until feat-009 calibration.

## Next Session Startup

1. Read `AGENTS.md`.
2. Read `feature_list.json`, `PROGRESS.md`, and the latest note under `progress/`.
3. Review this handoff and `docs/HANDOFF.md`.
4. Run `npm run check` before editing.

## Recommended Next Step

- Start feat-007 (decision engine): adopt, adapt or prepare first from the factor profile, with the rule and scores behind each verdict, and risk zones per module.
