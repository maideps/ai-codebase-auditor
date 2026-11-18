# Sprint Contract

**Feature ID:** feat-019
**Feature Name:** Generated harness files in the output directory
**Date:** 2026-11-18
**Estimated Duration:** 1 session
**Status:** decided without a review round, at the user's request (D-024)

## Decisions

1. **Five files under `<out>/harness/`:** `AGENTS.snippet.md`, `claude-settings.json`, `characterization-tests.md`, `roadmap-checks.json` and a `README.md` that says what each file is for and what it was built from. Nothing is ever written to the audited repository. The out-directory guard is unchanged, and the writer refuses any generated path that is absolute or contains `..`, including with backslashes.
2. **Citations:** each AGENTS rule names its plan item, level and trigger (the factor and its score, or the zone and its count). `claude-settings.json` must stay a valid settings fragment, so it holds only `permissions.deny`, and the README maps every deny rule to its red path and term. Each checklist line carries its zone's reason. Each roadmap check carries the step's factor, its current score and the score a re-audit should show (`minScore`).
3. **Checklist scope:** yellow modules and yellow paths. The declaration said "per yellow module listing its hotspots", but hotspots are computed only for green modules (D-019), and yellow paths are the files that need tests, so the declaration was reworded.
4. **Roadmap checks** are data plus instructions: re-run the audit and compare the factor's score. A script would be one more thing to install in the audited repository.
5. **Determinism:** the files come from the same inputs as the report (plan, zones, roadmap, audit date and commit), with deny rules sorted, so the same input gives the same bytes. The e2e test compares them across two runs.

## How I Will Verify

- [ ] Layer 1: `npm run lint`
- [ ] Layer 2: `npm run test`; Layer 2b `npx vitest run src/plan/files`:
  - each file's content and citations;
  - no red paths, no yellow zones, an empty plan;
  - roadmap checks matching the roadmap;
  - determinism;
  - the writer's refusals.
- [ ] Layer 3: `npm run check`, with the e2e tests comparing the harness files byte for byte across runs and checking that the target is unchanged.
