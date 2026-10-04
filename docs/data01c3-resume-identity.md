# DATA-01C3 — SQLite identity revalidation on foreground return

## Evidence and existing owners

The [DATA-01C1 source-executed diagnostic](https://github.com/FraGioco9/mfl-front-office/pull/1121) demonstrated that a fully cached SPA Watchlist has no way to discover a new SQLite generation without an HTTP response. [DATA-01C2](https://github.com/FraGioco9/mfl-front-office/pull/1122) correctly rejects old bootstrap/page completion, and namespaces the completed-route LRU by observed `generatedAt` and wallet; it does not initiate an identity check. The existing read-only `/api/identity` endpoint returns `database.generatedAt`, a strong identity ETag and 304 for `If-None-Match`. Its CDN cache controls already disable CDN persistence and its public reply contains **no private wallet data**.

## Narrow production fix

The canonical `modules/core-sources/shared-incremental-routing.js` owner now performs an event-scoped `GET /api/identity` only after **hidden → visible** or **BFCache `pageshow.persisted === true`**. There is **no interval polling**, global focus polling, initial-startup fetch, login operation, wallet proof, database refresh or deployment action.

- Explicit `If-None-Match` ETag, `Cache-Control` transport selection `cache: "no-store"`, 304 without body parsing; 30-second minimum spacing of successful probes and 5-second minimum spacing after transient offline/error/timeout.
- Single active request (deduped even when the two lifecycle events fire together), 7-second abort timeout; hiding cancels the request, and a late response cannot adopt SQLite identity.
- Reject older observed generations and malformed identity before cache invalidation, preserving monotonic dataset ownership even if an old deployment response races with a page response.
- Only a new later SQLite `generatedAt` calls the already-owned `adoptIncrementalPayloadDataset`: this invalidates completed table/Watchlist payloads and Home summary. No duplicate cache owner or new storage key is introduced. Marketplace JSON timestamps are **independent** and are never compared to SQLite identity.
- If and only if a Watchlist is still the same active route, wallet, list, view and page, the client has no outstanding table route requests and the document is visible, the current Watchlist page is reloaded once with `save: false` to update visible rows. On subsequent normal navigation, other pages load from the new SQLite namespace.
- **Planner is not reloaded**: locally edited or saved plans, formations, private state, wallet opt-in, club display localStorage, and source-of-truth user selections are untouched. On a Planner return the identity is still adopted and only the shared read cache changes; explicit Planner fetches thereafter use the current DB.

## Synthetic tests

`validation/data01c3-resume-identity.mjs` runs the **real canonical adopter + lifecycle callbacks**, in a hermetic VM with controlled clock, deferred fetches, in-memory Watchlist membership and a dirty Planner draft. Assert non-persisted initial `pageshow` does not probe; hidden/visible and BFCache do; concurrent events coalesce; `200`, ETag `304`, offline, 503, invalid JSON identity, abort-on-hide, bounded timeout, stale A after C, success B→C→D, safe Watchlist refresh, route switches during request, no Planner edits and no late stale effects.

Run via `node validation/data01c3-resume-identity.mjs` and `node validate-all.mjs`, plus all exact-head GitHub workflows. Browser automation is Chromium only; **real Safari/iPhone / Dapper / production swap remain final release gates**. This implementation does not silently modify the server, schedule DB updates or deploy.

## Explicit limits

A tab that never gets hidden, never receives a persisted BFCache return, and never performs a fresh route request will not detect a remote SQLite swap; changing that would require periodic polling and is out of scope. Rapid hide/show cycles intentionally throttle probes. While offline, existing cached data remains visible and the next qualifying return retries. Automatic visible refresh is scoped to an unchanged Watchlist to avoid clobbering editable forms (Planner/evaluation/settings). Other active pages are invalidated for their next data-driven read/navigation, rather than force-rendered during typing.

## Generated artifacts and exact-head CI gate

Source CI on `4fd8dc66a477cacf5ee135d754e2136550c3c0e3` passed all Site Quality jobs. Its canonical generated-assets writer updated **only** `modules/app-core-runtime.js` and `table-width-runtime.js` into `a4df97bdf284e6e600bc993a0c5a920e78e19afd`. The generated commit's first set of workflow records was `action_required`, not a verified test pass. This docs-only trigger requests all required workflows on the post-generated head. Do not mark DATA-01C3 complete until those runs and mergeability are confirmed against the final exact head. No deployment, DB refresh or merge.
