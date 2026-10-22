# ai-codebase-auditor

A command-line tool that audits a codebase, legacy systems first, and answers one question: is it safe and productive to let AI coding agents work in it, and if not, what has to change first? It collects measurable signals from the repository and its git history, scores each factor from 1 to 5 with cited evidence, and returns a verdict: **adopt**, **adapt** or **prepare first**. It never modifies or executes the audited repository.

Status: `audit <repo-path>` validates its inputs (feat-001), runs four collectors (feat-002 to feat-005), scores every factor from 1 to 5 with its evidence (feat-006), prints a verdict with green, yellow and red risk zones (feat-007), writes a deterministic Markdown and JSON report with `--out` (feat-008), and is calibrated on five public legacy repositories (feat-009): see the [case study](docs/case-study/README.md). The pipeline is built one feature at a time; see `feature_list.json` and [PROGRESS.md](PROGRESS.md).

Concept, prior art and design: [docs/concept-and-architecture.md](docs/concept-and-architecture.md).

## Quick Start

```bash
# 1. Install dependencies and verify the environment
./init.sh

# 2. Run full verification (make and npm forms are 1:1 mirrors)
npm run check          # or: make check

# 3. Run the CLI from a build
npm run build && node dist/cli.js audit <path-to-a-git-repo> --out <report-dir>
```

### Prerequisites

- **Node.js** ≥ 18 (`.nvmrc` pins the development version)
- **Git Bash** on Windows, for `init.sh`
- **Make** — optional; `npm run <target>` mirrors every make target

## Verification Layers

Each layer runs the harness's own check first, then the product tool. See [docs/USAGE.md](docs/USAGE.md#verification-layers) for why.

| Layer | Command | Harness check | Product check |
|-------|---------|---------------|---------------|
| 1 | `npm run lint` | Required surfaces, skills, command reference, progress log | ESLint on `src/` and `e2e/` |
| 1b | `npm run typecheck` | Feature list schema and state shards | `tsc --noEmit` (strict) |
| 2 | `npm run test` | Feature graph, WIP=1, runner unit tests | Vitest unit tests in `src/` |
| 3 | `npm run build` | Make targets and shell shims | `tsc -p tsconfig.build.json` to `dist/` |
| 3b | `npm run e2e` | — | Builds, then smoke-tests the built CLI |

Layers that are not configured report **SKIP** and do not count as verified.

### Harness Commands

The complete command list is generated from the Makefile and npm scripts. See [Harness Command Reference](docs/HARNESS.md); regenerate it with `npm run harness-docs`.

## State Files

- `feature_list.json` — feature declarations: id, behavior, dependencies, verification layers
- `.harness/state/<id>.json` — that feature's mutable state (`state`, `evidence`); one file per feature
- `PROGRESS.md` — generated current-state dashboard and session index
- `progress/NNN-YYYY-MM-DD.md` — one session's notes
- `DECISIONS.md` — architectural decisions log
- `session-handoff.md` — multi-session handoff notes

## Documentation

- [Product Overview](docs/PRODUCT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Standards](docs/STANDARDS.md)
- [Observability](docs/OBSERVABILITY.md)
- [Tools & MCP](docs/TOOLS.md)
- [Usage Guide](docs/USAGE.md)
- [Quality Document](docs/quality-document.md)

## License

MIT — see [LICENSE](LICENSE).
