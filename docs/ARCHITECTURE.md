# Architecture

## Pipeline

The audit is a one-way pipeline that reads the target repository and never writes to it or runs its code. Planned layout (only `src/cli.ts` exists today):

```
src/
  cli.ts              entry point: argument parsing, exit codes, wiring
  collectors/         read-only signal collection, one module per source
    git-history.ts      churn, authors, file age
    code-structure.ts   file size, module layout
    tests-docs.ts       test and doc presence, CI files
    dependencies.ts     manifest versions, end-of-life runtimes
  scoring/            signals → factor scores 1–5, each with evidence
  decision/           factor profile → adopt | adapt | prepare first
  report/             markdown.ts, json.ts
config/
  factors.json        factor list, blocking vs. constraining, thresholds
```

```
repository (read-only)
   │
   ├─ collectors ── Signal[] (value + evidence)
   │
   ├─ scoring ───── FactorScore[] (1–5, evidence, deferral flag)
   │                  ▲ config/factors.json
   ├─ decision ──── Verdict + readiness level + risk zone per module
   │                  ▲ harness requirements file (version 2)
   └─ report ────── Markdown + JSON
```

## Dependency Rules

- `cli` may depend on every other module. Nothing depends on `cli`.
- `report` depends on the types of `decision` and `scoring` only; it formats, it never computes scores.
- `decision` depends on `scoring` types and the harness requirements file; it never reads the repository.
- `scoring` depends on collector output types and `config/factors.json`; it never reads the repository.
- Collectors depend on nothing but Node built-ins and external read-only tools (git, scc, Lizard). They never depend on each other, so a new source is a new collector, not a pipeline change.
- Only collectors touch the file system or spawn processes. Every spawned command is read-only (for example `git log`, never `git checkout`) and runs against the target path, never through the target's own scripts.

Encode these rules as entries in `.harness/arch-rules.json` once the modules exist.

## Harness Boundaries

The harness contract (described in `.harness/manifest.json` and enforced by `npm run check-arch`) separates:

- **CORE** — files that ship as-is and must not be edited: `scripts/`, `tests/` (the harness runner's own tests), `skills/`, `templates/`, the agent files and the manifest classification.
- **TEMPLATES** — adopter skeletons under `templates/`.
- **INSTANCE** — this project's own state: feature list, progress, decisions, docs, `package.json`, `package-lock.json`.
- **PRODUCT-OWNED** — paths listed in the manifest's `productRoots`: `src/`, `e2e/`, `config/`, `fixtures/` and the root TypeScript, Vitest and ESLint config files.

Because `tests/` is CORE, product tests live next to their code (`src/**/*.test.ts`) and end-to-end tests in `e2e/`.

Verification entrypoints delegate to the Node runner (`scripts/framework-check.mjs`); Makefile targets and npm scripts are 1:1 mirrors. The single-repo layout does not use the optional multi-repo component, so `verify-all` reports SKIP.

## Worktree Lanes

Multiple agents can work concurrently, each in its own sibling git worktree on branch `lane/<feature-id>` (`npm run lane-new -- <id>`, `lane-list`, `lane-land -- <id>`, `lane-drop -- <id>`). WIP=1 is enforced per lane: a `lane/<feature-id>` branch may only activate the feature it is named for. Collectors are independent modules, so collector features are the natural candidates for parallel lanes.

## Sharded Feature State

`feature_list.json` declares what each feature is and rarely changes; each feature's mutable state (`state`, `evidence`) lives in its own file, `.harness/state/<feature-id>.json`. `verify-feature` writes only that shard, never the shared declarations file.

## Enforcement

```bash
npm run check-arch     # or: make check-arch
```

## Module Documentation

Co-locate notes with the modules they affect; record project-wide decisions in the root `DECISIONS.md`.
