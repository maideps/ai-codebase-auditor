# AI-readiness audit: moin-1.9

| | |
|---|---|
| Target | `D:\7-Maide\Projects\audit-targets\moin-1.9` at commit `8c6341e92bce` |
| Audit date | 2026-10-23 |
| Verdict | **adapt** |
| Readiness level | **3 of 5**, set by test-feedback |
| Tool | ai-codebase-auditor 0.1.0 |

## Verdict

**adapt**: adopt the harness with adaptations for the weak factors below.

Rule: 3 weak factors (score ≤ 2): type-strictness 1, documented-intent 2, dependency-currency 1

Triggered by: type-strictness 1, documented-intent 2, dependency-currency 1.

## Factor scores

| Factor | Class | Score | Rule |
|---|---|---|---|
| test-feedback | blocking | 3 | ratio 0.08 ≥ 0.05 with a runner config and CI |
| type-strictness | constraining | 1 | weighted typed share 0.06 |
| direct-api-calls | blocking | 3 | 7.93% of 1210 covered files have a computed-target call (243 sites) |
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

### direct-api-calls: Direct calls (visible at call site)

Score **3** (blocking). Rule: 7.93% of 1210 covered files have a computed-target call (243 sites).

Evidence:

- 96 of 1210 covered product files (7.93%) have computed-target calls: 243 sites
- by construct: getattr by name 175, __getattr__ 26, import by name 19, eval or exec 14, computed call 4, eval or Function 3, Class.forName by name 1, globals() by name 1
- top files: MoinMoin/config/multiconfig.py (15), MoinMoin/user.py (15), MoinMoin/support/passlib/utils/handlers.py (12), MoinMoin/support/werkzeug/datastructures.py (11), MoinMoin/support/passlib/ext/django/utils.py (10)
- sample sites: MoinMoin/config/multiconfig.py:48 import by name, MoinMoin/user.py:103 getattr by name, MoinMoin/support/passlib/utils/handlers.py:894 getattr by name, MoinMoin/support/werkzeug/datastructures.py:74 getattr by name, MoinMoin/support/passlib/ext/django/utils.py:73 getattr by name, MoinMoin/parser/text_rst.py:169 getattr by name, MoinMoin/support/passlib/utils/compat/__init__.py:285 getattr by name, MoinMoin/support/pygments/lexers/__init__.py:45 import by name, MoinMoin/support/werkzeug/local.py:70 __getattr__, MoinMoin/support/parsedatetime/__init__.py:2257 getattr by name
- covered languages hold 99.52% of 323903 source lines

Partial: configuration-wired dispatch (dependency injection, XML mappings, callbacks by symbol, annotations) is not detected; not covered: perl (0.48% of source lines).

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

## Harness adaptation plan

For ai-harness-framework 0.5.0 (commit `7fb142a`). Adopt the harness with these adaptations.

| Level | Item | Trigger | Surfaces |
|---|---|---|---|
| required | typed-changes | type-strictness 1 | package.json typecheck script, DECISIONS.md |
| required | written-intent | documented-intent 2 | AGENTS.md, docs/ARCHITECTURE.md |
| required | supported-runtime | dependency-currency 1 | CI, verification layers |
| required | detected-stack | test-feedback 3 | package.json layer scripts |
| required | red-paths | red zone: 7 paths | AGENTS.md, .claude/settings.json |
| required | yellow-modules | yellow zone: 9 modules | AGENTS.md |
| recommended | verifiable-changes | test-feedback 3 | feature_list.json layers, package.json test script, AGENTS.md |
| recommended | traceable-calls | direct-api-calls 3 | AGENTS.md, package.json lint script |
| recommended | legible-context | file-size 3 | AGENTS.md |

### required: typed-changes

Trigger: type-strictness 1. Surfaces: `package.json typecheck script`, `DECISIONS.md`.

Change: Add a type checker for the main dynamic language in check mode, with a baseline so existing code passes and new code is checked; point the typecheck layer at it and record the baseline as a dated deferral.

Why: Dynamic code without a checker lets an agent's type mistakes through every static layer.

- main dynamic language: python (236203 source lines); suggested checker: mypy or Pyright

### required: written-intent

Trigger: documented-intent 2. Surfaces: `AGENTS.md`, `docs/ARCHITECTURE.md`.

Change: Write the project's non-standard practices as rules in AGENTS.md, and fill docs/ARCHITECTURE.md by hand: the harness placeholder check passes generic template text (maideps/ai-harness-framework#23).

Why: Agents follow written rules; unwritten local conventions are exactly what they get wrong (arXiv 2602.11988).

- README: README.rst; contributing: none; architecture: none; decision records: 0; conventions: none
- stated rules: 0 in 0 files
- agent context files (presence alone scores nothing): none

### required: supported-runtime

Trigger: dependency-currency 1. Surfaces: `CI`, `verification layers`.

Change: Run the verification layers under the declared legacy runtime (a container or a pinned toolchain in CI), separately from the harness's own Node 18 or later, and keep agents away from runtime-sensitive code paths without that toolchain.

