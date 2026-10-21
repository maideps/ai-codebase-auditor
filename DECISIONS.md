# Architectural Decisions Log

This file records significant architectural decisions, their context, alternatives considered, and consequences. It serves as durable cross-session memory for why the codebase is structured the way it is.

## Decision Template

```
### D-XXX: [Decision Title]

**Date:** YYYY-MM-DD
**Status:** proposed | accepted | deprecated | superseded by D-YYY
**Context:** [What problem are we solving? What constraints exist?]
**Decision:** [What did we decide to do?]
**Alternatives considered:**
- Alternative 1: [description] — Rejected because [reason]
**Consequences:**
- Positive: [benefits gained]
- Negative: [tradeoffs accepted]
```

## Recorded Decisions

<!-- Add decision records here, newest last. Expand long records into docs/decisions/ and link back from here. -->

### D-001: TypeScript CLI on Node, built through ai-harness-framework

**Date:** 2026-10-19
**Status:** accepted
**Context:** The project is a portfolio piece meant to show building with AI coding agents through the owner's own harness. The harness runtime is Node ≥ 18. The planning session recorded the product decisions in `docs/HANDOFF.md`.
**Decision:** Write the CLI in TypeScript on Node ≥ 18, as an ES module package. Bootstrap the harness with `create-harness` and build every feature through its gates. The MVP is audit-only (score and verdict, Markdown plus JSON); the harness adaptation plan and modernization roadmap are version 2.
**Alternatives considered:**
- Python CLI — Rejected because it would add a second runtime next to the harness's Node.
**Consequences:**
- Positive: one runtime for product and harness; npm scripts are the layer commands directly.
- Negative: Node 18 is past end of life; `engines` stays at ≥ 18 to match the harness, and tool versions are kept within that range (Vitest 3, ESLint 9).

### D-002: Chain harness self-checks with product tools in the layer scripts

**Date:** 2026-10-19
**Status:** accepted
**Context:** For Node projects each `package.json` script key is a verification layer. The shipped values run the harness's own self-checks (surfaces, skills, feature schema, WIP=1, runner tests, Make targets), and the harness docs say to replace them with product tools. Replacing them would drop those checks from `npm run check` and every feature gate without warning.
**Decision:** Each of `lint`, `typecheck`, `test` and `build` runs `node scripts/framework-check.mjs <layer> && <product tool>`. Product tools: ESLint 9 with typescript-eslint strict, `tsc --noEmit` (strict), Vitest, `tsc -p tsconfig.build.json`.
**Alternatives considered:**
- Replace the values outright — Rejected because only `check-arch` would still cover the harness contract, and it does not check skills, the progress log or the command reference.
- A separate `harness-self-check` script added to `check` — Rejected for now because `check` is a harness-shipped value too; this is the better long-term fix and is proposed upstream in maideps/ai-harness-framework#25.
**Consequences:**
- Positive: both the harness contract and the product are verified in every layer.
- Negative: chaining is not explicitly documented as supported by the harness; after each `harness-upgrade` the five layer scripts must be checked by hand.

### D-003: e2e is a smoke run of the built CLI, not the harness adoption matrix

**Date:** 2026-10-19
**Status:** accepted
**Context:** The harness's default `e2e` is its adoption matrix, which generates throwaway adopter repositories and tests the harness. On a fresh adoption it made `init.sh` run more than 10 minutes on Windows, and every feature gate runs `npm run check`.
**Decision:** `e2e` builds the CLI and runs Vitest tests in `e2e/` that spawn `dist/cli.js` as a user would. The smoke run grows into a fixture-repository audit once the `audit` command exists.
**Alternatives considered:**
- Keep the matrix and set `CW_SKIP_ADOPTION_MATRIX=1` locally — Rejected because e2e would then SKIP, which never counts as verified.
**Consequences:**
- Positive: e2e tests this product and takes seconds.
- Negative: the harness is no longer end-to-end tested from here; it is tested in its own CI.

### D-004: Single-repo layout; product tests live outside tests/

