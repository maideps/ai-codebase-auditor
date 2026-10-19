# Architectural Decisions Log

This file records significant architectural decisions, their context, alternatives considered, and consequences. It serves as durable cross-session memory for why the codebase is structured the way it is.

## Decision Template

```
### D-XXX: [Decision Title]

**Date:** YYYY-MM-DD
**Status:** proposed | accepted | deprecated | superseded by D-YYY
**Context:** [What problem are we solving? What constraints exist?]
**Decision:** [What did we decide to do?]
**Alternatives considered:**
- Alternative 1: [description] — Rejected because [reason]
**Consequences:**
- Positive: [benefits gained]
- Negative: [tradeoffs accepted]
```

## Recorded Decisions

<!-- Add decision records here, newest last. Expand long records into docs/decisions/ and link back from here. -->

### D-001: TypeScript CLI on Node, built through ai-harness-framework

**Date:** 2026-10-19
**Status:** accepted
**Context:** The project is a portfolio piece meant to show building with AI coding agents through the owner's own harness. The harness runtime is Node ≥ 18. The planning session recorded the product decisions in `docs/HANDOFF.md`.
**Decision:** Write the CLI in TypeScript on Node ≥ 18, as an ES module package. Bootstrap the harness with `create-harness` and build every feature through its gates. The MVP is audit-only (score and verdict, Markdown plus JSON); the harness adaptation plan and modernization roadmap are version 2.
**Alternatives considered:**
- Python CLI — Rejected because it would add a second runtime next to the harness's Node.
**Consequences:**
- Positive: one runtime for product and harness; npm scripts are the layer commands directly.
- Negative: Node 18 is past end of life; `engines` stays at ≥ 18 to match the harness, and tool versions are kept within that range (Vitest 3, ESLint 9).

### D-002: Chain harness self-checks with product tools in the layer scripts

**Date:** 2026-10-19
**Status:** accepted
**Context:** For Node projects each `package.json` script key is a verification layer. The shipped values run the harness's own self-checks (surfaces, skills, feature schema, WIP=1, runner tests, Make targets), and the harness docs say to replace them with product tools. Replacing them would drop those checks from `npm run check` and every feature gate without warning.
**Decision:** Each of `lint`, `typecheck`, `test` and `build` runs `node scripts/framework-check.mjs <layer> && <product tool>`. Product tools: ESLint 9 with typescript-eslint strict, `tsc --noEmit` (strict), Vitest, `tsc -p tsconfig.build.json`.
**Alternatives considered:**
- Replace the values outright — Rejected because only `check-arch` would still cover the harness contract, and it does not check skills, the progress log or the command reference.
- A separate `harness-self-check` script added to `check` — Rejected for now because `check` is a harness-shipped value too; this is the better long-term fix and is proposed upstream in maideps/ai-harness-framework#25.
**Consequences:**
- Positive: both the harness contract and the product are verified in every layer.
- Negative: chaining is not explicitly documented as supported by the harness; after each `harness-upgrade` the five layer scripts must be checked by hand.

### D-003: e2e is a smoke run of the built CLI, not the harness adoption matrix

**Date:** 2026-10-19
**Status:** accepted
**Context:** The harness's default `e2e` is its adoption matrix, which generates throwaway adopter repositories and tests the harness. On a fresh adoption it made `init.sh` run more than 10 minutes on Windows, and every feature gate runs `npm run check`.
**Decision:** `e2e` builds the CLI and runs Vitest tests in `e2e/` that spawn `dist/cli.js` as a user would. The smoke run grows into a fixture-repository audit once the `audit` command exists.
**Alternatives considered:**
- Keep the matrix and set `CW_SKIP_ADOPTION_MATRIX=1` locally — Rejected because e2e would then SKIP, which never counts as verified.
**Consequences:**
- Positive: e2e tests this product and takes seconds.
- Negative: the harness is no longer end-to-end tested from here; it is tested in its own CI.

### D-004: Single-repo layout; product tests live outside tests/

**Date:** 2026-10-19
**Status:** accepted
**Context:** `create-harness` placed the optional multi-repo skeleton (`contracts/`, `tasks/`, `repositories/`, `scripts/verify-all*`) although the harness docs call it opt-in, and its example repository made `verify-all` report PASS for a check that did nothing (maideps/ai-harness-framework#24). `tests/` is a CORE surface holding the harness runner's own tests, overwritten by upgrades.
**Decision:** Remove the multi-repo skeleton, so `verify-all` reports SKIP. Put unit tests next to their code (`src/**/*.test.ts`) and end-to-end tests in `e2e/`. `productRoots` lists `src/`, `e2e/`, `config/`, `fixtures/` and the root TypeScript, Vitest and ESLint config files.
**Alternatives considered:**
- Product tests under `tests/` — Rejected because it is CORE: upgrades overwrite it and the harness test layer runs every `*.test.mjs` in it.
**Consequences:**
- Positive: classification stays honest; upgrades cannot touch product tests.
- Negative: two similar names (`tests/` for the harness, `e2e/` and colocated tests for the product) need the explanation in `docs/ARCHITECTURE.md`.

### D-005: Package stays private until the audit command works

**Date:** 2026-10-19
**Status:** accepted
**Context:** The bootstrap copied the harness's own `package.json`: its name, `bin` entries, publish settings and `prepublishOnly`.
**Decision:** Rename to `ai-codebase-auditor` 0.1.0, set `"private": true`, expose one bin `ai-codebase-auditor` → `dist/cli.js`, and publish only `dist/`, `config/`, `README.md` and `LICENSE`. A shorter command alias can be added later.
**Alternatives considered:**
- Publish from the start — Rejected because there is nothing useful to install yet.
**Consequences:**
- Positive: no accidental publish of a skeleton.
- Negative: `private` must be removed, and a publish workflow added, before the first release.
