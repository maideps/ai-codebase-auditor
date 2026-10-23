# AI-readiness audit: phpBB

| | |
|---|---|
| Target | `D:\7-Maide\Projects\audit-targets\phpBB` at commit `27fb7748768e` |
| Audit date | 2026-10-23 |
| Verdict | **adopt** (provisional: direct-api-calls not measured) |
| Readiness level | **5 of 5**, set by test-feedback (provisional) |
| Tool | ai-codebase-auditor 0.1.0 |

## Verdict

**adopt** (provisional: direct-api-calls not measured): the harness can be adopted as is.

Rule: no scored factor is weak (all ≥ 3)

Triggered by: test-feedback 5.

## Factor scores

| Factor | Class | Score | Rule |
|---|---|---|---|
| test-feedback | blocking | 5 | ratio 0.42 ≥ 0.3 with a runner config and CI |
| type-strictness | constraining | 3 | weighted typed share 0.58 |
| direct-api-calls | blocking | – | not measured: no collector signal yet: needs call-site analysis |
| file-size | constraining | 3 | lower of p90 473 lines (→ 3) and 3.87% of files over 1000 lines (→ 3) |
| module-boundaries | constraining | – | not measured: no collector signal yet: needs an import graph or co-change coupling |
| documented-intent | constraining | 3 | docs with contributing, architecture, convention or decision docs |
| observability | constraining | – | not measured: no collector signal yet: needs a logging and metrics detector |
| dev-deploy-simplicity | constraining | 5 | 4 of 4 signals: CI configured, test runner configured, runtime version declared, lock file committed |
| dependency-currency | constraining | 4 | a runtime reaches end of life on 2026-12-31, within 12 months |

Scores are never averaged; the lowest scored blocking factor sets the readiness level.

### test-feedback: Test presence and feedback speed

Score **5** (blocking). Rule: ratio 0.42 ≥ 0.3 with a runner config and CI.

Evidence:

- 573 test files for 1370 source files: ratio 0.42
- test runner configs: phpunit.xml.dist
- CI: .github/workflows/check_merge_to_master.yml, .github/workflows/merge_3.3.x_to_master.yml, .github/workflows/tests.yml

Partial: feedback speed is not measured: the audit never runs tests.

### type-strictness: Type strictness

Score **3** (constraining). Rule: weighted typed share 0.58.

Evidence:

- typed share 0.58 of 317925 source lines (strong 0, weak 0, checked dynamic 305116, unchecked dynamic 12809)
- type checkers: Psalm (psalm.xml)

### direct-api-calls: Direct API calls

Not measured (blocking): no collector signal yet: needs call-site analysis.

### file-size: File size and context legibility

Score **3** (constraining). Rule: lower of p90 473 lines (→ 3) and 3.87% of files over 1000 lines (→ 3).

Evidence:

- 1370 source files: p90 473 lines, 53 over 1000 lines (3.87%)
- largest: phpBB/includes/utf/data/recode_cjk.php (45177 lines), phpBB/includes/functions.php (4270 lines), phpBB/assets/javascript/cropper.js (3625 lines), phpBB/includes/functions_admin.php (3236 lines), phpBB/includes/functions_user.php (3150 lines)

### module-boundaries: Module boundary clarity

Not measured (constraining): no collector signal yet: needs an import graph or co-change coupling.

### documented-intent: Documented intent

Score **3** (constraining). Rule: docs with contributing, architecture, convention or decision docs.

Evidence:

- README: README.md; contributing: .github/CONTRIBUTING.md; architecture: none; decision records: 0; conventions: none
- stated rules: 0 in 0 files
- agent context files (presence alone scores nothing): none

### observability: Observability

Not measured (constraining): no collector signal yet: needs a logging and metrics detector.

### dev-deploy-simplicity: Dev and deploy simplicity

Score **5** (constraining). Rule: 4 of 4 signals: CI configured, test runner configured, runtime version declared, lock file committed.

Evidence:

- CI: .github/workflows/check_merge_to_master.yml, .github/workflows/merge_3.3.x_to_master.yml, .github/workflows/tests.yml
- test runner configs: phpunit.xml.dist
- declared runtimes: php ^8.2 (phpBB/composer.json), php 8.2.27 (phpBB/composer.json), php ^8.2 (phpBB/phpbb/composer.json), php >=5.4.7 (tests/dbal/ext/foo/bar/composer.json), php >=5.3 (tests/extension/ext/barfoo/composer.json), php >=5.3 (tests/extension/ext/vendor2/bar/composer.json), php >=5.3 (tests/extension/ext/vendor2/foo/composer.json), php >=5.3 (tests/extension/ext/vendor3/foo/composer.json), php >=5.3 (tests/extension/ext/vendor4/bar/composer.json), php >=5.3 (tests/extension/ext/vendor5/foo/composer.json), php >=5.3 (tests/functional/fixtures/ext/foo/bar/composer.json), php >=5.3 (tests/functional/fixtures/ext/foo/foo/composer.json)
- lock files: package-lock.json, phpBB/composer.lock

