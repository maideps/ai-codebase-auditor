# AI-readiness audit: redmine

| | |
|---|---|
| Target | `D:\7-Maide\Projects\audit-targets\redmine` at commit `77cad6adb89c` |
| Audit date | 2026-10-23 |
| Verdict | **adapt** (provisional: direct-api-calls not measured) |
| Readiness level | **5 of 5**, set by test-feedback (provisional) |
| Tool | ai-codebase-auditor 0.1.0 |

## Verdict

**adapt** (provisional: direct-api-calls not measured): adopt the harness with adaptations for the weak factors below.

Rule: 1 weak factor (score ≤ 2): type-strictness 1

Triggered by: type-strictness 1.

## Factor scores

| Factor | Class | Score | Rule |
|---|---|---|---|
| test-feedback | blocking | 5 | ratio 0.50 ≥ 0.3 with a runner config and CI |
| type-strictness | constraining | 1 | weighted typed share 0.00 |
| direct-api-calls | blocking | – | not measured: no collector signal yet: needs call-site analysis |
| file-size | constraining | 4 | lower of p90 214 lines (→ 4) and 1.07% of files over 1000 lines (→ 4) |
| module-boundaries | constraining | – | not measured: no collector signal yet: needs an import graph or co-change coupling |
| documented-intent | constraining | 3 | docs with contributing, architecture, convention or decision docs |
| observability | constraining | – | not measured: no collector signal yet: needs a logging and metrics detector |
| dev-deploy-simplicity | constraining | 5 | 4 of 4 signals: CI configured, test runner configured, runtime version declared, lock file committed |
| dependency-currency | constraining | 4 | a runtime reaches end of life on 2027-03-31, within 12 months |

Scores are never averaged; the lowest scored blocking factor sets the readiness level.

### test-feedback: Test presence and feedback speed

Score **5** (blocking). Rule: ratio 0.50 ≥ 0.3 with a runner config and CI.

Evidence:

- 419 test files for 839 source files: ratio 0.50
- test runner configs: test/test_helper.rb
- CI: .github/workflows/linters.yml, .github/workflows/tests.yml

Partial: feedback speed is not measured: the audit never runs tests.

### type-strictness: Type strictness

Score **1** (constraining). Rule: weighted typed share 0.00.

Evidence:

- typed share 0.00 of 74486 source lines (strong 0, weak 0, checked dynamic 0, unchecked dynamic 74486)
- type checkers: none

### direct-api-calls: Direct API calls

Not measured (blocking): no collector signal yet: needs call-site analysis.

### file-size: File size and context legibility

Score **4** (constraining). Rule: lower of p90 214 lines (→ 4) and 1.07% of files over 1000 lines (→ 4).

Evidence:

- 839 source files: p90 214 lines, 9 over 1000 lines (1.07%)
- largest: app/models/issue.rb (2173 lines), app/helpers/application_helper.rb (1994 lines), app/models/query.rb (1708 lines), app/assets/javascripts/application-legacy.js (1570 lines), app/models/project.rb (1370 lines)

### module-boundaries: Module boundary clarity

Not measured (constraining): no collector signal yet: needs an import graph or co-change coupling.

### documented-intent: Documented intent

Score **3** (constraining). Rule: docs with contributing, architecture, convention or decision docs.

Evidence:

- README: README.rdoc; contributing: CONTRIBUTING.md; architecture: none; decision records: 0; conventions: none
- stated rules: 0 in 0 files
- agent context files (presence alone scores nothing): none

### observability: Observability

Not measured (constraining): no collector signal yet: needs a logging and metrics detector.

### dev-deploy-simplicity: Dev and deploy simplicity

Score **5** (constraining). Rule: 4 of 4 signals: CI configured, test runner configured, runtime version declared, lock file committed.

Evidence:

- CI: .github/workflows/linters.yml, .github/workflows/tests.yml
- test runner configs: test/test_helper.rb
- declared runtimes: ruby >= 3.3.0 (Gemfile)
- lock files: yarn.lock

Partial: build scripts and containers are not detected yet.

### dependency-currency: Dependency and runtime currency

Score **4** (constraining). Rule: a runtime reaches end of life on 2027-03-31, within 12 months.

Evidence:

- ruby >= 3.3.0 (Gemfile, ruby directive): cycle 3.3 supported until 2027-03-31

Partial: package versions are not checked for age or vulnerabilities.

## Risk zones

