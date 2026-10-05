# LOAD-02 — Error, retry, navigation supersession and retained content (#1034)

**Clean reconstruction:** 2026-10-05 on `main` `750dcd6d49fbfca6eb8ddb1dbb35231a7b4bc9f1`. PR #1112 remains diagnostic/test-only evidence and is not part of this branch history. PR #1113 carries only the evidence-backed runtime guard, generated projection, regression fixtures and this report. No database refresh, account/wallet action, Supabase change or Vercel deploy.

## Evidence and reproduced failure

The isolated baseline in PR #1112 reproduced 6/6 late failures (401, 404, 429, 500, timeout and AbortError) showing an obsolete non-Player toast after a newer route had already won. Current-route failures still produced feedback and committed rows survived failed refreshes.

The product correction is intentionally narrow: at the existing route-owner catch boundary, return immediately when `pageNavigationIsCurrent(navigationOptions)` is false. Player-specific load feedback and generic current-route toasts remain unchanged, and the existing `finally` still releases the table-loading token.

## Regression coverage retained in the clean PR

1. `validation/load02-error-retry-isolation.mjs` executes the production route-owner closure in an isolated Node VM. It requires six current-route failures to remain visible, six superseded failures to produce zero obsolete toasts, all loading tokens to settle, failed refreshes to retain committed rows, and a subsequent retry to succeed.
2. `validation/load02-incremental-network-fixture.mjs` executes the canonical `requestIncrementalRoute` slice with synthetic 401/404/429/500 responses, timeout and concurrent abort. It verifies retry recovery, cache reuse, retained committed rows, no stale data application and no dangling requests/tokens.
3. `validate-ux02d-entity-request-errors.mjs` asserts that stale-navigation suppression occurs before both Player and non-Player feedback, while authoritative empty 200 responses remain distinct from request failures.
4. `.github/workflows/load02-failure-isolation.yml` runs these fixtures for changes to the relevant runtime, routing, validator, workflow, fixture or report files.

## Explicit non-claims

These are deterministic synthetic source-execution fixtures, not Safari/iPhone field measurements or authenticated wallet traces. No automatic HTTP retry/backoff is added. Wallet expiry, real rate limiting, production traffic and real-device behavior remain part of the final release gates (LOAD-01D / PERF-06.5 / TEST-04B6.6).

## Decision

Keep only the stale-error ownership guard. Do not import PR #1112 history, do not change persistence or retry policy, and do not touch unrelated generated artifacts.