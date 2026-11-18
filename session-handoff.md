# Session Handoff

Fill this at session end for large sessions; keep it current otherwise.

## Current Objective

- Goal: version 3, the backlog from the November 2026 prior-art refresh (D-018): feat-014 and feat-016 to feat-024. feat-015 was surveyed and dropped (D-020).
- Current status: all 23 declared features pass the gate. No feature is active and none is planned. The work ran on 2026-11-18 without review stops at the owner's request: each sprint contract records its choices, and D-019 to D-029 hold the reasons.
- Branch / commit: `main`, committed locally and not pushed; see `git log --oneline -30`.

## Completed This Session

- Harness upgraded to ai-harness-framework 368139b (session 016). The README-check false positive was fixed upstream in maideps/ai-harness-framework#62 (open, not merged when this was written).
- feat-014: hotspots in green modules become yellow paths (D-019).
- feat-015: knowledge risk surveyed and dropped; git authorship measured commit workflow, not knowledge (D-020).
- feat-016: read-only MCP server `mcp <report.json>` and the risk-zones agent skill (D-021).
- feat-017: SARIF output and `--fail-on` (D-022).
- feat-018: installable package (`npm pack`) and a composite GitHub Action (D-023).
- feat-019: copy-ready harness files under `--out/harness/` (D-024).
- feat-020: `compare` for two saved reports (D-025).
- feat-021: `audit-batch` for a portfolio (D-026).
- feat-022 and feat-023: direct-call rules for C#, Go, C and C++. DOOM is now measured and no longer provisional (D-027, D-028).
- feat-024: `validate` checks the zones against agent outcomes recorded elsewhere (D-029).

## Verification Evidence

- Every feature's gate evidence and trail are in `.harness/state/` and `.harness/trails/`. Each passing state is bound to its feature commit.
- `npm run check` passes: 710 unit tests and 15 e2e tests, with check-arch in the chain. `clean-state-check` passes.
- The case study was regenerated on 2026-11-18 with the feat-014 and feat-023 changes. All five clones stayed unchanged.

## Files Changed

- Product: `src/` (decision/hotspots, mcp, compare, batch, validate, report/sarif, saved and zone-of, plan/files, dynamic-call rules), `config/`, `e2e/`, `action.yml`, `.github/workflows/ci.yml`, `package.json`.
- Records: `feature_list.json`, `docs/sprints/feat-014.md` to `feat-024.md`, `DECISIONS.md` (D-018 to D-029), `docs/USAGE.md`, `docs/ARCHITECTURE.md`, `README.md`, `docs/case-study/`, `docs/quality-document.md`, `progress/015` to `027`.

## Decisions Made

- See D-018 to D-029. The changes to declared behavior were made openly, in the declarations and the contracts:
  - feat-014: yellow paths instead of whole yellow modules;
  - feat-016: the skill lives in `config/`;
  - feat-017: SARIF is checked structurally;
  - feat-019: checklist scope;
  - feat-022: the real-repository check is deferred.

## Blockers / Risks

- Nothing is pushed. The GitHub Action and its CI job (`action`) have not run yet; the first push will show whether they work.
- No C# or Go repository was audited: cloning one needs the owner's approval. Precision on real C# and Go code is unmeasured.
- The zones are not validated: `validate` exists, but no outcome data has been recorded. That needs a separate agent runner.
- Yellow paths match tests by name, so 6 of the 14 calibration yellow paths are tested under another name (known limit 6).
- Still open from session 014: `docs/TOOLS.md` says `.claude/settings.json` is empty; `init.sh` does not print the session brief; the CI actions need the v5 bump.

## Next Session Startup

1. Read `AGENTS.md`.
2. Read `feature_list.json`, `PROGRESS.md`, and the latest note under `progress/`.
3. Review this handoff.
4. Run `npm run check` before editing.

## Recommended Next Step

- Push `main` and watch the `action` CI job. Then decide on a C# or Go calibration repository to clone, and on a runner that records agent outcomes for `validate`.
