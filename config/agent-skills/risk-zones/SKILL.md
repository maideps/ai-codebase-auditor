---
name: risk-zones
description: Check a file's risk zone from the ai-codebase-auditor report before editing it. Red means propose only, yellow means write characterization tests first, green means edit and run the tests. Use whenever you are about to change code in a repository that has an ai-readiness report.
---
# Risk Zones

The ai-codebase-auditor report marks where agents may work in this repository. Its MCP server answers from the saved report and never changes anything.

## Setup

Start the server on the saved report. In Claude Code, for example:

```bash
claude mcp add ai-codebase-auditor -- npx ai-codebase-auditor mcp path/to/ai-readiness-report.json
```

From a clone of the auditor, use `node dist/cli.js mcp <report.json>` as the command instead.

## Workflow

1. At the start of a task, call `get_verdict`. Note the audit date and commit: if the code has moved far since then, say so and treat the zones as a guide.
2. Before editing any file, call `get_zone` with its path relative to the repository root.
   - **red:** do not edit it. Write the change as a proposal (a diff or a description) for a person to apply, and say which red term put it there.
   - **yellow:** first write characterization tests that pin the file's current behavior, quirks included, and make them pass against the unchanged code. Only then change it, and never edit those tests in the same change.
   - **green:** edit it, then run the repository's tests.
   - **no zone:** tests, docs and other files that are not zoned. Follow the repository's own rules.
3. When a factor matters to the task (for example `test-feedback` before relying on the tests), call `get_factor` for its score and evidence.
4. Use `list_red_paths` and `list_yellow_paths` to plan a change that spans many files, and `get_roadmap` when asked what to improve first.

## Quick Reference

- [ ] `get_verdict` once per task; check the audit date and commit
- [ ] `get_zone` before every file edit
- [ ] Red: propose only. Yellow: characterization tests first. Green: edit and test
