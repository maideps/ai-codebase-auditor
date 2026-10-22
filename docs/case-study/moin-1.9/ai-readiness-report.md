# AI-readiness audit: moin-1.9

| | |
|---|---|
| Target | `D:\7-Maide\Projects\audit-targets\moin-1.9` at commit `8c6341e92bce` |
| Audit date | 2026-10-22 |
| Verdict | **adapt** (provisional: direct-api-calls not measured) |
| Readiness level | **3 of 5**, set by test-feedback (provisional) |
| Tool | ai-codebase-auditor 0.1.0 |

## Verdict

**adapt** (provisional: direct-api-calls not measured): adopt the harness with adaptations for the weak factors below.

Rule: 3 weak factors (score ≤ 2): type-strictness 1, documented-intent 2, dependency-currency 1

Triggered by: type-strictness 1, documented-intent 2, dependency-currency 1.

## Factor scores

| Factor | Class | Score | Rule |
|---|---|---|---|
| test-feedback | blocking | 3 | ratio 0.08 ≥ 0.05 with a runner config and CI |
| type-strictness | constraining | 1 | weighted typed share 0.06 |
| direct-api-calls | blocking | – | not measured: no collector signal yet: needs call-site analysis |
| file-size | constraining | 3 | lower of p90 573 lines (→ 3) and 4.57% of files over 1000 lines (→ 3) |
| module-boundaries | constraining | – | not measured: no collector signal yet: needs an import graph or co-change coupling |
| documented-intent | constraining | 2 | a README without written rules |
| observability | constraining | – | not measured: no collector signal yet: needs a logging and metrics detector |
| dev-deploy-simplicity | constraining | 4 | 3 of 4 signals: CI configured, test runner configured, runtime version declared |
| dependency-currency | constraining | 1 | worst runtime is end-of-life since 2020-01-01 |

Scores are never averaged; the lowest scored blocking factor sets the readiness level.

### test-feedback: Test presence and feedback speed

Score **3** (blocking). Rule: ratio 0.08 ≥ 0.05 with a runner config and CI.

Evidence:

- 96 test files for 1226 source files: ratio 0.08
- test runner configs: MoinMoin/conftest.py
- CI: .travis.yml

Partial: feedback speed is not measured: the audit never runs tests.

### type-strictness: Type strictness

Score **1** (constraining). Rule: weighted typed share 0.06.

Evidence:

- typed share 0.06 of 323903 source lines (strong 18670, weak 0, checked dynamic 0, unchecked dynamic 305233)
- type checkers: none

### direct-api-calls: Direct API calls

Not measured (blocking): no collector signal yet: needs call-site analysis.

### file-size: File size and context legibility

Score **3** (constraining). Rule: lower of p90 573 lines (→ 3) and 4.57% of files over 1000 lines (→ 3).

Evidence:

- 1226 source files: p90 573 lines, 56 over 1000 lines (4.57%)
- largest: MoinMoin/support/pygments/lexers/_lasso_builtins.py (5327 lines), MoinMoin/support/pygments/lexers/_php_builtins.py (4756 lines), MoinMoin/support/werkzeug/datastructures.py (3120 lines), MoinMoin/support/pygments/lexers/_scilab_builtins.py (3094 lines), MoinMoin/support/parsedatetime/__init__.py (2789 lines)

### module-boundaries: Module boundary clarity

Not measured (constraining): no collector signal yet: needs an import graph or co-change coupling.

### documented-intent: Documented intent

Score **2** (constraining). Rule: a README without written rules.

Evidence:

- README: README.rst; contributing: none; architecture: none; decision records: 0; conventions: none
- stated rules: 0 in 0 files
- agent context files (presence alone scores nothing): none

### observability: Observability

Not measured (constraining): no collector signal yet: needs a logging and metrics detector.

### dev-deploy-simplicity: Dev and deploy simplicity

Score **4** (constraining). Rule: 3 of 4 signals: CI configured, test runner configured, runtime version declared.

Evidence:

- CI: .travis.yml
- test runner configs: MoinMoin/conftest.py
- declared runtimes: python 2.7 (setup.py)
- lock files: none

Partial: build scripts and containers are not detected yet.

### dependency-currency: Dependency and runtime currency

Score **1** (constraining). Rule: worst runtime is end-of-life since 2020-01-01.

Evidence:

- python 2.7 (setup.py, classifier): cycle 2.7 end-of-life since 2020-01-01

Partial: package versions are not checked for age or vulnerabilities.

## Risk zones

Green: agents may edit. Yellow: add characterization tests first. Red: agents may only propose changes.

