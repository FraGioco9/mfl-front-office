# Supabase persistence ownership

This document is the canonical inventory of MFL Front Office data persisted in Supabase. Supabase is used only for data that must survive devices/sessions or for server-side reference/access-control data. Ephemeral loading state, request/cache state, and redundant copies of an already-owned identity are not cloud persistence.

## Access model

`site/api/_supabase.js` is the shared REST client. Application writes and private reads use the server-side service-role key. `site/api/mfl-season-ratios-v2.js` may use the anon key for the read-only historical ratio dataset. Wallet-owned preference endpoints still require the existing signed-wallet proof before accessing a wallet row.

## Tables and owners

### `wallet_opt_ins`

Canonical write owner: `site/api/_wallet-presence.js`. Callers are `site/api/wallet-opt-ins.js` for the opt-in flow and `site/api/wallet-preferences.js` for authenticated visit tracking.

Stored values:
- `wallet_address`: the opted-in wallet identity.
- `agent_name`: the current MFL agent name resolved from the packaged runtime wallet database when the wallet presence record is touched.
- `opted_in_at`: first persisted opt-in timestamp.
- `last_seen_at`: most recent authenticated visit/activity timestamp.

`agent_name` and `last_seen_at` are refreshed when the signed wallet opts in and whenever the authenticated wallet-preferences GET succeeds far enough to run its parallel presence touch. Agent names are refreshed only when the current runtime database contains a non-empty name for that wallet, so a temporary lookup miss does not erase a previously known name. Application startup already requests wallet preferences for a restored valid wallet proof, so an opted-in user's return to the site refreshes this presence data without a separate browser persistence path. A failed presence touch is non-blocking and does not prevent required preferences from loading.

This table is retained as the explicit opt-in/audit and last-seen record. It is not duplicated into `wallet_preferences`.

### `wallet_permissions`

Owners/readers: `site/api/_data-auth.js` and `site/api/wallet-permissions-version.js`.

Stored values:
- `wallet_address`: permission subject.
- `can_view_progression`: progression-data access gate.
- `updated_at`: permission-version signal used to invalidate cached authorization state.

These values are server-side access-control data and are not UI preferences.

### `wallet_preferences`

Owner: `site/api/wallet-preferences.js`. Server-side progression email reads are performed by `send_progression_emails.py`; `.github/workflows/full-database-refresh.yml` only supplies that script with the Supabase credentials.

Stored values:
- `wallet_address`: row identity / ownership key.
- `watchlists`: authoritative synced watchlist definitions and player IDs; also used to resolve progression-email scopes.
- `player_notes`: user-created player notes.
- `table_state`: cross-device Table/view/search state that is not owned by another preference column.
- `evaluation_settings`: evaluation inputs/preferences (`mflPerUsd`, discount/first-season flags, late-season reward rates).
- `settings`: user settings including progression-email scopes/address and date/time format preferences.
- `updated_at`: storage freshness timestamp maintained by the database trigger.

Canonical `table_state` intentionally does **not** persist:
- `watchlistPlayerIds`, `watchlists`, or `currentWatchlistId`, because watchlists have their own authoritative column.
- `linkedWalletAddress`, because the `wallet_preferences` row is already keyed by `wallet_address`.
- `recentSearchPlayerIds` or `recentSearchAgentWallets`, because `recentSearchItems` is the canonical mixed global-search history and can represent players, agents, and clubs in one ordered list.

For compatibility, `site/api/wallet-preferences.js` still accepts legacy player/agent recent-search arrays, folds them into `recentSearchItems`, and derives the legacy arrays in API responses. The duplicate arrays are compatibility output, not cloud storage.

`recentEvaluationPlayerIds` remains separate because it belongs to Evaluation history rather than global search.

### `evaluation_saves`

Owner: `site/api/evaluation-save.js`.

Stored values:
- `id`: saved Evaluation identifier.
- `wallet_address`: owner and list/delete scope.
- `player_id`: queryable player identity for the saved Evaluation.
- `payload`: normalized Evaluation state required to restore it.
- `created_at`: ordering/limit metadata.

`player_id` is retained separately from `payload` because it is a query/identity field; it is not an accidental UI-state duplicate.

### `evaluation_shares`

Write/lifecycle owner: `site/api/evaluation-share.js`. Active-share lookup owner: `site/api/_evaluation-share-preview.js`, reused by `site/api/evaluation-share.js`, the public shared-link metadata endpoint `site/api/evaluation-preview.js`, and the dynamic social-card endpoint `site/api/evaluation-preview-image.js`.

Stored values:
- `id`: share identifier.
- `wallet_address`: creator scope used for per-wallet active-share limits.
- `player_id`: validates/resolves the shared player context.
- `payload`: normalized public Evaluation share state.
- `created_at`: share ordering metadata.
- `expires_at`: mandatory expiry and active-share filtering; new shares expire one calendar month after share creation.

The preview lookup selects only `id`, `player_id`, `payload`, and `expires_at`; it never exposes or selects the creator wallet. Only after that active share has been validated, the preview owner resolves the player's current public `name`, `age`, and `retirement_years` from the packaged public player database (`mfl_database.db`). Name and age keep the card aligned with the public player identity shown by the site. For valuation, the saved `overallValues` array is also the canonical saved Expected Seasons horizon because the Evaluation page creates exactly one Overall entry per raw expected season. Public age/retirement context is therefore only a backward-compatibility fallback when a legacy payload does not contain that horizon.

Preview metadata and the dynamic 2400x1260 social card are derived from the validated public share payload plus that public player context. Overall and Position come from the explicitly shared Evaluation inputs. The user-facing `Value` metric is the same discounted present-value sum shown in the Evaluation summary table, using the saved share horizon, shared Evaluation inputs, discount/first-season settings, and late-season reward rates. Invalid or expired links fall back to generic metadata/card output before any player lookup, and saved/private `evaluation_saves` data is never queried by either preview path.

All persisted fields have direct sharing/lifecycle ownership and are retained.

### `mfl_season_ratios`

Owner/reader: `site/api/mfl-season-ratios-v2.js`. Schema/seed owner: `supabase/migrations/20260730160100_create_mfl_season_ratios.sql`.

Stored values:
- `season`: MFL season identifier.
- `ratio`: historical MFL-per-USD ratio.

This is read-only reference data for the application, not user persistence.

## Local/session/cache-only state

The browser may keep local compatibility/preferences and runtime caches for fast first paint and guest behavior. Those are distinct from Supabase ownership. In particular, wallet proof/session material, request/loading state, route payload caches, guest watchlists, and the legacy per-entity recent-search arrays do not need independent Supabase copies.

The wallet presence data is intentionally server-owned rather than stored in the browser: the site proves the wallet to the API, and `site/api/_wallet-presence.js` resolves the current runtime agent name and writes it with the server timestamp into `wallet_opt_ins`.

## Issue #200 cleanup

The Issue #200 audit removed three redundant keys from new `wallet_preferences.table_state` writes:
1. `linkedWalletAddress` — duplicates the row primary key.
2. `recentSearchPlayerIds` — derivable from canonical `recentSearchItems`.
3. `recentSearchAgentWallets` — derivable from canonical `recentSearchItems`.

The pre-existing watchlist-state cleanup remains in place. Migration `supabase/migrations/20260823140000_minimize_wallet_preferences_table_state.sql` removes redundant keys from existing rows conservatively: legacy recent-search arrays are deleted only when canonical `recentSearchItems` is already present, so legacy-only histories are never discarded before the API can migrate them on the next authenticated save.