**Date:** 2026-10-19
**Status:** accepted
**Context:** `create-harness` placed the optional multi-repo skeleton (`contracts/`, `tasks/`, `repositories/`, `scripts/verify-all*`) although the harness docs call it opt-in, and its example repository made `verify-all` report PASS for a check that did nothing (maideps/ai-harness-framework#24). `tests/` is a CORE surface holding the harness runner's own tests, overwritten by upgrades.
**Decision:** Remove the multi-repo skeleton, so `verify-all` reports SKIP. Put unit tests next to their code (`src/**/*.test.ts`) and end-to-end tests in `e2e/`. `productRoots` lists `src/`, `e2e/`, `config/`, `fixtures/` and the root TypeScript, Vitest and ESLint config files.
**Alternatives considered:**
- Product tests under `tests/` — Rejected because it is CORE: upgrades overwrite it and the harness test layer runs every `*.test.mjs` in it.
**Consequences:**
- Positive: classification stays honest; upgrades cannot touch product tests.
- Negative: two similar names (`tests/` for the harness, `e2e/` and colocated tests for the product) need the explanation in `docs/ARCHITECTURE.md`.

### D-005: Package stays private until the audit command works

**Date:** 2026-10-19
**Status:** accepted
**Context:** The bootstrap copied the harness's own `package.json`: its name, `bin` entries, publish settings and `prepublishOnly`.
**Decision:** Rename to `ai-codebase-auditor` 0.1.0, set `"private": true`, expose one bin `ai-codebase-auditor` → `dist/cli.js`, and publish only `dist/`, `config/`, `README.md` and `LICENSE`. A shorter command alias can be added later.
**Alternatives considered:**
- Publish from the start — Rejected because there is nothing useful to install yet.
**Consequences:**
- Positive: no accidental publish of a skeleton.
- Negative: `private` must be removed, and a publish workflow added, before the first release.

### D-006: Collectors return Measurement<T>; git history counting conventions and git hardening

**Date:** 2026-10-19
**Status:** accepted
**Context:** feat-002 is the first collector. Scoring (feat-006) needs every value to carry its evidence and needs to tell "measured as zero" from "could not measure". Git history can be counted several ways, and audited repositories are untrusted: their own git config and location must not change what runs or which repository is read.
**Decision:**
- Every collector returns `Measurement<T>`: `measured` with a value and evidence (the exact commands and the counting caveats), or `not-measured` with a reason. Expected conditions (missing git, no commits, shallow clone, unreadable repository) are `not-measured`, never exceptions or guesses.
- Git history counts non-merge commits, does not follow renames, counts authors by email after `.mailmap` case-insensitively, uses author dates, and reports per-file values only for files tracked at HEAD. A shallow clone is not measured, because its counts would be silently low.
- Git runs with `GIT_CEILING_DIRECTORIES` set to the target's parent, inherited `GIT_DIR`/`GIT_WORK_TREE`/`GIT_INDEX_FILE` cleared, `GIT_OPTIONAL_LOCKS=0` and `-c core.fsmonitor=false`, and only `rev-parse`, `ls-tree` and `log`.
**Alternatives considered:**
- Count merge commits — Rejected because in merge-heavy repositories they inflate churn without changing files.
- Follow renames (`--follow`) — Rejected for the MVP because it works per file only, which means one git process per file on large repositories.
- Measure a shallow clone and flag it — Rejected because a low count looks like a real signal to a reader skimming the report.
- A git library such as isomorphic-git — Rejected because the git CLI is everywhere, faster on large histories, and keeps the dependency list empty.
**Consequences:**
- Positive: every number is reproducible from the cited commands; an empty `.git` directory or an enclosing repository can never be audited by mistake.
- Negative: renamed files look younger than they are; the whole log is held in memory (fine for the calibration set, to revisit for very large histories).

### D-007: Code structure counts with a built-in counter; scc only enriches

**Date:** 2026-10-21
**Status:** accepted
**Context:** feat-003 measures file size and layout. scc gives language, code lines and complexity but may not be installed, and its line semantics differ from a plain newline count. Legacy repositories often commit vendored libraries, lock files, minified bundles and binaries, which would swamp a size distribution. Tracked symlinks can point outside the target.
**Decision:**
- The file list is the tree at HEAD (`git ls-tree -r -z HEAD`), matching the git-history collector; content is read from the working tree.
- Lines and bytes always come from a built-in counter (newline count, plus one for a final line without a newline). scc, when on PATH, only adds language, code lines and complexity, matched by path; its absence or failure is recorded, not fatal.
- Vendored, generated, binary, symlink, submodule and missing files are excluded from every count and listed with their reason. Symlinks and submodules are recognized by tree mode and never read; a file whose real path leaves the target is skipped.
- Distribution uses nearest-rank percentiles and fixed line buckets (0-200, 201-500, 501-1000, 1001-2000, 2001+); thresholds that turn these into a score belong to the scoring engine (feat-006).
- The git runner moves to `collectors/git.ts`, shared by both git-based collectors.
**Alternatives considered:**
- Use scc's counts when available and the built-in counter otherwise — Rejected because the same repository would report different sizes depending on the machine.
- Honor `linguist-vendored` and `linguist-generated` attributes — Deferred: a useful refinement, but it needs `git check-attr` per file and the path rules cover the calibration set.
- Scan the working tree instead of HEAD — Rejected because untracked build output would count as code.
**Consequences:**
- Positive: sizes are reproducible from the cited commands on any machine; exclusions are visible, so a reader can see what was left out.
- Negative: scc's JSON shape is assumed from its documentation until a real install is checked; UTF-16 text files count as binary, as in git; every included file is read fully into memory.

### D-008: Tests and docs are detected from paths; written rules are extracted, not judged

**Date:** 2026-10-21
**Status:** accepted
**Context:** feat-004 feeds the blocking test-feedback factor and the documented-intent factor. The audit must never run a target's tests (PRODUCT.md non-goals), so test presence has to come from static evidence. Research (arXiv 2602.11988) found that agent context files help mainly when they state non-standard practices, so the presence of AGENTS.md must not count on its own.
**Decision:**
- Test files are matched by per-language name conventions first, then by "source file under a test directory"; each file records the convention that matched, so a reader can audit the match. Runner configs are matched by file name, plus three small manifest reads (`pyproject.toml`, `setup.cfg`, `package.json`), where npm's placeholder test script counts as no runner.
- CI is detected by file location for ten systems and reported as configured, never as passing.
- Agent context files are listed separately and marked presence-only. What counts is the stated rules: rule-keyword lines from agent context, contributing, architecture and convention docs, outside code blocks, with file and line. The detector does not decide which rules are non-standard; that needs judgment, and the scoring step decides how rules count.
- Shared tree helpers move to `collectors/tree.ts`: the HEAD tree listing, the vendored rule and `readTrackedFile`, which never opens symlinks or submodules, refuses paths that leave the target, and sniffs binaries before reading.
**Alternatives considered:**
- Run the target's test command to measure feedback speed — Rejected: running untrusted code is a non-goal; speed stays not measured until a static signal exists.
- Parse test files to count test cases — Rejected for the MVP: it needs per-language parsers (out of scope, D-001).
- Classify rules as standard or non-standard with an LLM — Rejected for collectors: LLM steps never produce measured signals; this may become an optional, flagged summary later.
**Consequences:**
- Positive: every detection names the path and the rule that matched; nothing in the target runs.
- Negative: name conventions miss tests in unconventional places (for example inline Rust `#[cfg(test)]` modules) and can count fixtures under test directories; keyword rule extraction includes some descriptive "must" sentences and misses rules phrased without the keywords.

### D-009: Dependencies are parsed statically; runtimes are checked against a dated, committed EOL table

**Date:** 2026-10-21
**Status:** accepted
**Context:** feat-005 feeds the dependency-and-runtime-currency factor. Legacy repositories often run end-of-life runtimes (moin-1.9 on Python 2.7). Manifests such as `setup.py` and Gradle files are programs; running them, or resolving versions from registries, would execute or fetch untrusted input and make results depend on the network.
**Decision:**
- Eight manifest formats plus six runtime version files are parsed as text with small, format-specific parsers (a TOML subset for `pyproject.toml`, regular expressions for `setup.py`, Gemfile, POM and Gradle). What a parser sees but cannot read (a non-literal `install_requires`, a parent POM, a `gemspec` line, an unresolved `${property}`) is recorded as an issue on that manifest; other ecosystems' manifests and unparseable files are listed as not measured.
- Each declared runtime is reduced to the lowest version its spec allows and to a cycle, then compared with `config/runtime-eol.json`: end-of-life on or after the cycle's date, supported before it, unknown with a reason otherwise. The audit date, not the table date, is the comparison point; the table's `asOf` is reported and a table older than a year is flagged.
- The table is a committed snapshot of endoflife.date, fetched 2026-10-21. Java uses Eclipse Temurin dates, with Oracle JDK dates for cycles Temurin never shipped, recorded per cycle. The fetch caught one date a hand-written table would have got wrong: Python 3.10 reached end of life on 2026-10-01.
- The CLI loads the table like the factor config (an invalid table is exit 2) and passes it to the collector.
**Alternatives considered:**
- Query endoflife.date or package registries during the audit — Rejected: the audit must be offline, deterministic and reproducible.
- Assess the highest version a range allows — Rejected: a project that still declares support for an end-of-life runtime is the risk the factor measures.
- One vendor's Java dates only — Rejected: Temurin never shipped Java 7 and earlier, which legacy repositories still declare.
**Consequences:**
- Positive: every runtime verdict cites the declaring file, the spec, the cycle and the dated source; nothing runs or fetches.
- Negative: dependency versions are not checked for age or known vulnerabilities (that needs registry data); the table must be refreshed by hand; regular-expression parsers miss unusual Gemfile, Gradle and setup.py constructs.

### D-010: Scoring rules, measured-only readiness and capped deferrals

**Date:** 2026-10-21
**Status:** accepted (thresholds reviewed before implementation; see docs/sprints/feat-006.md)
**Context:** feat-006 turns collector values into 1-5 factor scores. Three of the nine factors (direct-api-calls, module-boundaries, observability) have no collector signal yet. With language mix alone, every Ruby, PHP and Python repository would score 1 on the blocking type-strictness factor, including Redmine, the calibration control expected to reach *adopt*.
**Decision:**
- One pure rule per measurable factor (`src/scoring/rules.ts`). Every threshold and weight is in `config/factors.json`; startup rejects missing, unused, decreasing or out-of-range thresholds.
- Type strictness weighs source lines by language (strong 1.0, C-family 0.75, dynamic 0), with dynamic code at 0.6 when a type checker for its language is configured, and TypeScript at 0.8 without a strict tsconfig. The tests-and-docs detector now finds type-checker configs.
- Factors without a signal are not measured and get no score. Readiness is the lowest score among scored blocking factors, and is marked provisional, naming the unmeasured blocking factors.
- Deferrals come from `--deferrals <file>`, not from the audited repository. A current deferral raises a score by one level, capped at 3; an expired one, or one for an unmeasured factor, is reported but not applied.
- Shared file classification (`src/file-kinds.ts`) defines "source file" and "lock file" once for collectors and scoring.
**Alternatives considered:**
- Language mix only for type strictness — Rejected in review: it penalizes every dynamic-language codebase, whether or not it uses a type checker.
- Weak proxies for the three signal-less factors — Rejected in review: a score without a real signal breaks "no evidence, no score".
- An uncapped deferral (+1 up to 5) — Rejected in review: a deferral acknowledges a gap; it should not make the factor look healthy.
- Treat an unmeasured blocking factor as score 1 — Rejected: it would make every readiness level 1 today, measuring the tool's gaps instead of the repository's.
**Consequences:**
- Positive: every score names its rule and evidence; teams tune numbers without code changes; the readiness level never hides an unmeasured blocking factor.
- Negative: readiness stays provisional until a call-site collector exists; thresholds are first guesses checked on two local repositories and must be calibrated in feat-009; test feedback speed and package-level currency are not measured.
