# Sprint Contract

**Feature ID:** feat-003
**Feature Name:** Code-structure collector
**Date:** 2026-10-21
**Estimated Duration:** 1 session

## What I Will Build

`collectCodeStructure(repoPath, { gitBinary, scc })` in `src/collectors/code-structure.ts`, returning a `Measurement<CodeStructure>`. For the files tracked at HEAD it reports per-file lines and bytes, the size distribution (percentiles, buckets, largest files), and the top-level modules. Vendored, generated, binary, symlink, submodule and missing files are excluded and listed with their reason. A built-in counter always produces the sizes; scc, when on PATH, adds language, code lines and complexity, and the result records whether scc ran. The git runner moves to `src/collectors/git.ts` so both git-based collectors share one hardened implementation. `audit` prints a summary.

## How I Will Verify

- [ ] Layer 1 (static): `npm run lint`
- [ ] Layer 2 (runtime): `npm run test`, and Layer 2b `npx vitest run src/collectors/code-structure`: a fixture tree with known sizes and every exclusion reason, scc used, missing, failing and unparseable through a stand-in, an unchanged-target check
- [ ] Layer 3 (system): `npm run check`, with the e2e smoke run auditing a fixture repository with a vendored and a binary file

## What Success Looks Like

Counts match the fixture exactly, every skipped file is listed with its reason, links are never read through, and the summary is the same with or without scc apart from the scc-only fields. `npm run verify-feature -- feat-003` records a pass.

## Dependencies

- [x] Depends on: feat-001 (passing)
- [x] Blocked by: none

## Risks

- scc is not installed on this machine: its JSON shape is taken from scc's documentation and tested against a stand-in only.
- Tracked symlinks pointing outside the target: handled by tree mode and a real-path check.
- Large repositories: every included file is read fully.

## Commit Plan

One commit for feat-003 (collector, shared git runner, tests, CLI wiring, docs, D-007), then one for the gate's evidence from the clean tree.
