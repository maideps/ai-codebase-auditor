# Observability

Two kinds: how agent sessions on this project are traced (harness), and how the audit itself shows its work (product).

## Audit Output Observability

The product's main observability rule is evidence: every factor score in a report carries the signal behind it (a file path, a count, a command and its output). A reader must be able to reproduce any score by hand.

Planned for the audit command:

- A run summary at the end of each audit: collectors run, collectors skipped (with reason, for example "scc not installed"), duration per collector, and the list of signals that could not be verified.
- Batch runs over several repositories isolate failures per repository, so one broken target does not stop the calibration run. Proposed, not yet decided.
- Diagnostics go to stderr; reports go to files or stdout, so they stay machine-readable.
- No telemetry and no network calls by default.

## Sprint Contract

Before starting each feature, fill out a sprint contract (`templates/sprint-contract.md`) that declares what you intend to build, how you'll verify it, what success looks like and how long you expect it to take.

## Session Traces

```bash
npm run session-start    # or: make session-start
npm run session-end      # or: make session-end
```

Traces are stored in `.harness/traces/` as timestamped JSON records: session start and end times, active feature, verification metadata, files modified and a decision summary. They are local runtime records (gitignored), not evidence.

## Evaluator Rubric

After completing a feature, score it against `templates/evaluator-rubric.md`. Every dimension must reach B or above before the feature is considered complete.

## Quality Document

After touching any module, update `docs/quality-document.md` with ratings (A to F) per dimension: test coverage, type safety, documentation, architecture compliance, performance. Version 2 of the audit is meant to write these initial ratings for an audited repository.

## Verification Trail

`npm run vcr` records a verification trail to `.harness/trails/` after `check` and `check-arch` pass. A plain `npm run check` does not write trails. Feature evidence lives in `.harness/state/<id>.json`, written by `verify-feature`.

## Session Report and Sweep

```bash
npm run report    # session digest from .harness/traces/ (last 7 days; --days N, --json)
npm run sweep     # archive traces older than 30 days, prune orphans, report manifest drift
```
