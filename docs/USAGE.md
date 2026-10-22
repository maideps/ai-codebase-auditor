# Usage Guide

How to run the CLI, how verification is wired, and how features move through the harness. The full list of harness commands is in the generated [Harness Command Reference](HARNESS.md).

## Running the CLI

```bash
npm run build
node dist/cli.js audit <repo-path>                  # default factors from config/factors.json
node dist/cli.js audit <repo-path> --config my.json # a tuned factor list
node dist/cli.js audit <repo-path> --deferrals deferrals.json
node dist/cli.js audit <repo-path> --out ../audit-reports/<name>  # write the Markdown and JSON report
node dist/cli.js --help
```

`audit` checks that `<repo-path>` is the root of a git working tree (a `.git` directory, or a `.git` file for a linked worktree) and validates the factor configuration, then prints the target, the factor list, and a summary from each of the four collectors. Relative paths resolve against the current directory. Scores, the verdict and reports arrive with feat-006 to feat-008.

### Git history

The git-history collector runs only read-only git commands (`rev-parse`, `ls-tree`, `log`) against the target and reports, for the repository and for each file tracked at HEAD: non-merge commits over the full history and the last 12 months, distinct authors, and first and last commit dates. Conventions, also listed in the evidence of every measurement:

- merge commits are excluded;
- renames are not followed, so a renamed file's history starts at the rename;
- authors are counted by email after `.mailmap`, case-insensitively;
- dates are author dates, and the 12-month window ends at the time of the run.

It reports **not measured** instead of guessing when git is missing, the repository has no commits, the clone is shallow (history incomplete; re-clone without `--depth`), or git cannot read the repository.

### Code structure

The code-structure collector takes the files tracked at HEAD (from `git ls-tree`), reads their content from the working tree, and reports per-file lines and bytes, the size distribution (nearest-rank p50, p90 and p99 lines, the maximum, buckets of 0-200, 201-500, 501-1000, 1001-2000 and 2001+ lines, and the ten largest files), and the top-level modules (first path segment; root files count as `(root)`).

Files left out of every count are listed with their reason:

- **vendored**: a directory segment named `node_modules`, `bower_components`, `vendor`, `vendors`, `third_party`, `third-party`, `thirdparty` or `Pods`;
- **generated**: lock files (`package-lock.json`, `yarn.lock`, `composer.lock`, `Gemfile.lock` and similar), `*.min.js`, `*.min.css`, `*.map`;
- **binary**: a NUL byte in the first 8000 bytes, the rule git uses;
- **symlink** and **submodule**: never followed;
- **missing**: tracked at HEAD but absent from the working tree.

