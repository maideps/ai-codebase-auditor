# Sprint Contract

**Feature ID:** feat-024
**Feature Name:** Agreement between zones and recorded agent outcomes
**Date:** 2026-11-18
**Estimated Duration:** 1 session
**Status:** decided without a review round, at the user's request (D-029)

## Decisions

1. **The outcomes file** (`schema: ai-codebase-auditor/outcomes`, version 1) holds `tasks[]` with a unique `id`, a non-empty `filesChanged` and a boolean `passed`, plus optional `model`, `harness` and a top-level `runner`. Every problem is named, and the command exits with code 2. The format is documented in USAGE so other runners can write it.
2. **A task's zone** is the riskiest zone among the files it changed (red > yellow > green), from the same lookup as the MCP server's `get_zone`, which moved to `src/report/zone-of.ts`. Unzoned files (tests, docs, unknown paths) do not raise it, and they are listed. A task that changes only unzoned files counts as unzoned.
3. **Rates:**
   - per zone and for all tasks, with 95% Wilson intervals;
   - a zone needs at least 5 tasks for a rate, otherwise only its counts and the reason;
   - the ordering green ≥ yellow ≥ red is checked among rated zones, and it is "not enough data" with fewer than two of them.
4. **Per verdict:** a report has one verdict, so the overall rate is labeled with it, provisional or not. Comparing verdicts means validating several reports, one run each.
5. **Mixed runs:** a note when the tasks mix models or harnesses, since the rates then mix them too.
6. **Out of scope:** running agents. The auditor never executes the audited code or an agent (PRODUCT.md non-goals); the runner is separate.

## How I Will Verify

- [ ] Layer 1: `npm run lint`
- [ ] Layer 2: `npm run test`; Layer 2b `npx vitest run src/validate`:
  - the schema and each error;
  - Wilson intervals;
  - ordered, unordered and too-few cases;
  - red tasks, unzoned and unknown paths, mixed models;
  - the renderings.

  CLI tests cover the outputs and every input error.
- [ ] Layer 3: `npm run check`. The e2e test validates a fresh report against an outcomes file.
