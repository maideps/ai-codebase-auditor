# AI-readiness audit: struts

| | |
|---|---|
| Target | `D:\7-Maide\Projects\audit-targets\struts` at commit `f2ea51ac3e3c` |
| Audit date | 2026-10-23 |
| Verdict | **adopt** |
| Readiness level | **4 of 5**, set by direct-api-calls |
| Tool | ai-codebase-auditor 0.1.0 |

## Verdict

**adopt**: the harness can be adopted as is.

Rule: no scored factor is weak (all ≥ 3)

Triggered by: test-feedback 5, direct-api-calls 4.

## Factor scores

| Factor | Class | Score | Rule |
|---|---|---|---|
| test-feedback | blocking | 5 | ratio 0.60 ≥ 0.3 with a runner config and CI |
| type-strictness | constraining | 5 | weighted typed share 0.99 |
| direct-api-calls | blocking | 4 | 3.70% of 1515 covered files have a computed-target call (117 sites) |
| file-size | constraining | 4 | lower of p90 246 lines (→ 4) and 0.40% of files over 1000 lines (→ 5) |
| module-boundaries | constraining | – | not measured: no collector signal yet: needs an import graph or co-change coupling |
| documented-intent | constraining | 3 | docs with 34 stated rules |
| observability | constraining | – | not measured: no collector signal yet: needs a logging and metrics detector |
| dev-deploy-simplicity | constraining | 4 | 3 of 4 signals: CI configured, test runner configured, runtime version declared |
| dependency-currency | constraining | 5 | every runtime is supported past 12 months |

Scores are never averaged; the lowest scored blocking factor sets the readiness level.

### test-feedback: Test presence and feedback speed

Score **5** (blocking). Rule: ratio 0.60 ≥ 0.3 with a runner config and CI.

Evidence:

- 911 test files for 1518 source files: ratio 0.60
- test runner configs: apps/rest-showcase/pom.xml, apps/showcase/pom.xml, core/pom.xml, plugins/async/pom.xml, plugins/bean-validation/pom.xml, plugins/cdi/pom.xml, plugins/convention/pom.xml, plugins/jasperreports/pom.xml, plugins/jasperreports7/pom.xml, plugins/javatemplates/pom.xml, plugins/jfreechart/pom.xml, plugins/json/pom.xml, plugins/junit/pom.xml, plugins/rest/pom.xml, plugins/spring/pom.xml, plugins/testng/pom.xml, plugins/tiles/pom.xml, plugins/velocity/pom.xml, plugins/xslt/pom.xml, pom.xml
- CI: .github/workflows/codeql.yml, .github/workflows/maven.yml, .github/workflows/owasp.yml, .github/workflows/scorecards-analysis.yaml, .github/workflows/sonar.yml, Jenkinsfile

Partial: feedback speed is not measured: the audit never runs tests.

### type-strictness: Type strictness

Score **5** (constraining). Rule: weighted typed share 0.99.

Evidence:

- typed share 0.99 of 181946 source lines (strong 180624, weak 0, checked dynamic 0, unchecked dynamic 1322)
- type checkers: none

### direct-api-calls: Direct calls (visible at call site)

Score **4** (blocking). Rule: 3.70% of 1515 covered files have a computed-target call (117 sites).

Evidence:

- 56 of 1515 covered product files (3.70%) have computed-target calls: 117 sites
- by construct: Class.forName by name 54, Method.invoke 28, getMethod by name 27, setAccessible 7, Proxy 1
- top files: core/src/main/java/org/apache/struts2/util/finder/ResourceFinder.java (10), plugins/json/src/main/java/org/apache/struts2/json/StrutsJSONWriter.java (8), plugins/rest/src/main/java/org/apache/struts2/rest/ContentTypeInterceptor.java (7), plugins/rest/src/main/java/org/apache/struts2/rest/handler/JuneauXmlHandler.java (7), core/src/main/java/org/apache/struts2/config/providers/XmlDocConfigurationProvider.java (4)
- sample sites: core/src/main/java/org/apache/struts2/util/finder/ResourceFinder.java:377 Class.forName by name, plugins/json/src/main/java/org/apache/struts2/json/StrutsJSONWriter.java:346 Method.invoke, plugins/rest/src/main/java/org/apache/struts2/rest/ContentTypeInterceptor.java:238 Method.invoke, plugins/rest/src/main/java/org/apache/struts2/rest/handler/JuneauXmlHandler.java:123 Method.invoke, core/src/main/java/org/apache/struts2/config/providers/XmlDocConfigurationProvider.java:153 Class.forName by name, core/src/main/java/org/apache/struts2/dispatcher/Dispatcher.java:590 Class.forName by name, core/src/main/java/org/apache/struts2/inject/ContainerImpl.java:188 setAccessible, core/src/main/java/org/apache/struts2/util/ClassLoaderUtil.java:176 Class.forName by name, core/src/main/java/org/apache/struts2/util/fs/JBossFileManager.java:180 Method.invoke, core/src/main/java/org/apache/struts2/ognl/OgnlValueStackFactory.java:118 Class.forName by name
- covered languages hold 99.92% of 181946 source lines

