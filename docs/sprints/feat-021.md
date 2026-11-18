# Sprint Contract

**Feature ID:** feat-021
**Feature Name:** Portfolio audit of many repositories
**Date:** 2026-11-18
**Estimated Duration:** 1 session
**Status:** decided without a review round, at the user's request (D-026)

## Decisions

1. **The list file:** one repository path per line, resolved against the list file's directory. Blank lines and lines starting with `#` are skipped. Each repository's reports go to `<out>/<directory name>/`. Names that repeat (case-insensitively) get `-2`, `-3` and so on.
2. **Isolation:** each repository is audited on its own. A repository fails, with its reason recorded, when:
   - its path is missing;
   - it is not the root of a git working tree;
   - its report folder would land inside it;
   - its audit or its write throws.

   The others still run. Configs are loaded and validated once, so a bad `--config` stops the whole run with exit code 2 before any audit.
3. **One audit date** for the whole run, so every report in the portfolio uses the same time rules.
4. **Summary:** `ai-readiness-portfolio.md` and `.json` (`schema: ai-codebase-auditor/portfolio`, version 1). Each repository gets its verdict (provisional or not), readiness, weak factors, red and yellow path counts and folder, or its error. The list is sorted worst verdict first (prepare first, adapt, adopt, no verdict), with failures last, and shows counts per verdict.
5. **Exit codes:** 0 when every repository was audited; 1 when any failed (with the count on stderr); 2 for argument, list or config errors. `--fail-on` is not offered for batches: the portfolio's counts are the gate.
6. **Code:** `runAudit` is split into `loadAuditInputs`, `auditOne` and `writeAuditFiles`, which `audit-batch` reuses. A single audit therefore produces the same bytes it did before, and `src/batch/` stays pure.

## How I Will Verify

- [ ] Layer 1: `npm run lint`
- [ ] Layer 2: `npm run test`; Layer 2b `npx vitest run src/batch`:
  - list parsing (comments, blanks, relative paths, folder names that repeat);
  - entry summaries, sorting and counts;
  - renderings with failures.

  CLI tests cover a healthy repository beside a missing path, a non-git directory and a repository whose write throws, plus the argument errors.
- [ ] Layer 3: `npm run check`. The e2e test runs a batch of two fixture repositories and a missing path, and checks every folder and that both repositories are unchanged.
