# Sprint Contract

**Feature ID:** feat-018
**Feature Name:** Installable package and GitHub Action
**Date:** 2026-11-18
**Estimated Duration:** 1 session
**Status:** decided without a review round, at the user's request (D-023)

## Decisions

1. **The package:** `files` already limits the tarball to `dist/`, `config/` (configs and the risk-zones skill), `README.md` and `LICENSE`. A new `prepack` script deletes `dist/` and rebuilds, so a pack never ships stale compiled files from an older build. `private: true` stays (D-005): publishing to npm is a human step, which starts by removing it.
2. **The install test:** the e2e test runs `npm pack --ignore-scripts` on the `dist/` that `npm run e2e` has just built. The prepack clean build would delete `dist/` under the smoke tests that run in parallel. It installs the tarball offline into an empty project, then runs the installed binary through `npm exec` to audit a fixture repository and print the version. It also checks the tarball's file list: no sources, tests or harness files.
3. **The Action:** a composite `action.yml` at the repository root, with these steps:
   - build the auditor from the Action's own checkout;
   - audit `inputs.path` into `inputs.out` (default `$RUNNER_TEMP/ai-readiness`, which is always outside the audited repository), keeping the exit code;
   - append the Markdown report to the job summary;
   - upload the SARIF with `github/codeql-action/upload-sarif@v3` (category `ai-codebase-auditor`; needs `security-events: write`; can be turned off with `upload-sarif: "false"`);
   - fail last with the audit's exit code.

   The summary and the upload therefore still happen when `fail-on` stops the job. Outputs: `verdict` and `report-dir`.
4. **Paths:** the report directory is resolved in a shell step, not in an input default, because `hashFiles` only sees the workspace and input defaults cannot be relied on to expand `runner` expressions.
5. **CI:** a new `action` job in `.github/workflows/ci.yml` creates a fixture repository and runs the Action twice: once without a gate, and once with `fail-on: adapt` and `continue-on-error`. It then checks the report files, the `verdict` output, and that the gated step failed unless the verdict is adopt. It runs on the next push. The run that built this feature did not push.

## How I Will Verify

- [ ] Layer 1: `npm run lint`
- [ ] Layer 2: `npm run test`; Layer 2b `npx vitest run --config vitest.e2e.config.ts e2e/package` (pack, file list, offline install, audit with the installed binary)
- [ ] Layer 3: `npm run check`
- [ ] The CI `action` job, on the next push. Both YAML files were parsed locally.
