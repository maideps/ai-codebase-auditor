# Sprint Contract

**Feature ID:** feat-002
**Feature Name:** Git-history collector
**Date:** 2026-10-19
**Estimated Duration:** 1 session

## What I Will Build

`collectGitHistory(repoPath, { now, gitBinary })` in `src/collectors/git-history.ts`, returning a `Measurement<GitHistory>`: repository totals and one entry per file tracked at HEAD, with non-merge commits over the full history and the last 12 months, distinct authors, and first and last commit dates. It uses only read-only git commands, pinned to the target, and reports a missing git binary, an empty repository, a shallow clone or an unreadable repository as not measured. `audit` prints the totals.

## How I Will Verify

- [ ] Layer 1 (static): `npm run lint`
- [ ] Layer 2 (runtime): `npm run test`, and Layer 2b `npx vitest run src/collectors/git-history`: fixture repositories with known authors and dates, merges, unusual paths, a shallow clone, an empty repository, a missing git binary, a broken `.git`, and an unchanged-target check
- [ ] Layer 3 (system): `npm run check`, with the e2e smoke run auditing a fixture repository and checking it, `.git` included, is unchanged

## What Success Looks Like

The collector's numbers match hand-counted fixture histories exactly. Expected failure conditions come back as `not-measured` with a clear reason. `audit` on a real repository prints the git-history totals and leaves that repository's `git status` unchanged. `npm run verify-feature -- feat-002` records a pass.

## Dependencies

- [x] Depends on: feat-001 (passing)
- [x] Blocked by: none

## Risks

- Git output parsing: probed first in scratch repositories (`-z` record layout, unusual paths, shallow and empty repositories) instead of assumed.
- Untrusted target config or location: mitigated by pinning git to the target (D-006).
- Large histories: avoid spreading large arrays into `Math.min`/`Math.max`; the whole log is still held in memory.

## Commit Plan

One commit for feat-002 (collector, fixture helper, tests, CLI wiring, docs, D-006), then one for the gate's evidence from the clean tree.