Partial: configuration-wired dispatch (dependency injection, XML mappings, callbacks by symbol, annotations) is not detected; not covered: shell (0.08% of source lines).

### file-size: File size and context legibility

Score **4** (constraining). Rule: lower of p90 246 lines (→ 4) and 0.40% of files over 1000 lines (→ 5).

Evidence:

- 1518 source files: p90 246 lines, 6 over 1000 lines (0.40%)
- largest: core/src/main/java/org/apache/struts2/components/UIBean.java (1552 lines), core/src/main/java/org/apache/struts2/config/entities/ConstantConfig.java (1445 lines), core/src/main/java/org/apache/struts2/util/finder/ResourceFinder.java (1404 lines), core/src/main/java/org/apache/struts2/dispatcher/Dispatcher.java (1260 lines), plugins/convention/src/main/java/org/apache/struts2/convention/PackageBasedActionConfigBuilder.java (1255 lines)

### module-boundaries: Module boundary clarity

Not measured (constraining): no collector signal yet: needs an import graph or co-change coupling.

### documented-intent: Documented intent

Score **3** (constraining). Rule: docs with 34 stated rules.

Evidence:

- README: README.md; contributing: CONTRIBUTING.md; architecture: none; decision records: 0; conventions: docs/superpowers/plans/2026-07-20-WW-5620-log4j2-logging-standardization.md, docs/superpowers/plans/2026-10-14-WW-5770-scoped-convention-result-path.md, thoughts/shared/research/2025-12-02-WW-5593-convention-plugin-noclass-exception.md
- stated rules: 34 in 6 files
- agent context files (presence alone scores nothing): AGENTS.md, CLAUDE.md

### observability: Observability

Not measured (constraining): no collector signal yet: needs a logging and metrics detector.

### dev-deploy-simplicity: Dev and deploy simplicity

Score **4** (constraining). Rule: 3 of 4 signals: CI configured, test runner configured, runtime version declared.

Evidence:

- CI: .github/workflows/codeql.yml, .github/workflows/maven.yml, .github/workflows/owasp.yml, .github/workflows/scorecards-analysis.yaml, .github/workflows/sonar.yml, Jenkinsfile
- test runner configs: apps/rest-showcase/pom.xml, apps/showcase/pom.xml, core/pom.xml, plugins/async/pom.xml, plugins/bean-validation/pom.xml, plugins/cdi/pom.xml, plugins/convention/pom.xml, plugins/jasperreports/pom.xml, plugins/jasperreports7/pom.xml, plugins/javatemplates/pom.xml, plugins/jfreechart/pom.xml, plugins/json/pom.xml, plugins/junit/pom.xml, plugins/rest/pom.xml, plugins/spring/pom.xml, plugins/testng/pom.xml, plugins/tiles/pom.xml, plugins/velocity/pom.xml, plugins/xslt/pom.xml, pom.xml
- declared runtimes: java 17 (pom.xml)
- lock files: none

Partial: build scripts and containers are not detected yet.

### dependency-currency: Dependency and runtime currency

Score **5** (constraining). Rule: every runtime is supported past 12 months.

Evidence:

- java 17 (pom.xml, maven.compiler.release): cycle 17 supported until 2027-10-31

Partial: package versions are not checked for age or vulnerabilities.

## Risk zones

Green: agents may edit. Yellow: add characterization tests first. Red: agents may only propose changes.

| Zone | Module | Source files | Red files | Reason |
|---|---|---|---|---|
| green | `.claude` | 2 | 0 | test-feedback 5 ≥ 3 and files are legible (p90 103 lines, 0% over 1000 lines) |
| green | `apps` | 127 | 3 | test-feedback 5 ≥ 3 and files are legible (p90 117 lines, 0% over 1000 lines) |
| green | `core/src/main` | 797 | 5 | test-feedback 5 ≥ 3 and files are legible (p90 291 lines, 0.6% over 1000 lines) |
| green | `plugins` | 592 | 5 | test-feedback 5 ≥ 3 and files are legible (p90 211 lines, 0.2% over 1000 lines) |

Red paths:

