# Tools and MCP

## Configured MCP Tools

None. The project needs no MCP servers to build or run. `.claude/settings.json` is empty (`{}`).

If one is added, document here: server name and purpose, the tools it exposes, permissions (allow / ask / deny) and where it is configured.

### Sensitive Tool Policy

Default permission for sensitive tools is `ask`, not `allow`. Sensitive tools include:

- File system writes outside the project directory, including the harness repository and any audited repository
- Network requests to external services
- Shell commands that modify system state
- Package installations

Audited repositories are untrusted input: agents read them statically and never run their scripts, installs, builds or tests.

## External Tools the Audit Uses

| Tool | Used for | Status |
|---|---|---|
| git | History signals: churn, authors, file age. Read-only `rev-parse`, `ls-tree` and `log` only, pinned to the target (see [ARCHITECTURE.md](ARCHITECTURE.md#dependency-rules)) | Used by the git-history collector; without it, history is reported as not measured |
| [scc](https://github.com/boyter/scc) | Per-file language, code lines and keyword complexity as JSON (MIT); run as `scc --by-file --format json .` in the target | Optional, used by the code-structure collector when on PATH. Its JSON shape is parsed from scc's documented format and tested against a stand-in; not yet checked against a real scc install |
| [endoflife.date](https://endoflife.date) | Source of the dated runtime end-of-life table in `config/runtime-eol.json` | Used at development time only, when the table is refreshed; the audit itself never goes to the network |
| [Lizard](https://github.com/terryyin/lizard) | Per-function cyclomatic complexity across 25+ languages | Candidate; license still to check |
| [Code Maat](https://adamtornhill.com/code/maatdistro.htm) | Hotspots and change coupling from git logs | Candidate; license and input format still to check |

The audit must degrade honestly when an optional tool is missing: the factor it feeds reports what it could not measure instead of guessing.

## Development Tools

- `gh` — GitHub CLI, for issues on this repository and on `maideps/ai-harness-framework`.
- Node.js, npm, TypeScript, ESLint, Vitest — see [STANDARDS.md](STANDARDS.md).

## Skills

Reusable capability packs are documented in `skills/` (one `SKILL.md` per skill folder). Load the relevant skill when its "When to Use" conditions match: `feature-cycle`, `verification`, `review` and `commit` cover most feature work. Add project skills with the format described in the `write-skill` skill; never modify the shipped ones.

## Git Integration

- Commit messages follow [STANDARDS.md](STANDARDS.md#commit-and-review-standards): conventional prefix, feature id, why.
- One logical change per commit.
- `npm run check` must pass before every commit.
