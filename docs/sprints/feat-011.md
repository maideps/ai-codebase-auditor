# Sprint Contract

**Feature ID:** feat-011
**Feature Name:** Direct-api-calls collector
**Date:** 2026-10-23
**Estimated Duration:** 1 session
**Status:** detection and scoring rules reviewed and approved 2026-10-23 (decisions below); not implemented

## Review Decisions (2026-10-23)

All four open points were approved as recommended:
- **Measure:** share of covered product files with at least one computed-target call site.
- **Thresholds:** 2/5/10/20% for scores 5 to 2.
- **Languages:** Python, PHP, Ruby, Java, JavaScript and TypeScript; other languages are not assessed.
- **Zones:** the factor stays repository-wide; zones are unchanged.

## Settled During Implementation (recorded in D-015)

- **From the case-study sample check:** 3 of the 40 sampled sites were false positives, all in Struts. Each became a test and a fix:
  - an UPPER_CASE constant (optionally qualified) counts as a literal target;
  - a Java method declaration such as `public static Class loadClass(...)` is not a call;
  - `this.invoke(...)` and `super.invoke(...)` are not `Method.invoke`.
- **Shared code:**
  - the generated-file rule moved from code-structure to `collectors/tree.ts`, so both collectors use it;
  - the covered language families live in `src/file-kinds.ts`, so scoring does not import collector code.
- **File reads:** `readTrackedFile` reads files up to 4 MB once and sniffs for binary in memory, instead of opening every file twice. This was the main cost on Windows.
- **Report signal:** the `dynamicCalls` signal counts files as the collector read them, tests included. The score leaves tests out, and the CLI says so.

## What the Factor Means

`config/factors.json` defines direct-api-calls as: *"What a call does is visible at the call site, not hidden behind reflection, magic or dynamic dispatch."* An agent edits code by reading it. When the target of a call is computed at run time, for example `getattr(self, 'item_' + name)` or `params[:object_type].constantize`, a search for the method name does not find its callers. A rename or signature change can then break code the agent never saw, and only tests catch it.

So the factor measures how much of the product code contains calls whose **target name is computed**. It is not about calls to external services; the name stays, but the display name becomes "Direct calls (visible at call site)" to avoid that reading. The id stays `direct-api-calls`, so configs, deferrals and reports keep working.

## What I Will Build

- A collector, `src/collectors/dynamic-calls.ts`. It reads every tracked source file in a covered language, statically, with the same tree listing, link-safe reads and vendored rule as the other collectors. For each file it records the dynamic call sites found: construct, line, and a trimmed excerpt.
- A scoring rule for direct-api-calls, thresholds in `config/factors.json`.
- A harness requirement and a roadmap step for the factor, so the plan and the roadmap cover it like the other scored factors.
- A collector summary in `audit` output and a `dynamicCalls` signal in the report (`schemaVersion` 4).

Nothing is run, and the audited repository is not changed.

## Proposed Detection Rules

**Before matching**, comments are removed and string literals are replaced by a placeholder, so code inside strings or SQL never matches. A string that interpolates (Python f-strings, `"#{...}"` in Ruby, `"$x"` in PHP, JavaScript template literals) counts as computed.

**Only computed targets count.** A call whose target is a literal is visible at the call site: `getattr(obj, 'name')`, `send(:save)`, `Class.forName("x.Y")`, `obj['key']()`. These are not counted.

| Language (extensions) | Counted constructs |
|---|---|
| Python (`.py`) | `getattr`/`setattr`/`delattr` with a computed name; `def __getattr__` or `__getattribute__`; `eval`, `exec`, `execfile`; `__import__` or `importlib.import_module` with a computed name; `globals()[...]`, `locals()[...]`, `vars()[...]` |
| PHP (`.php`) | `call_user_func(_array)` with a computed callable; `$obj->$method()`, `Class::$method()`; `$function()`; `new $class`; `$$variable`, `${$...}`; `function __call`, `__callStatic`, `__get`; `eval`, `create_function` |
| Ruby (`.rb`) | `send`, `public_send`, `__send__` with a computed name; `def method_missing`; `define_method` with a computed name; `class_eval`, `instance_eval`, `module_eval` with a string; `eval`; `constantize`, `safe_constantize`, `const_get` on a computed name; `instance_variable_get`/`set` with a computed name |
| Java (`.java`) | `Class.forName` or `loadClass` with a computed name; `getMethod`, `getDeclaredMethod`, `getField`, `getDeclaredField` with a computed name; `.invoke(...)` with arguments, in files importing `java.lang.reflect`; `setAccessible(true)`; `Proxy.newProxyInstance` |
| JavaScript and TypeScript (`.js`, `.mjs`, `.cjs`, `.jsx`, `.ts`, `.tsx`) | `eval`, `new Function`; `obj[expr](...)` with a computed key; `Reflect.apply`, `Reflect.construct` |

**Excluded files:**
- vendored paths (the existing rule);
- generated files (lock files, `*.min.*`, `*.map`, as in code-structure);
- minified files: any line over 1000 characters;
- test files: the scoring rule leaves out the files the tests-docs collector lists as tests. Tests use mocks and reflection by design, and they are not what agents change for a feature.