Green: agents may edit. Yellow: add characterization tests first. Red: agents may only propose changes.

| Zone | Module | Source files | Red files | Reason |
|---|---|---|---|---|
| green | `app` | 340 | 10 | test-feedback 5 ≥ 3 and files are legible (p90 298 lines, 1.8% over 1000 lines) |
| green | `bin` | 1 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 282 lines, 0% over 1000 lines) |
| green | `config` | 18 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 169 lines, 0% over 1000 lines) |
| green | `db` | 331 | 68 | test-feedback 5 ≥ 3 and files are legible (p90 18 lines, 0% over 1000 lines) |
| green | `extra` | 7 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 289 lines, 0% over 1000 lines) |
| green | `lib` | 142 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 310 lines, 2.1% over 1000 lines) |

Red paths:

- `app/controllers/auth_sources_controller.rb` (auth)
- `app/controllers/oauth2_applications_controller.rb` (oauth)
- `app/controllers/roles_controller.rb` (roles)
- `app/helpers/auth_sources_helper.rb` (auth)
- `app/helpers/roles_helper.rb` (roles)
- `app/models/auth_source.rb` (auth)
- `app/models/auth_source_ldap.rb` (auth)
- `app/models/member_role.rb` (role)
- `app/models/role.rb` (role)
- `app/models/workflow_permission.rb` (permission)
- `db/migrate/012_add_comments_permissions.rb` (permissions)
- `db/migrate/014_add_queries_permissions.rb` (permissions)
- `db/migrate/016_add_repositories_permissions.rb` (permissions)
- `db/migrate/020_add_role_position.rb` (role)
- `db/migrate/024_add_roadmap_permission.rb` (permission)
- `db/migrate/025_add_search_permission.rb` (permission)
- `db/migrate/026_add_repository_login_and_password.rb` (login)
- `db/migrate/030_add_projects_feeds_permissions.rb` (permissions)
- `db/migrate/033_add_timelog_permissions.rb` (permissions)
- `db/migrate/043_add_relations_permissions.rb` (permissions)
- `db/migrate/047_add_boards_permissions.rb` (permissions)
- `db/migrate/049_add_wiki_destroy_page_permission.rb` (permission)
- `db/migrate/050_add_wiki_attachments_permissions.rb` (permissions)
- `db/migrate/056_add_repositories_changes_permission.rb` (permission)
- `db/migrate/059_add_roles_assignable.rb` (roles)
- `db/migrate/061_add_roles_builtin.rb` (roles)
- `db/migrate/062_insert_builtin_roles.rb` (roles)
- `db/migrate/063_add_roles_permissions.rb` (roles)
- `db/migrate/064_drop_permissions.rb` (permissions)
- `db/migrate/074_add_auth_sources_tls.rb` (auth)
- `db/migrate/084_change_auth_sources_account_limit.rb` (auth)
- `db/migrate/085_add_role_tracker_old_status_index_to_workflows.rb` (role)
- `db/migrate/096_add_commit_access_permission.rb` (permission)
- `db/migrate/097_add_view_wiki_edits_permission.rb` (permission)
- `db/migrate/099_add_delete_wiki_pages_attachments_permission.rb` (permission)
- `db/migrate/107_add_open_id_authentication_tables.rb` (authentication)
- `db/migrate/20090503121501_create_member_roles.rb` (roles)
- `db/migrate/20090503121505_populate_member_roles.rb` (roles)
- `db/migrate/20090503121510_drop_members_role_id.rb` (role)
- `db/migrate/20090704172358_add_member_roles_inherited_from.rb` (roles)
- `db/migrate/20091017213257_add_missing_indexes_to_auth_sources.rb` (auth)
- `db/migrate/20091017213716_add_missing_indexes_to_member_roles.rb` (roles)
- `db/migrate/20091114105931_add_view_issues_permission.rb` (permission)
- `db/migrate/20110223180953_salt_user_passwords.rb` (passwords)
- `db/migrate/20110226120112_change_repositories_password_limit.rb` (password)
- `db/migrate/20110226120132_change_auth_sources_account_password_limit.rb` (auth)
- `db/migrate/20110408103312_add_roles_issues_visibility.rb` (roles)
- `db/migrate/20120205111326_change_users_login_limit.rb` (login)
- `db/migrate/20120301153455_add_auth_sources_filter.rb` (auth)
- `db/migrate/20120707064544_add_auth_sources_timeout.rb` (auth)
- `db/migrate/20130110122628_split_documents_permissions.rb` (permissions)
- `db/migrate/20130602092539_create_queries_roles.rb` (roles)
- `db/migrate/20130713104233_create_custom_fields_roles.rb` (roles)
- `db/migrate/20130729070143_add_users_must_change_passwd.rb` (passwd)
- `db/migrate/20140903143914_add_password_changed_at_to_user.rb` (password)
- `db/migrate/20141109112308_add_roles_users_visibility.rb` (roles)
- `db/migrate/20150208105930_replace_move_issues_permission.rb` (permission)
- `db/migrate/20150526183158_add_roles_time_entries_visibility.rb` (roles)
- `db/migrate/20150528084820_add_roles_all_roles_managed.rb` (roles)
- `db/migrate/20150528092912_create_roles_managed_roles.rb` (roles)
- `db/migrate/20150528093249_add_unique_index_on_roles_managed_roles.rb` (roles)
- `db/migrate/20151021185456_change_auth_sources_filter_to_text.rb` (auth)
- `db/migrate/20160404080304_force_password_reset_during_setup.rb` (password)
- `db/migrate/20160529063352_add_roles_settings.rb` (roles)
- `db/migrate/20161002133421_add_index_on_member_roles_inherited_from.rb` (roles)
- `db/migrate/20170418090031_add_view_news_to_all_existing_roles.rb` (roles)
- `db/migrate/20170419144536_add_view_messages_to_all_existing_roles.rb` (roles)
- `db/migrate/20180913072918_add_verify_peer_to_auth_sources.rb` (auth)
- `db/migrate/20190620135549_change_roles_name_limit.rb` (roles)
- `db/migrate/20211213122101_drop_open_id_authentication_tables.rb` (authentication)
- `db/migrate/20220806215628_add_default_time_entry_activity_to_roles.rb` (roles)
- `db/migrate/20221002193055_delete_orphaned_query_and_role_from_queries_roles.rb` (role)
- `db/migrate/20221214173537_add_select_project_publicity_permission.rb` (permission)
- `db/migrate/20231012112407_remove_mention_users_permission.rb` (permission)
- `db/migrate/20241103184550_change_builtin_roles_user_visibility.rb` (roles)
- `db/migrate/20260319062845_add_index_to_users_lower_login_on_postgres_and_sqlite.rb` (login)
- `db/migrate/20260319170822_add_index_to_users_login.rb` (login)
- `db/migrate/20260906000000_add_export_issues_and_export_time_entries_permissions.rb` (permissions)

