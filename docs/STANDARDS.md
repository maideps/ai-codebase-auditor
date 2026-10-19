# Project Standards

Single source of truth for this project's coding standards. Keep this file current — it is what agents and reviewers check code against.

## Core Principles

- One feature at a time (WIP=1), passed only through `npm run verify-feature -- <id>`. Never mark a feature passing by hand.
- Every score cites evidence. No evidence, no score. Scores are never averaged.
- Prefer deterministic checks. LLM calls are optional, behind a flag, and never decide a score or verdict.
- The audit never writes to, installs into or executes the audited repository. Treat its contents as untrusted input.
- Never write to the `ai-harness-framework` repository from here; report harness gaps as issues on it instead.
- Reuse existing tools (git, scc, Lizard) for raw data instead of writing parsers.

## Language and Tooling

- TypeScript 5.9, ES modules (`"type": "module"`), `module`/`moduleResolution` `NodeNext`. Relative imports use the `.js` extension.
- Runtime: Node.js ≥ 18 (`engines`); development version pinned in `.nvmrc`.
- Type checking: `tsc --noEmit` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `verbatimModuleSyntax` (`tsconfig.json`). No `any`; narrow `unknown` instead.
- Linting: ESLint 9 flat config with `typescript-eslint` strict (`eslint.config.js`).
- Tests: Vitest. Unit tests in `src/**/*.test.ts` (`vitest.config.ts`); end-to-end tests in `e2e/` against the built CLI (`vitest.e2e.config.ts`).
- Package manager: npm, with `package-lock.json` committed.

## Testing Discipline

- New behavior starts with a failing test.
- Collectors are tested against small fixture repositories created in a temp directory or kept under `fixtures/`, never against a live clone.
- Scoring and decision logic get table-driven unit tests: one row per threshold edge, including the "documented deferral scores one level higher" rule.
- The e2e layer runs the built CLI as a user would. Extend it whenever a command or output format changes.
- A passing `npm run check` (lint, typecheck, test, build, e2e) is required before every commit.

## Naming and Structure

- Files: kebab-case (`git-history.ts`). Types and interfaces: PascalCase. Functions and variables: camelCase. Factor ids in `config/factors.json`: kebab-case.
- One module per directory under `src/` as laid out in [ARCHITECTURE.md](ARCHITECTURE.md); respect its dependency rules.
- Named exports only; no default exports in `src/`.
- Branches: `lane/<feature-id>` for harness lanes, otherwise `feat/<short-name>` or `fix/<short-name>`.

## Commit and Review Standards

- Conventional prefixes (`feat`, `fix`, `docs`, `chore`, `test`, `refactor`), with the feature id when there is one: `feat(feat-002): add git-history collector`.
- One logical change per commit; the message says why.
- Before a feature gate, run the `review` skill for an independent pass.

## Documentation Standards

- Update `docs/` in the same commit as the code it describes; no stale docs.
- Update `docs/quality-document.md` for every module touched in a session.
- Record decisions with alternatives and consequences in `DECISIONS.md`.
- Plain Markdown, sentence-case headings, tables for comparisons.
