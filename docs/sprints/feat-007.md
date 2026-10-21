# Sprint Contract

**Feature ID:** feat-007
**Feature Name:** Decision engine
**Date:** 2026-10-21
**Estimated Duration:** 1 session
**Status:** rules reviewed and approved 2026-10-21 (decisions below)

## Review Decisions (2026-10-21)

All four open points were approved as recommended:
- **Prepare first** fires when test-feedback ≤ 2. Unmeasured module boundaries count as not established.
- **Adapt** fires on any weak scored factor, blocking or constraining.
- **Adopt** is allowed while a blocking factor is unmeasured, marked provisional and naming it.
- **Modules** are split when a directory holds over half of all source files, up to 3 levels deep.

The rest of this contract (weak = ≤ 2, the green rule, the red terms) is implemented as written.

## What I Will Build

`decide(scoring, collected, config)` in `src/decision/`, a pure function like scoring. It returns:

- **One verdict**: `adopt`, `adapt` or `prepare-first`, with the rule that fired and the factor scores that triggered it.
- **A risk zone per module**: green or yellow.
- **Red paths**: auth, billing, permission and similar paths, where agents may only propose changes.

`audit` prints the verdict and the zones. Its parameters live in a new `config/decision.json`, validated at startup like the other config files.

"Weak" means a score of 2 or less (`weakMax: 2`).

## Proposed Verdict Rules

The rules are evaluated in order, and the first that applies decides.

| # | Verdict | Rule | Triggered by |
|---|---|---|---|
| 0 | *none* | test-feedback is not measured, so the tool cannot see whether changes can be verified | the reason test-feedback was not measured |
| 1 | **prepare first** | test-feedback is weak **and** module boundaries are not established. Boundaries count as not established when module-boundaries is weak or not measured. | test-feedback, module-boundaries |
| 2 | **adapt** | any scored factor is weak, blocking or constraining. Agents can work, but these factors need adapted rules. | every weak factor, with its score |
| 3 | **adopt** | no scored factor is weak | the scored blocking factors (all ≥ 3) |

- **Provisional:** a verdict is marked provisional, naming the factors, while a blocking factor is not measured. Today that is direct-api-calls.
- **Modules individually workable**, from the feature text: read as "rule 1 did not fire". A repo where an agent can verify changes is workable module by module, under the zones below.

**Open point 1.** module-boundaries has no signal yet. Under rule 1, *prepare first* therefore fires whenever test-feedback ≤ 2. That includes repos that have tests but only a few, or have no way to run them.

### Applied to the repos available locally

| Repo | Weak factors | Verdict |
|---|---|---|
| ai-codebase-auditor | type-strictness 2, dependency-currency 2 | adapt (provisional) |
| ai-harness-framework | type-strictness 1, dependency-currency 2 | adapt (provisional) |

**Calibration expectations to watch in feat-009:**
- **DOOM:** test-feedback 1, so *prepare first*, as expected.
- **Redmine:** Ruby without a type checker gives type-strictness 1, so *adapt*. The handoff expects *adopt*.
- **Struts:** Java should land close to *adopt*. The expected verdict is *adapt*.

Calibration may move these rules or thresholds.

## Proposed Risk-Zone Rules

### Modules

- **Starting point:** a module is a top-level directory, the same as code-structure. Files at the repository root form `(root)`.
- **Splitting:** a module holding more than half of all source files (`splitShare: 0.5`) is split into its subdirectories, plus `<dir>/(files)` for the files directly in it. This repeats up to 3 levels deep (`maxDepth: 3`). It is what turns `web/` with 195 files into `web/app`, `web/routes` and so on.
- **Scope:** only modules with source files get a zone. Docs, config and data directories are counted, not zoned.

### Green or yellow

| Zone | Rule |
|---|---|
| **green**: autonomous edits | the repository's test-feedback score is ≥ 3 (`greenMinTestScore`), **and** the module would score ≥ 3 on file-size: its p90 lines and its share of files over 1000 lines stay within the file-size factor's score-3 thresholds |
| **yellow**: only after characterization tests | otherwise, with the reason (tests too weak for the repository, or the module's files too large) |

Test-feedback is a repository-level signal. Mapping tests to modules is not reliable across conventions, for example Redmine's top-level `test/`.

### Red paths

A path is red when one of its path segments contains a sensitive term as a whole word. Segments are split on separators and camelCase, so `ForgotPasswordController.php` matches `password`.

- **Where a red path shows:** a matching directory is listed once, as a directory. A matching file is listed by itself.
- **Effect on zones:** red paths override their module's zone. A module whose source files are all red is red.
- **Terms**, kept in `config/decision.json`:
  - **Authentication:** auth, authn, authz, authenticate, authentication, authorize, authorization, oauth, sso, saml, jwt, login, logout, signin, signup, password, passwords, passwd, credential, credentials.
  - **Permissions:** permission, permissions, acl, acls, rbac, role, roles.
  - **Billing:** billing, payment, payments, checkout, subscription, subscriptions, stripe, paypal, refund, refunds.
  - **Secrets:** secret, secrets, encryption.
- **Removed after the sanity check:**
  - **session:** it marked `session-handoff.md` and a booking app's `BookSession.php` red.
  - **invoice:** in an invoice-processing app it marks the whole product red.

Sanity check on local repos:
- **studio-booking-saas:** red for `web/app/Auth`, `web/app/Http/Controllers/Auth`, `ChangeMemberRole.php` and `Enums/Role.php`.
- **ai-invoice-intake:** red for `api/auth.py`; `accounts.py` is not red.
- **This repository:** nothing red.

### `config/decision.json`

```json
{ "version": 1, "weakMax": 2, "greenMinTestScore": 3, "splitShare": 0.5, "maxDepth": 3, "redTerms": ["auth", "..."] }
```

## How I Will Verify

- [ ] Layer 1 (static): `npm run lint`
- [ ] Layer 2 (runtime): `npm run test`, and Layer 2b `npx vitest run src/decision`:
  - each verdict rule and its boundaries (scores 2 and 3 on every side);
  - provisional marking;
  - no verdict without test-feedback;
  - module splitting at the share and depth limits;
  - green and yellow at the file-size edges;
  - red paths for auth, billing and permission directories and files, camelCase matching, and no match on `session` or `invoice`;
  - validation of `config/decision.json`.
- [ ] Layer 3 (system): `npm run check`, with the e2e smoke run printing a verdict and zones.

## Dependencies

- [x] Depends on: feat-006 (passing)
- [x] Blocked by: review of these rules

## Risks

- The verdict rules are hypotheses until feat-009 calibration; Redmine is the case most likely to disagree.
- Red-term matching is path-based, so it misses sensitive code in neutrally named files, and can still flag unrelated words.
- Zones use a repository-level test signal, so a well-tested repository makes every legible module green even where that module's own tests are thin.

## Commit Plan

One commit for feat-007 (decision module, decision config and loader, tests, CLI output, docs, decision record), then one for the gate's evidence from the clean tree.
