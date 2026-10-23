# Product Overview

## Purpose

ai-codebase-auditor audits a local git repository and decides whether AI coding agents can safely and productively change it. It reads the repository statically, scores a fixed set of readiness factors from 1 to 5 with cited evidence, and returns one verdict: **adopt**, **adapt** or **prepare first**. Most agent tooling assumes a greenfield project with tests, docs and small modules; this tool targets the long-lived systems where those assumptions fail.

Full concept, prior art and research: [concept-and-architecture.md](concept-and-architecture.md).

## Primary Users

- Engineers and tech leads deciding whether to let coding agents work in an existing codebase, and where to start.
- Teams adopting an agent harness (first `ai-harness-framework`) who need to know which harness rules must change for a given repository.

## Key User Flows

- Run `ai-codebase-auditor audit <repo-path>` against a local clone and read the Markdown report: a readiness level, each factor's score with its evidence, and a risk zone per module.
- Feed the JSON report to CI or to an agent, so later sessions start from measured facts instead of guesses.
- Re-run after changes (new tests, smaller files, written conventions) to see which factor moved and whether the verdict changed.

Today `audit` prints the collected signals, a score per factor, the readiness level, the verdict and the risk zones, the harness adaptation plan and the modernization roadmap, and with `--out` writes the Markdown and JSON report. The MVP is calibrated on five public repositories; see [case-study/](case-study/README.md). Version 2 adds the plan and the roadmap.

## Scoring Rules

- Each factor is scored 1 to 5, and every score cites evidence: a file, a count or a command output. No evidence, no score.
- Scores are never averaged. The lowest scored **blocking** factor sets the readiness level; while a blocking factor cannot be measured, the level is reported as provisional and names it.
- Blocking factors: test presence and feedback speed, direct calls (what a call does is visible at the call site, measured as the share of files with reflection, dispatch by name or `eval`). Constraining factors: type strictness, file size and context legibility, module boundary clarity, documented intent, observability, dev and deploy simplicity, dependency and runtime currency. The split lives in `config/factors.json`, so a team can tune it. Type strictness moved from blocking to constraining after calibration (D-013): a well-tested dynamic-language codebase is workable, and a weak type score still produces *adapt*.
- A documented, dated deferral scores one level higher than an undocumented gap, up to 3, and only while its revisit date has not passed.
- Each module gets a risk zone: green (autonomous edits), yellow (only after characterization tests exist), red (auth, billing, permissions: proposals only). Red is decided per path, so a red file inside a green module is still proposals-only.
- The verdict is adopt, adapt or prepare first, by explicit rules over the factor scores; every verdict names its rule and the scores that triggered it.
- The harness adaptation plan and the roadmap follow fixed rules too. Each item names the factor score or zone that triggered it. Harness requirements live in a separate file, so the audit works without the harness.
- Proposed, not yet decided: signals that cannot be verified from repository contents, such as branch protection or CI results, are listed as "not verified" instead of scored.

## Non-Goals

- No changes to the audited repository, ever: no fixes, no generated files written into it, no installs.
- No execution of the audited repository's code, scripts, builds or tests. Audited repositories are untrusted input.
- No LLM-decided verdicts. An LLM may summarize or draft text behind a flag; it never sets a score or a verdict, and LLM steps are skipped, not failed, when turned off.
- Not a full static analyzer: size and complexity come from existing tools (scc, Lizard) instead of new parsers.
- No business-value judgement: the verdict is about technical readiness for agent work, separate from models like TIME or the 6 Rs.
- The plan and the roadmap are advice. They never change a score or a verdict, and the tool never applies them to the audited repository.

## Product Constraints

- TypeScript on Node.js 18 or newer, matching the harness runtime.
- Stack-agnostic in the MVP: only signals every repository has (git history, file size, test presence, docs, dependency manifests). No per-language parsers.
- Output is Markdown plus JSON, deterministic for the same input and configuration.
- Harness requirements live in a separate file, so the audit also works without ai-harness-framework.
- Calibration target: five public repositories (DOOM, moin-1.9, phpBB, Struts, Redmine) must separate as expected; if DOOM and Redmine score alike, the scoring is broken.
