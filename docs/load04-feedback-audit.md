# LOAD-04 — Error/toast feedback: evidence and narrow actions (#1034)

Date: 2026-10-04. All three PRs are OPEN/UNMERGED: test-only baseline [#1116](https://github.com/FraGioco9/mfl-front-office/pull/1116), toast lifecycle fix [#1117](https://github.com/FraGioco9/mfl-front-office/pull/1117) stacked on baseline, Planner/Settings contextual messages [#1118](https://github.com/FraGioco9/mfl-front-office/pull/1118) stacked on #1117. Baseline main: `3f5204515c4e5d51ac278f6bbee13bb5527290b4`. No changes to wallet, account, secrets, API, database or deploy.

## 1. Reproduced problems in actual production owners

Source-execution test `validation/load04-feedback-context-isolation.mjs` runs the canonical `shared-toast-core.js` and Planner mutation owner via a synthetic DOM, controlled timers, and deterministic error instances. It does not reach network services.

- **Sticky toast**: current Dapper opt-in shows `showToast("Opting in...", { sticky: true })`. Baseline: `showToast` schedules no timer initially, but its unconditional `mouseleave` listener **schedules an auto-dismiss after 2200ms**. The toast can disappear while opt-in is still in progress. In #1117 a `data-sticky` state is set per message; mouseleave only resumes the existing timer for ordinary non-sticky messages. This state is reset on subsequent normal messages. Browser focus is not moved by toasts.
- **Planner Save/Plans action errors**: baseline toolbar displayed raw generic HTTP 409 `Conflict`, HTTP 429 `Too Many Requests`, offline `Failed to fetch` without any useful recovery direction. In #1118 a source-owned `plannerActionErrorMessage` maps **only generic** 409/429/offline feedback into actionable sentences, shared by toolbar and Saved Plans action failure owner. Existing genuinely specific 409 `Saved plan changed. Reload it before saving.`, 429 `You can save a maximum of 5 plans.`, 401 opt-in and ordinary 500 error texts are deliberately preserved. No arbitrary background auto-retry was added.
- **Settings failed write**: a failed wallet-preferences save keeps the draft queued locally and unlocks Save/Discard; baseline shows only `Settings could not be saved.` with the toast's default polite announcement. #1118 changes this to `Settings could not be saved. Your changes are kept; select Save to retry.`, with `urgent: true`. Success remains polite. No automatic double-submit or focus stealing.

## 2. Verified existing behaviors retained

- Global Search renders a `Retry` control after a failed query, guards stale/aborted errors and does not claim `No results` before the current authoritative HTTP success. Existing UX-02F source-execution test covers pending, clear, debounce 200ms, retry and settled zero. LOAD-03 owns the search concurrency fixes; no search module changes are needed here.
- Planner toolbar and Saved Plans have separate **single-flight** locks; overlapping clicks/confirmation and duplicate network writes are prevented, even for actions from different Saved Plans rows. `validate-ux03-planner-toolbar-actions.mjs`, `validate-ux03c-planner-saved-plans-actions.mjs`, `validate-ux05-planner-plan-state.mjs` validate action outcomes, conflict detection, clear pending and restore the original or fallback modal control's **keyboard focus** after completion/error.
- Evaluation Save/Share/Delete uses a mutation-wide lock and confirmation with Cancel as default focus; Watchlist double-delete is ignored. Settings stale/pending draft is preserved and can retry manually. Existing `validate-ux03d-cross-domain-actions.mjs` checks these contracts, updated solely to assert urgent Settings failure and polite success.
- Toast visible node remains unique, `aria-hidden="true"` to prevent duplicate screen-reader feedback; live-region priority role `status` vs `alert` is independent of visual toast. `validation/a11y04-live-announcements.mjs` checks stable nodes and deduplication; display timer remains **2200 ms** for ordinary success, hover pauses/resumes normal toasts. No new fixed error duration is invented.

## 3. Isolated test gates and limitations

Synthetic fixture tests **sticky mouseleave**, normal toast lifecycle and hover, 409/429/offline mapping, known API messages, 401, 500, single-flight, alert priority, stable live regions. Related focused test files cover actual source-executed Settings failure/retry, Planner Saved Plans restoration of focus, Eval confirmation, and Global Search retry. Separate CI workflow: `.github/workflows/load04-feedback-isolation.yml`.

Fixtures are not real wallet sessions, production HTTP 429 rate-limit events, actual keyboard/screen-reader hardware, or Safari/iPhone. The tests do not assert all toast messages in the entire codebase are perfectly tailored or redacted. A wholesale global status mapper or longer generic durations would affect unrelated flows without demonstrated evidence, so neither is implemented.

## 4. Decision

Two **independently reviewable, minimal application PRs**, one for toast lifecycle (#1117) and one for contextual Planner/Settings feedback (#1118), based on reproducible failures. No rewrites of global search retry, other domain mutations, network request policy, arbitrary changes to status duration, token/session handling, data persistence or focus. Keep #1116–#1118 open; do not merge, refresh any database, change Vercel or deploy. Safari/iPhone TEST-04B6.6, PERF-06.5 and LOAD-01D remain final-gate validations.

Final exact-head CI status and any CI-owned generated projection commits must be rechecked before LOAD-04 can be marked fully completed.
