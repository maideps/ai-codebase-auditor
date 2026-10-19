# Usage Guide

How to run the CLI, how verification is wired, and how features move through the harness. The full list of harness commands is in the generated [Harness Command Reference](HARNESS.md).

## Running the CLI

```bash
npm run build
node dist/cli.js --help
node dist/cli.js --version
```

Exit codes: `0` success, `2` usage error. The `audit <repo-path>` command arrives with feat-001; this section will document its options and output files then.

Audited repositories should be cloned outside this project, for example under `D:\7-Maide\Projects\audit-targets\`. Never clone them into this repository.

## Setup

```bash
./init.sh          # prerequisites, stack detection, npm install (lock-preserving), full verify chain
npm run check      # lint → typecheck → test → build → e2e → verify-all
npm run check-arch # harness architecture rules arch-001 to arch-006
```

On Windows, run `init.sh` from Git Bash.

## Verification Layers

For Node projects the harness treats each `package.json` script key as a layer command. The harness ships those keys running its own self-checks, and adopters are expected to replace the values with product tools. Replacing them outright would silently drop the self-checks from `npm run check` and every feature gate, so this project **chains** them: the harness check runs first, then the product tool.

| Script | Value | Why |
|---|---|---|
| `lint` | `node scripts/framework-check.mjs lint && eslint src e2e` | Keeps the surfaces, skills, command-reference and progress-log checks |
| `typecheck` | `node scripts/framework-check.mjs typecheck && tsc --noEmit` | Keeps the feature list and state-shard schema check |
| `test` | `node scripts/framework-check.mjs test && vitest run` | Keeps the dependency graph, WIP=1 and runner unit tests |
| `build` | `node scripts/framework-check.mjs build && tsc -p tsconfig.build.json` | Keeps the Make target and shell shim checks |
| `e2e` | `tsc -p tsconfig.build.json && vitest run --config vitest.e2e.config.ts` | Replaces the harness default |

The harness's default `e2e` is its adoption matrix, which builds throwaway adopter repositories and tests the harness, not this product. It took more than 10 minutes locally on Windows, and every feature gate runs `npm run check`, so it is replaced by a smoke run of the built CLI. The harness still tests itself in its own CI.

Keep values as direct commands; a value that calls `run-layer` is treated as unconfigured. After a `harness-upgrade`, compare these five scripts with the upgrade's report and keep the chains. Upstream issue: [maideps/ai-harness-framework#25](https://github.com/maideps/ai-harness-framework/issues/25).

Semantics: **PASS** counts as verified, **SKIP** (not configured) does not, **FAIL** stops the chain.

Run a single product tool without the harness check when iterating:

```bash
npx vitest            # watch mode
npx tsc --noEmit
npx eslint src e2e
```

## Feature Workflow

1. Read `feature_list.json` and pick the next planned feature in order. Add one with `npm run add-feature -- <id> <name> --behavior "…" --verification "…" --depends a,b`.
2. Start a session trace: `npm run session-start`.
3. Activate it: `npm run activate -- <id>` (enforces WIP=1 and dependency order).
4. Write a failing test, implement, and run `npm run check` until it passes.
5. Pass the gate: `npm run verify-feature -- <id>`. It records evidence in `.harness/state/<id>.json`. Never edit a shard by hand.
6. Record a trail with `npm run vcr` for durable evidence.
7. Close the session: add `progress/NNN-YYYY-MM-DD.md`, run `node scripts/framework-check.mjs progress-update`, update `session-handoff.md` and `docs/quality-document.md`, run `npm run clean-check`, `npm run session-end`, then commit.

## Parallel Work

Independent features, mainly the collectors, can run in separate worktree lanes:

```bash
npm run lane-new -- feat-003
npm run lane-list
npm run lane-land -- feat-003   # from the target branch, after the lane's feature passes
```

## Harness Maintenance

```bash
npm run harness-audit   # health of this harness adoption
npm run harness-docs    # regenerate docs/HARNESS.md after changing scripts or the Makefile
```

To upgrade, run `node scripts/harness-upgrade.mjs <path to this repository>` from a newer ai-harness-framework checkout.

`harness-upgrade` overwrites CORE only (`scripts/`, `tests/`, `skills/`, `templates/`, agent files) and never touches `package.json`, docs, product code or state.
