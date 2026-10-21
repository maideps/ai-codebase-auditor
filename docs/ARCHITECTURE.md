# Architecture

## Pipeline

The audit is a one-way pipeline that reads the target repository and never writes to it or runs its code. Planned layout (everything down to `decision/` exists today; `report/` is next):

```
src/
  cli.ts              entry point: argument parsing, exit codes, wiring
  result.ts           Result<T>: a value, or every validation error found
  file-kinds.ts       source extensions, language typing, lock-file names (pure data)
  target.ts           resolves and checks the audited repository root (static)
  config/factors.ts   loads and validates config/factors.json
  config/runtime-eol.ts loads and validates config/runtime-eol.json
  config/deferrals.ts loads and validates a --deferrals file
  config/decision.ts  loads and validates config/decision.json
  testing/            test-only helpers (git fixture repos); not built
  collectors/         read-only signal collection, one module per source
    types.ts            Measurement<T>: measured with evidence, or not measured with a reason
    git.ts              shared git runner, pinned to the target (not a collector)
    tree.ts             files tracked at HEAD, the vendored rule, link-safe file reads (not a collector)
    git-history.ts      churn, authors, file age
    code-structure.ts   file size, size distribution, top-level modules
    tests-docs.ts       test files and runners, CI files, docs, stated rules
    dependencies.ts     manifests, declared runtimes, end-of-life assessment
    dependencies/       parsers.ts (one static parser per manifest), versions.ts (spec → lowest version → cycle), toml.ts
  scoring/            rules.ts (one rule per factor), score.ts (engine, deferrals, readiness), types.ts
  decision/           verdict.ts (adopt | adapt | prepare first), zones.ts (green / yellow modules, red paths), decide.ts
  report/             markdown.ts, json.ts
config/
  factors.json        factor list, blocking vs. constraining, thresholds
  runtime-eol.json    dated end-of-life table for Node.js, Python, PHP, Ruby, Java
  decision.json       weak-score limit, green rule, module splitting, red path terms
```

```
repository (read-only)
   │
   ├─ collectors ── Measurement<T> per collector (value + evidence, or a not-measured reason)
   │
   ├─ scoring ───── FactorScore[] (1–5, evidence, deferral flag)
   │                  ▲ config/factors.json
   ├─ decision ──── Verdict + readiness level + risk zone per module
   │                  ▲ harness requirements file (version 2)
   └─ report ────── Markdown + JSON
```

## Dependency Rules

- `cli` may depend on every other module. Nothing depends on `cli`.
- `result` and `config` depend on nothing in `src/` but each other; any module may use them (collectors use config types only, and receive loaded config such as the EOL table from `cli`). `target` is used only by `cli`.
- Validation returns a `Result` with every problem found instead of throwing on the first one; the CLI turns errors into exit code 2.
- `report` depends on the types of `decision` and `scoring` only; it formats, it never computes scores.
- `decision` depends on `scoring` results, collector output types, `file-kinds` and loaded config (factors, decision); it is pure and never reads the repository. The harness requirements file joins it in version 2.
- `scoring` depends on collector output types, `file-kinds` and loaded config (factors with thresholds, deferrals); it is pure and never reads the repository. Every threshold lives in `config/factors.json`; rules hold no default numbers, and `checkThresholds` rejects missing, unused or out-of-order thresholds at startup.
- Collectors depend on nothing but Node built-ins, `collectors/types.ts`, the shared helpers `collectors/git.ts` and `collectors/tree.ts`, and external read-only tools (git, scc, Lizard). They never depend on each other, so a new source is a new collector, not a pipeline change.
- A collector that cannot measure returns `not-measured` with a reason; it never throws for an expected condition (missing tool, shallow clone, empty repository) and never substitutes a guess.
- Only collectors spawn processes, and only collectors, `target` and `config` read the file system. Every spawned command is read-only (for example `git log`, never `git checkout`) and runs against the target path, never through the target's own scripts.
- File content is read only through `readTrackedFile` in `collectors/tree.ts`, and only for regular files inside the target: symlinks and submodules are skipped by their tree mode, and a file whose real path leaves the target is skipped too.
- Git runs pinned to the target (in `collectors/git.ts`): `GIT_CEILING_DIRECTORIES` stops it from finding an enclosing repository, inherited `GIT_DIR`, `GIT_WORK_TREE` and `GIT_INDEX_FILE` are cleared, optional locks are off, and `core.fsmonitor` is disabled so a target's own config cannot start a program.
- `src/testing/` is imported only by tests and is excluded from the build.

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