Partial: build scripts and containers are not detected yet.

### dependency-currency: Dependency and runtime currency

Score **4** (constraining). Rule: a runtime reaches end of life on 2026-12-31, within 12 months.

Evidence:

- php ^8.2 (phpBB/composer.json, require.php): cycle 8.2 supported until 2026-12-31
- php 8.2.27 (phpBB/composer.json, config.platform.php): cycle 8.2 supported until 2026-12-31
- php ^8.2 (phpBB/phpbb/composer.json, require.php): cycle 8.2 supported until 2026-12-31
- ignored as test fixtures: php >=5.4.7 (tests/dbal/ext/foo/bar/composer.json), php >=5.3 (tests/extension/ext/barfoo/composer.json), php >=5.3 (tests/extension/ext/vendor2/bar/composer.json), php >=5.3 (tests/extension/ext/vendor2/foo/composer.json), php >=5.3 (tests/extension/ext/vendor3/foo/composer.json), php >=5.3 (tests/extension/ext/vendor4/bar/composer.json), php >=5.3 (tests/extension/ext/vendor5/foo/composer.json), php >=5.3 (tests/functional/fixtures/ext/foo/bar/composer.json), php >=5.3 (tests/functional/fixtures/ext/foo/foo/composer.json)

Partial: package versions are not checked for age or vulnerabilities.

## Risk zones

Green: agents may edit. Yellow: add characterization tests first. Red: agents may only propose changes.

| Zone | Module | Source files | Red files | Reason |
|---|---|---|---|---|
| green | `(root)` | 1 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 67 lines, 0% over 1000 lines) |
| green | `.devcontainer` | 2 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 81 lines, 0% over 1000 lines) |
| green | `.github` | 16 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 81 lines, 0% over 1000 lines) |
| green | `build` | 27 | 1 | test-feedback 5 ≥ 3 and files are legible (p90 380 lines, 0% over 1000 lines) |
| green | `git-tools` | 2 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 194 lines, 0% over 1000 lines) |
| yellow | `phpBB/(files)` | 15 | 0 | files too large for unsupervised edits: p90 2124 lines > 800; 33.3% of files over 1000 lines > 7% |
| green | `phpBB/adm` | 6 | 1 | test-feedback 5 ≥ 3 and files are legible (p90 425 lines, 0% over 1000 lines) |
| yellow | `phpBB/assets` | 10 | 0 | files too large for unsupervised edits: p90 1914 lines > 800; 30% of files over 1000 lines > 7% |
| green | `phpBB/bin` | 1 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 95 lines, 0% over 1000 lines) |
| green | `phpBB/develop` | 36 | 2 | test-feedback 5 ≥ 3 and files are legible (p90 307 lines, 0% over 1000 lines) |
| green | `phpBB/download` | 1 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 55 lines, 0% over 1000 lines) |
| yellow | `phpBB/includes` | 166 | 7 | files too large for unsupervised edits: p90 1545 lines > 800; 18.7% of files over 1000 lines > 7% |
| yellow | `phpBB/install` | 8 | 0 | files too large for unsupervised edits: p90 1605 lines > 800; 12.5% of files over 1000 lines > 7% |
| green | `phpBB/language` | 40 | 2 | test-feedback 5 ≥ 3 and files are legible (p90 594 lines, 2.5% over 1000 lines) |
| yellow | `phpBB/phpbb/(files)` | 16 | 1 | files too large for unsupervised edits: p90 930 lines > 800 |
| green | `phpBB/phpbb/attachment` | 5 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 474 lines, 0% over 1000 lines) |
| red | `phpBB/phpbb/auth` | 16 | 16 | every source file is on a red path: agents may only propose changes |
| green | `phpBB/phpbb/avatar` | 7 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 379 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/ban` | 11 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 240 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/cache` | 10 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 425 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/captcha` | 11 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 391 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/composer` | 14 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 335 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/config` | 3 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 219 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/console` | 44 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 223 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/controller` | 4 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 375 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/cron` | 23 | 1 | test-feedback 5 ≥ 3 and files are legible (p90 162 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/db` | 440 | 19 | test-feedback 5 ≥ 3 and files are legible (p90 151 lines, 0.9% over 1000 lines) |
| green | `phpBB/phpbb/debug` | 2 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 71 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/di` | 14 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 167 lines, 0% over 1000 lines) |
| yellow | `phpBB/phpbb/event` | 9 | 0 | files too large for unsupervised edits: p90 808 lines > 800 |
| green | `phpBB/phpbb/exception` | 4 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 70 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/extension` | 7 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 585 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/feed` | 24 | 1 | test-feedback 5 ≥ 3 and files are legible (p90 211 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/files` | 10 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 510 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/filesystem` | 5 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 744 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/finder` | 4 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 545 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/form` | 1 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 104 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/forum` | 2 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 156 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/group` | 1 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 359 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/groupposition` | 4 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 597 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/help` | 5 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 181 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/install` | 98 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 288 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/json` | 1 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 59 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/language` | 6 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 685 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/lock` | 3 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 153 lines, 0% over 1000 lines) |
| yellow | `phpBB/phpbb/log` | 3 | 0 | files too large for unsupervised edits: p90 1008 lines > 800; 33.3% of files over 1000 lines > 7% |
| green | `phpBB/phpbb/members` | 4 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 469 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/mention` | 10 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 194 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/message` | 5 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 274 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/messenger` | 4 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 588 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/mimetype` | 5 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 509 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/module` | 3 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 564 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/notification` | 33 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 462 lines, 3% over 1000 lines) |
| red | `phpBB/phpbb/passwords` | 22 | 22 | every source file is on a red path: agents may only propose changes |
| green | `phpBB/phpbb/plupload` | 1 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 427 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/posting` | 1 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 43 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/profilefields` | 12 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 418 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/report` | 14 | 1 | test-feedback 5 ≥ 3 and files are legible (p90 175 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/request` | 5 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 454 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/routing` | 8 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 408 lines, 0% over 1000 lines) |
| yellow | `phpBB/phpbb/search` | 16 | 0 | files too large for unsupervised edits: p90 1170 lines > 800; 25% of files over 1000 lines > 7% |
| green | `phpBB/phpbb/storage` | 16 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 278 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/template` | 31 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 347 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/textformatter` | 15 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 371 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/textreparser` | 13 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 148 lines, 0% over 1000 lines) |
| yellow | `phpBB/phpbb/tree` | 3 | 0 | files too large for unsupervised edits: p90 875 lines > 800 |
| green | `phpBB/phpbb/ucp` | 4 | 2 | test-feedback 5 ≥ 3 and files are legible (p90 496 lines, 0% over 1000 lines) |
| green | `phpBB/phpbb/update` | 3 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 175 lines, 0% over 1000 lines) |
| green | `phpBB/styles` | 3 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 757 lines, 0% over 1000 lines) |
| green | `vagrant` | 1 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 37 lines, 0% over 1000 lines) |

