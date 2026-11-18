# Quality Document

Rate each module on a scale of A (excellent) / B (good) / C (acceptable) / D (needs work) / F (failing).

## Modules

| Module | Test Coverage | Type Safety | Documentation | Arch Compliance | Performance |
|---|---|---|---|---|---|
| cli (`src/cli.ts`) | B | A | B | A | A |
| config (`src/config/factors.ts`, `config/factors.json`) | A | A | A | A | A |
| target (`src/target.ts`) | A | A | B | A | A |
| result (`src/result.ts`) | n/a | A | B | A | A |
| collectors/git-history (`src/collectors/git-history.ts`, `types.ts`, `git.ts`) | A | A | A | A | A |
| collectors/code-structure (`src/collectors/code-structure.ts`, `tree.ts`) | A | A | A | A | A |
| collectors/tests-docs (`src/collectors/tests-docs.ts`) | A | A | A | A | A |
| collectors/dependencies (`src/collectors/dependencies.ts`, `dependencies/`) | A | A | A | A | A |
| collectors/dynamic-calls (`src/collectors/dynamic-calls.ts`, `dynamic-calls/`) | A | A | A | A | B |
| collectors/co-change (`src/collectors/co-change.ts`) | A | A | A | A | A |
| modules (`src/modules.ts`) | A | A | A | A | A |
| collectors/observability (`src/collectors/observability.ts`, `src/observability-names.ts`) | A | A | A | A | A |
| config/runtime-eol (`src/config/runtime-eol.ts`, `config/runtime-eol.json`) | A | A | A | A | A |
| scoring (`src/scoring/`, thresholds in `config/factors.json`) | A | A | A | A | A |
| config/deferrals (`src/config/deferrals.ts`) | A | A | A | A | A |
| file-kinds (`src/file-kinds.ts`) | B | A | B | A | A |
| decision (`src/decision/` including `hotspots.ts`, `config/decision.json`) | A | A | A | A | A |
| config/decision (`src/config/decision.ts`) | A | A | A | A | A |
| report (`src/report/`) | A | A | A | A | A |
| plan (`src/plan/`) | A | A | A | A | A |
| config/harness-requirements (`src/config/harness-requirements.ts`, `config/harness-requirements.json`) | A | A | A | A | A |
| mcp (`src/mcp/`, `config/agent-skills/`) | A | A | A | A | A |
| compare (`src/compare/`) | A | A | A | A | A |
| batch (`src/batch/`) | A | A | A | A | B |
| testing (`src/testing/git-fixture.ts`) | n/a | A | B | A | A |

