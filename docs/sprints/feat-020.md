# Sprint Contract

**Feature ID:** feat-020
**Feature Name:** Compare two audits
**Date:** 2026-11-18
**Estimated Duration:** 1 session
**Status:** decided without a review round, at the user's request (D-025)

## Decisions

1. **What counts as change:**
   - the verdict and readiness;
   - each factor's score, labeled raised, lowered, unchanged, now measured, no longer measured, added or removed, with its rule (or reason) before and after;
   - modules whose zone changed, appeared or disappeared;
   - red paths and yellow paths added and removed;
   - roadmap steps of the earlier audit whose target score the later audit reached.
2. **Same repository:** both reports must name the same `target.path`. A report holds no other identity, and audits from one clone or one CI checkout path share it. Otherwise exit 2.
3. **Versions:** both reports must be `schemaVersion` 7, through the same reader as `mcp`, which now lives in `src/report/saved.ts`.
4. **Output:** text to stdout. With `--out`, the command also writes `ai-readiness-compare.md` and `ai-readiness-compare.json` (`schema: ai-codebase-auditor/comparison`, version 1) through `report/write.ts`. When the audited repository exists on this machine, the out directory may not be inside it.
5. **Before and after:** the order on the command line decides, not the dates, so a person can compare in either direction.

## How I Will Verify

- [ ] Layer 1: `npm run lint`
- [ ] Layer 2: `npm run test`; Layer 2b `npx vitest run src/compare`:
  - a report against itself;
  - every kind of factor change, zone moves, red and yellow path changes, completed roadmap steps;
  - different repositories;
  - the three renderings.

  CLI tests cover argument errors, a mismatched version and `--out`.
- [ ] Layer 3: `npm run check`. The e2e test audits a fixture repository, commits tests and an auth file, audits again, and compares the two reports.
