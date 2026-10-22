# Calibration Case Study

**Status:** final, reviewed 2026-10-22. The proposals from the first run were approved and applied (D-013). The reports in each folder are the regenerated ones; machine-readable labels are in [labels.json](labels.json).

Five public legacy repositories, audited on 2026-10-22. Each folder holds that repository's `ai-readiness-report.md` and `ai-readiness-report.json` (report `schemaVersion` 2). The clones are kept outside this repository, in `D:\7-Maide\Projects\audit-targets\`. They were cloned with full history, `core.autocrlf=false` and Git LFS downloads skipped, and the auditor only read them: every clone's `git status` was empty after each of the two audit runs.

## Repositories

| Repository | Commit | Non-merge commits (last 12 months) | Authors | History | Tracked files | Main languages |
|---|---|---|---|---|---|---|
| [id-Software/DOOM](https://github.com/id-Software/DOOM) | `a77dfb96cb91` | 4 (0) | 2 | 2012-01-31 to 2024-01-16 | 165 | C (`.c`/`.h`, also upper-case `.C`/`.H`) |
| [moinwiki/moin-1.9](https://github.com/moinwiki/moin-1.9) | `8c6341e92bce` | 5,901 (12) | 46 | 2005-09-22 to 2026-07-28 | 2,087 | Python 2, some Java and JavaScript |
| [phpbb/phpbb](https://github.com/phpbb/phpbb) | `27fb7748768e` | 28,503 (483) | 358 | 2001-02-17 to 2026-10-22 | 3,006 | PHP |
| [apache/struts](https://github.com/apache/struts) | `f2ea51ac3e3c` | 7,461 (428) | 149 | 2006-02-22 to 2026-10-22 | 3,848 | Java |
| [redmine/redmine](https://github.com/redmine/redmine) | `77cad6adb89c` | 19,890 (837) | 12 | 2006-06-28 to 2026-10-22 | 2,341 | Ruby on Rails |

Corrections to the facts assumed in `docs/HANDOFF.md`:
- **DOOM's history is 4 commits:** the 1997 source release, imported in 2012. History signals say nothing about it.
- **Redmine has only 12 authors** because it is mirrored from Subversion, where only committers appear.
- **phpBB has 28,503 non-merge commits.** The 39k figure counts merges.

## Expected Versus Actual

| Repository | Expected | First run | Final run | Readiness (first, final) | Match |
|---|---|---|---|---|---|
| DOOM | prepare first | prepare first | **prepare first**: no test files | 1, 1 (test-feedback) | yes |
| moin-1.9 | adapt or prepare first | adapt | **adapt**: type-strictness 1, documented-intent 2, dependency-currency 1 | 1, 3 (test-feedback) | yes |
| phpBB | adapt, revised to adopt (provisional) | adapt, for a wrong reason | **adopt (provisional)**: nothing weak | 3, 5 (test-feedback) | yes, after revision |
| Struts | adapt, revised to adopt (provisional) | adopt | **adopt (provisional)**: nothing weak | 3, 5 (test-feedback) | yes, after revision |
| Redmine | adopt, revised to adapt | adapt | **adapt**: type-strictness 1 | 1, 5 (test-feedback) | yes, after revision |

Every verdict is provisional, because direct-api-calls is not measured.

**Sanity test:** DOOM and Redmine must land at opposite ends.
- **First run: failed.** Both had readiness 1.
- **Final run: passes.** DOOM is at readiness 1 with *prepare first*. Redmine is at readiness 5 with *adapt*, a single adaptation: add type checking.

**Why the expectations were revised:**
- **Struts and phpBB:** the guess of *adapt* rested on module boundaries, which nothing measures yet. Measured as they stand, both are tested, typed or checked, legible and on supported runtimes, so *adopt (provisional)* is the honest result.
- **Redmine:** under the reviewed rule that any weak factor gives *adapt* (D-011), *adopt* is not reachable with an unchecked Ruby codebase. *Adapt* with "add type checking" as the only adaptation is what the tool should say.

## What Calibration Changed (D-013)

| Change | Why | Effect |
|---|---|---|
| Test runners provided by build tools count: Maven (Surefire/Failsafe or `src/test`), Gradle (`src/test`), Rails minitest (`test/test_helper.rb`), RSpec (`spec/spec_helper.rb`), `go test`, `cargo test` | Struts and Redmine ran their tests through Maven and Rails but scored "no runner config" | Struts and Redmine test-feedback went from 3 to 5; Struts dev-deploy from 3 to 4; Redmine from 4 to 5 |
| Runtimes declared under test or fixture directories are listed (`testFixture: true`) but do not set dependency-currency or the "runtime declared" signal | phpBB's worst runtime was `php >=5.3` from test fixtures; the product needs `^8.2` | phpBB dependency-currency went from 1 to 4 |
| Files under test or fixture directories, and `src/<set>/resources`, are not classified as docs | Struts test data (`validationstyles-*.txt`) counted as convention docs | no score change |
| type-strictness is constraining instead of blocking | dynamic-language codebases with strong tests (Redmine) shared DOOM's readiness of 1 | readiness is now set by tests (and, later, direct-api-calls); type-strictness still produces *adapt* when weak |
| Report `schemaVersion` went from 1 to 2 | runtimes gained `testFixture` | consumers check the version |

## Performance

| Repository | First run | Final run | Peak memory |
|---|---|---|---|
| DOOM | 0.7 s | 0.8 s | 48 MB |
| moin-1.9 | 2.9 s | 2.7 s | 198 MB |
| phpBB | 7.2 s | 5.0 s | 113 MB |
| Struts | 3.0 s | 5.4 s | 98 MB |
| Redmine | 2.9 s | 4.1 s | 110 MB |

Holding the whole log in memory and reading every file is fine at this scale, which settles the performance risk noted since feat-002. Struts and Redmine got slower because the Maven and Rails runner checks read the build files.

## Labels (final run)

Labels follow feat-009's definitions:
- **TP (true positive):** the score or finding matches the repository, checked against the clone.
- **FP (false positive):** the score or finding is wrong, checked against the clone.
- **NO (not observable):** the property cannot be seen from repository contents, so it is not scored, or it is reported as partial.

The first-run labels for findings that changed are kept in the notes.

### DOOM

| Factor or finding | Score | Label | Check |
|---|---|---|---|
| test-feedback | 1 | TP | no test files, runner configs or CI in `git ls-files` |
| type-strictness | 4 | TP | 59,110 lines of C, weakly static, no checker |
| file-size | 2 | TP | p90 988 lines; `info.c` 4,670 and `p_enemy.c` 2,008 lines |
| documented-intent | 2 | TP | `README.TXT` only, no written rules |
| dev-deploy-simplicity | 1 | TP under the rule, but partial | two Makefiles (`linuxdoom-1.10/Makefile`, `sndserv/Makefile`) are build scripts the rule does not detect yet |
| dependency-currency | not measured | NO | C with no manifests or declared runtime |
| git history and hotspots | — | NO | 4 commits from a source drop |
| zones | 4 yellow | TP | tests too weak for any green module |

### moin-1.9

| Factor or finding | Score | Label | Check |
|---|---|---|---|
| test-feedback | 3 | TP | 96 `test_*.py` files under `MoinMoin/_tests`, `conftest.py`, `.travis.yml` |
| CI passing | — | NO | `.travis.yml` exists; whether Travis still runs it cannot be seen |
| type-strictness | 1 | TP | Python 2 without a type checker; 6% typed share from bundled Java |
| file-size | 3 | TP | p90 573 lines among source files |
| documented-intent | 2 | TP | `README.rst` and `docs/` plain-text files, no written rules |
| dependency-currency | 1 | TP | `setup.py` classifiers declare Python 2.7, end-of-life since 2020-01-01 |
| source-file population | — | FP (minor, known limit) | about 444 bundled third-party files under `MoinMoin/support/` (pygments, passlib, werkzeug) count as product source. Excluding them changes no score; the test ratio goes from 0.08 to about 0.12. |
| red paths | 7 | TP | `MoinMoin/auth/`, the login and logout actions, `contrib/auth_externalcookie/` |

### phpBB

| Factor or finding | Score | Label | Check |
|---|---|---|---|
| test-feedback | 5 | TP | 573 test files, `phpunit.xml.dist`, three GitHub Actions workflows |
| type-strictness | 3 | TP | Psalm configured (`psalm.xml`), so PHP counts as checked dynamic: 0.58 |
| file-size | 3 | TP | p90 473 lines; `functions.php` 4,270 lines; `recode_cjk.php` is a 45,177-line data table in PHP |
| documented-intent | 3 | TP | `.github/CONTRIBUTING.md`, no architecture docs or written rules |
| dev-deploy-simplicity | 5 | TP | CI, runner, declared runtime, `composer.lock` |
| dependency-currency | 4 | TP | `phpBB/composer.json` requires `^8.2`, supported until 2026-12-31. The 9 fixture declarations under `tests/` are listed but not counted. First run: 1, FP. |
| red paths | 40 | 39 TP, 1 FP (known limit) | auth, OAuth, passwords and permissions are right; `build/doctum-checkout.conf.php` is a version-control checkout, not payments |

### Struts

| Factor or finding | Score | Label | Check |
|---|---|---|---|
| test-feedback | 5 | TP | 911 test files (ratio 0.60), CI, Maven Surefire across 20 module POMs. First run: 3, FP. |
| type-strictness | 5 | TP | 99% Java |
| file-size | 4 | TP | p90 246 lines |
| documented-intent | 3 | TP | 41 stated rules in 8 files, including recent `AGENTS.md` and `CLAUDE.md`, no architecture docs or decision records |
| conventions docs | — | FP (minor, known limit) | test resources are no longer counted (first run: FP). Design notes about the convention *plugin* still match "convention", and design specs under `docs/superpowers/specs/` are now skipped because `specs` is a test-path name. No score changes. |
| dev-deploy-simplicity | 4 | TP (partial) | CI, Maven runner, declared Java 17; no lock file is normal for Maven |
| dependency-currency | 5 | TP | `maven.compiler.release` 17, Temurin support to 2027-10-31 |
| module boundaries | not measured | NO | the original *adapt* expectation rested on Struts' multi-module layout, which no collector measures yet |
| red paths | 13 | 8 TP, 5 FP (known limit) | `RolesInterceptor`, the authorization handlers and the showcase chat login are right; five `Password*` classes render password form fields (UI, not credential logic) |

### Redmine

| Factor or finding | Score | Label | Check |
|---|---|---|---|
| test-feedback | 5 | TP | 419 test files (ratio 0.50), CI, Rails minitest (`test/test_helper.rb`). First run: 3, FP. |
| type-strictness | 1 | TP | Ruby with no Sorbet, Steep or RBS. Now constraining, so it produces *adapt* without setting readiness. |
| file-size | 4 | TP | p90 214 lines among source files |
| documented-intent | 3 | TP | `CONTRIBUTING.md`, no written rules |
| dev-deploy-simplicity | 5 | TP | CI, Rails test runner, declared Ruby, `Gemfile.lock` |
| dependency-currency | 4 | TP | Gemfile `ruby '>= 3.3.0'`, Ruby 3.3 supported until 2027-03-31 |
| git authors | — | NO | 12 authors from a Subversion mirror |
| red paths | 78 | TP | auth sources, OAuth, roles and permissions models, and old migrations on those tables. Editing old migrations is risky anyway. |

## Known Limits Kept After Review

1. **Bundled libraries under non-standard directory names** count as product code (moin-1.9 `MoinMoin/support/`). A fix would honor `linguist-vendored` or take a team-supplied exclude list.
2. **Red-term false positives** from UI and tooling names (`Password*` form-field classes, "doctum-checkout"). Path terms favor recall, and red only means agents propose instead of editing.
3. **Doc classification by name:** "convention" in a feature name matches, and design specs in a `specs/` directory are skipped as test paths.
4. **Unmeasured signals:** module boundaries, direct API calls, observability, test feedback speed, CI pass state and build scripts are not measured. Every verdict stays provisional until direct-api-calls has a collector.