Not zoned (no source files): (root), .github, doc, files, log, plugins, public, test, themes, tmp.

## Harness adaptation plan

For ai-harness-framework 0.5.0 (commit `7fb142a`). Adopt the harness with these adaptations.

| Level | Item | Trigger | Surfaces |
|---|---|---|---|
| required | typed-changes | type-strictness 1 | package.json typecheck script, DECISIONS.md |
| required | detected-stack | test-feedback 5 | package.json layer scripts |
| required | red-paths | red zone: 78 paths | AGENTS.md, .claude/settings.json |
| recommended | written-intent | documented-intent 3 | AGENTS.md, docs/ARCHITECTURE.md |

### required: typed-changes

Trigger: type-strictness 1. Surfaces: `package.json typecheck script`, `DECISIONS.md`.

Change: Add a type checker for the main dynamic language in check mode, with a baseline so existing code passes and new code is checked; point the typecheck layer at it and record the baseline as a dated deferral.

Why: Dynamic code without a checker lets an agent's type mistakes through every static layer.

- main dynamic language: ruby (65580 source lines); suggested checker: Sorbet or Steep

### required: detected-stack

Trigger: test-feedback 5. Surfaces: `package.json layer scripts`.

Change: Declare each verification layer command explicitly in package.json scripts (for example phpunit, bin/rails test, make check), so no required layer reports only SKIP.

Why: The harness picks layer commands from root markers; when it does not detect the repository's main language, its layers run the wrong tool or SKIP, and a SKIP-only required layer fails verify-feature (D-029).

- the harness would detect node (from package.json), but the main language is ruby

### required: red-paths

Trigger: red zone: 78 paths. Surfaces: `AGENTS.md`, `.claude/settings.json`.

Change: List these paths as proposal-only in AGENTS.md, and add Claude Code permissions.deny rules so agents cannot edit them directly; agents propose diffs for a person to apply.

