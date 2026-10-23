# Sprint Contract

**Feature ID:** feat-013
**Feature Name:** Observability collector
**Date:** 2026-10-23
**Estimated Duration:** 1 session
**Status:** detection rules and score ladder reviewed and approved 2026-10-23 (decisions below); not implemented

## Review Decisions (2026-10-23)

All four open points were approved as recommended:
- **Logging present:** calls in ≥ 2% of product files, or a committed logging configuration, or a framework that logs by default.
- **C's `fprintf(stderr, …)`:** counts as logging, together with `syslog(` and Java's `System.err`.
- **Share threshold:** 2% of product source files.
- **`console.*`:** not logging; counted and shown separately.

## Settled During Implementation (recorded in D-017)

- **Logging patterns:**
  - `Rails.logger.info` is caught by the receiver-name pattern, so there is no separate `Rails.logger` pattern that would count it twice;
  - level methods may be called Ruby-style, without parentheses (`logger.warn "…"`).
- **Stripping for C-like languages:** C, C++, Go, C#, Kotlin and similar languages are stripped with the Java lexer, so a commented-out `fprintf(stderr, …)` does not count.
- **Development dependencies** do not count as integrations: they do not run in production.
- **From the case-study check:** Struts's `log4j2.xml` files under `src/main/resources` were missed, because the D-013 test-path rule treats `src/<set>/resources` as test data. Configuration detection now uses `isUnderTestDirectory` (test directories only).

## What the Factor Means

`config/factors.json` defines observability as: *"Logs, errors and metrics show what the code does when it runs."* After an agent's change ships, its tests are not the only check: run-time failures have to show up somewhere a person or an agent will see them. The factor asks whether the repository has the means: logging, error reporting, and metrics or tracing.

It is the last factor without a signal. It is constraining, so a weak score gives *adapt*; it never sets readiness.

## What I Will Build

- A collector, `src/collectors/observability.ts`. It reads tracked files statically:
  - logging calls in source files, with comments and strings stripped for the covered languages;
  - logging configuration files by name;
  - framework log settings by content;
  - observability imports in source.

  Nothing is run.
- A scoring rule for observability. It combines the collector with the manifests the dependency collector already parses, and its thresholds go in `config/factors.json`.
- A harness requirement and a roadmap step for the factor.
- A collector summary in `audit` output and an `observability` signal in the report (`schemaVersion` 6).

## Proposed Detection Rules

**Logging calls** in product source files. Tests are left out, as are vendored, generated and minified files. One pattern works across languages, plus a few language conventions:

| Pattern | Examples |
|---|---|
| a receiver named `log`, `logger`, `LOG`, `LOGGER` (any prefix) with a level method | `logger.info(`, `LOG.debug(`, `$this->logger->error(`, `log.warn(`, `Logger::warning(` |
| Python's module-level logging | `logging.info(`, `logging.exception(` |
| Rails | `Rails.logger` |
| PHP | `error_log(`, phpBB-style `$log->add(` and `add_log(` |
| C and Unix | `syslog(`, `fprintf(stderr, …)`, Java's `System.err.print…` |

Level methods: trace, debug, info, notice, warn(ing), error, fatal, critical, alert, emergency, exception, severe, fine, log.

`console.log` and its siblings are **not** logging: in browser code they are debugging output. They are counted and shown separately.

**Logging configuration:**
- committed files named `log4j2.xml`, `logback.xml`, `log4j.properties`, `logging.properties`, `logging.conf`/`.ini`/`.yaml`, `*logging*.conf`, `monolog.yaml`, outside test directories;
- framework settings: `config.log_level`, `config.logger`, `config.log_tags` or `config.log_formatter` in Rails `config/`; `LOGGING =` in a Django settings file; Python `logging.config.dictConfig`/`fileConfig`.

**A framework that logs by default:** `rails`, `django`, `spring-boot-starter*`, `laravel/framework` or `symfony/framework-bundle` in a manifest. These log requests and errors without code in the repository.

**Integrations**, matched on manifest dependency names and on import lines in product source:
- **error reporting:** Sentry (and its older Raven), Bugsnag, Rollbar, Honeybadger, Airbrake;
- **metrics or tracing:** Prometheus clients, Micrometer, StatsD, Dropwizard Metrics, New Relic, Datadog (`ddtrace`), AppSignal, Elastic APM, OpenTelemetry, OpenTracing, Jaeger, Zipkin.

## Proposed Score Ladder

**Logging is present** when logging calls appear in at least **2%** of product source files, or a logging configuration is committed, or a framework logs by default.

| Score | Rule |
|---|---|
| 1 | no logging calls in product code, no logging configuration, no logging framework |
| 2 | some logging calls, in under 2% of product files, without configuration or framework |
| 3 | logging is present |
| 4 | logging is present, plus error reporting **or** metrics/tracing |
| 5 | logging is present, plus error reporting **and** metrics/tracing |

