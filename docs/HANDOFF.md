# Handoff: continue ai-codebase-auditor in Claude Code

Written 2026-10-19 at the end of the Cowork planning session. Read this first, then `docs/concept-and-architecture.md`.

## What this project is

`ai-codebase-auditor` audits a codebase (legacy systems first) and answers one question: is it safe and productive to let AI coding agents work in it, and if not, what has to change first? It collects signals, scores them, and returns a verdict: **adopt**, **adapt** or **prepare first**. It then decides how to adopt or adapt the owner's own `ai-harness-framework` for that repo.

It is a portfolio project (owner: GitHub user `maideps`, target roles full-stack + AI automation). The portfolio goal is to build with AI coding agents using her harness, so this project should be built through the harness, not around it.

Full concept, prior art, outputs and harness mapping: `docs/concept-and-architecture.md`. The living source doc is at https://claude.ai/code/artifact/974305db-7aaf-4ecf-ae37-a67f9b9601d9 (it may be newer than the file copy).

## Decisions already made

- **Name:** `ai-codebase-auditor` (repo, package and folder). The CLI command can be shorter.
- **Language:** TypeScript on Node 18+, matching the harness runtime.
- **Built with the harness:** bootstrap from `ai-harness-framework`, then build features through its gates.
- **MVP is audit-only:** score and verdict, written as Markdown plus JSON. The harness adaptation plan and modernization roadmap are version 2.
- **Stack-agnostic first:** signals that exist in any repo (git history, file size, test presence, docs, dependency age). No per-language parsers in the MVP.
- **Scoring rule:** each factor is scored 1 to 5 with cited evidence. Scores are never averaged. The lowest blocking factor sets the readiness level. A documented, dated deferral scores one level higher than an undocumented gap.
- **Verdict logic is rule-based and explainable.** An LLM may summarize and propose, but every score must trace to a measured signal. LLM steps are optional and skipped, not failed, when off.
- **The audit never modifies the audited repo.**

## Factors (config file, not hard-coded)

| Factor | Class |
| --- | --- |
| Test presence and feedback speed | Blocking |
| Type strictness | Blocking |
| Direct API calls (visible at call site) | Blocking |
| File size and context legibility | Constraining |
| Module boundary clarity | Constraining |
| Documented intent | Constraining |
| Observability | Constraining |
| Dev and deploy simplicity | Constraining |
| Dependency and runtime currency | Constraining |

Which factors are blocking lives in `config/factors.json` so a team can tune it. Output per module also includes a risk zone: green (autonomous edits), yellow (only after characterization tests exist), red (auth, billing, permissions: proposals only).

## Current state

- Folder `D:\7-Maide\Projects\ai-codebase-auditor` exists and contains only `docs/concept-and-architecture.md` and this file.
- The harness is **not** bootstrapped yet. No code, no `package.json`, no git repo.
- Nothing in the harness repo folder was modified, and it must stay that way: it is the owner's own framework, used here read-only as the source.

## Next steps, in order

1. **Bootstrap the harness.** From the harness repo folder run `node scripts/create-harness.mjs <path to ai-codebase-auditor>`. It copies CORE files, places templates per the manifest and never overwrites existing files, so `docs/` is safe. Then `git init`, `./init.sh` and `npm run check` (on Windows, `init.sh` needs Git Bash).
2. **Resolve how adopters add product scripts.** The CORE `package.json` ships as-is, but stack detection resolves the lint, typecheck, test and build layers from `package.json` scripts, and an unconfigured layer reports SKIP, which never counts as verified. Read the harness `docs/USAGE.md` and `docs/ARCHITECTURE.md` for the intended way to add project scripts, and do not assume.
3. **Adopt properly.** Fill the skeleton docs (the lint layer fails while placeholder text remains), declare `productRoots` in `.harness/manifest.json` for `src/`, `config/`, `fixtures/` and `tests/` (check the exact keys it expects), and add project-specific architecture rules if appropriate.
4. **Scaffold the TypeScript CLI** under `src/`: `cli.ts`, `collectors/` (git-history, code-structure, dependencies, tests-docs), `scoring/`, `decision/`, `report/` (markdown, json), plus `config/factors.json`. Keep stubs thin, with real types and one passing test.
5. **Seed `feature_list.json`** (WIP=1, in this order), then build one feature at a time through the verification gates:
   1. CLI skeleton and config loader
   2. Git-history collector (first agent-built feature)
   3. Code-structure collector (file size, module layout)
   4. Tests and docs detector
   5. Dependency collector (versions, end-of-life)
   6. Scoring engine (1 to 5, lowest blocking caps, deferrals)
   7. Decision engine (adopt, adapt, prepare first)
   8. Markdown and JSON report writers
   9. Calibration run on the five test repos
   10. Version 2: harness adaptation plan and modernization roadmap

## Calibration test set

