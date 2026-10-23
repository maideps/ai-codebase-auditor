# Sprint Contract

**Feature ID:** feat-010
**Feature Name:** Version 2: harness adaptation plan and modernization roadmap
**Date:** 2026-10-22
**Estimated Duration:** 1 session
**Status:** plan and roadmap rules reviewed and approved 2026-10-22 (decisions below)

## Review Decisions (2026-10-22)

All four open points were approved as recommended:
- **Zone items:** red-path and yellow-module items cite their zone as the trigger.
- **Red-path guardrail:** an `AGENTS.md` proposal-only list plus Claude Code `permissions.deny` rules.
- **Effort:** the rule-based S/M/L model.
- **Output:** plan and roadmap go in the same report as `schemaVersion` 3.

The rest of the contract is implemented as written. One detail is settled during implementation: "changes the verdict" is computed by re-running the verdict rules with the step's score in place of the current one, so it uses the same rules as the decision engine.

Two more were settled during implementation and recorded in D-014:
- Under *prepare first*, the zone guardrails stay in the plan. They are required items, and agents writing characterization tests still need them. The first case-study run showed DOOM's four yellow modules missing, which led to this fix.
- Only a user-supplied `--harness` file must name configured factors. The default file meets reduced `--config` files, and their requirements are listed as not assessed.

## What I Will Build

`buildPlan(...)` and `buildRoadmap(...)` in `src/plan/`, both pure like scoring and decision. They read the factor scores, the collector results, the zones and a **harness requirements file**: `config/harness-requirements.json`, kept separate so another team can swap in its own harness.

- **The plan** says which ai-harness-framework rules, context files and guardrails to change for this repository, and why.
- **The roadmap** lists the steps that raise scores, ordered by expected gain against effort.

Every plan item and roadmap step names the factor score, or the zone, that triggered it. Both go into the existing report, as `schemaVersion` 3: new `plan` and `roadmap` sections in the JSON, new sections in the Markdown. `audit` prints a short summary. `--harness <file>` replaces the requirements file.

The requirements file names the harness version it was written against: ai-harness-framework 0.5.0, commit `7fb142a`, which includes D-029 (a required layer that only reports SKIP now fails `verify-feature`).

## Proposed Harness Requirements (the default file)

Each requirement is a harness assumption tied to one factor. When the factor's score is **≤ 2** (weak), its adaptations are **required**. When it is **3**, they are **recommended**. At 4 or 5, or when the factor is not measured, nothing is added; the not-measured case is listed as "not assessed".

| Requirement | Factor | Harness surface | Adaptation (required at ≤ 2; recommended at 3) |
|---|---|---|---|
| verifiable-changes | test-feedback | `feature_list.json` layers, `package.json` test script | Add a characterization-test step (golden-master capture of current behavior) for each module before a feature edits it. Under D-029, a test layer that only SKIPs fails every feature, so the test layer must run real tests. The agent that changes logic must not be the only author of its tests (`AGENTS.md` rule). |
| typed-changes | type-strictness | `typecheck` layer in `package.json`, `DECISIONS.md` | Add the checker for the main dynamic language in check mode with a baseline, so new code is checked: mypy or Pyright for Python, PHPStan or Psalm for PHP, Sorbet or Steep for Ruby, `strict`/`checkJs` for JS/TS. Record the baseline as a dated deferral. |
| legible-context | file-size | `AGENTS.md` | Work per module; list the oversized files (over 1000 lines) as plan-by-function, split-before-feature files. |
| written-intent | documented-intent | `AGENTS.md`, `docs/ARCHITECTURE.md` | Write the project's non-standard practices as rules in `AGENTS.md`, and fill `docs/ARCHITECTURE.md` by hand: the placeholder check passes generic template text (maideps/ai-harness-framework#23). |
| reproducible-runs | dev-deploy-simplicity | `init.sh`, `.github/workflows/ci.yml`, runtime pin | Add whichever of these the evidence shows missing: CI from the harness template, a pinned runtime, a test runner, a lock file (not for Maven or Gradle). |
| supported-runtime | dependency-currency | CI and the verification layers | Run the verification layers under the declared legacy runtime (container or pinned toolchain), separately from the harness's own Node ≥ 18. Agents do not change runtime-sensitive code without that toolchain. |
| detected-stack | test-feedback (the layer at risk) | `package.json` layer scripts | **Triggered when the harness's stack detection would not find the repository's main language.** The harness checks root markers in order (Python `pyproject.toml`/`requirements.txt`, `go.mod`, `Cargo.toml`, Maven/Gradle, .NET, then `package.json`), and the main language comes from the source-line share. Fix: declare each layer command explicitly (for example `phpunit`, `bin/rails test`, `make check`) so no required layer reports only SKIP. |

### Zones (the zone is the trigger, not a factor score)

| Zone | Harness surface | Adaptation |
|---|---|---|
| red paths | `AGENTS.md`; `.claude/settings.json` | List the red paths as proposal-only in `AGENTS.md`, and add Claude Code `permissions.deny` rules (`Edit(<path>/**)`, `Write(<path>/**)`) so agents cannot edit them directly |
| yellow modules | `AGENTS.md` | List the yellow modules as "characterization tests first", with each module's reason |

### Plan framing by verdict

