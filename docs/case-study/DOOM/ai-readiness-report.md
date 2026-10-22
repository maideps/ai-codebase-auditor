# AI-readiness audit: DOOM

| | |
|---|---|
| Target | `D:\7-Maide\Projects\audit-targets\DOOM` at commit `a77dfb96cb91` |
| Audit date | 2026-10-22 |
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

## Not measured

- factor `direct-api-calls`: no collector signal yet: needs call-site analysis
- factor `module-boundaries`: no collector signal yet: needs an import graph or co-change coupling
- factor `observability`: no collector signal yet: needs a logging and metrics detector
- factor `dependency-currency`: no declared runtime with a known end-of-life status outside test fixtures
- tool `scc`: scc is not installed or not on PATH

## Signals

### Git history

4 non-merge commits (0 in the 12 months to 2026-10-22), 2 authors, first 2012-01-31, last 2024-01-16, 165 tracked files.

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
- End-of-life table: `D:\7-Maide\Projects\ai-codebase-auditor\config\runtime-eol.json`, as of 2026-10-21 (1 day before the audit)
- Deferrals: none

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
