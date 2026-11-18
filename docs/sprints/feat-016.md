# Sprint Contract

**Feature ID:** feat-016
**Feature Name:** Read-only MCP server over a saved report
**Date:** 2026-11-18
**Estimated Duration:** 1 session
**Status:** decided without a review round. The user asked for the remaining features to be built without stopping for review (2026-11-18), so each open point below was settled as recommended and recorded in D-021.

## What the Feature Means

An agent working in an audited repository should be able to ask, before editing a file, whether the file is green, yellow or red, and why. The audit already has those answers in the saved JSON report. The server reads only that report: it never audits again, never reads the audited repository and never runs anything. So it is as safe as reading the report itself.

## Decisions

1. **Protocol without a dependency:** the product has no runtime dependencies. MCP over stdio is JSON-RPC 2.0, one message per line, and the server needs only `initialize`, `ping`, `tools/list`, `tools/call` and the `notifications/initialized` notification. It is implemented directly in `src/mcp/`, which keeps the package dependency-free and the code auditable. Supported protocol versions: 2025-06-18, 2025-03-26 and 2024-11-05. The server answers with the client's version when it supports it, and otherwise with 2025-06-18.
2. **Tools:**
   - `get_verdict`: the verdict, its rule and triggers, readiness, audit date and commit;
   - `get_factor` (`id`): one factor's score, rule and evidence;
   - `get_zone` (`path`): a path's zone and reason. A red path wins over a yellow path, which wins over the module's zone;
   - `list_red_paths`, `list_yellow_paths`;
   - `get_roadmap`.
3. **Which reports:** the `ai-codebase-auditor/report` schema at `schemaVersion` 7 only. Anything else is refused at startup with exit code 2, naming the version found.
4. **Paths not zoned:** a path outside every zoned module gets no zone and the reason. Reports carry no per-file lists, so a test file inside a module directory gets that module's zone. The tool description says so.
5. **Skill file location:** `config/agent-skills/risk-zones/SKILL.md`, not `templates/`. `templates/` is harness-owned and replaced on `harness-upgrade`, while `config/` ships with the package. The declared behavior in `feature_list.json` was updated to name the new location.
6. **File reading:** the CLI reads the report file and hands the parsed report to `src/mcp/`, which stays pure apart from the stdio loop. docs/ARCHITECTURE.md lists this as the CLI's second file read, beside the configs.

## How I Will Verify

- [ ] Layer 1: `npm run lint`
- [ ] Layer 2: `npm run test`; Layer 2b `npx vitest run src/mcp`:
  - every tool against a fixture report: a red path inside a green module, a yellow path, `(root)` and `<dir>/(files)` modules, an unknown path, an unknown factor;
  - protocol: initialize with each version, unknown method, unknown tool, missing arguments, notifications getting no answer, a parse error;
  - report validation: a wrong schema or version.
- [ ] Layer 3: `npm run check`, including an e2e test that audits a fixture repository, starts the built `mcp` command on the report, lists the tools and calls each one over stdio.

## Risks

- **The protocol moves.** A future MCP version may change the handshake. The version list is in one place, and the e2e test covers the wire format.
- **Stale reports.** The server answers from a report that may be older than the code. `get_verdict` returns the audit date and commit, and the skill tells agents to check them.
