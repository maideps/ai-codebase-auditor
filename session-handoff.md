# Session Handoff

Fill this at session end for large sessions; keep it current otherwise.

## Current Objective

- Goal: build the MVP audit pipeline one feature at a time (feat-001 to feat-008), then calibrate (feat-009).
- Current status: feat-001 and feat-002 passing. feat-003 (code-structure collector) implemented and run through the gate; see `.harness/state/feat-003.json`.
- Branch / commit: `main`; see `git log --oneline -5`.

## Completed This Session

- [x] Bootstrapped and adopted the harness; harness repo left unmodified by this session.
- [x] Filed harness gaps upstream: maideps/ai-harness-framework#23, #24, #25.
- [x] Declared feat-001 to feat-010 from `docs/HANDOFF.md`.
- [x] feat-001: `audit <repo-path> [--config <file>]`, target check, factor config loader, `config/factors.json`.
- [x] feat-002: git-history collector, `Measurement<T>`, git fixture helper, D-006.
- [x] feat-003 (2026-10-21): code-structure collector, shared `collectors/git.ts`, D-007.

## Verification Evidence

| Check | Command | Result | Notes |
|---|---|---|---|
| Unit tests | `npx vitest run` | PASS, 62 tests | config, target, cli, git-history, code-structure |
| Smoke | `npm run e2e` | PASS, 6 tests | audits a fixture repo with history, a vendored and a binary file, and checks it, .git included, is unchanged |
| Feature gates | `npm run verify-feature -- <id>` | feat-001 and feat-002 PASS (clean tree), feat-003 see shard | evidence in `.harness/state/<id>.json`, logs in `.harness/logs/<id>/` |
| Architecture | `npm run check-arch` | PASS, 6/6 at bdabc39 | |

## Files Changed

- feat-003: `src/collectors/code-structure.ts` and its tests, `src/collectors/git.ts`, `src/collectors/git-history.ts` (runner moved out), `src/testing/git-fixture.ts` (binary content), `src/cli.ts`, `src/cli.test.ts`, `e2e/smoke.test.ts`; docs, D-007, `docs/sprints/feat-003.md`, `progress/003-2026-10-21.md`
- feat-002: `src/collectors/types.ts`, `src/collectors/git-history.ts` and its tests, `src/testing/git-fixture.ts`, `src/cli.ts`, `src/cli.test.ts`, `e2e/smoke.test.ts`, `tsconfig.build.json`
- Docs: `README.md`, `DECISIONS.md` (D-006), `docs/ARCHITECTURE.md`, `docs/USAGE.md`, `docs/TOOLS.md`, `docs/STANDARDS.md`, `docs/quality-document.md`, `docs/sprints/feat-002.md`, `progress/002-2026-10-19.md`

## Decisions Made

- D-001 to D-005 (adoption), D-006 (collector measurement type, git-history conventions, git hardening), D-007 (code-structure counting, exclusions, scc as enrichment).

## Blockers / Risks

- Chained layer scripts are not explicitly supported by the harness; recheck them after every `harness-upgrade` (#25).
- `harness-audit` reports the removed multi-repo templates as missing; worth adding to maideps/ai-harness-framework#24.
- Module dependency rules in `docs/ARCHITECTURE.md` are not yet encoded in `.harness/arch-rules.json`.
- Git history holds the whole log in memory and code structure reads every included file; check both on the large calibration repositories (feat-009).
- scc is not installed here, so the scc path is tested only against a stand-in; check it against a real scc before relying on language or complexity.

## Next Session Startup

1. Read `AGENTS.md`.
2. Read `feature_list.json`, `PROGRESS.md`, and the latest note under `progress/`.
3. Review this handoff and `docs/HANDOFF.md`.
4. Run `npm run check` before editing.

## Recommended Next Step

- Start feat-004 (tests and docs detector). feat-004 and feat-005 are independent and can also run as parallel lanes (`npm run lane-new -- <id>`).
