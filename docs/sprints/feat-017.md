# Sprint Contract

**Feature ID:** feat-017
**Feature Name:** SARIF output and a verdict gate for CI
**Date:** 2026-11-18
**Estimated Duration:** 1 session
**Status:** decided without a review round. The user asked for the remaining features to be built without stopping for review, so the points below were settled as recommended and recorded in D-022.

## What the Feature Means

CI and code-scanning tools should see the audit without parsing the Markdown, and a pipeline should be able to stop on a weak verdict.

## Decisions

1. **SARIF results:** one result per weak factor (score ≤ `weakMax`), yellow module, yellow path (added since the declaration, from feat-014) and red path. Each result carries a rule id (`factor/<id>`, `zone/yellow-module`, `zone/yellow-path`, `zone/red-path`) and a message with the report's rule and evidence.
2. **Levels:** `error` for a weak blocking factor; `warning` for a weak constraining factor, a yellow module or a yellow path; `note` for a red path. A red path is guidance for agents, not a defect.
3. **Locations:** zone results point at their file or directory (`src/auth/`, or `.` for the root module), relative to `%SRCROOT%`. Factor results have no location: they describe the whole repository, and SARIF allows that. Code-scanning tools that require a location may skip them, so the JSON report stays the full record.
4. **Run properties:** verdict, provisional flag, readiness, audit date and commit.
5. **`--fail-on <adapt|prepare-first>`:** exits 1 when the verdict ranks at or below the level (adopt > adapt > prepare first), or when there is no verdict. The summary gains a `Verdict gate` line that names a provisional verdict as provisional. The gate is checked after the report files are written, so a failing pipeline still has the reports. Any other value exits 2. Without the option, exit codes are unchanged.
6. **Validating SARIF without downloading the schema:** the declared verification said "validate against the 2.1.0 schema". The schema file would have to be downloaded, which this run avoids, so the tests check the 2.1.0 schema's required structure instead: `version`, `runs`, `tool.driver.name`, unique rule ids, a `message.text`, a valid `level` and a `ruleIndex` that matches its `ruleId` for every result, and forward-slash URIs. The validator is tested against a broken log too. The declaration's verification was reworded to say so.

## How I Will Verify

- [ ] Layer 1: `npm run lint`
- [ ] Layer 2: `npm run test`; Layer 2b `npx vitest run src/report/sarif src/cli`:
  - SARIF structure, results and levels by kind, `weakMax`, determinism and a file snapshot;
  - the gate for every verdict and level, provisional verdicts and no verdict;
  - CLI exit codes, invalid values, and SARIF written under `--out`.
- [ ] Layer 3: `npm run check`. The e2e tests compare the three report files byte for byte across two runs and check the built CLI's exit codes.