Why: Auth, billing, permission and secret code needs human review of every change.

- app/controllers/auth_sources_controller.rb (auth): deny Edit(app/controllers/auth_sources_controller.rb), Write(app/controllers/auth_sources_controller.rb)
- app/controllers/oauth2_applications_controller.rb (oauth): deny Edit(app/controllers/oauth2_applications_controller.rb), Write(app/controllers/oauth2_applications_controller.rb)
- app/controllers/roles_controller.rb (roles): deny Edit(app/controllers/roles_controller.rb), Write(app/controllers/roles_controller.rb)
- app/helpers/auth_sources_helper.rb (auth): deny Edit(app/helpers/auth_sources_helper.rb), Write(app/helpers/auth_sources_helper.rb)
- app/helpers/roles_helper.rb (roles): deny Edit(app/helpers/roles_helper.rb), Write(app/helpers/roles_helper.rb)
- app/models/auth_source.rb (auth): deny Edit(app/models/auth_source.rb), Write(app/models/auth_source.rb)
- app/models/auth_source_ldap.rb (auth): deny Edit(app/models/auth_source_ldap.rb), Write(app/models/auth_source_ldap.rb)
- app/models/member_role.rb (role): deny Edit(app/models/member_role.rb), Write(app/models/member_role.rb)
- app/models/role.rb (role): deny Edit(app/models/role.rb), Write(app/models/role.rb)
- app/models/workflow_permission.rb (permission): deny Edit(app/models/workflow_permission.rb), Write(app/models/workflow_permission.rb)
- db/migrate/012_add_comments_permissions.rb (permissions): deny Edit(db/migrate/012_add_comments_permissions.rb), Write(db/migrate/012_add_comments_permissions.rb)
- db/migrate/014_add_queries_permissions.rb (permissions): deny Edit(db/migrate/014_add_queries_permissions.rb), Write(db/migrate/014_add_queries_permissions.rb)
- db/migrate/016_add_repositories_permissions.rb (permissions): deny Edit(db/migrate/016_add_repositories_permissions.rb), Write(db/migrate/016_add_repositories_permissions.rb)
- db/migrate/020_add_role_position.rb (role): deny Edit(db/migrate/020_add_role_position.rb), Write(db/migrate/020_add_role_position.rb)
- db/migrate/024_add_roadmap_permission.rb (permission): deny Edit(db/migrate/024_add_roadmap_permission.rb), Write(db/migrate/024_add_roadmap_permission.rb)
- db/migrate/025_add_search_permission.rb (permission): deny Edit(db/migrate/025_add_search_permission.rb), Write(db/migrate/025_add_search_permission.rb)
- db/migrate/026_add_repository_login_and_password.rb (login): deny Edit(db/migrate/026_add_repository_login_and_password.rb), Write(db/migrate/026_add_repository_login_and_password.rb)
- db/migrate/030_add_projects_feeds_permissions.rb (permissions): deny Edit(db/migrate/030_add_projects_feeds_permissions.rb), Write(db/migrate/030_add_projects_feeds_permissions.rb)
- db/migrate/033_add_timelog_permissions.rb (permissions): deny Edit(db/migrate/033_add_timelog_permissions.rb), Write(db/migrate/033_add_timelog_permissions.rb)
- db/migrate/043_add_relations_permissions.rb (permissions): deny Edit(db/migrate/043_add_relations_permissions.rb), Write(db/migrate/043_add_relations_permissions.rb)
- db/migrate/047_add_boards_permissions.rb (permissions): deny Edit(db/migrate/047_add_boards_permissions.rb), Write(db/migrate/047_add_boards_permissions.rb)
- db/migrate/049_add_wiki_destroy_page_permission.rb (permission): deny Edit(db/migrate/049_add_wiki_destroy_page_permission.rb), Write(db/migrate/049_add_wiki_destroy_page_permission.rb)
- db/migrate/050_add_wiki_attachments_permissions.rb (permissions): deny Edit(db/migrate/050_add_wiki_attachments_permissions.rb), Write(db/migrate/050_add_wiki_attachments_permissions.rb)
- db/migrate/056_add_repositories_changes_permission.rb (permission): deny Edit(db/migrate/056_add_repositories_changes_permission.rb), Write(db/migrate/056_add_repositories_changes_permission.rb)
- db/migrate/059_add_roles_assignable.rb (roles): deny Edit(db/migrate/059_add_roles_assignable.rb), Write(db/migrate/059_add_roles_assignable.rb)
- db/migrate/061_add_roles_builtin.rb (roles): deny Edit(db/migrate/061_add_roles_builtin.rb), Write(db/migrate/061_add_roles_builtin.rb)
- db/migrate/062_insert_builtin_roles.rb (roles): deny Edit(db/migrate/062_insert_builtin_roles.rb), Write(db/migrate/062_insert_builtin_roles.rb)
- db/migrate/063_add_roles_permissions.rb (roles): deny Edit(db/migrate/063_add_roles_permissions.rb), Write(db/migrate/063_add_roles_permissions.rb)
- db/migrate/064_drop_permissions.rb (permissions): deny Edit(db/migrate/064_drop_permissions.rb), Write(db/migrate/064_drop_permissions.rb)
- db/migrate/074_add_auth_sources_tls.rb (auth): deny Edit(db/migrate/074_add_auth_sources_tls.rb), Write(db/migrate/074_add_auth_sources_tls.rb)
- db/migrate/084_change_auth_sources_account_limit.rb (auth): deny Edit(db/migrate/084_change_auth_sources_account_limit.rb), Write(db/migrate/084_change_auth_sources_account_limit.rb)
- db/migrate/085_add_role_tracker_old_status_index_to_workflows.rb (role): deny Edit(db/migrate/085_add_role_tracker_old_status_index_to_workflows.rb), Write(db/migrate/085_add_role_tracker_old_status_index_to_workflows.rb)
- db/migrate/096_add_commit_access_permission.rb (permission): deny Edit(db/migrate/096_add_commit_access_permission.rb), Write(db/migrate/096_add_commit_access_permission.rb)
- db/migrate/097_add_view_wiki_edits_permission.rb (permission): deny Edit(db/migrate/097_add_view_wiki_edits_permission.rb), Write(db/migrate/097_add_view_wiki_edits_permission.rb)
- db/migrate/099_add_delete_wiki_pages_attachments_permission.rb (permission): deny Edit(db/migrate/099_add_delete_wiki_pages_attachments_permission.rb), Write(db/migrate/099_add_delete_wiki_pages_attachments_permission.rb)
- db/migrate/107_add_open_id_authentication_tables.rb (authentication): deny Edit(db/migrate/107_add_open_id_authentication_tables.rb), Write(db/migrate/107_add_open_id_authentication_tables.rb)
- db/migrate/20090503121501_create_member_roles.rb (roles): deny Edit(db/migrate/20090503121501_create_member_roles.rb), Write(db/migrate/20090503121501_create_member_roles.rb)
- db/migrate/20090503121505_populate_member_roles.rb (roles): deny Edit(db/migrate/20090503121505_populate_member_roles.rb), Write(db/migrate/20090503121505_populate_member_roles.rb)
- db/migrate/20090503121510_drop_members_role_id.rb (role): deny Edit(db/migrate/20090503121510_drop_members_role_id.rb), Write(db/migrate/20090503121510_drop_members_role_id.rb)
- db/migrate/20090704172358_add_member_roles_inherited_from.rb (roles): deny Edit(db/migrate/20090704172358_add_member_roles_inherited_from.rb), Write(db/migrate/20090704172358_add_member_roles_inherited_from.rb)
- db/migrate/20091017213257_add_missing_indexes_to_auth_sources.rb (auth): deny Edit(db/migrate/20091017213257_add_missing_indexes_to_auth_sources.rb), Write(db/migrate/20091017213257_add_missing_indexes_to_auth_sources.rb)
- db/migrate/20091017213716_add_missing_indexes_to_member_roles.rb (roles): deny Edit(db/migrate/20091017213716_add_missing_indexes_to_member_roles.rb), Write(db/migrate/20091017213716_add_missing_indexes_to_member_roles.rb)
- db/migrate/20091114105931_add_view_issues_permission.rb (permission): deny Edit(db/migrate/20091114105931_add_view_issues_permission.rb), Write(db/migrate/20091114105931_add_view_issues_permission.rb)
- db/migrate/20110223180953_salt_user_passwords.rb (passwords): deny Edit(db/migrate/20110223180953_salt_user_passwords.rb), Write(db/migrate/20110223180953_salt_user_passwords.rb)
- db/migrate/20110226120112_change_repositories_password_limit.rb (password): deny Edit(db/migrate/20110226120112_change_repositories_password_limit.rb), Write(db/migrate/20110226120112_change_repositories_password_limit.rb)
- db/migrate/20110226120132_change_auth_sources_account_password_limit.rb (auth): deny Edit(db/migrate/20110226120132_change_auth_sources_account_password_limit.rb), Write(db/migrate/20110226120132_change_auth_sources_account_password_limit.rb)
- db/migrate/20110408103312_add_roles_issues_visibility.rb (roles): deny Edit(db/migrate/20110408103312_add_roles_issues_visibility.rb), Write(db/migrate/20110408103312_add_roles_issues_visibility.rb)
- db/migrate/20120205111326_change_users_login_limit.rb (login): deny Edit(db/migrate/20120205111326_change_users_login_limit.rb), Write(db/migrate/20120205111326_change_users_login_limit.rb)
- db/migrate/20120301153455_add_auth_sources_filter.rb (auth): deny Edit(db/migrate/20120301153455_add_auth_sources_filter.rb), Write(db/migrate/20120301153455_add_auth_sources_filter.rb)
- db/migrate/20120707064544_add_auth_sources_timeout.rb (auth): deny Edit(db/migrate/20120707064544_add_auth_sources_timeout.rb), Write(db/migrate/20120707064544_add_auth_sources_timeout.rb)
- db/migrate/20130110122628_split_documents_permissions.rb (permissions): deny Edit(db/migrate/20130110122628_split_documents_permissions.rb), Write(db/migrate/20130110122628_split_documents_permissions.rb)
- db/migrate/20130602092539_create_queries_roles.rb (roles): deny Edit(db/migrate/20130602092539_create_queries_roles.rb), Write(db/migrate/20130602092539_create_queries_roles.rb)
- db/migrate/20130713104233_create_custom_fields_roles.rb (roles): deny Edit(db/migrate/20130713104233_create_custom_fields_roles.rb), Write(db/migrate/20130713104233_create_custom_fields_roles.rb)
- db/migrate/20130729070143_add_users_must_change_passwd.rb (passwd): deny Edit(db/migrate/20130729070143_add_users_must_change_passwd.rb), Write(db/migrate/20130729070143_add_users_must_change_passwd.rb)
- db/migrate/20140903143914_add_password_changed_at_to_user.rb (password): deny Edit(db/migrate/20140903143914_add_password_changed_at_to_user.rb), Write(db/migrate/20140903143914_add_password_changed_at_to_user.rb)
- db/migrate/20141109112308_add_roles_users_visibility.rb (roles): deny Edit(db/migrate/20141109112308_add_roles_users_visibility.rb), Write(db/migrate/20141109112308_add_roles_users_visibility.rb)
- db/migrate/20150208105930_replace_move_issues_permission.rb (permission): deny Edit(db/migrate/20150208105930_replace_move_issues_permission.rb), Write(db/migrate/20150208105930_replace_move_issues_permission.rb)
- db/migrate/20150526183158_add_roles_time_entries_visibility.rb (roles): deny Edit(db/migrate/20150526183158_add_roles_time_entries_visibility.rb), Write(db/migrate/20150526183158_add_roles_time_entries_visibility.rb)
- db/migrate/20150528084820_add_roles_all_roles_managed.rb (roles): deny Edit(db/migrate/20150528084820_add_roles_all_roles_managed.rb), Write(db/migrate/20150528084820_add_roles_all_roles_managed.rb)
- db/migrate/20150528092912_create_roles_managed_roles.rb (roles): deny Edit(db/migrate/20150528092912_create_roles_managed_roles.rb), Write(db/migrate/20150528092912_create_roles_managed_roles.rb)
- db/migrate/20150528093249_add_unique_index_on_roles_managed_roles.rb (roles): deny Edit(db/migrate/20150528093249_add_unique_index_on_roles_managed_roles.rb), Write(db/migrate/20150528093249_add_unique_index_on_roles_managed_roles.rb)
- db/migrate/20151021185456_change_auth_sources_filter_to_text.rb (auth): deny Edit(db/migrate/20151021185456_change_auth_sources_filter_to_text.rb), Write(db/migrate/20151021185456_change_auth_sources_filter_to_text.rb)
- db/migrate/20160404080304_force_password_reset_during_setup.rb (password): deny Edit(db/migrate/20160404080304_force_password_reset_during_setup.rb), Write(db/migrate/20160404080304_force_password_reset_during_setup.rb)
- db/migrate/20160529063352_add_roles_settings.rb (roles): deny Edit(db/migrate/20160529063352_add_roles_settings.rb), Write(db/migrate/20160529063352_add_roles_settings.rb)
- db/migrate/20161002133421_add_index_on_member_roles_inherited_from.rb (roles): deny Edit(db/migrate/20161002133421_add_index_on_member_roles_inherited_from.rb), Write(db/migrate/20161002133421_add_index_on_member_roles_inherited_from.rb)
- db/migrate/20170418090031_add_view_news_to_all_existing_roles.rb (roles): deny Edit(db/migrate/20170418090031_add_view_news_to_all_existing_roles.rb), Write(db/migrate/20170418090031_add_view_news_to_all_existing_roles.rb)
- db/migrate/20170419144536_add_view_messages_to_all_existing_roles.rb (roles): deny Edit(db/migrate/20170419144536_add_view_messages_to_all_existing_roles.rb), Write(db/migrate/20170419144536_add_view_messages_to_all_existing_roles.rb)
- db/migrate/20180913072918_add_verify_peer_to_auth_sources.rb (auth): deny Edit(db/migrate/20180913072918_add_verify_peer_to_auth_sources.rb), Write(db/migrate/20180913072918_add_verify_peer_to_auth_sources.rb)
- db/migrate/20190620135549_change_roles_name_limit.rb (roles): deny Edit(db/migrate/20190620135549_change_roles_name_limit.rb), Write(db/migrate/20190620135549_change_roles_name_limit.rb)
- db/migrate/20211213122101_drop_open_id_authentication_tables.rb (authentication): deny Edit(db/migrate/20211213122101_drop_open_id_authentication_tables.rb), Write(db/migrate/20211213122101_drop_open_id_authentication_tables.rb)
- db/migrate/20220806215628_add_default_time_entry_activity_to_roles.rb (roles): deny Edit(db/migrate/20220806215628_add_default_time_entry_activity_to_roles.rb), Write(db/migrate/20220806215628_add_default_time_entry_activity_to_roles.rb)
- db/migrate/20221002193055_delete_orphaned_query_and_role_from_queries_roles.rb (role): deny Edit(db/migrate/20221002193055_delete_orphaned_query_and_role_from_queries_roles.rb), Write(db/migrate/20221002193055_delete_orphaned_query_and_role_from_queries_roles.rb)
- db/migrate/20221214173537_add_select_project_publicity_permission.rb (permission): deny Edit(db/migrate/20221214173537_add_select_project_publicity_permission.rb), Write(db/migrate/20221214173537_add_select_project_publicity_permission.rb)
- db/migrate/20231012112407_remove_mention_users_permission.rb (permission): deny Edit(db/migrate/20231012112407_remove_mention_users_permission.rb), Write(db/migrate/20231012112407_remove_mention_users_permission.rb)
- db/migrate/20241103184550_change_builtin_roles_user_visibility.rb (roles): deny Edit(db/migrate/20241103184550_change_builtin_roles_user_visibility.rb), Write(db/migrate/20241103184550_change_builtin_roles_user_visibility.rb)
- db/migrate/20260319062845_add_index_to_users_lower_login_on_postgres_and_sqlite.rb (login): deny Edit(db/migrate/20260319062845_add_index_to_users_lower_login_on_postgres_and_sqlite.rb), Write(db/migrate/20260319062845_add_index_to_users_lower_login_on_postgres_and_sqlite.rb)
- db/migrate/20260319170822_add_index_to_users_login.rb (login): deny Edit(db/migrate/20260319170822_add_index_to_users_login.rb), Write(db/migrate/20260319170822_add_index_to_users_login.rb)
- db/migrate/20260906000000_add_export_issues_and_export_time_entries_permissions.rb (permissions): deny Edit(db/migrate/20260906000000_add_export_issues_and_export_time_entries_permissions.rb), Write(db/migrate/20260906000000_add_export_issues_and_export_time_entries_permissions.rb)