**Not assessed:**
- Other languages, such as C and C++ (function pointers are not separable from macros without a parser), Go, C# and Kotlin.
- Configuration-wired dispatch, listed as partial coverage. Examples are dependency-injection containers (`services.yml`), XML action mappings (`struts.xml`), OGNL expressions, Rails callbacks by symbol, event dispatchers and annotations.

## Proposed Scoring Rule

The measure is the **share of covered product source files with at least one computed-target call site**. Counts per construct and per file are evidence.

| Score | Share of files |
|---|---|
| 5 | ≤ 2% |
| 4 | ≤ 5% |
| 3 | ≤ 10% |
| 2 | ≤ 20% |
| 1 | > 20% |

The factor is **not measured** in two cases:
- the covered languages hold less than half of the product source lines, with the reason naming the main uncovered language;
- fewer than 10 covered product files exist.

The evidence cites the share, the site count, the top files with their counts, and up to 10 sample sites as `path:line`.

## Plan and Roadmap Additions

- **Harness requirement `traceable-calls`** (factor direct-api-calls; surfaces `AGENTS.md` and the lint layer):
  - **Required (≤ 2):** list the files with dynamic dispatch in `AGENTS.md` as "find every call target before editing", and add a lint rule that rejects new `eval` and computed-name calls in the lint layer. Examples: ESLint `no-eval` and `no-implied-eval`, RuboCop `Security/Eval`, Bandit `B307`.
  - **Recommended (3):** the `AGENTS.md` list only.
- **Roadmap step:** "make the computed-target calls explicit in K of N files", where K is the fewest files that reach the next band. Effort is S for at most 5 files, M for at most 20, and L for more. The step lists the top files.

## What This Would Produce on the Calibration Set (measured with a prototype of these rules)

The prototype read the clones' files directly and used its own approximation of the test-file rule, so the final counts may differ slightly.

| Repo | Covered files with sites | Score | Readiness (now → after) | Verdict |
|---|---|---|---|---|
| DOOM | C is not covered | not measured | 1 → 1, still provisional | prepare first, still provisional |
| moin-1.9 | 95 of 1,200 (7.9%): `getattr` by name, plugin `__import__`, `eval` of config | 3 | 3 → 3 | adapt, no longer provisional |
| phpBB | 52 of 1,319 (3.9%): `$$var`, `new $class`, `eval` in the converter | 4 | 5 → 4 | adopt, no longer provisional |
| Struts | 55 of 1,515 (3.6%): `loadClass`, `Method.invoke` in the DI container and plugins | 4 | 5 → 4 | adopt, no longer provisional |
| Redmine | 52 of 856 (6.1%): `send(component)`, `constantize` on params, `class_eval` | 3 | 5 → 3 | adapt, no longer provisional |

No verdict changes; four of five stop being provisional. Readiness now reflects both blocking factors. The prototype's samples were checked by eye. Two false-positive sources were found and are fixed in the rules above: zero-argument `getMethod()`/`invoke()` in Java (HTTP method, Struts `ActionInvocation`), and code inside SQL strings in PHP.

## Open Points

1. **Measure:** share of files with any site (proposed: robust to one dispatcher file with many sites, and maps to "how much of the code hides its targets"), or sites per 1000 lines.
2. **Thresholds:** the bands above (2/5/10/20%), or stricter bands (1/3/6/12%), which would make moin-1.9 and Redmine weak (score 2) and drop their readiness to 2.
3. **Languages:** the five calibrated ones above (proposed), or also Go (`reflect`) and C# (`Type.GetType`, `GetMethod`, `Invoke`, `dynamic`) without calibration data.
4. **Zones:** keep the factor repository-wide (proposed), or also turn a green module yellow when its own share is over the score-3 band.

## How I Will Verify

- [ ] Layer 1 (static): `npm run lint`
- [ ] Layer 2 (runtime): `npm run test`, and Layer 2b `npx vitest run src/collectors/dynamic-calls`:
  - each construct per language, counted and literal-target forms not counted;
  - comments and strings stripped, and interpolated strings counted as computed;
  - vendored, generated, minified and link exclusions;
  - an unchanged-target check;
  - the score rule at each band edge, the coverage and minimum-file rules, and test files left out;
  - the new requirement and roadmap step.
- [x] Layer 3 (system): `npm run check`. The five case-study reports are regenerated, and at least 10 sample sites per repository are checked against the clones.

## Dependencies

- [x] Depends on: feat-010 (passing)
- [x] Blocked by: review of these rules (approved 2026-10-23)

## Risks

- **Pattern matching, not parsing.** Heredocs, nested strings and unusual syntax can hide or invent a site. The excerpt cited per site lets a person check it.
- **Framework magic is mostly configuration-wired** and not counted, so Rails, Struts and DI-heavy PHP score better than an agent's experience may suggest. This is stated as partial coverage.
- **Readiness drops for three repositories** (phpBB and Struts to 4, Redmine to 3). That is the intended effect of measuring a blocking factor, but it changes the case-study numbers.

## Commit Plan

One commit for feat-011 (collector, rule, config, requirement and roadmap step, report `schemaVersion` 4, CLI, tests, regenerated case study, docs, decision record), then one for the gate's evidence from the clean tree.
