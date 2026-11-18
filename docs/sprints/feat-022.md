# Sprint Contract

**Feature ID:** feat-022
**Feature Name:** Direct-call rules for C# and Go
**Date:** 2026-11-18
**Estimated Duration:** 1 session
**Status:** decided without a review round, at the user's request (D-027). The real-repository check is deferred: see "How I Will Verify".

## Decisions

1. **Strippers:**
   - C# removes comments and replaces every string form: regular, verbatim (`@"..."` with `""` for a quote and literal backslashes), interpolated (`$"..."`, `$@"..."`, `@$"..."`, marked as interpolated when they hold `{`), raw (`"""..."""` and longer runs, with `$` prefixes) and char literals.
   - Go replaces raw backquoted strings (no escapes, multi-line), interpreted strings and runes.
   - Line counts are kept in both.
2. **C# constructs:**
   - `.GetType(name)` and `Assembly.Load*(path)` with a computed argument (`obj.GetType()` has none, so it never counts);
   - `Activator.CreateInstance(type)`, where `typeof(...)` counts as visible and the generic form is not matched;
   - `GetMethod`, `GetProperty`, `GetField`, `GetMember` and `InvokeMember` by name, where `nameof(...)` counts as visible;
   - `.Invoke(...)` only in files with `using System.Reflection;`, and never `?.Invoke` (event raising);
   - `dynamic` variables and parameters.
3. **Go constructs:**
   - `.Call` and `.CallSlice` with arguments, in files using `reflect.`;
   - `MethodByName` and `FieldByName` with a computed name;
   - `.Lookup(name)` in files calling `plugin.Open`.

   `rpc.Client.Call("Svc.Method", ...)` with a literal name stays visible.
4. **Coverage:** `csharp` and `go` join `DYNAMIC_CALL_FAMILIES`, so they count toward the direct-api-calls factor's covered share. C# and Go repositories are measured instead of not measured.

## How I Will Verify

- [ ] Layer 1: `npm run lint`
- [ ] Layer 2: `npm run test`; Layer 2b `npx vitest run src/collectors/dynamic-calls`:
  - every new rule and its exclusions in both languages;
  - each new string form;
  - collector-level reading of a `.cs` and a `.go` file in a fixture repository.
- [ ] Layer 3: `npm run check`
- [ ] **Deferred:** auditing a public legacy C# or Go repository and checking a sample of findings against the clone. No such clone is on this machine, and cloning one is a download that needs the owner's approval, which this run's no-interruption request did not cover. The declared verification was reworded to say so.
