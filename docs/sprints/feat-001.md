# Sprint Contract

**Feature ID:** feat-001
**Feature Name:** CLI skeleton and config loader
**Date:** 2026-10-19
**Estimated Duration:** 1 session

## What I Will Build

`ai-codebase-auditor audit <repo-path> [--config <file>]`: argument parsing with `node:util` `parseArgs`, a target check (the path exists, is a directory and holds a `.git` entry, read statically), and a loader that validates the factor configuration. The default `config/factors.json` holds the nine factors from the concept, three blocking and six constraining. On success the CLI prints the target, the config path and the factor summary. Every input problem exits 2 and is listed, not just the first one.

## How I Will Verify

- [ ] Layer 1 (static): `npm run lint`: harness lint plus ESLint strict on `src/` and `e2e/`
- [ ] Layer 2 (runtime): `npm run test`, and Layer 2b `npx vitest run src/cli src/config src/target`: argument parsing, target validation, each config validation error
- [ ] Layer 3 (system): `npm run check`, including the e2e smoke run against a temporary git repository (valid config, broken config, missing target)

## What Success Looks Like

`node dist/cli.js audit <some git repo>` prints the factor summary and exits 0. A non-repository path, an unknown option or an invalid config exits 2 with one line per problem. The audited directory is unchanged. `npm run verify-feature -- feat-001` records a pass.

## Dependencies

- [x] Depends on: none
- [x] Blocked by: none

## Risks

- Config schema churn: thresholds belong to feat-006, so the schema stays minimal now (`version`, factor `id`, `name`, `class`, `description`) and grows with scoring.
- Package-root resolution: the default config path must work from both `src/` (tests) and `dist/` (built CLI).

## Commit Plan

One commit for feat-001 (code, tests, config, docs), then the gate's evidence shard.