Line and byte counts always come from the built-in counter, so runs are comparable whether or not scc is installed. When [scc](https://github.com/boyter/scc) is on PATH it adds each file's language, code lines and complexity; the output says whether it was used and why not.

### Tests and docs

The tests-and-docs detector works from the paths tracked at HEAD (vendored paths ignored) plus a few small reads. It never runs the target's tests or tools.

- **Test files**, by the first convention that matches: `__tests__/`, `*.test.*` / `*.spec.*` (JavaScript and TypeScript), `test_*.py` / `*_test.py`, `*_test.go`, `*_spec.rb`, `*_test.rb`, `*Test.php`, `*Test.java` / `*Tests.java` / `*IT.java`, `*Test.kt`, `*Test.cs`, and finally any source file under a `test`, `tests`, `spec`, `specs` or `t` directory.
- **Test runner configs**: Jest, Vitest (named variants such as `vitest.e2e.config.ts` included), Karma, Mocha, Cypress, Playwright, pytest (`pytest.ini`, `conftest.py`, or a `[tool.pytest]` section in `pyproject.toml` / `[tool:pytest]` in `setup.cfg`), tox, PHPUnit, RSpec, and a `package.json` test script other than npm's placeholder. Build tools that run tests by convention count too, when tests sit beside the build file: Maven (Surefire or Failsafe in `pom.xml`, or `src/test/`), Gradle (`src/test/`), Rails minitest (`test/test_helper.rb`), RSpec (`spec/spec_helper.rb`), `go test` (`go.mod` with `*_test.go`) and `cargo test` (`Cargo.toml` with `tests/*.rs`).
- **CI**: GitHub Actions, GitLab CI, Travis CI, CircleCI, Jenkins, Azure Pipelines, AppVeyor, Bitbucket Pipelines, Drone, Buildkite. A CI file shows CI is configured, not that it passes.
- **Docs**: root and module READMEs, CONTRIBUTING (root, `.github/`, `docs/`), architecture or design docs, decision records (`adr/`, `decisions/`), convention and style docs, files under `docs/` or `doc/`, and agent context files (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `codex.md`, `.cursorrules`, `.cursor/rules/`, `.windsurfrules`, `.github/copilot-instructions.md`). Agent context files are listed for presence only: presence alone scores nothing. Files under test and fixture directories (`test`, `tests`, `spec`, `specs`, `__tests__`, `fixtures`, `testdata`) and under `src/<set>/resources` are test inputs, not docs, and are skipped.
- **Stated rules**: lines containing must, never, always, do not, should not, required, forbidden or prohibited in agent context, contributing, architecture and convention docs, outside fenced code blocks, each with its file and line. This finds written rules; whether a rule is non-standard for its stack still needs judgment. Rule files that are symlinks, binary or over 1 MB are listed as unread.

### Dependencies

The dependency collector reads manifests and runtime version files tracked at HEAD (vendored directories skipped) as text. It never runs `setup.py`, Gradle or Maven, never installs or resolves anything, and never goes to the network.

| File | Dependencies | Runtime declarations |
|---|---|---|
| `package.json` | dependencies, devDependencies, optionalDependencies, peerDependencies | `engines.node` |
| `requirements*.txt`, `requirements/*.txt` | one per line; editable and URL lines are listed as issues | — |
| `setup.py` | a literal `install_requires` list; anything else is an issue | `python_requires`, "Programming Language :: Python :: X.Y" classifiers |
| `pyproject.toml` | `[project]` dependencies and optional-dependencies, Poetry dependencies and groups | `requires-python`, Poetry `python` |
| `composer.json` | require, require-dev (platform packages such as `ext-*` skipped) | `require.php`, `config.platform.php` |
| `Gemfile` | gems with groups; a `gemspec` line is an issue | `ruby` directive |
| `pom.xml` | dependencies with `${property}` versions resolved locally; a parent POM is an issue | `maven.compiler.release/source/target`, `java.version`, compiler plugin |
| `build.gradle`, `build.gradle.kts` | string and map notation | toolchain `languageVersion`, `sourceCompatibility`, `targetCompatibility` |
| `.nvmrc`, `.node-version`, `.python-version`, `.ruby-version`, `runtime.txt`, `.tool-versions` | — | the declared version |

Manifests of other ecosystems (`go.mod`, `Cargo.toml`, `Pipfile`, `*.csproj`, `*.gemspec` and similar) and supported files that fail to parse are listed as **not measured** with the reason.

Runtimes declared under test or fixture directories are listed with `testFixture: true`, but do not count as the product's runtime for scoring. Each declared runtime is assessed against `config/runtime-eol.json`: the lowest version its spec allows (`>=3.7,<4` → 3.7; `^7.4 || ^8.0` → 7.4) maps to a cycle (major for Node.js and Java, with Java `1.8` as 8; major.minor for Python, PHP and Ruby), and the cycle is **end-of-life** on or after its date in the table, **supported** before it, or **unknown** with a reason (no lower bound, too coarse, cycle not in the table).

#### Refreshing the end-of-life table

`config/runtime-eol.json` is a dated snapshot of [endoflife.date](https://endoflife.date) (Node.js, Python, PHP, Ruby; Java from Eclipse Temurin, with Oracle JDK dates for cycles Temurin never shipped). The audit warns when the table is more than a year old. To refresh it, fetch `https://endoflife.date/api/<product>.json` for `nodejs`, `python`, `php`, `ruby`, `eclipse-temurin` and `oracle-jdk`, keep each cycle's `cycle` and `eol` date, set `asOf` to the fetch date, and commit the table on its own so the change is reviewable.

Exit codes: `0` success; `2` usage or input error (unknown command or option, missing or extra path, a target that is not a repository root, an invalid factor config, thresholds, decision config, end-of-life table or deferrals file, an out directory inside the target); `1` when the report cannot be written. Every input problem is printed, one `error:` line each, not just the first.

### Factor configuration

`config/factors.json` lists the readiness factors. Each factor has a kebab-case `id`, a `name`, a `class` (`blocking` or `constraining`) and a `description`. Unknown keys are rejected, so a typo cannot silently change a factor, and at least one factor must be blocking because the lowest blocking factor sets the readiness level. A factor with a scoring rule also has a `thresholds` object with exactly the keys its rule reads; missing, unused, decreasing or out-of-range thresholds are input errors. A factor id without a rule is reported as not measured.

### Scores and readiness

After the collectors, `audit` prints one line per factor: its class, its score (or `-` when not measured, with the reason), and the rule that produced it, with `partial:` lines for what the score does not cover. Then the readiness level: the lowest score among scored blocking factors, never an average. While a blocking factor is not measured, the level is marked **provisional** and the factor is named. The rules and thresholds are in [docs/sprints/feat-006.md](sprints/feat-006.md) and `config/factors.json`.

Not measured today, for lack of a collector signal: direct-api-calls (blocking), module-boundaries and observability. So every readiness level is provisional until a call-site collector exists. Today test-feedback is the only scored blocking factor, so it sets the readiness level; type-strictness and the other constraining factors decide between *adopt* and *adapt*.

### Deferrals

A team can record a known gap as a documented, dated decision and pass it with `--deferrals <file>`:

```json
{
  "version": 1,
  "deferrals": [
    { "factor": "type-strictness", "recorded": "2026-09-01", "reason": "migrating to TypeScript in Q1", "revisitBy": "2027-03-31" }
  ]
}
```

A current deferral raises that factor's score by one level, up to 3: a deferral acknowledges a gap, it does not fix it. The output shows the base score and the deferral. A deferral whose `revisitBy` date has passed, or whose factor is not measured, is shown but not applied. Unknown factor ids and invalid dates are input errors (exit 2).

### Verdict and risk zones

The verdict comes from the factor scores, by the first rule that applies (weak means a score of 2 or less, `weakMax` in `config/decision.json`):

1. **none**: test-feedback is not measured, so there is no basis for a verdict.
2. **prepare first**: test-feedback is weak and module boundaries are not established. While module-boundaries has no signal, boundaries count as not established, so weak tests alone give *prepare first*.
3. **adapt**: any scored factor is weak, blocking or constraining. Each weak factor is listed as an adaptation to make.
4. **adopt**: no scored factor is weak.

Verdicts use final scores, so a current deferral counts. A verdict is **provisional** while a blocking factor is not measured, and it names the factor.

Risk zones cover source files that are not tests:

- **Modules** start as top-level directories. A directory holding more than half of all source files (`splitShare`) is split into its subdirectories, plus `<dir>/(files)` for its own files, down to `maxDepth` levels.
- **Green** (agents may edit): the repository's test-feedback base score is at least `greenMinTestScore` (3), and the module's p90 lines and share of files over 1000 lines stay within the file-size factor's score-3 thresholds.
- **Yellow** (characterization tests first): otherwise, with the reason.
- **Red** (proposals only): a path with a sensitive term (`redTerms`: auth, login, password, permission, role, billing, payment, secret and similar) as a whole word of a directory or file name, split on separators and camelCase. A red directory is listed once. A module whose source files are all red is red.

Zones use test-feedback's base score, because a deferral adds no tests. Directories without source files are listed as not zoned.

### Report files

`--out <dir>` writes `ai-readiness-report.md` and `ai-readiness-report.json` to `<dir>`, creating it if needed and overwriting earlier reports there. Without `--out`, nothing is written. An out directory inside the audited repository (directly or through a link) is an input error.

Both files come from one report model, so they hold the same content:
- the verdict with its rule and triggers;
- the readiness level;
- every factor with its rule, evidence, partial coverage and any deferral;
- risk zones and red paths;
- everything not measured, in one list;
- signal summaries (git-history hotspots, size distribution and largest files, tests and docs, manifests and runtimes);
- the method: inputs, every read-only command run, collector notes.

Per-file lists are left out, to keep reports small on large repositories. The JSON layout is `schema: "ai-codebase-auditor/report"`, `schemaVersion: 2`, documented in [sprints/feat-008.md](sprints/feat-008.md); version 2 added `testFixture` to each runtime (D-013).

Reports are deterministic. Every date-based rule (the 12-month window, end of life, deferral expiry) uses the audit date in UTC. Keys and lists are in a fixed order, and line endings are LF. Two runs on the same day, repository and configs give identical bytes. The report records the audited commit (`target.head`), so it traces to exact code.

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
