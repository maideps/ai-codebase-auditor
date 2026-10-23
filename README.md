# ai-codebase-auditor

Can AI coding agents safely work in this codebase, and if not, what has to change first?

`ai-codebase-auditor` answers that for a local git repository, legacy systems first. It reads the repository and its history statically, scores nine readiness factors from 1 to 5 with cited evidence, and returns one verdict: **adopt**, **adapt** or **prepare first**. It also marks which parts agents may edit, which need tests first, and which are proposals only. Then it plans how to adapt an agent harness to the repository, and lists the changes that would raise its scores, ordered by gain against effort.

Most agent tooling assumes a greenfield project with tests, docs and small files. This tool is for the long-lived systems where those assumptions fail.

## What an Audit Looks Like

An excerpt from auditing [Redmine](https://github.com/redmine/redmine), from the [case study](docs/case-study/README.md):

```text
Scores (1-5; the lowest blocking factor sets the readiness level, never an average):
  blocking      test-feedback          5  ratio 0.50 ≥ 0.3 with a runner config and CI
  constraining  type-strictness        1  weighted typed share 0.00
  blocking      direct-api-calls       3  5.61% of 838 covered files have a computed-target call (72 sites)
  constraining  file-size              4  lower of p90 214 lines (→ 4) and 1.07% of files over 1000 lines (→ 4)
  constraining  documented-intent      3  docs with contributing, architecture, convention or decision docs
  constraining  dev-deploy-simplicity  5  4 of 4 signals: CI configured, test runner configured, runtime version declared, lock file committed
  constraining  dependency-currency    4  a runtime reaches end of life on 2027-03-31, within 12 months
  ...

Verdict: adapt
  rule: 1 weak factor (score ≤ 2): type-strictness 1

Risk zones (green: agents may edit; yellow: characterization tests first; red: proposals only):
  green   app     340 source files, 10 red: test-feedback 5 ≥ 3 and files are legible (p90 298 lines, 1.8% over 1000 lines)
  red paths:
    app/models/auth_source.rb (auth)
    app/models/role.rb (role)
  ...

Harness adaptation plan (ai-harness-framework 0.5.0): Adopt the harness with these adaptations.
  required     typed-changes    type-strictness 1
  required     detected-stack   test-feedback 5
  required     red-paths        red zone, 78
  recommended  traceable-calls  direct-api-calls 3
  recommended  written-intent   documented-intent 3

Modernization roadmap (by gain against effort):
  1. type-strictness 1→3 [M] configure Sorbet or Steep for ruby with a baseline (typed share 0.00 to 0.53) (verdict after: adopt)
  2. direct-api-calls 3→4 [M] make the computed-target calls explicit in 6 of 47 files (to 4.9% of files), starting with app/models/query.rb (5), ...
  ...
```

With `--out`, the same content is written as a Markdown report for people and a JSON report for CI or agents.

## Quick Start

Requires Node.js 18 or newer and git. The tool is not published to npm, so run it from a clone:

```bash
git clone https://github.com/maideps/ai-codebase-auditor.git
cd ai-codebase-auditor
npm ci
npm run build
node dist/cli.js audit ../some-legacy-repo --out ../audit-reports/some-legacy-repo
```

Clone the repositories you audit outside this one. The tool refuses an `--out` directory inside the audited repository.

| Option | Purpose |
|---|---|
| `--out <dir>` | Write `ai-readiness-report.md` and `ai-readiness-report.json` |
| `--config <file>` | Use your own factor list and thresholds instead of `config/factors.json` |
| `--deferrals <file>` | Record a known gap with a reason and a revisit date (raises that factor by one level, up to 3) |
| `--harness <file>` | Plan for another harness instead of `config/harness-requirements.json` |

[scc](https://github.com/boyter/scc) is used for language and complexity data when it is installed; without it, the audit still runs. The full guide is [docs/USAGE.md](docs/USAGE.md).

## How It Decides

**Factors.** Each factor is scored 1 to 5 by a fixed rule, and every score cites its evidence: a file, a count or a command's output. A factor with no signal is reported as not measured, never guessed.

| Factor | Class | Measured from |
|---|---|---|
| test-feedback | blocking | test files per source file, runner config, CI |
| direct-api-calls | blocking | share of files with calls whose target is computed: reflection, dispatch by name, `eval`, `method_missing` (Python, PHP, Ruby, Java, JavaScript, TypeScript) |
| type-strictness | constraining | share of code under a type checker, TypeScript `strict` |
| file-size | constraining | p90 file length, share of files over 1000 lines |
| module-boundaries | constraining | share of the latest 500 commits that change more than one module (from git history, any language) |
| documented-intent | constraining | contributing, architecture, convention and decision docs, stated rules |
| observability | constraining | not measured yet |
| dev-deploy-simplicity | constraining | CI, test runner, pinned runtime, lock file |
| dependency-currency | constraining | declared runtimes against a dated end-of-life table |

**Verdict.** Scores are never averaged. The lowest blocking factor sets the readiness level. The verdict comes from the first rule that applies:
1. **Prepare first:** tests are weak (score ≤ 2) and module boundaries are not established.
2. **Adapt:** any factor is weak; each weak factor is named as an adaptation.
3. **Adopt:** nothing is weak.

A verdict is marked provisional while a blocking factor is not measured.

**Risk zones.**
- **Green** modules (agents may edit) need test-feedback of at least 3 and legible files.
- **Yellow** modules need characterization tests before agents edit them.
- **Red** paths (auth, billing, permissions, secrets and similar) are proposals only, even inside a green module.

**Plan and roadmap.** The plan maps weak factors and zones to changes in the [ai-harness-framework](https://github.com/maideps/ai-harness-framework): extra rules in `AGENTS.md`, Claude Code `permissions.deny` entries for red paths, and explicit layer commands where the harness would not detect the stack. The roadmap gives one step per factor below 5, with its effort (S, M or L) and the verdict it would lead to. The harness assumptions live in one file, so the audit works without the harness.

All thresholds and terms are in [`config/`](config/), and the reasons behind them are in [DECISIONS.md](DECISIONS.md).

## Safety

Audited repositories are treated as untrusted input:
- The tool never writes to the audited repository, and never installs, builds or runs anything from it.
- Files are read statically, and links leading outside the repository are skipped.
- Git runs read-only commands, pinned to the target. The target's own config cannot start a program, for example through `core.fsmonitor`.
- Reports are deterministic: the same repository, configuration and audit date give identical bytes, and the report records the audited commit.

## Calibration

The rules were calibrated on five public legacy repositories, each checked against the clone by hand:

| Repository | Verdict | Why |
|---|---|---|
| [DOOM](https://github.com/id-Software/DOOM) (C, 1997) | prepare first | no tests |
| [moin-1.9](https://github.com/moinwiki/moin-1.9) (Python 2) | adapt | untyped, few written conventions, Python 2.7 is end of life |
| [phpBB](https://github.com/phpbb/phpbb) (PHP) | adopt | nothing weak |
| [Struts](https://github.com/apache/struts) (Java) | adopt | nothing weak |
| [Redmine](https://github.com/redmine/redmine) (Ruby on Rails) | adapt | well tested, but no type checking |

DOOM's verdict is provisional: its C code has no dynamic-call rules, so direct-api-calls is not measured there. The [case study](docs/case-study/README.md) has the full reports, the labels and the known limits.

## Status and Limits

Version 2 is complete: the audit, the reports, the harness adaptation plan and the modernization roadmap.
- Observability has no collector yet.
- Module boundaries come from how files changed together, so layouts where co-change is by design count as coupling, such as Rails migrations with their models.
- Direct calls are detected for Python, PHP, Ruby, Java, JavaScript and TypeScript only, by pattern matching rather than parsing. Dispatch wired through configuration (dependency injection, XML mappings, callbacks by symbol) is not counted.
- Test speed, CI pass rates and branch protection cannot be seen from repository contents.
- Roadmap effort comes from counts, not from how hard the code is.
- An LLM never sets a score or a verdict.

## Development

This project is built with the [ai-harness-framework](https://github.com/maideps/ai-harness-framework): one feature at a time, tests first, and each feature passes `npm run verify-feature` before it counts as done.

```bash
./init.sh          # install and verify the environment (Git Bash on Windows)
npm run check      # every verification layer; make check is the same
npm run check-arch # architecture rules
```

| Layer | Command | Product check |
|---|---|---|
| 1 | `npm run lint` | ESLint on `src/` and `e2e/` |
| 1b | `npm run typecheck` | `tsc --noEmit` (strict) |
| 2 | `npm run test` | Vitest unit tests |
| 3 | `npm run build` | `tsc -p tsconfig.build.json` |
| 3b | `npm run e2e` | smoke tests of the built CLI against a fixture repository |

Each layer runs the harness's own check first, then the product tool. A layer that is not configured reports SKIP, which never counts as verified. The [Harness Command Reference](docs/HARNESS.md) lists every command.

Project state is kept in files: features in [`feature_list.json`](feature_list.json), per-feature evidence in `.harness/state/`, progress in [PROGRESS.md](PROGRESS.md), decisions in [DECISIONS.md](DECISIONS.md) and per-feature contracts in [`docs/sprints/`](docs/sprints/).

## Documentation

- [Usage Guide](docs/USAGE.md): options, scores, verdicts, zones, plan, roadmap and report format
- [Product Overview](docs/PRODUCT.md) and [Concept and Architecture](docs/concept-and-architecture.md): the problem, prior art and design
- [Architecture](docs/ARCHITECTURE.md): modules and dependency rules
- [Case Study](docs/case-study/README.md): calibration on five repositories
- [Standards](docs/STANDARDS.md), [Observability](docs/OBSERVABILITY.md), [Tools](docs/TOOLS.md), [Quality Document](docs/quality-document.md)

## License

MIT. See [LICENSE](LICENSE).