- `apps/showcase/src/main/java/org/apache/struts2/showcase/chat/ChatAuthenticationInterceptor.java` (authentication)
- `apps/showcase/src/main/java/org/apache/struts2/showcase/chat/ChatLoginAction.java` (login)
- `apps/showcase/src/main/java/org/apache/struts2/showcase/chat/ChatLogoutAction.java` (logout)
- `core/src/main/java/org/apache/struts2/components/Password.java` (password)
- `core/src/main/java/org/apache/struts2/interceptor/RolesInterceptor.java` (roles)
- `core/src/main/java/org/apache/struts2/interceptor/parameter/ParameterAuthorizationContext.java` (authorization)
- `core/src/main/java/org/apache/struts2/views/freemarker/tags/PasswordModel.java` (password)
- `core/src/main/java/org/apache/struts2/views/jsp/ui/PasswordTag.java` (password)
- `plugins/javatemplates/src/main/java/org/apache/struts2/views/java/simple/PasswordHandler.java` (password)
- `plugins/rest/src/main/java/org/apache/struts2/rest/handler/AuthorizationAwareContentTypeHandler.java` (authorization)
- `plugins/rest/src/main/java/org/apache/struts2/rest/handler/jackson/DynamicKeyAuthorizationContext.java` (authorization)
- `plugins/rest/src/main/java/org/apache/struts2/rest/handler/xstream/XStreamPermissionProvider.java` (permission)
- `plugins/velocity/src/main/java/org/apache/struts2/views/velocity/components/PasswordDirective.java` (password)

Not zoned (no source files): (root), .github, .mvn, assembly, bom, docs, jakarta, parent, src, thoughts.

## Harness adaptation plan

For ai-harness-framework 0.5.0 (commit `7fb142a`). Adopt the harness as is, with the guardrails and recommendations below.

| Level | Item | Trigger | Surfaces |
|---|---|---|---|
| required | red-paths | red zone: 13 paths | AGENTS.md, .claude/settings.json |
| recommended | written-intent | documented-intent 3 | AGENTS.md, docs/ARCHITECTURE.md |

### required: red-paths

Trigger: red zone: 13 paths. Surfaces: `AGENTS.md`, `.claude/settings.json`.

Change: List these paths as proposal-only in AGENTS.md, and add Claude Code permissions.deny rules so agents cannot edit them directly; agents propose diffs for a person to apply.

Why: Auth, billing, permission and secret code needs human review of every change.

- apps/showcase/src/main/java/org/apache/struts2/showcase/chat/ChatAuthenticationInterceptor.java (authentication): deny Edit(apps/showcase/src/main/java/org/apache/struts2/showcase/chat/ChatAuthenticationInterceptor.java), Write(apps/showcase/src/main/java/org/apache/struts2/showcase/chat/ChatAuthenticationInterceptor.java)
- apps/showcase/src/main/java/org/apache/struts2/showcase/chat/ChatLoginAction.java (login): deny Edit(apps/showcase/src/main/java/org/apache/struts2/showcase/chat/ChatLoginAction.java), Write(apps/showcase/src/main/java/org/apache/struts2/showcase/chat/ChatLoginAction.java)
- apps/showcase/src/main/java/org/apache/struts2/showcase/chat/ChatLogoutAction.java (logout): deny Edit(apps/showcase/src/main/java/org/apache/struts2/showcase/chat/ChatLogoutAction.java), Write(apps/showcase/src/main/java/org/apache/struts2/showcase/chat/ChatLogoutAction.java)
- core/src/main/java/org/apache/struts2/components/Password.java (password): deny Edit(core/src/main/java/org/apache/struts2/components/Password.java), Write(core/src/main/java/org/apache/struts2/components/Password.java)
- core/src/main/java/org/apache/struts2/interceptor/RolesInterceptor.java (roles): deny Edit(core/src/main/java/org/apache/struts2/interceptor/RolesInterceptor.java), Write(core/src/main/java/org/apache/struts2/interceptor/RolesInterceptor.java)
- core/src/main/java/org/apache/struts2/interceptor/parameter/ParameterAuthorizationContext.java (authorization): deny Edit(core/src/main/java/org/apache/struts2/interceptor/parameter/ParameterAuthorizationContext.java), Write(core/src/main/java/org/apache/struts2/interceptor/parameter/ParameterAuthorizationContext.java)
- core/src/main/java/org/apache/struts2/views/freemarker/tags/PasswordModel.java (password): deny Edit(core/src/main/java/org/apache/struts2/views/freemarker/tags/PasswordModel.java), Write(core/src/main/java/org/apache/struts2/views/freemarker/tags/PasswordModel.java)
- core/src/main/java/org/apache/struts2/views/jsp/ui/PasswordTag.java (password): deny Edit(core/src/main/java/org/apache/struts2/views/jsp/ui/PasswordTag.java), Write(core/src/main/java/org/apache/struts2/views/jsp/ui/PasswordTag.java)
- plugins/javatemplates/src/main/java/org/apache/struts2/views/java/simple/PasswordHandler.java (password): deny Edit(plugins/javatemplates/src/main/java/org/apache/struts2/views/java/simple/PasswordHandler.java), Write(plugins/javatemplates/src/main/java/org/apache/struts2/views/java/simple/PasswordHandler.java)
- plugins/rest/src/main/java/org/apache/struts2/rest/handler/AuthorizationAwareContentTypeHandler.java (authorization): deny Edit(plugins/rest/src/main/java/org/apache/struts2/rest/handler/AuthorizationAwareContentTypeHandler.java), Write(plugins/rest/src/main/java/org/apache/struts2/rest/handler/AuthorizationAwareContentTypeHandler.java)
- plugins/rest/src/main/java/org/apache/struts2/rest/handler/jackson/DynamicKeyAuthorizationContext.java (authorization): deny Edit(plugins/rest/src/main/java/org/apache/struts2/rest/handler/jackson/DynamicKeyAuthorizationContext.java), Write(plugins/rest/src/main/java/org/apache/struts2/rest/handler/jackson/DynamicKeyAuthorizationContext.java)
- plugins/rest/src/main/java/org/apache/struts2/rest/handler/xstream/XStreamPermissionProvider.java (permission): deny Edit(plugins/rest/src/main/java/org/apache/struts2/rest/handler/xstream/XStreamPermissionProvider.java), Write(plugins/rest/src/main/java/org/apache/struts2/rest/handler/xstream/XStreamPermissionProvider.java)
- plugins/velocity/src/main/java/org/apache/struts2/views/velocity/components/PasswordDirective.java (password): deny Edit(plugins/velocity/src/main/java/org/apache/struts2/views/velocity/components/PasswordDirective.java), Write(plugins/velocity/src/main/java/org/apache/struts2/views/velocity/components/PasswordDirective.java)