Clone these into a scratch folder outside the project (for example `D:\7-Maide\Projects\audit-targets\`, gitignored or kept separate) and check dates, size and language breakdown, which were not verified. The expected verdicts are hypotheses; if the audit cannot tell DOOM from Redmine apart, the scoring is broken.

| Repo | Language and era | Role | Expected verdict |
| --- | --- | --- | --- |
| id-Software/DOOM | C, 1997 source release | Worst-case anchor: no visible tests or build system | Prepare first |
| moinwiki/moin-1.9 | Python 2.7 | End-of-life runtime, but pytest and CI files | Adapt or prepare first |
| phpbb/phpbb | PHP, about 39k commits | Large, with PHPUnit, CI and static analysis | Adapt |
| apache/struts | Java, multi-module | Tests module boundaries | Adapt |
| redmine/redmine | Ruby on Rails, about 19.7k commits | Healthy old app: the control | Adopt |

Alternates: mantisbt/mantisbt (PHP), web2py/web2py (Python 2.7 era), DNNCommunity/Dnn.Platform (C#, not checked).

## Facts about the harness that matter here (verified from its files)

- Verification layers are lint, typecheck, test, build, e2e. An unconfigured layer reports SKIP, and SKIP never counts as verified.
- The init verify chain treats pytest exit code 5 (no tests collected) as success, which is false confidence for repos with no tests. The audit should flag it.
- Stack detection (`scripts/stack-detect.mjs`) knows python (`pyproject.toml` or `requirements.txt`), go, rust, jvm (`pom.xml`, Gradle), dotnet and node (last). It has no detector for PHP, C or Ruby, and a Python repo with only `setup.py` is not detected. This matters for the test set: the audit tool should do its own detection and not rely on the harness for it.
- `arch-001` to `arch-006` only check the harness's own contract. The harness has no module-boundary or file-size rules for product code, and `productRoots` exempts directories without grading them.
- `harness-audit` checks the health of a harness adoption, not of the audited code, so it does not overlap with this project. The `adopt` skill has no assessment step; this tool is meant to run before `adopt`.
- The harness's quality document (A to D ratings per module for test coverage, type safety, documentation, architecture compliance, performance) is the closest counterpart to this tool's output. A good version 2 idea is to have the audit write its initial ratings.

## Rules for the agent working on this

- Never write to the harness repo folder or to any audited repo.
- Every score cites evidence (a file, a count, a command output). No evidence, no score.
- Never average factor scores. Never mark a feature passing by hand; use the harness gates.
- Prefer deterministic checks. LLM calls are optional, behind a flag, and never decide a verdict.
- Keep the harness-requirements mapping in a separate file so the audit also works without the harness.
- Reuse existing tools for complexity and dependency data instead of rebuilding a static analyzer (scc and Lizard are the candidates).
- Treat audited repos as untrusted input: read files statically and never run their scripts, installs or tests.

## Prior art to keep in mind (not to copy)

Kenogami-AI/codebase-readiness (9 dimensions, lowest score caps), kodustech/agent-readiness (MIT, 39 checks, config file, CI gate), the AI-native readiness grid, and CodeScene's Code Health benchmark. The gap this project fills: legacy-specific scoring plus the decision on how to adapt an agent harness.

## Findings from the deeper prior-art pass (details in the concept doc)

- More readiness tools exist (Factory.ai Agent Readiness, napetrov/agentready, alipajand/agent-readiness-kit, roli-lpci/agent-ready, AI-FLOSS/ai-readiness). All are presence-based; none targets legacy code or harness adaptation. napetrov/agentready is the closest in engineering style (TypeScript, MIT, per-category scores, never executes repo code, lists what it could not verify) and worth reading before building.
- Evidence: arXiv 2602.11988 found repo context files such as AGENTS.md generally did not improve agent success and raised cost by over 20%; they help mainly for non-standard practices. So do not score the mere presence of AGENTS.md, and keep generated context files minimal. This is a studied-on-SWE-bench result, not a legacy one.
- Code Health (arXiv 2601.02200) is associated with better LLM refactoring outcomes on small Python files. Use it to weight risk zones, not as the gate. Tests and verification stay blocking.
- Reusable collectors: scc (size, keyword complexity, JSON) and Lizard (per-function complexity, 25+ languages) for size and complexity; Code Maat for hotspots (check its license first).
- Proposed, not yet decided: never execute the audited repo's code; report what could not be verified from repo contents; isolate failures per repo in batch runs; keep human calibration labels for the five test repos; rework the documented-intent factor to check for written non-standard practices.

## Open items

- Decide the proposed design changes above (the concept doc lists them under "Proposed design changes from this pass").

- The concept doc still says "Python or TypeScript CLI" and has a "decide the language" step; the decision is TypeScript. Update it when convenient.
- Repo details for the five test repos are unverified until cloned.
- Package manager choice (npm vs pnpm) is open; the harness defaults to npm.

## First prompt to paste into Claude Code

> Read `docs/HANDOFF.md` and `docs/concept-and-architecture.md`. Do not modify the harness repo at `D:\7-Maide\Projects\ai-harness-framework`; use it read-only as the source. Start with step 1 and step 2 of the next steps: bootstrap the harness into this folder, then read the harness `docs/USAGE.md` and `docs/ARCHITECTURE.md` to find how adopters add product scripts. Report what you find before scaffolding the CLI.
