# AI-readiness audit: DOOM

| | |
|---|---|
| Target | `D:\7-Maide\Projects\audit-targets\DOOM` at commit `a77dfb96cb91` |
| Audit date | 2026-10-23 |
| Verdict | **prepare first** (provisional: direct-api-calls not measured) |
| Readiness level | **1 of 5**, set by test-feedback (provisional) |
| Tool | ai-codebase-auditor 0.1.0 |

## Verdict

**prepare first** (provisional: direct-api-calls not measured): make changes verifiable before letting agents edit: add characterization tests first.

Rule: test-feedback 1 ≤ 2 and module boundaries not measured

Triggered by: test-feedback 1, module-boundaries not measured.

## Factor scores

| Factor | Class | Score | Rule |
|---|---|---|---|
| test-feedback | blocking | 1 | no test files |
| type-strictness | constraining | 4 | weighted typed share 0.75 |
| direct-api-calls | blocking | – | not measured: no collector signal yet: needs call-site analysis |
| file-size | constraining | 2 | lower of p90 988 lines (→ 2) and 8.90% of files over 1000 lines (→ 2) |
| module-boundaries | constraining | – | not measured: no collector signal yet: needs an import graph or co-change coupling |
| documented-intent | constraining | 2 | a README without written rules |
| observability | constraining | – | not measured: no collector signal yet: needs a logging and metrics detector |
| dev-deploy-simplicity | constraining | 1 | 0 of 4 signals: none |
| dependency-currency | constraining | – | not measured: no declared runtime with a known end-of-life status outside test fixtures |

Scores are never averaged; the lowest scored blocking factor sets the readiness level.

### test-feedback: Test presence and feedback speed

Score **1** (blocking). Rule: no test files.

Evidence:

- 0 test files for 146 source files: ratio 0.00
- test runner configs: none
- CI: none

Partial: feedback speed is not measured: the audit never runs tests.

### type-strictness: Type strictness

Score **4** (constraining). Rule: weighted typed share 0.75.

Evidence:

- typed share 0.75 of 59110 source lines (strong 0, weak 59110, checked dynamic 0, unchecked dynamic 0)
- type checkers: none

### direct-api-calls: Direct API calls

Not measured (blocking): no collector signal yet: needs call-site analysis.

### file-size: File size and context legibility

Score **2** (constraining). Rule: lower of p90 988 lines (→ 2) and 8.90% of files over 1000 lines (→ 2).

Evidence:

- 146 source files: p90 988 lines, 13 over 1000 lines (8.90%)
- largest: linuxdoom-1.10/info.c (4670 lines), linuxdoom-1.10/tables.c (2130 lines), linuxdoom-1.10/p_enemy.c (2008 lines), linuxdoom-1.10/m_menu.c (1893 lines), linuxdoom-1.10/wi_stuff.c (1850 lines)

### module-boundaries: Module boundary clarity

Not measured (constraining): no collector signal yet: needs an import graph or co-change coupling.

### documented-intent: Documented intent

Score **2** (constraining). Rule: a README without written rules.

Evidence:

- README: README.TXT; contributing: none; architecture: none; decision records: 0; conventions: none
- stated rules: 0 in 0 files
- agent context files (presence alone scores nothing): none

### observability: Observability

Not measured (constraining): no collector signal yet: needs a logging and metrics detector.

### dev-deploy-simplicity: Dev and deploy simplicity

Score **1** (constraining). Rule: 0 of 4 signals: none.

Evidence:

- CI: none
- test runner configs: none
- declared runtimes: none
- lock files: none

Partial: build scripts and containers are not detected yet.

### dependency-currency: Dependency and runtime currency

Not measured (constraining): no declared runtime with a known end-of-life status outside test fixtures.

## Risk zones

Green: agents may edit. Yellow: add characterization tests first. Red: agents may only propose changes.

| Zone | Module | Source files | Red files | Reason |
|---|---|---|---|---|
| yellow | `ipx` | 7 | 0 | test-feedback 1 < 3: add characterization tests before agents edit |
| yellow | `linuxdoom-1.10` | 124 | 0 | test-feedback 1 < 3: add characterization tests before agents edit |
| yellow | `sersrc` | 7 | 0 | test-feedback 1 < 3: add characterization tests before agents edit |
| yellow | `sndserv` | 8 | 0 | test-feedback 1 < 3: add characterization tests before agents edit |

Red paths:

- none

Not zoned (no source files): (root).

## Harness adaptation plan

For ai-harness-framework 0.5.0 (commit `7fb142a`). Do not adopt the harness for feature work yet: complete the required items first, starting with test-feedback.

| Level | Item | Trigger | Surfaces |
|---|---|---|---|
| required | verifiable-changes | test-feedback 1 | feature_list.json layers, package.json test script, AGENTS.md |
| required | legible-context | file-size 2 | AGENTS.md |
| required | written-intent | documented-intent 2 | AGENTS.md, docs/ARCHITECTURE.md |
| required | reproducible-runs | dev-deploy-simplicity 1 | init.sh, .github/workflows/ci.yml, runtime version file |
| required | detected-stack | test-feedback 1 | package.json layer scripts |
| required | yellow-modules | yellow zone: 4 modules | AGENTS.md |

