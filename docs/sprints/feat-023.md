# Sprint Contract

**Feature ID:** feat-023
**Feature Name:** Direct-call rules for C and C++
**Date:** 2026-11-18
**Estimated Duration:** 1 session
**Status:** decided without a review round, at the user's request (D-028)

## Decisions

1. **One family for C and C++**, `c`, with its own stripper: comments, strings and char literals with escapes, and C++ raw strings `R"delim(...)delim"`. Line counts are kept.
2. **Symbol lookup by name:** `dlsym`, `dlvsym` and `GetProcAddress` with a computed symbol name. A string literal or an UPPER_CASE constant is visible.
3. **Function-pointer table calls at a computed index:** `handlers[op](x)` and `menu->items[i].routine(i)` (an index, then any `.`/`->` member chain, then a call), and the dereferenced form `(*table[i])(x)`. Not counted:
   - literal or constant indexes (`fns[0]`, `ops[OP_READ]`);
   - function pointers called by their own name (`fp(x)`, `(*fp)(x)`, `action.acp1(actor)`);
   - array declarations;
   - C++ `operator[]` (an empty index);
   - lambdas (`[&](...)` follows no name).
4. **Coverage:** `c` and `cpp` count toward the covered share, so DOOM is measured.

## How I Will Verify

- [ ] Layer 1: `npm run lint`
- [ ] Layer 2: `npm run test`; Layer 2b `npx vitest run src/collectors/dynamic-calls`:
  - every rule and exclusion, including the dereferenced form and the struct-member call;
  - both C stripper forms;
  - the collector reading a `.c` file while a `.rs` file stays unread.

  The scoring tests that used C as their example uncovered language now use Rust.
- [ ] Layer 3: `npm run check`. The five case-study reports are regenerated: DOOM is no longer provisional, all 7 of its sites are checked in the clone, and the case-study section and labels are updated.