Red paths:

- `build/doctum-checkout.conf.php` (checkout)
- `phpBB/adm/style/permissions.js` (permissions)
- `phpBB/develop/add_permissions.php` (permissions)
- `phpBB/develop/set_permissions.sh` (permissions)
- `phpBB/includes/acp/acp_permission_roles.php` (permission)
- `phpBB/includes/acp/acp_permissions.php` (permissions)
- `phpBB/includes/acp/auth.php` (auth)
- `phpBB/includes/acp/info/acp_permission_roles.php` (permission)
- `phpBB/includes/acp/info/acp_permissions.php` (permissions)
- `phpBB/includes/ucp/info/ucp_auth_link.php` (auth)
- `phpBB/includes/ucp/ucp_auth_link.php` (auth)
- `phpBB/language/en/acp/permissions.php` (permissions)
- `phpBB/language/en/acp/permissions_phpbb.php` (permissions)
- `phpBB/phpbb/auth/` (auth)
- `phpBB/phpbb/cron/task/core/purge_oauth_states.php` (oauth)
- `phpBB/phpbb/db/migration/data/v310/auth_provider_oauth.php` (auth)
- `phpBB/phpbb/db/migration/data/v310/auth_provider_oauth2.php` (auth)
- `phpBB/phpbb/db/migration/data/v310/forgot_password.php` (password)
- `phpBB/phpbb/db/migration/data/v310/passwords.php` (passwords)
- `phpBB/phpbb/db/migration/data/v310/passwords_convert_p1.php` (passwords)
- `phpBB/phpbb/db/migration/data/v310/passwords_convert_p2.php` (passwords)
- `phpBB/phpbb/db/migration/data/v310/passwords_p2.php` (passwords)
- `phpBB/phpbb/db/migration/data/v310/signature_module_auth.php` (auth)
- `phpBB/phpbb/db/migration/data/v320/announce_global_permission.php` (permission)
- `phpBB/phpbb/db/migration/data/v320/oauth_states.php` (oauth)
- `phpBB/phpbb/db/migration/data/v32x/f_list_topics_permission_add.php` (permission)
- `phpBB/phpbb/db/migration/data/v32x/user_emoji_permission.php` (permission)
- `phpBB/phpbb/db/migration/data/v330/reset_password.php` (password)
- `phpBB/phpbb/db/migration/data/v33x/add_oauth_state_time.php` (oauth)
- `phpBB/phpbb/db/migration/data/v33x/remove_orphaned_roles.php` (roles)
- `phpBB/phpbb/db/migration/data/v400/add_storage_permission.php` (permission)
- `phpBB/phpbb/db/migration/data/v400/extensions_catalog_auth.php` (auth)
- `phpBB/phpbb/db/migration/data/v400/remove_smtp_auth_method.php` (auth)
- `phpBB/phpbb/db/migration/tool/permission.php` (permission)
- `phpBB/phpbb/feed/event/http_auth_subscriber.php` (auth)
- `phpBB/phpbb/passwords/` (passwords)
- `phpBB/phpbb/permissions.php` (permissions)
- `phpBB/phpbb/report/exception/report_permission_denied_exception.php` (permission)
- `phpBB/phpbb/ucp/controller/oauth.php` (oauth)
- `phpBB/phpbb/ucp/controller/reset_password.php` (password)