| Zone | Module | Source files | Red files | Reason |
|---|---|---|---|---|
| green | `(root)` | 4 | 0 | test-feedback 3 ≥ 3 and files are legible (p90 370 lines, 0% over 1000 lines) |
| yellow | `MoinMoin/(files)` | 16 | 0 | files too large for unsupervised edits: p90 2006 lines > 800; 25% of files over 1000 lines > 7% |
| yellow | `MoinMoin/_tests` | 7 | 0 | files too large for unsupervised edits: p90 916 lines > 800 |
| green | `MoinMoin/action` | 52 | 2 | test-feedback 3 ≥ 3 and files are legible (p90 397 lines, 1.9% over 1000 lines) |
| red | `MoinMoin/auth` | 16 | 16 | every source file is on a red path: agents may only propose changes |
| yellow | `MoinMoin/config` | 2 | 0 | files too large for unsupervised edits: p90 1477 lines > 800; 50% of files over 1000 lines > 7% |
| yellow | `MoinMoin/converter` | 2 | 0 | files too large for unsupervised edits: p90 1459 lines > 800; 50% of files over 1000 lines > 7% |
| green | `MoinMoin/datastruct` | 10 | 0 | test-feedback 3 ≥ 3 and files are legible (p90 193 lines, 0% over 1000 lines) |
| green | `MoinMoin/events` | 5 | 0 | test-feedback 3 ≥ 3 and files are legible (p90 286 lines, 0% over 1000 lines) |
| green | `MoinMoin/filter` | 22 | 0 | test-feedback 3 ≥ 3 and files are legible (p90 52 lines, 4.5% over 1000 lines) |
| yellow | `MoinMoin/formatter` | 11 | 0 | files too large for unsupervised edits: p90 1052 lines > 800; 18.2% of files over 1000 lines > 7% |
| green | `MoinMoin/i18n` | 11 | 0 | test-feedback 3 ≥ 3 and files are legible (p90 374 lines, 0% over 1000 lines) |
| green | `MoinMoin/logfile` | 3 | 0 | test-feedback 3 ≥ 3 and files are legible (p90 462 lines, 0% over 1000 lines) |
| green | `MoinMoin/macro` | 41 | 0 | test-feedback 3 ≥ 3 and files are legible (p90 235 lines, 0% over 1000 lines) |
| green | `MoinMoin/mail` | 3 | 0 | test-feedback 3 ≥ 3 and files are legible (p90 349 lines, 0% over 1000 lines) |
| green | `MoinMoin/parser` | 18 | 0 | test-feedback 3 ≥ 3 and files are legible (p90 636 lines, 5.6% over 1000 lines) |
| green | `MoinMoin/script` | 113 | 0 | test-feedback 3 ≥ 3 and files are legible (p90 218 lines, 2.7% over 1000 lines) |
| green | `MoinMoin/search` | 10 | 0 | test-feedback 3 ≥ 3 and files are legible (p90 624 lines, 0% over 1000 lines) |
| green | `MoinMoin/security` | 4 | 0 | test-feedback 3 ≥ 3 and files are legible (p90 459 lines, 0% over 1000 lines) |
| green | `MoinMoin/stats` | 6 | 0 | test-feedback 3 ≥ 3 and files are legible (p90 259 lines, 0% over 1000 lines) |
| yellow | `MoinMoin/support` | 388 | 2 | files too large for unsupervised edits: p90 960 lines > 800; 9% of files over 1000 lines > 7% |
| yellow | `MoinMoin/theme` | 6 | 0 | files too large for unsupervised edits: p90 1959 lines > 800; 16.7% of files over 1000 lines > 7% |
| green | `MoinMoin/userform` | 3 | 1 | test-feedback 3 ≥ 3 and files are legible (p90 131 lines, 0% over 1000 lines) |
| green | `MoinMoin/userprefs` | 7 | 0 | test-feedback 3 ≥ 3 and files are legible (p90 410 lines, 0% over 1000 lines) |
| green | `MoinMoin/util` | 21 | 0 | test-feedback 3 ≥ 3 and files are legible (p90 269 lines, 0% over 1000 lines) |
| green | `MoinMoin/web` | 252 | 0 | test-feedback 3 ≥ 3 and files are legible (p90 539 lines, 1.2% over 1000 lines) |
| green | `MoinMoin/widget` | 5 | 0 | test-feedback 3 ≥ 3 and files are legible (p90 707 lines, 0% over 1000 lines) |
| green | `MoinMoin/wikixml` | 3 | 0 | test-feedback 3 ≥ 3 and files are legible (p90 107 lines, 0% over 1000 lines) |
| yellow | `MoinMoin/xmlrpc` | 7 | 0 | files too large for unsupervised edits: p90 1201 lines > 800; 14.3% of files over 1000 lines > 7% |
| green | `contrib` | 153 | 1 | test-feedback 3 ≥ 3 and files are legible (p90 385 lines, 0.7% over 1000 lines) |
| yellow | `jabberbot` | 9 | 0 | files too large for unsupervised edits: p90 1686 lines > 800; 11.1% of files over 1000 lines > 7% |
| green | `wiki` | 16 | 0 | test-feedback 3 ≥ 3 and files are legible (p90 180 lines, 0% over 1000 lines) |

