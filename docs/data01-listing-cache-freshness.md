# DATA-01B — Marketplace-sensitive completed route cache

**Problem demonstrated by DATA-01A PR #1119:** the server has independent Flow Marketplace generations and correctly marks listing-price sort/filter pages as ineligible for SQLite-only HTTP revalidation, yet the browser's 64-entry completed route cache is scoped only to the SQLite `generatedAt` and linked wallet. Returning to a price-sorted/price-filtered page may reuse its previous result despite a Marketplace update, including a sale disappearing or counts/pagination changing.

## Minimal fix

`shared-incremental-routing.js` checks the canonical outgoing query for `sortKey=listing_price` or a listing-price filter (using the same classification semantics as the Marketplace endpoint). Such pages bypass **only the completed-payload cache** on read and write. The ordinary SQLite-only routes retain 64-entry LRU reuse; the in-flight promise deduplication, cancellation, per-route loading/focus ownership, wallet namespace, SQLite generation adoption, `force`, and API headers remain unchanged. No time polling or additional speculative requests are introduced; one fresh page API request is issued when the user re-enters a Marketplace-dependent route.

Validation `validation/data01-listing-cache-freshness.mjs` executes the real canonical source owners in a Node VM under synthetic generation A/B and guest/wallet contexts; it proves no completed-cache reuse for price sort/filter and preserved ordinary cache, namespace invalidation, LRU bound and in-flight deduplication source contract. Existing Marketplace overlay test ensures non-price Player/Evaluation reads remain asynchronously enriched and authoritative listing requests aren't overlay-patched.

## Limitations / release gate

- This does not guarantee an open tab immediately notices a deployed **SQLite generation** if it only revisits already-cached SQLite-only routes: explicit version revalidation needs its own design and evidence, rather than a hidden background poll.
- The server's 5s marketplace snapshot TTL remains; this change fixes unbounded *browser completed-page* reuse, not the upstream snapshot cadence.
- Test in CI using `node validation/data01-listing-cache-freshness.mjs` and `npm run validate`, plus full Site Quality, Windows, Mobile, A11Y and Table Header on the **exact head**.
- Live simultaneous wallet/Watchlist/Planner flows, production swap, Safari/iPhone and Dapper remain the **single final release gate**.
- No DB refresh, live Supabase operation, merge or Vercel deployment.