Not zoned (no source files): .vscode, tests.

## Harness adaptation plan

For ai-harness-framework 0.5.0 (commit `7fb142a`). Adopt the harness as is, with the guardrails and recommendations below.

| Level | Item | Trigger | Surfaces |
|---|---|---|---|
| required | detected-stack | test-feedback 5 | package.json layer scripts |
| required | red-paths | red zone: 40 paths | AGENTS.md, .claude/settings.json |
| required | yellow-modules | yellow zone: 9 modules | AGENTS.md |
| recommended | typed-changes | type-strictness 3 | package.json typecheck script, DECISIONS.md |
| recommended | legible-context | file-size 3 | AGENTS.md |
| recommended | written-intent | documented-intent 3 | AGENTS.md, docs/ARCHITECTURE.md |

### required: detected-stack

Trigger: test-feedback 5. Surfaces: `package.json layer scripts`.

Change: Declare each verification layer command explicitly in package.json scripts (for example phpunit, bin/rails test, make check), so no required layer reports only SKIP.

Why: The harness picks layer commands from root markers; when it does not detect the repository's main language, its layers run the wrong tool or SKIP, and a SKIP-only required layer fails verify-feature (D-029).

- the harness would detect node (from package.json), but the main language is php

### required: red-paths

Trigger: red zone: 40 paths. Surfaces: `AGENTS.md`, `.claude/settings.json`.

Change: List these paths as proposal-only in AGENTS.md, and add Claude Code permissions.deny rules so agents cannot edit them directly; agents propose diffs for a person to apply.

Why: Auth, billing, permission and secret code needs human review of every change.