### required: verifiable-changes

Trigger: test-feedback 1. Surfaces: `feature_list.json layers`, `package.json test script`, `AGENTS.md`.

Change: Before a feature edits a module, capture its current behavior with characterization tests (golden-master style) and make the test layer run them. Add an AGENTS.md rule: the agent that changes logic is never the only author of its tests.

Why: Without real tests, every required test layer reports SKIP and fails verify-feature, so no feature can pass honestly.

- 0 test files for 146 source files: ratio 0.00
- test runner configs: none
- CI: none

### required: legible-context

Trigger: file-size 2. Surfaces: `AGENTS.md`.

Change: Add an AGENTS.md rule to work one module at a time, and list the oversized files: plan edits by function there, and split a file before adding features to it.

Why: Large files push the relevant code out of an agent's context and invite confident edits to code it has not read.

- files over 1000 lines: linuxdoom-1.10/info.c (4670), linuxdoom-1.10/tables.c (2130), linuxdoom-1.10/p_enemy.c (2008), linuxdoom-1.10/m_menu.c (1893), linuxdoom-1.10/wi_stuff.c (1850), linuxdoom-1.10/g_game.c (1690), linuxdoom-1.10/st_stuff.c (1471), linuxdoom-1.10/p_spec.c (1362), linuxdoom-1.10/am_map.c (1349), linuxdoom-1.10/info.h (1340)

### required: written-intent

Trigger: documented-intent 2. Surfaces: `AGENTS.md`, `docs/ARCHITECTURE.md`.

Change: Write the project's non-standard practices as rules in AGENTS.md, and fill docs/ARCHITECTURE.md by hand: the harness placeholder check passes generic template text (maideps/ai-harness-framework#23).

Why: Agents follow written rules; unwritten local conventions are exactly what they get wrong (arXiv 2602.11988).

- README: README.TXT; contributing: none; architecture: none; decision records: 0; conventions: none
- stated rules: 0 in 0 files
- agent context files (presence alone scores nothing): none

### required: reproducible-runs

Trigger: dev-deploy-simplicity 1. Surfaces: `init.sh`, `.github/workflows/ci.yml`, `runtime version file`.

Change: Add what the evidence shows missing: CI from the harness template (templates/ci.yml), a pinned runtime version, a test runner, and a lock file where the ecosystem uses one.

Why: init.sh and the verification layers can only be trusted when the environment they run in is pinned and scripted.

- missing: CI configured, test runner configured, runtime version declared

### required: detected-stack

Trigger: test-feedback 1. Surfaces: `package.json layer scripts`.

Change: Declare each verification layer command explicitly in package.json scripts (for example phpunit, bin/rails test, make check), so no required layer reports only SKIP.

Why: The harness picks layer commands from root markers; when it does not detect the repository's main language, its layers run the wrong tool or SKIP, and a SKIP-only required layer fails verify-feature (D-029).

- the harness would detect none, but the main language is c

### required: yellow-modules

Trigger: yellow zone: 4 modules. Surfaces: `AGENTS.md`.

Change: List these modules in AGENTS.md as characterization-tests-first: no feature work there until their current behavior is pinned by tests.

Why: Agents may only edit autonomously where their changes can be verified.

- ipx: test-feedback 1 < 3: add characterization tests before agents edit
- linuxdoom-1.10: test-feedback 1 < 3: add characterization tests before agents edit
- sersrc: test-feedback 1 < 3: add characterization tests before agents edit
- sndserv: test-feedback 1 < 3: add characterization tests before agents edit

Not assessed (factor not measured):

- supported-runtime (dependency-currency): no declared runtime with a known end-of-life status outside test fixtures

## Modernization roadmap

Ordered by priority: score gain (plus 1 when a weak factor leaves weak) × 2 for blocking factors ÷ effort (S 1, M 2, L 3).

| # | Factor | Score | Effort | Priority | Step | Verdict after |
|---|---|---|---|---|---|---|
| 1 | test-feedback | 1 → 3 | M | 3 | add 8 test files (to ratio 0.05), a test runner config and CI | adapt |
| 2 | documented-intent | 2 → 3 | S | 2 | write at least 3 project rules (AGENTS.md or CONTRIBUTING) | unchanged |
| 3 | dev-deploy-simplicity | 1 → 4 | M | 2 | add CI, a test runner config and a pinned runtime version | unchanged |
| 4 | file-size | 2 → 3 | L | 0.67 | split 3 of 13 files over 1000 lines (to 6.8% of files) and bring the p90 file length from 988 to 800 lines | unchanged |

## Not measured

- factor `direct-api-calls`: no collector signal yet: needs call-site analysis
- factor `module-boundaries`: no collector signal yet: needs an import graph or co-change coupling
- factor `observability`: no collector signal yet: needs a logging and metrics detector
- factor `dependency-currency`: no declared runtime with a known end-of-life status outside test fixtures
- tool `scc`: scc is not installed or not on PATH