### recommended: written-intent

Trigger: documented-intent 3. Surfaces: `AGENTS.md`, `docs/ARCHITECTURE.md`.

Change: Add the non-standard practices that are still unwritten to AGENTS.md, and record significant decisions in DECISIONS.md.

Why: Agents follow written rules; unwritten local conventions are exactly what they get wrong (arXiv 2602.11988).

- README: README.rdoc; contributing: CONTRIBUTING.md; architecture: none; decision records: 0; conventions: none
- stated rules: 0 in 0 files
- agent context files (presence alone scores nothing): none

## Modernization roadmap

Ordered by priority: score gain (plus 1 when a weak factor leaves weak) × 2 for blocking factors ÷ effort (S 1, M 2, L 3).

| # | Factor | Score | Effort | Priority | Step | Verdict after |
|---|---|---|---|---|---|---|
| 1 | type-strictness | 1 → 3 | M | 1.5 | configure Sorbet or Steep for ruby with a baseline (typed share 0.00 to 0.53) | adopt |
| 2 | documented-intent | 3 → 4 | M | 0.5 | write 10 more rules, across at least 2 files, and add an architecture doc or decision records | unchanged |
| 3 | dependency-currency | 4 → 5 | M | 0.5 | upgrade ruby from 3.3 to 3.4 | unchanged |
| 4 | file-size | 4 → 5 | L | 0.33 | split 1 of 9 files over 1000 lines (to 1% of files) and bring the p90 file length from 214 to 200 lines | unchanged |

