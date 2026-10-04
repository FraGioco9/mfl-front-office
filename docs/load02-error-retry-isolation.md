# LOAD-02 — Error, retry, navigation supersession and retained content (#1034)

**Date:** 2026-10-04. PR #1112 (diagnostic baseline, test-only, open/unmerged); PR #1113 (one evidence-backed product fix, stacked on #1112, open/unmerged). Baseline `main` `3f5204515c4e5d51ac278f6bbee13bb5527290b4`. No live database refresh, account, wallet, backend, API, Supabase, Vercel deploy or merge.

## Evidence and reproduced failure

`validation/load02-error-retry-isolation.mjs` executes the original `setIncrementalPage` route owner's actual `loadAndRender` closure from `modules/core-sources/shared-incremental-navigation.js` in an isolated Node VM with controlled rejected promises, navigation ownership and table-loading token probes.

On unchanged baseline code in PR #1112, **all 6/6** simulated late failures (401, 404, 429, 500, timeout, AbortError) **showed an obsolete toast after a newer route won**, while current-route failures properly displayed feedback. Its pre-existing error handler guarded `showLoadError("Player")` behind `pageNavigationIsCurrent` but showed the generic non-Player toast regardless of transition ownership.

The independently reviewable product fix in PR #1113 adds `if (!pageNavigationIsCurrent(navigationOptions)) return;` **at the beginning of the existing route-owner catch**. It then retains the Player-specific error UI and generic non-Player feedback, preserving the `finally` block's loading-token cleanup and all normal response handling. A canonical-core source change and its generated `modules/app-core-runtime.js` projection match the ownership contract.

## Verification after the fix

Two source-execution fixtures are run via `.github/workflows/load02-failure-isolation.yml` on every relevant PR:

1. **Navigation ownership/feedback/reload** (`validation/load02-error-retry-isolation.mjs`): 6 current-route failures remain visible, **0/6 stale-route errors displayed** after navigation supersession, all six stale tokens finalized, failed reload leaves committed `state.rows` and `dataLoaded` intact, and an explicit retry can succeed with no extra error. This simulates errors at the route-owner boundary without a browser.
2. **Actual canonical `requestIncrementalRoute` HTTP and abort behavior** (`validation/load02-incremental-network-fixture.mjs`): synthetic non-2xx **401, 404, 429 and 500** responses reject without deleting a previously committed table; each scenario can recover on explicit retry, then read the successfully cached payload without another failing network request. A timed out fetch aborts and preserves committed rows; a concurrent newer route aborts the old pending request and wins without stale data application. The same test asserts **11 begun and 11 finished loading tokens**, no dangling in-flight promises, and no request to a real service.
3. Existing `validate-ux02d-entity-request-errors.mjs` continues to assert that **authoritative 200/empty** Player/Club responses are distinct from non-2xx/network errors. Its guard contract is updated to recognize that stale-error suppression now happens **before either Player or non-Player feedback**, not in the Player branch alone.

## Explicit non-claims

- VM fixtures validate **specific production function slices** but are **not full real-browser screenshots** or field measurements, nor production network traces. No new automatic HTTP retries or backoff were added; retries remain user/route actions. No scope beyond these contracts is claimed.
- The request-level fixture does not exercise wallet expiration flows, real access-token lifecycles, actual server 401/429 rate limits, or every UI retry surface. The 404 fixture models a request failure, **not** the authoritative HTTP 200/empty missing-entity contract.
- Background force-cache replacement and arbitrary dataset-version swaps are not changed by this PR; they require separate evidence, particularly since stale cache reuse across generations must never cross identity boundaries.
- Real Safari/iPhone and authenticated browser sessions remain reserved for the final release gate: **LOAD-01D, PERF-06.5, TEST-04B6.6** all remain pending.

## Generated-artifact head validation

The Site Quality workflow validates and may auto-commit derived assets to the open PR branch. The initial comprehensive exact-head run on `3cb37b69064988774ff5f852399a060fe973e61b` succeeded (18/18 jobs), then its generated-output synchronization created descendant commit `8f8a2632f395133f8c0de2e9631870a0c8bf9ef9` modifying only the checked-in `table-width-runtime.js` projection. The automatically authored SHA does not itself inherit the preceding run's status checks. A user-authored documentation commit will retrigger the **entire CI suite on its new exact head**, and its status must be verified before marking issue #1034's LOAD-02D complete.

## Decision

**Small, evidence-backed change** only: obsolete toasts must be suppressed, while all current-route feedback and committed rows are preserved. Do not globally retry HTTP errors, invent recovery UI for unrelated routes, alter data persistence, or change retry policy without additional isolated proof. The diagnostic fixture PR and product fix PR remain **open and unmerged**.