### recommended: written-intent

Trigger: documented-intent 3. Surfaces: `AGENTS.md`, `docs/ARCHITECTURE.md`.

Change: Add the non-standard practices that are still unwritten to AGENTS.md, and record significant decisions in DECISIONS.md.

Why: Agents follow written rules; unwritten local conventions are exactly what they get wrong (arXiv 2602.11988).

- README: README.md; contributing: CONTRIBUTING.md; architecture: none; decision records: 0; conventions: docs/superpowers/plans/2026-07-20-WW-5620-log4j2-logging-standardization.md, docs/superpowers/plans/2026-10-14-WW-5770-scoped-convention-result-path.md, thoughts/shared/research/2025-12-02-WW-5593-convention-plugin-noclass-exception.md
- stated rules: 34 in 6 files
- agent context files (presence alone scores nothing): AGENTS.md, CLAUDE.md

## Modernization roadmap

Ordered by priority: score gain (plus 1 when a weak factor leaves weak) × 2 for blocking factors ÷ effort (S 1, M 2, L 3).

| # | Factor | Score | Effort | Priority | Step | Verdict after |
|---|---|---|---|---|---|---|
| 1 | direct-api-calls | 4 → 5 | L | 0.67 | make the computed-target calls explicit in 26 of 56 files (to 2% of files), starting with core/src/main/java/org/apache/struts2/util/finder/ResourceFinder.java (10), plugins/json/src/main/java/org/apache/struts2/json/StrutsJSONWriter.java (8), plugins/rest/src/main/java/org/apache/struts2/rest/ContentTypeInterceptor.java (7) | unchanged |
| 2 | documented-intent | 3 → 4 | M | 0.5 | add an architecture doc or decision records | unchanged |
| 3 | file-size | 4 → 5 | L | 0.33 | bring the p90 file length from 246 to 200 lines | unchanged |

## Not measured

- factor `module-boundaries`: no collector signal yet: needs an import graph or co-change coupling
- factor `observability`: no collector signal yet: needs a logging and metrics detector
- tool `scc`: scc is not installed or not on PATH

## Signals

### Git history

7461 non-merge commits (428 in the 12 months to 2026-10-23), 149 authors, first 2006-02-22, last 2026-10-22, 3848 tracked files.

Hotspots (most commits in the last 12 months):