Red paths:

- `MoinMoin/action/login.py` (login)
- `MoinMoin/action/logout.py` (logout)
- `MoinMoin/auth/` (auth)
- `MoinMoin/support/BasicAuthTransport.py` (auth)
- `MoinMoin/support/werkzeug/wrappers/auth.py` (auth)
- `MoinMoin/userform/login.py` (login)
- `contrib/auth_externalcookie/` (auth)

Not zoned (no source files): .github, docs, scripts.

## Not measured

- factor `direct-api-calls`: no collector signal yet: needs call-site analysis
- factor `module-boundaries`: no collector signal yet: needs an import graph or co-change coupling
- factor `observability`: no collector signal yet: needs a logging and metrics detector
- manifest `setup.cfg`: not a supported manifest
- tool `scc`: scc is not installed or not on PATH

## Signals

### Git history

5901 non-merge commits (12 in the 12 months to 2026-10-22), 46 authors, first 2005-09-22, last 2026-07-28, 2087 tracked files.

Hotspots (most commits in the last 12 months):

| File | Commits (12 months) | Commits | Authors | Last commit |
|---|---|---|---|---|
| `MoinMoin/action/info.py` | 6 | 349 | 20 | 2026-07-28 |
| `MoinMoin/macro/MonthCalendar.py` | 4 | 378 | 24 | 2026-07-28 |
| `MoinMoin/config/multiconfig.py` | 1 | 577 | 24 | 2026-07-28 |
| `MoinMoin/action/diff.py` | 1 | 330 | 20 | 2026-07-28 |
| `MoinMoin/web/static/htdocs/modernized/css/common.css` | 1 | 67 | 9 | 2026-07-28 |
| `MoinMoin/web/static/htdocs/rightsidebar/css/common.css` | 1 | 65 | 9 | 2026-07-28 |
| `MoinMoin/web/static/htdocs/modern/css/common.css` | 1 | 64 | 9 | 2026-07-28 |
| `docs/CHANGES` | 0 | 970 | 29 | 2024-08-21 |
| `MoinMoin/wikiutil.py` | 0 | 611 | 25 | 2020-09-02 |
| `MoinMoin/action/AttachFile.py` | 0 | 558 | 24 | 2020-11-08 |

### Code structure

1633 files, 846120 lines; per file p50 114, p90 692, p99 4074, max 208753. Excluded: binary 454. scc: not used (scc is not installed or not on PATH).

Largest files:

| File | Lines |
|---|---|
| `contrib/dict/de.utf-8` | 208753 |
| `contrib/dict/en_us.ascii` | 45404 |
| `contrib/dict/de_de_10000.utf-8` | 10000 |
| `MoinMoin/support/passlib/_data/wordsets/eff_long.txt` | 7776 |
| `docs/CHANGES` | 5355 |
| `MoinMoin/support/pygments/lexers/_lasso_builtins.py` | 5327 |
| `MoinMoin/support/pygments/lexers/_php_builtins.py` | 4756 |
| `wiki/data/pages/BadContent/revisions/00000001` | 4459 |
| `MoinMoin/i18n/ja.MoinMoin.po` | 4249 |
| `MoinMoin/i18n/gl.MoinMoin.po` | 4209 |

### Tests and docs

- Test files: 96 (`test directory` 6, `test_*.py / *_test.py` 90)
- Test runner configs: pytest (`MoinMoin/conftest.py`)
- CI: Travis CI (`.travis.yml`)
- Type checkers: none
- README: README.rst; contributing: none; architecture: none; decision records: 0; conventions: none
- Agent context files (presence alone scores nothing): none
- Stated rules: 0

### Dependencies

| Manifest | Ecosystem | Dependencies | Issues |
|---|---|---|---|
| `setup.py` | pip | 0 | none |

| Runtime | Spec | Declared in | Cycle | Status | End of life |
|---|---|---|---|---|---|
| python | 2.7 | `setup.py` (classifier) | 2.7 | end-of-life | 2020-01-01 |

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