Why: Code verified on a different runtime than it ships on is not verified.

- python 2.7 (setup.py, classifier): cycle 2.7 end-of-life since 2020-01-01

### required: detected-stack

Trigger: test-feedback 3. Surfaces: `package.json layer scripts`.

Change: Declare each verification layer command explicitly in package.json scripts (for example phpunit, bin/rails test, make check), so no required layer reports only SKIP.

Why: The harness picks layer commands from root markers; when it does not detect the repository's main language, its layers run the wrong tool or SKIP, and a SKIP-only required layer fails verify-feature (D-029).

- the harness would detect none, but the main language is python

### required: red-paths

Trigger: red zone: 7 paths. Surfaces: `AGENTS.md`, `.claude/settings.json`.

Change: List these paths as proposal-only in AGENTS.md, and add Claude Code permissions.deny rules so agents cannot edit them directly; agents propose diffs for a person to apply.

Why: Auth, billing, permission and secret code needs human review of every change.

- MoinMoin/action/login.py (login): deny Edit(MoinMoin/action/login.py), Write(MoinMoin/action/login.py)
- MoinMoin/action/logout.py (logout): deny Edit(MoinMoin/action/logout.py), Write(MoinMoin/action/logout.py)
- MoinMoin/auth/ (auth): deny Edit(MoinMoin/auth/**), Write(MoinMoin/auth/**)
- MoinMoin/support/BasicAuthTransport.py (auth): deny Edit(MoinMoin/support/BasicAuthTransport.py), Write(MoinMoin/support/BasicAuthTransport.py)
- MoinMoin/support/werkzeug/wrappers/auth.py (auth): deny Edit(MoinMoin/support/werkzeug/wrappers/auth.py), Write(MoinMoin/support/werkzeug/wrappers/auth.py)
- MoinMoin/userform/login.py (login): deny Edit(MoinMoin/userform/login.py), Write(MoinMoin/userform/login.py)
- contrib/auth_externalcookie/ (auth): deny Edit(contrib/auth_externalcookie/**), Write(contrib/auth_externalcookie/**)

### required: yellow-modules

Trigger: yellow zone: 9 modules. Surfaces: `AGENTS.md`.

Change: List these modules in AGENTS.md as characterization-tests-first: no feature work there until their current behavior is pinned by tests.

Why: Agents may only edit autonomously where their changes can be verified.

- MoinMoin/(files): files too large for unsupervised edits: p90 2006 lines > 800; 25% of files over 1000 lines > 7%
- MoinMoin/_tests: files too large for unsupervised edits: p90 916 lines > 800
- MoinMoin/config: files too large for unsupervised edits: p90 1477 lines > 800; 50% of files over 1000 lines > 7%
- MoinMoin/converter: files too large for unsupervised edits: p90 1459 lines > 800; 50% of files over 1000 lines > 7%
- MoinMoin/formatter: files too large for unsupervised edits: p90 1052 lines > 800; 18.2% of files over 1000 lines > 7%
- MoinMoin/support: files too large for unsupervised edits: p90 960 lines > 800; 9% of files over 1000 lines > 7%
- MoinMoin/theme: files too large for unsupervised edits: p90 1959 lines > 800; 16.7% of files over 1000 lines > 7%
- MoinMoin/xmlrpc: files too large for unsupervised edits: p90 1201 lines > 800; 14.3% of files over 1000 lines > 7%
- jabberbot: files too large for unsupervised edits: p90 1686 lines > 800; 11.1% of files over 1000 lines > 7%

### recommended: verifiable-changes

Trigger: test-feedback 3. Surfaces: `feature_list.json layers`, `package.json test script`, `AGENTS.md`.

Change: Grow tests in the modules agents will touch first, and keep feature scopes inside green modules.

Why: Without real tests, every required test layer reports SKIP and fails verify-feature, so no feature can pass honestly.

- 96 test files for 1226 source files: ratio 0.08
- test runner configs: MoinMoin/conftest.py
- CI: .travis.yml

### recommended: traceable-calls

Trigger: direct-api-calls 3. Surfaces: `AGENTS.md`, `package.json lint script`.

Change: List the files with computed-target calls in AGENTS.md as "find every call target before editing".

Why: A call whose target is computed at run time does not show up when an agent searches for the method it renames or changes, so the agent breaks callers it never saw.

- files with computed-target calls: MoinMoin/config/multiconfig.py (15), MoinMoin/user.py (15), MoinMoin/support/passlib/utils/handlers.py (12), MoinMoin/support/werkzeug/datastructures.py (11), MoinMoin/support/passlib/ext/django/utils.py (10), MoinMoin/parser/text_rst.py (9), MoinMoin/support/passlib/utils/compat/__init__.py (6), MoinMoin/support/pygments/lexers/__init__.py (6), MoinMoin/support/werkzeug/local.py (6), MoinMoin/support/parsedatetime/__init__.py (5)

### recommended: legible-context

Trigger: file-size 3. Surfaces: `AGENTS.md`.

Change: List the largest files in AGENTS.md as split-before-feature files.

Why: Large files push the relevant code out of an agent's context and invite confident edits to code it has not read.

- files over 1000 lines: MoinMoin/support/pygments/lexers/_lasso_builtins.py (5327), MoinMoin/support/pygments/lexers/_php_builtins.py (4756), MoinMoin/support/werkzeug/datastructures.py (3120), MoinMoin/support/pygments/lexers/_scilab_builtins.py (3094), MoinMoin/support/parsedatetime/__init__.py (2789), MoinMoin/support/passlib/utils/handlers.py (2712), MoinMoin/support/pygments/lexers/lisp.py (2694), MoinMoin/wikiutil.py (2667), MoinMoin/support/passlib/context.py (2632), MoinMoin/support/pygments/lexers/_openedge_builtins.py (2547)

## Modernization roadmap

Ordered by priority: score gain (plus 1 when a weak factor leaves weak) × 2 for blocking factors ÷ effort (S 1, M 2, L 3).

| # | Factor | Score | Effort | Priority | Step | Verdict after |
|---|---|---|---|---|---|---|
| 1 | documented-intent | 2 → 3 | S | 2 | write at least 3 project rules (AGENTS.md or CONTRIBUTING) | unchanged |
| 2 | dependency-currency | 1 → 5 | L | 1.67 | upgrade python from 2.7 to 3.11 | unchanged |
| 3 | type-strictness | 1 → 3 | M | 1.5 | configure mypy or Pyright for python with a baseline (typed share 0.06 to 0.50) | unchanged |
| 4 | test-feedback | 3 → 4 | M | 1 | add 88 test files (to ratio 0.15) | unchanged |
| 5 | direct-api-calls | 3 → 4 | L | 0.67 | make the computed-target calls explicit in 36 of 96 files (to 5% of files), starting with MoinMoin/config/multiconfig.py (15), MoinMoin/user.py (15), MoinMoin/support/passlib/utils/handlers.py (12) | unchanged |
| 6 | file-size | 3 → 4 | L | 0.33 | split 20 of 56 files over 1000 lines (to 2.9% of files) and bring the p90 file length from 573 to 400 lines | unchanged |

## Not measured

- factor `module-boundaries`: no collector signal yet: needs an import graph or co-change coupling
- factor `observability`: no collector signal yet: needs a logging and metrics detector
- manifest `setup.cfg`: not a supported manifest
- tool `scc`: scc is not installed or not on PATH

## Signals

### Git history

5901 non-merge commits (12 in the 12 months to 2026-10-23), 46 authors, first 2005-09-22, last 2026-07-28, 2087 tracked files.

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

### Dynamic calls

1306 covered files read, tests included; 104 with computed-target calls, 264 sites. Skipped: minified 8.

| Language | Files | With sites | Sites |
|---|---|---|---|
| java | 141 | 1 | 1 |
| javascript | 209 | 6 | 7 |
| php | 19 | 0 | 0 |
| python | 937 | 97 | 256 |

| Construct | Sites |
|---|---|
| getattr by name | 193 |
| __getattr__ | 27 |
| import by name | 20 |
| eval or exec | 14 |
| computed call | 4 |
| eval or Function | 3 |
| globals() by name | 2 |
| Class.forName by name | 1 |

Files with the most sites:

| File | Sites | Constructs |
|---|---|---|
| `MoinMoin/config/multiconfig.py` | 15 | import by name, getattr by name, eval or exec |
| `MoinMoin/user.py` | 15 | getattr by name |
| `MoinMoin/support/passlib/utils/handlers.py` | 12 | getattr by name, __getattr__ |
| `MoinMoin/support/werkzeug/datastructures.py` | 11 | getattr by name, __getattr__ |
| `MoinMoin/support/passlib/ext/django/utils.py` | 10 | getattr by name, import by name |
| `MoinMoin/parser/text_rst.py` | 9 | getattr by name |
| `MoinMoin/support/passlib/tests/utils.py` | 8 | getattr by name |
| `MoinMoin/support/passlib/utils/compat/__init__.py` | 6 | getattr by name, import by name, __getattr__ |
| `MoinMoin/support/pygments/lexers/__init__.py` | 6 | import by name, getattr by name, eval or exec, __getattr__ |
| `MoinMoin/support/werkzeug/local.py` | 6 | __getattr__, getattr by name |

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
- files are those tracked at HEAD; content is read from the working tree; nothing is run
- covered languages: Python, PHP, Ruby, Java, JavaScript and TypeScript
- comments are removed and strings replaced before matching, so text inside strings never counts
- only calls whose target is computed count; a literal target is visible at the call site
- vendored and generated paths are skipped, and so are minified files (a line over 1000 characters)
- configuration-wired dispatch (dependency injection, XML mappings, callbacks by symbol, annotations) is not detected