An integration without logging adds 1 to the logging rung it would otherwise get: Sentry on a codebase without logs scores 2, not 4.

**Not measured:**
- no product source files;
- the collector failed;
- the dependency collector did not run. Integrations then count from imports only, and the factor says so as partial coverage.

**Evidence:**
- the logging share, with the top logging call forms;
- configuration files and framework settings, by path;
- the logging framework;
- each integration with its manifest or import path;
- the number of files that use only `console`.

**Partial:** whether logs and reports reach a place someone reads is not visible in the repository. Error handlers that swallow exceptions are not detected.

## Plan and Roadmap Additions

- **Harness requirement `observable-changes`** (factor observability; surfaces `AGENTS.md` and the e2e/smoke layer):
  - **Required (≤ 2):** before agents change run-time behavior, add error logging with context to the modules they will touch, and make the smoke layer fail when the run logs an error.
  - **Recommended (3):** add an error reporter or metrics, so a failure after a change is seen, and write in `AGENTS.md` where logs go.
- **Roadmap step:**
  - from 1 or 2: "add logging to the main code paths and commit its configuration" (M);
  - from 3: "add an error reporter (for example Sentry)" or "add metrics or tracing (for example OpenTelemetry)", whichever is missing (M);
  - from 4: the other one (M).

## What This Would Produce on the Calibration Set (measured with a prototype)

| Repo | Logging calls (product files) | Configuration / framework | Integrations | Score | Verdict |
|---|---|---|---|---|---|
| DOOM | 13 of 144 (9.0%): `fprintf(stderr, …)` | none | none | 3 | prepare first, unchanged |
| moin-1.9 | 78 of 1,217 (6.4%): `logging.*`, `logger.*` | `wikiserverlogging.conf`, `dictConfig` in `MoinMoin/log.py` | none | 3 | adapt, unchanged |
| phpBB | 44 of 1,343 (3.3%): `$phpbb_log->add` | none | none | 3 | adopt, unchanged |
| Struts | 308 of 1,510 (20.4%): `LOG.*` | `log4j2.xml` in two apps; log4j and commons-logging | none | 3 | adopt, unchanged |
| Redmine | 30 of 836 (3.6%): `logger.*`, `Rails.logger` | `config.log_level` in `config/environments/production.rb`; Rails | none | 3 | adapt, unchanged |

None of the five has error reporting, metrics or tracing. That is honest for self-hosted products and a framework library, and the roadmap step names what to add. No verdict changes.

## Open Points

1. **When logging counts as present:**
   - calls in ≥ 2% of product files **or** a configuration **or** a logging framework (proposed);
   - or calls **and** a configuration. phpBB and DOOM would then drop to 2, and phpBB would go from *adopt* to *adapt*.
2. **C's `fprintf(stderr, …)`:** count it as logging, as C programs conventionally do (proposed), or count only `syslog(`. DOOM would drop to 2, with no verdict change: it is *prepare first* either way.
3. **The share threshold:** 2% of product files (proposed), or 5%, which would leave phpBB and Redmine on configuration or framework alone.
4. **`console.*` in JavaScript:** not logging (proposed), or count `console.error` and `console.warn` as logging.

## How I Will Verify

- [ ] Layer 1 (static): `npm run lint`
- [ ] Layer 2 (runtime): `npm run test`, and Layer 2b `npx vitest run src/collectors/observability`:
  - every logging pattern per language, counted, and not counted inside strings and comments;
  - `console` counted separately;
  - every configuration file name and framework setting;
  - integrations from imports, and from manifests through the rule;
  - exclusions (tests, vendored, generated, minified, links);
  - an unchanged-target check;
  - every rung of the ladder and the not-measured cases;
  - the requirement and roadmap step.
- [x] Layer 3 (system): `npm run check`. The five case-study reports are regenerated, and every detected configuration, framework and a sample of 10 logging sites per repository are checked against the clones.

## Dependencies

- [x] Depends on: feat-012 (passing)
- [x] Blocked by: review of these rules (approved 2026-10-23)

## Risks

- **Presence is not quality.** A repository can log everywhere and still hide failures, for example in swallowed exceptions. The ladder measures means, not use.
- **The name lists go stale.** New libraries need adding. They are data in one module, tested per entry.
- **The receiver-name pattern** misses loggers with unusual names, such as `$this->audit->add(`, and can count a variable named `catalog.log(`. Sample checks in the case study will show how often.

## Commit Plan

One commit for feat-013 (collector, rule, config, requirement and roadmap step, report `schemaVersion` 6, CLI, tests, regenerated case study, docs, decision record), then one for the gate's evidence from the clean tree.
