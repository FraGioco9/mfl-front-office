# PERF-03B1 — Global Search cold-split dependency gate

Parent: [#1034](https://github.com/FraGioco9/mfl-front-office/issues/1034), [PERF-03A baseline](performance-1034-perf03.md). This audit is **read-only**: no JavaScript code is removed from the universal bundle, no cold-route request is added, and no performance improvement is claimed.

## Evidence and constraints

The PERf-03A profiler measured `shared-global-search.js` at **9,800 uncompressed source bytes**, containing **15 top-level functions with 0/15 executed in selected cold routes**. This is an *upper bound* for an initial split: not a measurement of compressed transferred bytes, parsed CPU savings or an independently safe module boundary.

The new `validate-perf03b-search-boundary.mjs` parses the canonical Shared fragments with the TypeScript compiler AST. It inventories all 15 functions and reads real lexical symbol references in sibling Shared fragments. Its executable, fail-closed integration assertions protect the following contracts:

| Source owner | Dependency / consequence |
| --- | --- |
| `shared-interaction-bindings.js` | `openSearch` is bound by the search button and invoked via Ctrl/Cmd+K; `closeSearch` is bound by the close button, Escape handler and backdrop. `clearPlayerSearch` and `renderSearchResults` are bound directly at startup. Removing definitions without synchronous delegates raises ReferenceError during normal application startup, not just when Search is opened. |
| `shared-personal-state.js` | Recent-history storage change can call `renderSearchResultsNow` while Search is open. |
| `shared-core-contracts.js` | `searchMatchScore` is **reassigned** to surname-first behavior when first-use runtime installs matching; the implementation and binding must remain replaceable without losing the override. Core contracts also call `renderSearchResultsNow`. |
| `global-search-runtime.js` | Currently lazy on first search/Evaluation; installs matching and a search-modal observer, looks up `closeSearch` on `window`, and maintains asynchronous recent-search state. Added owner scripts must be sequenced ahead of interactions, without overriding this existing lifecycle. |

This means that treating the 9.8 KiB file as a standalone lazy classic script, without synchronized minimal delegates, would break initial event listener installation. Splitting by text/string replacement, or prepending a first-paint script request, is **not** a safe solution.

## Gate for PERF-03B2 — experiment before any runtime patch

1. Construct a **disposable experimental build**, not a production code change. Keep the unmodified head as the control, with the same pinned fixture database, Chrome/Node versions, runner, server and route sequence. Candidate must expose the same global lexical callable bindings to first-paint owner code, including `searchMatchScore` mutation; there must be no new *cold* request.
2. Capture **paired, interleaved control vs candidate** with more than one fresh-profile replicate for desktop and synthetic slow mobile. Measure cold/refresh/cached navigation, request topology and bytes, V8 compile/script work and variability under identical CDP instrumentation.
3. Measure **first use independently**: pointer click, Ctrl/Cmd+K, focus/keyboard, Escape/backdrop and clear/search input, Supabase recent-search lifecycle, player/club/agent navigation, Evaluation direct link, guest/wallet states, duplicate rapid open and SPA reentry.
4. **Reject** candidate if universal bytes/compile savings are not visible over noise, initial requests appear, first-use becomes slower/unreliable, the renderer or keyboard shortcuts regress, or first-use loading introduces cross-route ownership issues. Don't mistake precise coverage low reach for dead code.
5. Only an evidence-backed candidate goes into a **separate product-code PR** with normal Site Quality, Windows, browser, mobile and A11Y CI. Real iPhone/Safari and production audits remain in **PERF-03C after the single final #1034 deploy**.

## How to validate this guard

```bash
node validate-perf03b-search-boundary.mjs
npm run validate
```

Its reported reference map is a static lexical inventory, **not an A/B result**. The validator runs as part of the default repository validation and should be updated deliberately if a later, measured search-owner split changes the architecture.

**PERF-03B1 outcome:** *dependency boundary mapped and fail-closed checks installed.* **PERF-03B2 remains pending same-runner A/B.** No Vercel deploy and no Supabase production mutation in this phase.