| File | Commits (12 months) | Commits | Authors | Last commit |
|---|---|---|---|---|
| `pom.xml` | 108 | 1060 | 45 | 2026-10-22 |
| `.github/workflows/codeql.yml` | 44 | 85 | 3 | 2026-10-22 |
| `.github/workflows/scorecards-analysis.yaml` | 38 | 106 | 4 | 2026-10-22 |
| `parent/pom.xml` | 36 | 64 | 3 | 2026-10-22 |
| `core/src/main/java/org/apache/struts2/StrutsConstants.java` | 18 | 176 | 20 | 2026-10-11 |
| `.github/dependabot.yml` | 17 | 20 | 1 | 2026-10-16 |
| `apps/showcase/pom.xml` | 16 | 414 | 23 | 2026-10-22 |
| `core/src/main/resources/org/apache/struts2/default.properties` | 15 | 106 | 16 | 2026-10-11 |
| `.github/workflows/maven.yml` | 13 | 35 | 5 | 2026-10-15 |
| `core/src/main/resources/struts-beans.xml` | 13 | 35 | 3 | 2026-10-12 |

### Code structure

3777 files, 453814 lines; per file p50 60, p90 282, p99 977, max 2226. Excluded: binary 71. scc: not used (scc is not installed or not on PATH).

Largest files:

| File | Lines |
|---|---|
| `core/src/test/java/org/apache/struts2/views/jsp/ui/FormTagTest.java` | 2226 |
| `core/src/test/java/org/apache/struts2/views/jsp/URLTagTest.java` | 2178 |
| `core/src/test/java/org/apache/struts2/ognl/OgnlUtilTest.java` | 1909 |
| `docs/superpowers/plans/2026-08-24-html5-constraint-validation.md` | 1828 |
| `plugins/rest/src/test/java/org/apache/struts2/rest/handler/jackson/ParameterAuthorizingModuleTest.java` | 1800 |
| `core/src/test/java/org/apache/struts2/views/jsp/AnchorTagTest.java` | 1699 |
| `core/src/main/java/org/apache/struts2/components/UIBean.java` | 1552 |
| `core/src/test/java/org/apache/struts2/views/jsp/ui/SelectTest.java` | 1471 |
| `core/src/main/java/org/apache/struts2/config/entities/ConstantConfig.java` | 1445 |
| `core/src/test/java/org/apache/struts2/interceptor/parameter/ParametersInterceptorTest.java` | 1440 |

### Tests and docs

- Test files: 911 (`*Test.java / *Tests.java / *IT.java` 609, `test directory` 302)
- Test runner configs: Maven (`apps/rest-showcase/pom.xml`), Maven (`apps/showcase/pom.xml`), Maven (`core/pom.xml`), Maven (`plugins/async/pom.xml`), Maven (`plugins/bean-validation/pom.xml`), Maven (`plugins/cdi/pom.xml`), Maven (`plugins/convention/pom.xml`), Maven (`plugins/jasperreports/pom.xml`), Maven (`plugins/jasperreports7/pom.xml`), Maven (`plugins/javatemplates/pom.xml`), Maven (`plugins/jfreechart/pom.xml`), Maven (`plugins/json/pom.xml`), Maven (`plugins/junit/pom.xml`), Maven (`plugins/rest/pom.xml`), Maven (`plugins/spring/pom.xml`), Maven (`plugins/testng/pom.xml`), Maven (`plugins/tiles/pom.xml`), Maven (`plugins/velocity/pom.xml`), Maven (`plugins/xslt/pom.xml`), Maven (`pom.xml`)
- CI: GitHub Actions (`.github/workflows/codeql.yml`), GitHub Actions (`.github/workflows/maven.yml`), GitHub Actions (`.github/workflows/owasp.yml`), GitHub Actions (`.github/workflows/scorecards-analysis.yaml`), GitHub Actions (`.github/workflows/sonar.yml`), Jenkins (`Jenkinsfile`)
- Type checkers: none
- README: README.md; contributing: CONTRIBUTING.md; architecture: none; decision records: 0; conventions: docs/superpowers/plans/2026-07-20-WW-5620-log4j2-logging-standardization.md, docs/superpowers/plans/2026-10-14-WW-5770-scoped-convention-result-path.md, thoughts/shared/research/2025-12-02-WW-5593-convention-plugin-noclass-exception.md
- Agent context files (presence alone scores nothing): AGENTS.md, CLAUDE.md
- Stated rules: 34