- build/doctum-checkout.conf.php (checkout): deny Edit(build/doctum-checkout.conf.php), Write(build/doctum-checkout.conf.php)
- phpBB/adm/style/permissions.js (permissions): deny Edit(phpBB/adm/style/permissions.js), Write(phpBB/adm/style/permissions.js)
- phpBB/develop/add_permissions.php (permissions): deny Edit(phpBB/develop/add_permissions.php), Write(phpBB/develop/add_permissions.php)
- phpBB/develop/set_permissions.sh (permissions): deny Edit(phpBB/develop/set_permissions.sh), Write(phpBB/develop/set_permissions.sh)
- phpBB/includes/acp/acp_permission_roles.php (permission): deny Edit(phpBB/includes/acp/acp_permission_roles.php), Write(phpBB/includes/acp/acp_permission_roles.php)
- phpBB/includes/acp/acp_permissions.php (permissions): deny Edit(phpBB/includes/acp/acp_permissions.php), Write(phpBB/includes/acp/acp_permissions.php)
- phpBB/includes/acp/auth.php (auth): deny Edit(phpBB/includes/acp/auth.php), Write(phpBB/includes/acp/auth.php)
- phpBB/includes/acp/info/acp_permission_roles.php (permission): deny Edit(phpBB/includes/acp/info/acp_permission_roles.php), Write(phpBB/includes/acp/info/acp_permission_roles.php)
- phpBB/includes/acp/info/acp_permissions.php (permissions): deny Edit(phpBB/includes/acp/info/acp_permissions.php), Write(phpBB/includes/acp/info/acp_permissions.php)
- phpBB/includes/ucp/info/ucp_auth_link.php (auth): deny Edit(phpBB/includes/ucp/info/ucp_auth_link.php), Write(phpBB/includes/ucp/info/ucp_auth_link.php)
- phpBB/includes/ucp/ucp_auth_link.php (auth): deny Edit(phpBB/includes/ucp/ucp_auth_link.php), Write(phpBB/includes/ucp/ucp_auth_link.php)
- phpBB/language/en/acp/permissions.php (permissions): deny Edit(phpBB/language/en/acp/permissions.php), Write(phpBB/language/en/acp/permissions.php)
- phpBB/language/en/acp/permissions_phpbb.php (permissions): deny Edit(phpBB/language/en/acp/permissions_phpbb.php), Write(phpBB/language/en/acp/permissions_phpbb.php)
- phpBB/phpbb/auth/ (auth): deny Edit(phpBB/phpbb/auth/**), Write(phpBB/phpbb/auth/**)
- phpBB/phpbb/cron/task/core/purge_oauth_states.php (oauth): deny Edit(phpBB/phpbb/cron/task/core/purge_oauth_states.php), Write(phpBB/phpbb/cron/task/core/purge_oauth_states.php)
- phpBB/phpbb/db/migration/data/v310/auth_provider_oauth.php (auth): deny Edit(phpBB/phpbb/db/migration/data/v310/auth_provider_oauth.php), Write(phpBB/phpbb/db/migration/data/v310/auth_provider_oauth.php)
- phpBB/phpbb/db/migration/data/v310/auth_provider_oauth2.php (auth): deny Edit(phpBB/phpbb/db/migration/data/v310/auth_provider_oauth2.php), Write(phpBB/phpbb/db/migration/data/v310/auth_provider_oauth2.php)
- phpBB/phpbb/db/migration/data/v310/forgot_password.php (password): deny Edit(phpBB/phpbb/db/migration/data/v310/forgot_password.php), Write(phpBB/phpbb/db/migration/data/v310/forgot_password.php)
- phpBB/phpbb/db/migration/data/v310/passwords.php (passwords): deny Edit(phpBB/phpbb/db/migration/data/v310/passwords.php), Write(phpBB/phpbb/db/migration/data/v310/passwords.php)
- phpBB/phpbb/db/migration/data/v310/passwords_convert_p1.php (passwords): deny Edit(phpBB/phpbb/db/migration/data/v310/passwords_convert_p1.php), Write(phpBB/phpbb/db/migration/data/v310/passwords_convert_p1.php)
- phpBB/phpbb/db/migration/data/v310/passwords_convert_p2.php (passwords): deny Edit(phpBB/phpbb/db/migration/data/v310/passwords_convert_p2.php), Write(phpBB/phpbb/db/migration/data/v310/passwords_convert_p2.php)
- phpBB/phpbb/db/migration/data/v310/passwords_p2.php (passwords): deny Edit(phpBB/phpbb/db/migration/data/v310/passwords_p2.php), Write(phpBB/phpbb/db/migration/data/v310/passwords_p2.php)
- phpBB/phpbb/db/migration/data/v310/signature_module_auth.php (auth): deny Edit(phpBB/phpbb/db/migration/data/v310/signature_module_auth.php), Write(phpBB/phpbb/db/migration/data/v310/signature_module_auth.php)
- phpBB/phpbb/db/migration/data/v320/announce_global_permission.php (permission): deny Edit(phpBB/phpbb/db/migration/data/v320/announce_global_permission.php), Write(phpBB/phpbb/db/migration/data/v320/announce_global_permission.php)
- phpBB/phpbb/db/migration/data/v320/oauth_states.php (oauth): deny Edit(phpBB/phpbb/db/migration/data/v320/oauth_states.php), Write(phpBB/phpbb/db/migration/data/v320/oauth_states.php)
- phpBB/phpbb/db/migration/data/v32x/f_list_topics_permission_add.php (permission): deny Edit(phpBB/phpbb/db/migration/data/v32x/f_list_topics_permission_add.php), Write(phpBB/phpbb/db/migration/data/v32x/f_list_topics_permission_add.php)
- phpBB/phpbb/db/migration/data/v32x/user_emoji_permission.php (permission): deny Edit(phpBB/phpbb/db/migration/data/v32x/user_emoji_permission.php), Write(phpBB/phpbb/db/migration/data/v32x/user_emoji_permission.php)
- phpBB/phpbb/db/migration/data/v330/reset_password.php (password): deny Edit(phpBB/phpbb/db/migration/data/v330/reset_password.php), Write(phpBB/phpbb/db/migration/data/v330/reset_password.php)
- phpBB/phpbb/db/migration/data/v33x/add_oauth_state_time.php (oauth): deny Edit(phpBB/phpbb/db/migration/data/v33x/add_oauth_state_time.php), Write(phpBB/phpbb/db/migration/data/v33x/add_oauth_state_time.php)
- phpBB/phpbb/db/migration/data/v33x/remove_orphaned_roles.php (roles): deny Edit(phpBB/phpbb/db/migration/data/v33x/remove_orphaned_roles.php), Write(phpBB/phpbb/db/migration/data/v33x/remove_orphaned_roles.php)
- phpBB/phpbb/db/migration/data/v400/add_storage_permission.php (permission): deny Edit(phpBB/phpbb/db/migration/data/v400/add_storage_permission.php), Write(phpBB/phpbb/db/migration/data/v400/add_storage_permission.php)
- phpBB/phpbb/db/migration/data/v400/extensions_catalog_auth.php (auth): deny Edit(phpBB/phpbb/db/migration/data/v400/extensions_catalog_auth.php), Write(phpBB/phpbb/db/migration/data/v400/extensions_catalog_auth.php)
- phpBB/phpbb/db/migration/data/v400/remove_smtp_auth_method.php (auth): deny Edit(phpBB/phpbb/db/migration/data/v400/remove_smtp_auth_method.php), Write(phpBB/phpbb/db/migration/data/v400/remove_smtp_auth_method.php)
- phpBB/phpbb/db/migration/tool/permission.php (permission): deny Edit(phpBB/phpbb/db/migration/tool/permission.php), Write(phpBB/phpbb/db/migration/tool/permission.php)
- phpBB/phpbb/feed/event/http_auth_subscriber.php (auth): deny Edit(phpBB/phpbb/feed/event/http_auth_subscriber.php), Write(phpBB/phpbb/feed/event/http_auth_subscriber.php)
- phpBB/phpbb/passwords/ (passwords): deny Edit(phpBB/phpbb/passwords/**), Write(phpBB/phpbb/passwords/**)
- phpBB/phpbb/permissions.php (permissions): deny Edit(phpBB/phpbb/permissions.php), Write(phpBB/phpbb/permissions.php)
- phpBB/phpbb/report/exception/report_permission_denied_exception.php (permission): deny Edit(phpBB/phpbb/report/exception/report_permission_denied_exception.php), Write(phpBB/phpbb/report/exception/report_permission_denied_exception.php)
- phpBB/phpbb/ucp/controller/oauth.php (oauth): deny Edit(phpBB/phpbb/ucp/controller/oauth.php), Write(phpBB/phpbb/ucp/controller/oauth.php)
- phpBB/phpbb/ucp/controller/reset_password.php (password): deny Edit(phpBB/phpbb/ucp/controller/reset_password.php), Write(phpBB/phpbb/ucp/controller/reset_password.php)

### required: yellow-modules

Trigger: yellow zone: 9 modules. Surfaces: `AGENTS.md`.

Change: List these modules in AGENTS.md as characterization-tests-first: no feature work there until their current behavior is pinned by tests.

Why: Agents may only edit autonomously where their changes can be verified.

- phpBB/(files): files too large for unsupervised edits: p90 2124 lines > 800; 33.3% of files over 1000 lines > 7%
- phpBB/assets: files too large for unsupervised edits: p90 1914 lines > 800; 30% of files over 1000 lines > 7%
- phpBB/includes: files too large for unsupervised edits: p90 1545 lines > 800; 18.7% of files over 1000 lines > 7%
- phpBB/install: files too large for unsupervised edits: p90 1605 lines > 800; 12.5% of files over 1000 lines > 7%
- phpBB/phpbb/(files): files too large for unsupervised edits: p90 930 lines > 800
- phpBB/phpbb/event: files too large for unsupervised edits: p90 808 lines > 800
- phpBB/phpbb/log: files too large for unsupervised edits: p90 1008 lines > 800; 33.3% of files over 1000 lines > 7%
- phpBB/phpbb/search: files too large for unsupervised edits: p90 1170 lines > 800; 25% of files over 1000 lines > 7%
- phpBB/phpbb/tree: files too large for unsupervised edits: p90 875 lines > 800

### recommended: typed-changes

Trigger: type-strictness 3. Surfaces: `package.json typecheck script`, `DECISIONS.md`.

Change: Raise the checker's strictness for new and touched modules.

Why: Dynamic code without a checker lets an agent's type mistakes through every static layer.

- main dynamic language: javascript (11804 source lines); suggested checker: TypeScript checkJs

### recommended: legible-context

Trigger: file-size 3. Surfaces: `AGENTS.md`.

Change: List the largest files in AGENTS.md as split-before-feature files.

Why: Large files push the relevant code out of an agent's context and invite confident edits to code it has not read.

- files over 1000 lines: phpBB/includes/utf/data/recode_cjk.php (45177), phpBB/includes/functions.php (4270), phpBB/assets/javascript/cropper.js (3625), phpBB/includes/functions_admin.php (3236), phpBB/includes/functions_user.php (3150), phpBB/includes/functions_posting.php (2944), phpBB/includes/acp/acp_users.php (2714), phpBB/viewtopic.php (2462), phpBB/includes/functions_convert.php (2346), phpBB/includes/functions_privmsgs.php (2319)

### recommended: written-intent

Trigger: documented-intent 3. Surfaces: `AGENTS.md`, `docs/ARCHITECTURE.md`.

Change: Add the non-standard practices that are still unwritten to AGENTS.md, and record significant decisions in DECISIONS.md.

Why: Agents follow written rules; unwritten local conventions are exactly what they get wrong (arXiv 2602.11988).

- README: README.md; contributing: .github/CONTRIBUTING.md; architecture: none; decision records: 0; conventions: none
- stated rules: 0 in 0 files
- agent context files (presence alone scores nothing): none

## Modernization roadmap

Ordered by priority: score gain (plus 1 when a weak factor leaves weak) × 2 for blocking factors ÷ effort (S 1, M 2, L 3).

| # | Factor | Score | Effort | Priority | Step | Verdict after |
|---|---|---|---|---|---|---|
| 1 | documented-intent | 3 → 4 | M | 0.5 | write 10 more rules, across at least 2 files, and add an architecture doc or decision records | unchanged |
| 2 | dependency-currency | 4 → 5 | M | 0.5 | upgrade php from 8.2 to 8.3 | unchanged |
| 3 | file-size | 3 → 4 | L | 0.33 | split 12 of 53 files over 1000 lines (to 3% of files) and bring the p90 file length from 473 to 400 lines | unchanged |

## Not measured

- factor `direct-api-calls`: no collector signal yet: needs call-site analysis
- factor `module-boundaries`: no collector signal yet: needs an import graph or co-change coupling
- factor `observability`: no collector signal yet: needs a logging and metrics detector
- manifest `phpBB/config/development/container/environment.yml`: not a supported manifest
- manifest `phpBB/config/development/routing/environment.yml`: not a supported manifest
- manifest `phpBB/config/installer/container/environment.yml`: not a supported manifest
- manifest `phpBB/config/installer/routing/environment.yml`: not a supported manifest
- manifest `phpBB/config/production/container/environment.yml`: not a supported manifest
- manifest `phpBB/config/production/routing/environment.yml`: not a supported manifest
- manifest `phpBB/config/test/container/environment.yml`: not a supported manifest
- manifest `phpBB/config/test/routing/environment.yml`: not a supported manifest
- manifest `tests/controller/config/test/routing/environment.yml`: not a supported manifest
- manifest `tests/controller/ext/vendor2/bar/config/test/routing/environment.yml`: not a supported manifest
- manifest `tests/di/fixtures/config/production/container/environment.yml`: not a supported manifest
- manifest `tests/di/fixtures/config/test/container/environment.yml`: not a supported manifest
- manifest `tests/di/fixtures/other_config/production/container/environment.yml`: not a supported manifest
- manifest `tests/di/fixtures/other_config/test/container/environment.yml`: not a supported manifest
- manifest `tests/pagination/config/test/routing/environment.yml`: not a supported manifest
- tool `scc`: scc is not installed or not on PATH

## Signals

### Git history

28503 non-merge commits (483 in the 12 months to 2026-10-23), 358 authors, first 2001-02-17, last 2026-10-22, 3006 tracked files.

Hotspots (most commits in the last 12 months):

| File | Commits (12 months) | Commits | Authors | Last commit |
|---|---|---|---|---|
| `phpBB/viewtopic.php` | 22 | 905 | 74 | 2026-10-18 |
| `phpBB/install/schemas/schema_data.sql` | 18 | 766 | 58 | 2026-09-24 |
| `phpBB/composer.lock` | 17 | 304 | 28 | 2026-10-17 |
| `phpBB/language/en/common.php` | 15 | 517 | 67 | 2026-10-18 |
| `phpBB/docs/events.md` | 15 | 324 | 47 | 2026-10-08 |
| `.github/workflows/tests.yml` | 15 | 138 | 7 | 2026-09-28 |
| `phpBB/includes/startup.php` | 13 | 47 | 17 | 2026-10-17 |
| `build/build.xml` | 12 | 310 | 14 | 2026-09-24 |
| `phpBB/phpbb/ucp/controller/webpush.php` | 12 | 31 | 4 | 2026-09-29 |
| `tests/ucp/controller_webpush_test.php` | 12 | 19 | 5 | 2026-09-29 |

### Code structure

2887 files, 469711 lines; per file p50 55, p90 332, p99 1605, max 45177. Excluded: binary 98, generated 11, vendored 10. scc: not used (scc is not installed or not on PATH).

Largest files:

| File | Lines |
|---|---|
| `phpBB/includes/utf/data/recode_cjk.php` | 45177 |
| `phpBB/docs/CHANGELOG.html` | 8741 |
| `phpBB/includes/functions.php` | 4270 |
| `phpBB/docs/events.md` | 3731 |
| `phpBB/assets/javascript/cropper.js` | 3625 |
| `phpBB/includes/functions_admin.php` | 3236 |
| `phpBB/adm/style/admin.css` | 3190 |
| `phpBB/includes/functions_user.php` | 3150 |
| `phpBB/includes/functions_posting.php` | 2944 |
| `phpBB/includes/acp/acp_users.php` | 2714 |

### Tests and docs

- Test files: 573 (`test directory` 573)
- Test runner configs: PHPUnit (`phpunit.xml.dist`)
- CI: GitHub Actions (`.github/workflows/check_merge_to_master.yml`), GitHub Actions (`.github/workflows/merge_3.3.x_to_master.yml`), GitHub Actions (`.github/workflows/tests.yml`)
- Type checkers: Psalm (`psalm.xml`)
- README: README.md; contributing: .github/CONTRIBUTING.md; architecture: none; decision records: 0; conventions: none
- Agent context files (presence alone scores nothing): none
- Stated rules: 0

### Dependencies

| Manifest | Ecosystem | Dependencies | Issues |
|---|---|---|---|
| `package.json` | npm | 6 | none |
| `phpBB/composer.json` | composer | 38 | none |
| `phpBB/language/en/composer.json` | composer | 0 | none |
| `phpBB/phpbb/composer.json` | composer | 0 | none |
| `phpBB/styles/prosilver/composer.json` | composer | 0 | none |
| `tests/dbal/ext/foo/bar/composer.json` | composer | 0 | none |
| `tests/extension/ext/barfoo/composer.json` | composer | 0 | none |
| `tests/extension/ext/vendor2/bar/composer.json` | composer | 0 | none |
| `tests/extension/ext/vendor2/foo/composer.json` | composer | 0 | none |
| `tests/extension/ext/vendor3/foo/composer.json` | composer | 0 | none |
| `tests/extension/ext/vendor4/bar/composer.json` | composer | 0 | none |
| `tests/extension/ext/vendor5/foo/composer.json` | composer | 0 | none |
| `tests/functional/fixtures/ext/foo/bar/composer.json` | composer | 0 | none |
| `tests/functional/fixtures/ext/foo/foo/composer.json` | composer | 0 | none |
| `vagrant/composer.json` | composer | 1 | none |

| Runtime | Spec | Declared in | Cycle | Status | End of life |
|---|---|---|---|---|---|
| php | ^8.2 | `phpBB/composer.json` (require.php) | 8.2 | supported | 2026-12-31 |
| php | 8.2.27 | `phpBB/composer.json` (config.platform.php) | 8.2 | supported | 2026-12-31 |
| php | ^8.2 | `phpBB/phpbb/composer.json` (require.php) | 8.2 | supported | 2026-12-31 |
| php | >=5.4.7 | `tests/dbal/ext/foo/bar/composer.json` (require.php), test fixture: not counted | 5.4 | end-of-life | 2015-09-14 |
| php | >=5.3 | `tests/extension/ext/barfoo/composer.json` (require.php), test fixture: not counted | 5.3 | end-of-life | 2014-08-14 |
| php | >=5.3 | `tests/extension/ext/vendor2/bar/composer.json` (require.php), test fixture: not counted | 5.3 | end-of-life | 2014-08-14 |
| php | >=5.3 | `tests/extension/ext/vendor2/foo/composer.json` (require.php), test fixture: not counted | 5.3 | end-of-life | 2014-08-14 |
| php | >=5.3 | `tests/extension/ext/vendor3/foo/composer.json` (require.php), test fixture: not counted | 5.3 | end-of-life | 2014-08-14 |
| php | >=5.3 | `tests/extension/ext/vendor4/bar/composer.json` (require.php), test fixture: not counted | 5.3 | end-of-life | 2014-08-14 |
| php | >=5.3 | `tests/extension/ext/vendor5/foo/composer.json` (require.php), test fixture: not counted | 5.3 | end-of-life | 2014-08-14 |
| php | >=5.3 | `tests/functional/fixtures/ext/foo/bar/composer.json` (require.php), test fixture: not counted | 5.3 | end-of-life | 2014-08-14 |
| php | >=5.3 | `tests/functional/fixtures/ext/foo/foo/composer.json` (require.php), test fixture: not counted | 5.3 | end-of-life | 2014-08-14 |

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
