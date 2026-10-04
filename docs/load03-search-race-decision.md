# LOAD-03 — Debounce, stale result suppression and settled empty states (#1034)

Date: 2026-10-04. Read-only diagnostic PR [#1114](https://github.com/FraGioco9/mfl-front-office/pull/1114) and dedicated production fix PR [#1115](https://github.com/FraGioco9/mfl-front-office/pull/1115), both OPEN / NOT MERGED; #1115 is stacked on #1114. Baseline `main` `3f5204515c4e5d51ac278f6bbee13bb5527290b4`. All fixtures run without a wallet, real database, Supabase, external requests or deploy.

## Actual owners and existing behavior

- **Global Search** (`global-search-runtime.js`): 200 ms input debounce, invalidates the current sequence and aborts the active request immediately on every key edit, normalizes NFD/diacritics and only renders **No players, clubs, or agents found** for the most recent, successfully settled query. Existing source-execution tests `validate-ux02f-home-search-recovery.mjs`, `validate-global-search-results.mjs` and `validate-ux02-empty-states.mjs` pass without source changes. One- and two-character inputs use the same debounce; arbitrary new minimum lengths would be a UX/API behavior change without evidence.
- **Planner team search** (`modules/core-sources/planner.js`): 140 ms debounce. Every edit increments `searchSequence`, and both successful/error completions reject superseded sequence or changed literal query; an empty/none state is emitted only once a current request returns. The synthetic fixture executes `requestTeams` on superseded error, stale success and authoritative empty (including `Molé` → `Mole`), without a code change. It prevents stale DOM ownership even though this search does not directly AbortController-abort an already sent fetch; adding broad new request plumbing lacks a demonstrated user-visible win.
- **Evaluation search** (`global-search-runtime.js`): dispatches immediately, with no extra fixed debounce, but every replacement cancels the older AbortController and verifies `evaluationSequence` and normalized active input before applying. The isolated owner fixture confirms `Zoë` → `Zoe` applies only the latest result and clearing aborts the pending request. No added delay is justified without actual user-visible improvement.

## Reproduced real Planner Player failure

In the initial source-execution fixture from PR #1114, a queued new Planner Player query took its existing **140 ms** before invoking `requestPlayers`. The old in-flight request's `catch` checked only `playerSearchSequence` and **that sequence did not increment on an edit until the subsequent request started**. Therefore an old failure inside the debounce gap rendered `renderPlayerResults({}, oldQuery)`, showing a **premature “No players found”** and reporting an obsolete network error. Also, `José` → `Jose` could render the old result while the new input was pending, because the old response compared only normalized strings and saw them as equal. The baseline fixture recorded **one obsolete error, one obsolete empty render, one stale accent-equivalent result** and **zero aborts** for its designed race.

## Targeted fix in PR #1115

- Invalidate the player-search sequence **on every edit**, and abort any prior in-flight Player request using one owned `AbortController` on edit, clear, close, and request replacement. Pass its signal to the canonical `__mflDataClient.fetch`.
- Show a **Searching players…** status during the existing 140 ms debounce, rather than keeping old-match rows or claiming zero data.
- On **a successful latest response**, render rows or the true empty result as before. On **current HTTP/network failure**, clear obsolete rows and the misleading empty hint, keeping the actionable `rosterMessage`; never turn a failed network response into a confirmed zero result. On superseded/aborted requests, do nothing.
- Mirror changes into checked-in generated `modules/app-core-planner-runtime.js`; do not alter server search algorithms, Unicode normalization, page size, pagination, minimum character rules or other search modules.

## Regression evidence and limitations

The exact production Player search and input owner are extracted into `validation/load03-search-race-isolation.mjs` with fake timers, deferred responses and observable AbortControllers. A passing corrected run reports:
- **zero** obsolete error messages and stale empty results;
- **zero** stale accent-equivalent payloads applied;
- at least **two aborted pending requests**;
- an authoritative empty response still renders an empty state **only after settling**;
- a current failed request shows its error without falsely rendering **No players found**;
- clearing input hides results and cancels debounce;
- Planner team source-execution stale success/error and current empty are checked;
- Evaluation latest-only abort / accent-equivalence / clear are checked;
- pre-existing Global Search debounce and search/empty/error validators pass.

These are **isolated, source-execution synthetic checks**, not a real wallet, Safari/iPhone test, real network timings or a field measurement of server query load. The fixture does not prove all server Unicode matching, backend 429 handling, every pagination edge case or real touch-keyboard composition. Do not infer a performance improvement from the measured abort counts alone.

## CI-generated source projection head

The first complete CI on `bf293003a05909bd4a11ecf35405b2c06135ca8e` passed **10/10 workflows, 18/18 jobs**, including the Player/Planner browser regressions. After completing, Site Quality's source-owned generation synchronization automatically created commit `46b5e9fc0e6304363a0ba6e17de8ab01028e7ad8`, changing only two lines in derived `table-width-runtime.js`. That generated commit has no directly successful full-suite status on its exact SHA. This documentation update intentionally retriggers the full suite on a fresh human-authored head containing the finalized projection. **Do not claim final exact-head pass until all jobs on the resulting commit succeed and the PR head remains unchanged.**

## Decision

Only the reproduced **Planner Player search** race warrants an application PR. Global Search, Planner Club search and Evaluation remain **NO CHANGE**. Do not merge either PR, refresh a live/shared database or deploy Vercel. Real Safari/iPhone and wallet remain at the final issue gate (TEST-04B6.6, PERF-06.5, LOAD-01D). Exact-head CI success must be recorded separately when the last PR commit is verified.
