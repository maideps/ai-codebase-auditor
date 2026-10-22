# Sprint Contract

**Feature ID:** feat-009
**Feature Name:** Calibration run on the five test repos
**Date:** 2026-10-22
**Estimated Duration:** 1 session

This contract was written at the end of the run instead of the start. The first half of the session followed the user's instructions: clone, audit, then propose labels and a comparison for review. Writing it before starting was missed and is recorded in the session note.

## What I Built

- Full-history clones of DOOM, moin-1.9, phpBB, Struts and Redmine, outside this repository.
- One audit per repository with `--out` into `docs/case-study/<repo>/`, timed, with each clone's `git status` checked afterwards.
- Proposed labels and an expected-versus-actual comparison, reviewed by the user. The approved changes were then applied (D-013):
  - build-tool test runners;
  - test-fixture runtimes listed but not counted;
  - docs under test paths ignored;
  - type-strictness constraining;
  - report `schemaVersion` 2.
- Regenerated reports, final labels (`docs/case-study/labels.json`) and the case-study write-up.

## How I Verified

- [x] Layer 1 (static): `npm run lint`
- [x] Layer 2 (runtime): `npm run test`, including new tests for build-tool runners, docs under test paths, fixture runtimes and the reclassified readiness
- [x] Layer 3 (system): `npm run check`
- [x] Every final verdict matches its (revised) expectation; DOOM (readiness 1, prepare first) and Redmine (readiness 5, adapt) land at opposite ends

## Dependencies

- [x] Depends on: feat-008 (passing)

## Risks

- The clones are a snapshot as of 2026-10-22. Re-audits use whatever HEAD the clones are at, and each report records its commit.
- The known limits listed in the case study stay open.