- `cli`: unit tests cover every command and error path, and the e2e smoke run covers the built binary, including that the audited repository is left unchanged. No coverage tool is configured, hence B.
- `config`: table-driven tests cover each validation rule, multiple errors at once, missing files and invalid JSON; the schema is documented in `docs/USAGE.md`.
- `target`: tests cover a clone, a linked worktree, a relative path, a missing path, a file and a non-root directory.
- `result` is a type only.
- `collectors/git-history`: 11 tests on fixture repositories cover totals, per-file values, the 12-month window, merges, unusual paths, every not-measured reason and an unchanged-target check. Performance A: the whole log is held in memory, at most 5.0 s and 113 MB for the full audit of phpBB (28,503 commits).
- `collectors/code-structure`: 12 tests cover exact per-file counts (empty, CRLF, no final newline), every exclusion reason including a symlink and a submodule that exist only in the tree, percentiles, buckets, modules, scc used / missing / failing / unparseable through a stand-in, and an unchanged-target check. Performance A: every included file is read fully, at most 205 MB peak for the full audit of moin-1.9 (2,087 files, including a 208,753-line dictionary). The scc path is not yet checked against a real scc install.
- `collectors/tests-docs`: 11 tests cover nine test conventions across seven languages, five runner configs including manifest-declared ones, named Vitest variants and npm's placeholder, three CI systems, every docs category, rule extraction (list markers, code fences, soft wording), presence-only agent context, a symlinked rules file and an unchanged-target check. Performance A: path matching plus a few small reads.
- `collectors/dependencies`: 29 parser tests (every supported format and runtime file, issues, unsupported manifests), 39 version tests (spec forms, cycles, coarse and unbounded specs) and 9 collector tests (mixed repository, vendored and unparseable manifests, every assessment status, the EOL-date boundary, an unchanged-target check).
- `collectors/dynamic-calls`: 15 stripper tests (comments, strings, interpolation, PHP tags and heredocs, Ruby heredocs and percent literals, regex literals, line preservation), 42 pattern tests (every construct counted and its literal form not counted, plus the three Struts false positives), and 5 collector tests (each covered language, every skip reason, evidence, an unchanged-target check, not-measured cases). Performance B: Struts takes 3.5 s alone because each covered file is opened again after code-structure, and file opens are slow on Windows.
- `collectors/co-change`: 6 tests on fixture histories (source files per commit, docs-only, vendored and generated commits left out, the read limit, merges left out, a shallow clone, an empty repository, an unchanged-target check).
- `modules`: 9 tests on grouping, splitting, the depth limit, and mapping old paths onto today's modules; the zones' tests pass unchanged on the shared code.
- `collectors/observability`: 7 collector tests (every logging form, comments and strings ignored, console apart, integration imports with lines, each configuration and framework setting, src/main/resources counted and src/test/resources not, vendored and minified skipped, evidence, an unchanged-target check) and 39 name-list tests (each integration and framework, near-miss names left alone).
- `config/runtime-eol`: the committed table loads; validation rejects bad versions, dates, unknown runtimes and duplicate cycles.
- `scoring`: table-driven tests on every threshold edge for six rules (just below, at, just above), each not-measured path, readiness (lowest blocking, constraining ignored, ties, provisional, none scored), deferrals (raise, cap, expiry boundary, unmeasured factor, effect on readiness) and threshold validation.
- `config/deferrals`: validation of every field, revisit-before-recorded, unknown factors, missing files.
- `file-kinds`: pure data, covered through the collector and scoring tests rather than its own suite, hence B.
- `decision`: 29 tests cover every verdict rule and boundary (scores 2 and 3, measured and unmeasured boundaries, deferred scores), provisional marking, red terms (camelCase, digits, whole words, no match on session, invoice, author, rolex), red-directory collapsing, green and yellow at the file-size edges, all-red modules, splitting at the share and depth limits, and test files left unzoned. feat-014 added 22 hotspot tests (name words, test-name suffix matching including partial words and longer names, the percentile and floor edges, ties, changed-files-only percentiles, no changes in the window) and 5 zone tests (a yellow path inside a green module with scores untouched, green modules only, red files never hotspots, history not measured, an empty window).
- `config/decision`: 17 tests on validation (including the hotspot settings) and the default terms.
- `plan`: 26 plan tests cover each requirement at scores 2, 3 and 4, not-assessed factors, every verdict's framing, stack detection for each harness marker and an undetected language, zone items with deny rules, and every item citing its trigger. 18 roadmap tests cover each factor's step and effort bands, the ordering formula with ties, `verdictAfter` and runtime upgrade targets. The case-study script confirms every item and step in the five reports cites a matching score or zone.
- `config/harness-requirements`: 12 tests on validation (ids, duplicates, surfaces, unknown keys, zones), unknown factors and the default file.
- `report`: file snapshots of all three formats (SARIF with a structural 2.1.0 validator that is itself tested against a broken log) for a fixed, git-free input, determinism, same content across formats, LF endings, cell escaping, the out-directory guard (inside, link into the target, sibling with a shared prefix) and writing; the e2e run compares two real runs byte for byte.
- `mcp`: 15 tests cover report validation, zone lookup (red over yellow over module, `(root)`, `<dir>/(files)`, longest module, Windows separators, unzoned paths), every tool, the handshake per protocol version, notifications, and each JSON-RPC error. The stdio loop is tested with streams, and the e2e test drives the built server through every tool.
- `compare`: 4 tests cover a report against itself, every kind of factor change, zone moves, red and yellow path changes, completed roadmap steps, different repositories and the three renderings; CLI tests cover argument and version errors and `--out`; an e2e test compares audits of a fixture at two commits.
- `batch`: 6 tests cover list parsing, folder names that repeat, entry summaries, sorting and counts, and renderings with failures. CLI tests run a healthy repository beside a missing path, a non-git directory and a repository whose write throws; the e2e test checks every folder and that the repositories are unchanged. Performance B: repositories are audited one after another, about 90 seconds for the five calibration clones.
- `testing`: test-only, excluded from the build.

## Summary

- **Overall Quality Grade:** A- (feat-001 to feat-023 scope)
- **Blockers:** none
- **Areas requiring attention:** no coverage measurement yet; module dependency rules from `docs/ARCHITECTURE.md` are not yet encoded in `.harness/arch-rules.json`; scc output format unverified against a real install; known calibration limits (bundled libraries under non-standard names, red-term and doc-name false positives) in docs/case-study/README.md

## Notes

