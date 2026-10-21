# Sprint Contract

**Feature ID:** feat-005
**Feature Name:** Dependency collector
**Date:** 2026-10-21
**Estimated Duration:** 1 session

## What I Will Build

`collectDependencies(repoPath, { table, now })` in `src/collectors/dependencies.ts`, returning a `Measurement<Dependencies>`: parsed manifests with their dependencies and issues, every declared runtime assessed against a dated end-of-life table, and manifests that could not be measured. Static parsers live in `src/collectors/dependencies/` (package.json, requirements files, setup.py, pyproject.toml, composer.json, Gemfile, pom.xml, build.gradle, and six runtime version files). `config/runtime-eol.json` is built from endoflife.date rather than from memory, with its loader in `src/config/runtime-eol.ts`. `audit` loads the table and prints a summary.

## How I Will Verify

- [ ] Layer 1 (static): `npm run lint`
- [ ] Layer 2 (runtime): `npm run test`, and Layer 2b `npx vitest run src/collectors/dependencies`: one parser test per format, spec-to-version-to-cycle tables, every assessment status, the EOL-date boundary, an unchanged-target check
- [ ] Layer 3 (system): `npm run check`, with the e2e smoke run covering a declared Node.js runtime

## What Success Looks Like

Fixture manifests parse to exactly the expected dependencies and runtimes; unparseable and unsupported manifests are listed, not guessed; each runtime's status traces to a dated table row. Nothing in the target is executed and no network is used at audit time. `npm run verify-feature -- feat-005` records a pass.

## Dependencies

- [x] Depends on: feat-001 (passing)
- [x] Blocked by: none

## Risks

- EOL dates: fetched from endoflife.date instead of remembered; Java dates are vendor-dependent (Temurin, then Oracle for older cycles).
- Regular-expression parsers miss unusual constructs; whatever they see but cannot read is recorded as an issue.
- Scope: eight formats in one session; kept small by testing pure parsers without git.

## Commit Plan

One commit for feat-005 (collector, parsers, EOL table and loader, tests, CLI wiring, docs, D-009), then one for the gate's evidence from the clean tree.
