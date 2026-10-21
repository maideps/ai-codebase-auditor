# Sprint Contract

**Feature ID:** feat-004
**Feature Name:** Tests and docs detector
**Date:** 2026-10-21
**Estimated Duration:** 1 session

## What I Will Build

`collectTestsDocs(repoPath, { gitBinary })` in `src/collectors/tests-docs.ts`, returning a `Measurement<TestsDocs>`: test files by language convention, test runner configs (including ones declared in `pyproject.toml`, `setup.cfg` and `package.json`), CI configuration files by system, documentation by category, agent context files marked presence-only, and stated rules (rule-keyword lines with file and line) from agent context, contributing, architecture and convention docs. Every item names its path. Nothing in the target runs. The tree listing, vendored rule and link-safe file read move to `src/collectors/tree.ts`, shared with the code-structure collector. `audit` prints a summary.

## How I Will Verify

- [ ] Layer 1 (static): `npm run lint`
- [ ] Layer 2 (runtime): `npm run test`, and Layer 2b `npx vitest run src/collectors/tests-docs`: a polyglot fixture across seven languages, sparse repositories without tests, CI or rules, presence-only agent context, a symlinked rules file, an unchanged-target check
- [ ] Layer 3 (system): `npm run check`, with the e2e smoke run covering a test file and a CI file

## What Success Looks Like

Detections match the fixtures exactly, each with the convention or system that matched; the only command run is `git ls-tree`; agent context presence alone produces no rules. `npm run verify-feature -- feat-004` records a pass.

## Dependencies

- [x] Depends on: feat-001 (passing)
- [x] Blocked by: none

## Risks

- Name conventions miss unconventional test locations and may count fixtures under test directories.
- Keyword rule extraction is a heuristic: it finds written rules, not non-standard ones.

## Commit Plan

One commit for feat-004 (detector, shared tree helpers, tests, CLI wiring, docs, D-008), then one for the gate's evidence from the clean tree.