- 2026-10-19: harness adopted; strict TypeScript, ESLint, Vitest unit and e2e layers wired.
- 2026-10-19: feat-001 added the `audit` command, target check and factor config loader.
- 2026-10-19: feat-002 added the git-history collector and the shared `Measurement<T>` type (D-006).
- 2026-10-21: feat-003 added the code-structure collector and moved the git runner to `collectors/git.ts` (D-007).
- 2026-10-21: feat-004 added the tests-and-docs detector and moved tree helpers to `collectors/tree.ts` (D-008).
- 2026-10-21: feat-005 added the dependency collector and the dated runtime end-of-life table (D-009); raised the Vitest timeouts to 30 s because git-spawning tests passed 5 s under parallel load.
- 2026-10-21: feat-006 added the scoring engine, thresholds in `config/factors.json`, `--deferrals`, type-checker detection and `src/file-kinds.ts` (D-010).
- 2026-10-21: feat-007 added the decision engine: verdict rules, module splitting and path-based red zones (D-011).
- 2026-10-22: feat-009 calibrated on five public repositories: build-tool runners, fixture runtimes, test-path docs, type-strictness constraining, report schemaVersion 2 (D-013); collector performance measured (at most 7.2 s and 205 MB, on phpBB and moin-1.9).
- 2026-11-18: feat-023 added direct-call rules and a stripper for C and C++ (D-028); DOOM is measured (7 sites, all true positives) and no longer provisional. Modules touched: collectors/dynamic-calls, file-kinds; ratings unchanged. The case study was regenerated.
- 2026-11-18: feat-022 added direct-call rules and strippers for C# and Go, which now count toward the covered share (D-027). Module touched: collectors/dynamic-calls; rating unchanged. Precision on a real C# or Go repository is not yet measured: none was cloned.
- 2026-11-18: feat-021 added `audit-batch` (`src/batch/`) and split the CLI's audit into `loadAuditInputs`, `auditOne` and `writeAuditFiles` (D-026). Modules touched: batch (new), cli.
- 2026-11-18: feat-020 added `compare` (`src/compare/`), moved saved-report parsing to `src/report/saved.ts`, and added `writeOutFiles` to the report writer (D-025). Modules touched: compare (new), report, mcp, cli.
- 2026-11-18: feat-019 added copy-ready harness files under `--out/harness/` (`src/plan/files.ts`) and a path guard in the report writer (D-024). Modules touched: plan, report, cli; ratings unchanged.
- 2026-11-18: feat-018 made the package installable (`prepack` clean build, an e2e test that installs the tarball and audits with it) and added the composite GitHub Action `action.yml` with a CI job (D-023). Modules touched: packaging and CI only; ratings unchanged. The Action's CI job has not run yet: nothing was pushed.
- 2026-11-18: feat-017 added the SARIF 2.1.0 report (`src/report/sarif.ts`) and the `--fail-on` verdict gate (`src/decision/gate.ts`) (D-022). Modules touched: report, decision, cli; ratings unchanged. SARIF is checked against the schema's required structure, not the full schema.
- 2026-11-18: feat-016 added the read-only MCP server `mcp <report.json>` (`src/mcp/`, no dependency) and the risk-zones agent skill (D-021). Modules touched: mcp (new), cli.
- 2026-11-18: feat-014 added hotspots in green modules and yellow paths (`src/decision/hotspots.ts`, `hotspots` in `config/decision.json`), the yellow-paths plan item, and report schemaVersion 7 (D-019). Modules touched: decision, config/decision, plan, report, cli; ratings unchanged. Known limit: tests are matched by name, so 6 of the 14 calibration yellow paths are tested under another name.
- 2026-10-23: feat-013 added the observability collector and score, the observability name lists, the observable-changes requirement and roadmap step, and report schemaVersion 6 (D-017).
- 2026-10-23: feat-012 added the co-change collector and the module-boundaries score, shared module grouping, the scoped-lanes requirement and roadmap step, and report schemaVersion 5 (D-016).
- 2026-10-23: feat-011 added the dynamic-calls collector and the direct-api-calls score, the traceable-calls requirement and roadmap step, report schemaVersion 4, and single-open file reads (D-015).
- 2026-10-22: feat-010 added the harness adaptation plan and modernization roadmap (`src/plan/`, `config/harness-requirements.json`, `--harness`, report schemaVersion 3, D-014).
- 2026-10-22: feat-008 added the report model, Markdown and JSON renderers, `--out` with a target guard, the audit-date time unit and the HEAD commit (D-012).

---

_Update this document at session close for modules touched in the session._