## Not measured

- factor `direct-api-calls`: no collector signal yet: needs call-site analysis
- factor `module-boundaries`: no collector signal yet: needs an import graph or co-change coupling
- factor `observability`: no collector signal yet: needs a logging and metrics detector
- tool `scc`: scc is not installed or not on PATH

## Signals

### Git history

19890 non-merge commits (837 in the 12 months to 2026-10-23), 12 authors, first 2006-06-28, last 2026-10-22, 2341 tracked files.

Hotspots (most commits in the last 12 months):

| File | Commits (12 months) | Commits | Authors | Last commit |
|---|---|---|---|---|
| `app/assets/stylesheets/application.css` | 119 | 285 | 2 | 2026-10-21 |
| `config/locales/ja.yml` | 66 | 731 | 8 | 2026-10-22 |
| `Gemfile` | 64 | 661 | 6 | 2026-10-22 |
| `config/locales/bg.yml` | 57 | 662 | 8 | 2026-10-20 |
| `config/locales/en.yml` | 55 | 564 | 8 | 2026-10-21 |
| `config/locales/zh-TW.yml` | 53 | 711 | 8 | 2026-10-20 |
| `config/locales/sv.yml` | 51 | 535 | 8 | 2026-10-22 |
| `config/locales/cs.yml` | 50 | 541 | 8 | 2026-10-20 |
| `config/locales/fr.yml` | 49 | 549 | 8 | 2026-10-20 |
| `config/locales/fa.yml` | 49 | 419 | 5 | 2026-10-20 |