| File | Line | Rule |
|---|---|---|
| `AGENTS.md` | 17 | [`THREAT_MODEL.md`](THREAT_MODEL.md) (scope, trust boundaries, in-model security properties, and the known-non-findings list). If the answers do not still |
| `AGENTS.md` | 18 | point to a likely new framework vulnerability, stop and explain — do not draft a new report. |
| `AGENTS.md` | 22 | Do not open a public GitHub issue, Jira issue, pull request, mailing list thread, or discussion for a suspected vulnerability before private triage. |
| `AGENTS.md` | 26 | **Never submit a pull request that fixes a suspected vulnerability.** Before opening any PR, verify the change is not a security patch — OGNL injection, |
| `AGENTS.md` | 30 | Do not speculate beyond what can be demonstrated. If severity is uncertain, say so explicitly. |
| `AGENTS.md` | 31 | If the issue turns out to be application misconfiguration, an already-disclosed CVE, or a non-Struts problem, stop and explain — do not draft a new report. |
| `CLAUDE.md` | 47 | Read it first and follow its pre-reporting checks, assessment checklist, and reporting requirements. Reports must be sent privately to |
| `CLAUDE.md` | 48 | `security@struts.apache.org`; do not open a public GitHub issue, Jira issue, pull request, or mailing list thread for a suspected vulnerability before private |
| `CLAUDE.md` | 60 | Methods must be named `testXxx()`. A Jupiter `@Test` annotation added to one of these **silently |
| `CLAUDE.md` | 61 | never runs** — it does not fail, it is simply not collected. |
| `CLAUDE.md` | 69 | that needs its own `WW-` ticket, never a side effect of a feature. |
| `CLAUDE.md` | 73 | **Title format**: `WW-XXXX Description` — a Jira ticket ID is required for any code change. |
| `CLAUDE.md` | 79 | **Never submit a PR that fixes a suspected vulnerability.** Before opening a PR, verify the change is not a security patch (OGNL injection, parameter |
| `CONTRIBUTING.md` | 11 | Unless required by applicable law or agreed to in writing, software |
| `CONTRIBUTING.md` | 22 | request. You do not need to be a committer to contribute — anyone can open a PR. |
| `CONTRIBUTING.md` | 82 | request must reference a `WW-XXXX` ticket ID. |
| `CONTRIBUTING.md` | 94 | **Title format:** `WW-XXXX Description` (the JIRA ticket ID is required). |
| `CONTRIBUTING.md` | 97 | Continuous integration must pass, and reviewers expect code changes to come |
| `CONTRIBUTING.md` | 102 | **Do not** open a public GitHub issue, JIRA issue, pull request, or |
| `CONTRIBUTING.md` | 112 | Every new source file must include the standard ASF license header (see any |
| `docs/superpowers/plans/2026-07-20-WW-5620-log4j2-logging-standardization.md` | 3 | **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`)… |
| `docs/superpowers/plans/2026-07-20-WW-5620-log4j2-logging-standardization.md` | 13 | Fix version: 7.3.0. Target ticket: WW-5620. Every commit message MUST be prefixed `WW-5620`. |
| `docs/superpowers/plans/2026-07-20-WW-5620-log4j2-logging-standardization.md` | 16 | Do NOT touch the runtime bridges `log4j-jcl`, `log4j-slf4j-impl`, or `commons-logging` — they route third-party logging and are out of scope. |
| `docs/superpowers/plans/2026-07-20-WW-5620-log4j2-logging-standardization.md` | 256 | Consumes: Tasks 1–3 must be done first (no first-party source uses SLF4J anymore). |
| `docs/superpowers/plans/2026-07-20-WW-5620-log4j2-logging-standardization.md` | 320 | If any test fails because it silently relied on `slf4j-simple` as a test logging backend, STOP and report — do not add unrelated logging config to force a pass. |
| `docs/superpowers/plans/2026-10-14-WW-5770-scoped-convention-result-path.md` | 3 | **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`)… |
| `docs/superpowers/plans/2026-10-14-WW-5770-scoped-convention-result-path.md` | 21 | Tests are JUnit 3 or 4 — never Jupiter. Match the target file's style; an `@Test` in a `TestCase` subclass never runs. |
| `docs/superpowers/plans/2026-10-14-WW-5770-scoped-convention-result-path.md` | 22 | `ScopedConstantProvider` must stay a functional interface (23 test sites stub it as `name -> ...`). |
| `docs/superpowers/plans/2026-10-14-WW-5770-scoped-convention-result-path.md` | 28 | Stage explicit paths only — never `git add -A`, never `git stash`. |
| `docs/superpowers/plans/2026-10-14-WW-5770-scoped-convention-result-path.md` | 33 | **Override without a trailing slash** (`/WEB-INF/admin`) — must behave like the global constant does: a slash is |
| `docs/superpowers/plans/2026-10-14-WW-5770-scoped-convention-result-path.md` | 35 | **Empty override** (`value=""`) — must be used as-is, not fall back to the global path. Pinned in Task 2. |
| `docs/superpowers/plans/2026-10-14-WW-5770-scoped-convention-result-path.md` | 36 | **Package-level `@ResultPath` (`package-info.java`)** — must beat the scoped value just as the class-level one |
| `thoughts/shared/research/2025-12-02-WW-5593-convention-plugin-noclass-exception.md` | 283 | ❌ Users must add workarounds to proceed |
| `thoughts/shared/research/2025-12-02-WW-5593-convention-plugin-noclass-exception.md` | 364 | **Option 3**: Don't use `struts.convention.action.includeJars` if not needed |

### Dependencies

| Manifest | Ecosystem | Dependencies | Issues |
|---|---|---|---|
| `apps/pom.xml` | maven | 2 | inherits from a parent POM (org.apache.struts:struts2-parent); inherited dependencies and properties are not resolved |
| `apps/rest-showcase/pom.xml` | maven | 15 | inherits from a parent POM (org.apache.struts:struts2-apps); inherited dependencies and properties are not resolved |
| `apps/showcase/pom.xml` | maven | 26 | inherits from a parent POM (org.apache.struts:struts2-apps); inherited dependencies and properties are not resolved, unresolved property ${hibernate-validator.version}, unresolved property ${webjars-jquery-showcase.version} |
| `assembly/pom.xml` | maven | 15 | inherits from a parent POM (org.apache.struts:struts2-parent); inherited dependencies and properties are not resolved |
| `bom/pom.xml` | maven | 22 | inherits from a parent POM (org.apache.struts:struts2-project); inherited dependencies and properties are not resolved, unresolved property ${project.version} |
| `core/pom.xml` | maven | 31 | inherits from a parent POM (org.apache.struts:struts2-parent); inherited dependencies and properties are not resolved |
| `jakarta/pom.xml` | maven | 0 | inherits from a parent POM (org.apache.struts:struts2-parent); inherited dependencies and properties are not resolved |
| `jakarta/velocity-tools-jsp-jakarta/pom.xml` | maven | 1 | inherits from a parent POM (org.apache.struts:struts2-jakarta); inherited dependencies and properties are not resolved |
| `jakarta/velocity-tools-view-jakarta/pom.xml` | maven | 0 | inherits from a parent POM (org.apache.struts:struts2-jakarta); inherited dependencies and properties are not resolved |
| `parent/pom.xml` | maven | 44 | inherits from a parent POM (org.apache.struts:struts2-bom); inherited dependencies and properties are not resolved, unresolved property ${struts-annotations.version}, unresolved property ${freemarker.version}, unresolved property ${webjars-locator-lite.version}, unresolved property ${webjars-jquery.version}, unresolved property ${webjars-bootstrap.version}, unresolved property ${webjars-bootstrap-icons.version}, unresolved property ${velocity-tools.version}, unresolved property ${project.version}, unresolved property ${ognl.version}, unresolved property ${asm.version}, unresolved property ${jakarta-ee.version}, unresolved property ${jaxb-impl.version}, unresolved property ${commons-fileupload2.version}, unresolved property ${spring.version}, unresolved property ${mockito.version}, unresolved property ${byte-buddy.version}, unresolved property ${log4j2.version}, unresolved property ${jackson.version} |
| `plugins/async/pom.xml` | maven | 2 | inherits from a parent POM (org.apache.struts:struts2-plugins); inherited dependencies and properties are not resolved |
| `plugins/bean-validation/pom.xml` | maven | 7 | inherits from a parent POM (org.apache.struts:struts2-plugins); inherited dependencies and properties are not resolved, unresolved property ${hibernate-validator.version} |
| `plugins/cdi/pom.xml` | maven | 7 | inherits from a parent POM (org.apache.struts:struts2-plugins); inherited dependencies and properties are not resolved, unresolved property ${weld.version} |
| `plugins/config-browser/pom.xml` | maven | 1 | inherits from a parent POM (org.apache.struts:struts2-plugins); inherited dependencies and properties are not resolved |
| `plugins/convention/pom.xml` | maven | 6 | inherits from a parent POM (org.apache.struts:struts2-plugins); inherited dependencies and properties are not resolved |
| `plugins/jasperreports/pom.xml` | maven | 4 | inherits from a parent POM (org.apache.struts:struts2-plugins); inherited dependencies and properties are not resolved |
| `plugins/jasperreports7/pom.xml` | maven | 7 | inherits from a parent POM (org.apache.struts:struts2-plugins); inherited dependencies and properties are not resolved |
| `plugins/javatemplates/pom.xml` | maven | 1 | inherits from a parent POM (org.apache.struts:struts2-plugins); inherited dependencies and properties are not resolved |
| `plugins/jfreechart/pom.xml` | maven | 4 | inherits from a parent POM (org.apache.struts:struts2-plugins); inherited dependencies and properties are not resolved |
| `plugins/json/pom.xml` | maven | 4 | inherits from a parent POM (org.apache.struts:struts2-plugins); inherited dependencies and properties are not resolved |
| `plugins/junit/pom.xml` | maven | 6 | inherits from a parent POM (org.apache.struts:struts2-plugins); inherited dependencies and properties are not resolved |
| `plugins/pom.xml` | maven | 7 | inherits from a parent POM (org.apache.struts:struts2-parent); inherited dependencies and properties are not resolved |
| `plugins/rest/pom.xml` | maven | 10 | inherits from a parent POM (org.apache.struts:struts2-plugins); inherited dependencies and properties are not resolved |
| `plugins/spring/pom.xml` | maven | 10 | inherits from a parent POM (org.apache.struts:struts2-plugins); inherited dependencies and properties are not resolved |
| `plugins/testng/pom.xml` | maven | 3 | inherits from a parent POM (org.apache.struts:struts2-plugins); inherited dependencies and properties are not resolved |
| `plugins/tiles/pom.xml` | maven | 10 | inherits from a parent POM (org.apache.struts:struts2-plugins); inherited dependencies and properties are not resolved |
| `plugins/velocity/pom.xml` | maven | 5 | inherits from a parent POM (org.apache.struts:struts2-plugins); inherited dependencies and properties are not resolved |
| `plugins/xslt/pom.xml` | maven | 3 | inherits from a parent POM (org.apache.struts:struts2-plugins); inherited dependencies and properties are not resolved |
| `pom.xml` | maven | 2 | inherits from a parent POM (org.apache.struts:struts-master); inherited dependencies and properties are not resolved |

| Runtime | Spec | Declared in | Cycle | Status | End of life |
|---|---|---|---|---|---|
| java | 17 | `pom.xml` (maven.compiler.release) | 17 | supported | 2027-10-31 |

### Dynamic calls

2426 covered files read, tests included; 73 with computed-target calls, 181 sites. Skipped: minified 1.

| Language | Files | With sites | Sites |
|---|---|---|---|
| java | 2418 | 73 | 181 |
| javascript | 8 | 0 | 0 |

| Construct | Sites |
|---|---|
| Class.forName by name | 61 |
| getMethod by name | 53 |
| Method.invoke | 36 |
| setAccessible | 26 |
| Proxy | 5 |

Files with the most sites:

| File | Sites | Constructs |
|---|---|---|
| `core/src/test/java/org/apache/struts2/ognl/SecurityMemberAccessTest.java` | 25 | getMethod by name, Proxy, Method.invoke |
| `core/src/main/java/org/apache/struts2/util/finder/ResourceFinder.java` | 10 | Class.forName by name |
| `core/src/test/java/org/apache/struts2/dispatcher/DispatcherCleanupTest.java` | 8 | setAccessible, getMethod by name |
| `core/src/test/java/org/apache/struts2/dispatcher/multipart/JakartaStreamMultiPartRequestTest.java` | 8 | setAccessible, Method.invoke |
| `plugins/json/src/main/java/org/apache/struts2/json/StrutsJSONWriter.java` | 8 | Method.invoke, Class.forName by name, getMethod by name |
| `plugins/rest/src/main/java/org/apache/struts2/rest/ContentTypeInterceptor.java` | 7 | Method.invoke |
| `plugins/rest/src/main/java/org/apache/struts2/rest/handler/JuneauXmlHandler.java` | 7 | Method.invoke |
| `core/src/test/java/org/apache/struts2/util/ConfigParseUtilTest.java` | 5 | Class.forName by name, setAccessible, getMethod by name |
| `core/src/main/java/org/apache/struts2/config/providers/XmlDocConfigurationProvider.java` | 4 | Class.forName by name |
| `core/src/main/java/org/apache/struts2/dispatcher/Dispatcher.java` | 4 | Class.forName by name |

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
- files are those tracked at HEAD; content is read from the working tree; nothing is run
- covered languages: Python, PHP, Ruby, Java, JavaScript and TypeScript
- comments are removed and strings replaced before matching, so text inside strings never counts
- only calls whose target is computed count; a literal target is visible at the call site
- vendored and generated paths are skipped, and so are minified files (a line over 1000 characters)
- configuration-wired dispatch (dependency injection, XML mappings, callbacks by symbol, annotations) is not detected
