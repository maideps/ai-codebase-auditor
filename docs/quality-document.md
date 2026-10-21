# Quality Document

Rate each module on a scale of A (excellent) / B (good) / C (acceptable) / D (needs work) / F (failing).

## Modules

| Module | Test Coverage | Type Safety | Documentation | Arch Compliance | Performance |
|---|---|---|---|---|---|
| cli (`src/cli.ts`) | B | A | B | A | A |
| config (`src/config/factors.ts`, `config/factors.json`) | A | A | A | A | A |
| target (`src/target.ts`) | A | A | B | A | A |
| result (`src/result.ts`) | n/a | A | B | A | A |
| collectors/git-history (`src/collectors/git-history.ts`, `types.ts`, `git.ts`) | A | A | A | A | B |
| collectors/code-structure (`src/collectors/code-structure.ts`) | A | A | A | A | B |
| testing (`src/testing/git-fixture.ts`) | n/a | A | B | A | A |

- `cli`: unit tests cover every command and error path, and the e2e smoke run covers the built binary, including that the audited repository is left unchanged. No coverage tool is configured, hence B.
- `config`: table-driven tests cover each validation rule, multiple errors at once, missing files and invalid JSON; the schema is documented in `docs/USAGE.md`.
- `target`: tests cover a clone, a linked worktree, a relative path, a missing path, a file and a non-root directory.
- `result` is a type only.
- `collectors/git-history`: 11 tests on fixture repositories cover totals, per-file values, the 12-month window, merges, unusual paths, every not-measured reason and an unchanged-target check. Performance B: the whole log is held in memory; 0.65 s on a 79-commit repository, not yet measured on the calibration set.
- `collectors/code-structure`: 12 tests cover exact per-file counts (empty, CRLF, no final newline), every exclusion reason including a symlink and a submodule that exist only in the tree, percentiles, buckets, modules, scc used / missing / failing / unparseable through a stand-in, and an unchanged-target check. Performance B: every included file is read fully; 1.2 s on a 171-file repository. The scc path is not yet checked against a real scc install.
- `testing`: test-only, excluded from the build.

## Summary

- **Overall Quality Grade:** A- (feat-001 to feat-003 scope)
- **Blockers:** none
- **Areas requiring attention:** no coverage measurement yet; module dependency rules from `docs/ARCHITECTURE.md` are not yet encoded in `.harness/arch-rules.json`; collector performance unmeasured on large repositories; scc output format unverified against a real install

## Notes

- 2026-10-19: harness adopted; strict TypeScript, ESLint, Vitest unit and e2e layers wired.
- 2026-10-19: feat-001 added the `audit` command, target check and factor config loader.
- 2026-10-19: feat-002 added the git-history collector and the shared `Measurement<T>` type (D-006).
- 2026-10-21: feat-003 added the code-structure collector and moved the git runner to `collectors/git.ts` (D-007).

---

_Update this document at session close for modules touched in the session._