- **prepare first:** "Do not adopt the harness for feature work yet." The plan lists only the required items, with the test-feedback items first.
- **adapt:** "Adopt the harness with these adaptations." Required items first, then recommended items.
- **adopt:** "Adopt as is." Only the zone guardrails and recommended items appear.

## Proposed Roadmap Rules

There is one step for each scored factor below 5 that has a concrete next action. Each step names the factor's current score, the score the step reaches, the action with the metric gap, and an effort.

| Factor | Step | Effort |
|---|---|---|
| test-feedback | Add a runner config and/or CI if missing, then the number of test files needed to reach the next ratio threshold | by test files needed: ≤ 20 S, ≤ 100 M, more L; **at least M when the repository has no tests yet** |
| type-strictness | Configure a checker for the main dynamic language (the share is recomputed as checked), or turn on TypeScript `strict` | M |
| file-size | Split the fewest files over 1000 lines needed to reach the next share band | ≤ 5 files S, ≤ 20 M, more L |
| documented-intent | Reach the next level's rule count, files and architecture or decision docs | S to reach 3, M beyond |
| dev-deploy-simplicity | Add the missing signals (no lock file for Maven or Gradle) | M if CI is missing, else S |
| dependency-currency | Upgrade the worst runtime to the oldest cycle supported more than 12 months past the audit date | L across a major version (Python 2→3, PHP 5→8), M otherwise |

**Ordering:** priority = gain × weight ÷ effort.
- **Gain** is the score increase, plus 1 when the step lifts a weak factor (≤ 2) to 3 or more, because that is what changes a verdict.
- **Weight** is 2 for blocking factors and 1 otherwise.
- **Effort** counts S as 1, M as 2, L as 3.
- **Ties** break blocking first, then config order.
- A step that lifts the last weak factor is marked **"changes the verdict to adopt"**.

## What This Would Produce on the Calibration Set (estimated from the committed reports)

| Repo | Plan, required items | Plan, other items | Roadmap, first three steps |
|---|---|---|---|
| DOOM (prepare first) | verifiable-changes, legible-context, written-intent, reproducible-runs, detected-stack (no stack found) | yellow: all 4 modules | test-feedback 1→3 by adding a runner, CI and 8 tests [M]; dev-deploy 1→5 [M]; documented-intent 2→3 [S] |
| moin-1.9 (adapt) | typed-changes (Python), written-intent, supported-runtime (Python 2.7), detected-stack (`setup.py` only: no stack found) | red: 7 paths; yellow: 9 modules; recommended: verifiable-changes, legible-context | documented-intent 2→3 [S]; dependency-currency 1→5, Python 2.7 to a supported 3.x [L]; type-strictness 1→3 with mypy [M] |
| phpBB (adopt) | detected-stack (root `package.json`: taken for Node) | red: 40 paths; recommended: legible-context, written-intent, typed-changes | file-size 3→4 by splitting 12 files [M]; documented-intent 3→4 [M] |
| Struts (adopt) | none | red: 13 paths; recommended: written-intent | documented-intent 3→4 [M]; the lock-file step is skipped (Maven) |
| Redmine (adapt) | typed-changes (Ruby: Sorbet or Steep), detected-stack (root `package.json`: taken for Node) | red: 78 paths; recommended: written-intent | type-strictness 1→3 [M], marked "changes the verdict to adopt"; documented-intent 3→4 [M] |

## Open Points

1. **Zone items** cite their zone (red path, yellow module) rather than a factor score. Option A: count that as the trigger the feature asks for. Option B: keep zones out of the plan and only in the zone section.
2. **Red-path guardrail:** an `AGENTS.md` list plus Claude Code `permissions.deny` rules (enforced for Claude Code, advisory for other agents), or the `AGENTS.md` list only.
3. **Effort model:** the rule-based S/M/L above, or no effort and ordering by gain alone.
4. **Where the output goes:** the existing report as `schemaVersion` 3, or separate `ai-harness-plan.md` and `.json` files.

## How I Will Verify

- [ ] Layer 1 (static): `npm run lint`
- [ ] Layer 2 (runtime): `npm run test`, and Layer 2b `npx vitest run src/plan`:
  - each requirement at scores 2, 3 and 4 (required, recommended, none);
  - not-measured factors listed as not assessed;
  - each verdict's framing;
  - stack detection for every harness marker and for an undetected language;
  - zone items;
  - every roadmap rule, its effort bands and the ordering formula with ties;
  - the "changes the verdict" marker;
  - every item citing its trigger;
  - validation of the requirements file.
- [x] Layer 3 (system): `npm run check`. The five case-study reports are regenerated, and a check confirms every plan item and roadmap step there cites a factor score or a zone.

## Dependencies

- [x] Depends on: feat-009 (passing)
- [x] Blocked by: review of these rules

## Risks

- **Effort is a heuristic.** S/M/L by counts ignores how hard the code is, for example characterization tests for a 1997 game engine.
- **The requirements file describes one harness version.** The file states which; harness changes need a file update.
- **Red-path deny rules may be too broad** where red terms are false positives (the case study's known limit 2). The plan quotes the paths so a person can prune them.

## Commit Plan

One commit for feat-010 (`src/plan/`, requirements file and loader, report `schemaVersion` 3, CLI, tests and snapshots, regenerated case study, docs, decision record), then one for the gate's evidence from the clean tree.