### Code structure

2170 files, 314201 lines; per file p50 34, p90 322, p99 1608, max 9399. Excluded: binary 162, generated 5, vendored 4. scc: not used (scc is not installed or not on PATH).

Largest files:

| File | Lines |
|---|---|
| `test/functional/issues_controller_test.rb` | 9399 |
| `doc/CHANGELOG` | 8442 |
| `test/unit/issue_test.rb` | 3753 |
| `test/unit/query_test.rb` | 3490 |
| `app/assets/stylesheets/application.css` | 2792 |
| `test/helpers/application_helper_test.rb` | 2459 |
| `app/models/issue.rb` | 2173 |
| `app/helpers/application_helper.rb` | 1994 |
| `test/fixtures/workflows.yml` | 1933 |
| `test/functional/timelog_controller_test.rb` | 1900 |

### Tests and docs

- Test files: 419 (`*_spec.rb` 1, `*_test.rb` 400, `test directory` 18)
- Test runner configs: minitest (Rails) (`test/test_helper.rb`)
- CI: GitHub Actions (`.github/workflows/linters.yml`), GitHub Actions (`.github/workflows/tests.yml`)
- Type checkers: none
- README: README.rdoc; contributing: CONTRIBUTING.md; architecture: none; decision records: 0; conventions: none
- Agent context files (presence alone scores nothing): none
- Stated rules: 0

### Dependencies

| Manifest | Ecosystem | Dependencies | Issues |
|---|---|---|---|
| `Gemfile` | bundler | 58 | none |
| `package.json` | npm | 1 | none |

| Runtime | Spec | Declared in | Cycle | Status | End of life |
|---|---|---|---|---|---|
| ruby | >= 3.3.0 | `Gemfile` (ruby directive) | 3.3 | supported | 2027-03-31 |

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
