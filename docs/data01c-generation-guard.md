# DATA-01C2 — reject older SQLite completion and stale Home summaries

**Reason:** test-only PR #1121 isolates actual source owners and demonstrates (1) late Home bootstrap A overwriting observed route dataset B, (2) Watchlist tables staying cached until a new generation is actually learned, and (3) independently cached Planner club display fields. This product PR is stacked directly on DATA-01B PR #1120, not on the diagnostic PR, and changes **only** the proven generation-race behavior.

## Minimal production change

- `shared-home-summary.js`: reject an older bootstrap manifest after a newer route has already adopted `generatedAt`; do not replace newer counts/manifest, show existing error/retry presentation instead. Successful newer bootstrap synchronizes the shared cache namespace. Export Home summary `invalidate()` alongside existing `isReady()` so subsequent generation changes do not retain Home counts from an older snapshot. Preserve normal bootstrap deduplication and cached returns. In isolated Home unit harnesses without the assembled shared cache owner, the namespace sync is optional.
- `shared-incremental-routing.js`: reject stale page payloads **before** dataset adoption, completed-route cache writes or UI application when their `generatedAt` predates the newest observed SQLite generation. When new data generation is adopted, invalidate only Home summary snapshot (not wallets, Watchlist membership, user settings, saved Planner plans, share revisions or local drafts). Existing 64-entry completed cache namespace and GET abort/latest-route ownership remain unchanged.
- Strict source-execution test `validation/data01c-generation-regression.mjs`: deferred old bootstrap followed by new route B; rollback forbidden; retry B; generation C invalidates Home and Watchlist; stale route A is rejected before write; Planner's local stored draft is left intact.

## Explicit exclusions / unfinished DATA-01C gates

The solution **does not introduce a hidden polling mechanism or fetch new data on every navigation**. An already-open tab making only completed cache hits cannot discover a remote SQLite deployment automatically; a bounded, separately justified visibility/return check requires dedicated network/error tests before any product change. Planner's unversioned *public display* storage still exists and is intentionally not deleted to preserve first paint and user-edited plans. Do not claim an end-to-end remote swap or Safari/iPhone/Dapper validation from Node fixtures alone.

Run exact-head full GitHub CI (Site Quality, Windows, Mobile, Table Header, A11Y-01–06, Browser routing, Planner browser). No merges, refresh database, live Supabase operations or Vercel deploy. Safeguard real wallet/Safari/iPhone at final release gate.