## Signals

### Git history

4 non-merge commits (0 in the 12 months to 2026-10-23), 2 authors, first 2012-01-31, last 2024-01-16, 165 tracked files.

Hotspots (most commits in the last 12 months):

| File | Commits (12 months) | Commits | Authors | Last commit |
|---|---|---|---|---|
| `README.TXT` | 0 | 2 | 2 | 2024-01-16 |
| `LICENSE.TXT` | 0 | 1 | 1 | 2024-01-16 |
| `ipx/DOOMNET.C` | 0 | 1 | 1 | 2012-01-31 |
| `ipx/DOOMNET.H` | 0 | 1 | 1 | 2012-01-31 |
| `ipx/IPXNET.C` | 0 | 1 | 1 | 2012-01-31 |
| `ipx/IPXNET.H` | 0 | 1 | 1 | 2012-01-31 |
| `ipx/IPXSETUP.C` | 0 | 1 | 1 | 2012-01-31 |
| `ipx/IPXSTR.H` | 0 | 1 | 1 | 2012-01-31 |
| `ipx/IPX_FRCH.H` | 0 | 1 | 1 | 2012-01-31 |
| `ipx/README` | 0 | 1 | 1 | 2012-01-31 |

### Code structure

165 files, 61896 lines; per file p50 132, p90 922, p99 2130, max 4670. Excluded: none. scc: not used (scc is not installed or not on PATH).

Largest files:

| File | Lines |
|---|---|
| `linuxdoom-1.10/info.c` | 4670 |
| `linuxdoom-1.10/tables.c` | 2130 |
| `linuxdoom-1.10/p_enemy.c` | 2008 |
| `linuxdoom-1.10/m_menu.c` | 1893 |
| `linuxdoom-1.10/wi_stuff.c` | 1850 |
| `linuxdoom-1.10/g_game.c` | 1690 |
| `linuxdoom-1.10/st_stuff.c` | 1471 |
| `linuxdoom-1.10/p_spec.c` | 1362 |
| `linuxdoom-1.10/am_map.c` | 1349 |
| `linuxdoom-1.10/info.h` | 1340 |

### Tests and docs

- Test files: 0 (none)
- Test runner configs: none
- CI: none
- Type checkers: none
- README: README.TXT; contributing: none; architecture: none; decision records: 0; conventions: none
- Agent context files (presence alone scores nothing): none
- Stated rules: 0

### Dependencies

None.

None.

## Method

- Factor config: `D:\7-Maide\Projects\ai-codebase-auditor\config\factors.json`
- Decision config: `D:\7-Maide\Projects\ai-codebase-auditor\config\decision.json`
- End-of-life table: `D:\7-Maide\Projects\ai-codebase-auditor\config\runtime-eol.json`, as of 2026-10-21 (2 days before the audit)
- Deferrals: none
- Harness requirements: `D:\7-Maide\Projects\ai-codebase-auditor\config\harness-requirements.json`

Read-only commands run against the target:

- `git rev-parse --is-shallow-repository`
- `git rev-parse --verify -q HEAD`
- `git rev-parse HEAD`
- `git ls-tree -r -z --name-only HEAD`
- `git log --no-merges --no-renames --name-only -z HEAD`
- `git ls-tree -r -z HEAD`
- `scc --by-file --format json .`

Collector notes:

- merge commits are excluded
- renames are not followed, so a renamed file's history starts at the rename
- authors are counted by email after .mailmap, case-insensitively
- dates are author dates
- files are those tracked at HEAD; content is read from the working tree
- line and byte counts come from the built-in counter
- a file is binary when its first 8000 bytes contain a NUL byte, as git decides
- vendored: any path segment in node_modules, bower_components, vendor, vendors, third_party, third-party, thirdparty, Pods
- generated: lock files, *.min.js, *.min.css and *.map
- symlinks and submodules are never followed
- paths are those tracked at HEAD; vendored paths are ignored
- test files are matched by name and directory conventions; tests are never run
- build-tool test runners (Maven, Gradle, Rails minitest, RSpec, go test, cargo test) count when tests sit beside the build file
- files under test and fixture directories, and src/<set>/resources, are not classified as documentation
- CI files show that CI is configured, not that it passes
- agent context files are listed for presence only; presence alone scores nothing
- type checkers are found by config file; inherited tsconfig settings (extends) are not followed
- stated rules are lines with must, never, always, do not, should not, required, forbidden or prohibited in agent context, contributing, architecture and convention docs, outside code blocks; whether a rule is non-standard needs judgment
- manifests are files tracked at HEAD outside vendored directories, read as text; setup.py and build files are never executed
- nothing is installed or resolved; versions are as declared
- for a version range, the lowest declared version is assessed
- runtimes declared under test or fixture directories are marked testFixture and do not count as the product's runtime
- end-of-life dates come from the table as of 2026-10-21; a runtime is end-of-life on or after its cycle's date
- Maven dependencies include those declared in dependencyManagement and plugin blocks
