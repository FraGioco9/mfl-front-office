# Supabase persistence ownership

This document is the canonical inventory of MFL Front Office data persisted in Supabase. Supabase is used only for data that must survive devices/sessions or for server-side reference/access-control data. Ephemeral loading state, request/cache state, and redundant copies of an already-owned identity are not cloud persistence.

## Access model

`api/_supabase.js` is the shared REST client. Application writes and private reads use the server-side service-role key. `api/mfl-season-ratios-v2.js` may use the anon key for the read-only historical ratio dataset. Wallet-owned private endpoints authenticate through the server-issued wallet session cookie before accessing a wallet row; replayable legacy proof headers are no longer an authorization fallback.

`bug_reports` is also private application data. The browser never writes to Supabase directly: it submits to `api/bug-reports.js`, which validates and rate-limits the report before using the server-side service-role client. The table has RLS enabled, no `anon` or `authenticated` privileges, and no public read policy.

`api/_operational-health.js` is the server-only reader for operational runtime objects in the existing private `mfl-runtime` Storage bucket. It reads the Marketplace runtime snapshot plus `health/database-refresh.json` and `health/marketplace-refresh.json` with the service-role key; `api/operational-health.js` exposes only normalized freshness/outcome metadata and never returns credentials or raw private objects. Scheduled production workflow writes are owned by `scripts/operations/runtime_health.py`.

## SEC-07 — Supabase Auth password-advisor scope (1 October 2026)

The **MFL Front Office web application** authenticates users with an FCL/Dapper wallet challenge and signed account proof. `api/wallet-session.js` issues a first-party, HttpOnly, SameSite=Strict wallet-session cookie; `api/_wallet-auth.js` resolves that server-owned session before private wallet actions. `api/_supabase.js` uses the server-side service-role REST API, not a Supabase Auth user JWT. A search of the runtime sources and package manifest found no Supabase Auth password login, registration or password-reset implementation.

The **Supabase project** is a separate security boundary. Read-only checks on 1 October 2026 found:

- Security Advisor warning `auth_leaked_password_protection` (`WARN`): leaked-password protection is disabled.
- Four rows in `auth.users`, four rows in `auth.identities`, all four identities using provider `email` and all four user rows with non-empty password hashes (aggregated counts only; no email addresses or hashes retrieved).
- These records show that password-capable accounts **exist in this project**. They do **not** prove that the current email/password provider is enabled, that the accounts are active, or that this MFL site uses them. Ownership/purpose of the records has not been established.

**Decision:** the warning is **not applicable to the Front Office's wallet login path**, but **must not be dismissed as inapplicable to the entire Supabase project**. Preserve the warning as a project-level follow-up until the provider configuration and purpose of the four accounts are confirmed by the project owner in the Supabase Auth dashboard. If password login is in use, assess enabling leaked-password protection (Supabase documents plan availability and settings in [Password security](https://supabase.com/docs/guides/auth/password-security)). Do not delete or change account records to silence an advisor.

`validate-sec07-auth-boundary.mjs` is a static regression inventory: it guards the canonical runtime sources against introducing Supabase Auth credential APIs without re-review and checks the app's wallet/server REST boundary. It does **not** read project Auth settings or replace a real login/browser test. Its presence is not evidence that the four Auth records are safe or unused.

**Release policy:** this audit requires no database migration, user-account change, Supabase Auth configuration edit, or Vercel deployment. Keep all Vercel deployments and SEC-05 database migration for the single coordinated final release of issue #1034.

## SEC-05 — explicit deny-by-default grants (staged; not applied to production)

The 1 October 2026 **read-only production audit** found **12 public application tables** with RLS enabled and **zero RLS policies**. This is intentional: the browser never authenticates to Supabase as a row owner; wallet ownership is verified by first-party server routes, which query the database via `service_role` after checking the server-issued session. Supabase Security Advisor's `rls_enabled_no_policy` finding is therefore **informational**, not a request to create public policies. [Advisor rule](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Six legacy tables nevertheless had explicit broad grants to `anon` and `authenticated` (including `TRUNCATE`): `evaluation_saves`, `evaluation_shares`, `mfl_season_ratios`, `wallet_opt_ins`, `wallet_permissions`, `wallet_preferences`. The six newer tables already lacked those grants: `bug_reports`, `planner_plans`, `planner_shares`, `wallet_auth_consumed_challenges`, `wallet_auth_rate_limits`, `wallet_auth_sessions`. With zero client policies, those roles could not read or modify rows through RLS, but removing the table grants provides another protection layer against future policy changes. The live trigger `public.set_updated_at()` also retained `EXECUTE` granted to `PUBLIC`, `anon` and `authenticated`; seven other application functions already had server-only execution grants. No public-schema sequences or views were found.

Storage was also checked read-only: the only storage bucket is `mfl-runtime`, it is **private** (`public=false`), and `storage.objects` has no RLS policies. `anon`/`authenticated` have normal schema `USAGE` privileges on `public` and `storage`, which are not sufficient to bypass table/object permissions. Do not revoke shared `storage` schema access or change Storage's built-in grants to fix the application's table grants.

The staged `supabase/migrations/20261001172000_restrict_application_grants.sql`:
- revokes all direct table privileges from `PUBLIC`, `anon`, and `authenticated` for **all 12** application tables;
- explicitly preserves server-side `SELECT/INSERT/UPDATE/DELETE` grants on each table;
- revokes public execution of the existing `set_updated_at()` trigger function but preserves `service_role`;
- removes legacy automatic table/sequence grants from `postgres`'s `public` default privileges and removes explicit default `anon/authenticated` function execution grants. It does not change RLS policies, rows, stored procedures, roles or their passwords.

**Provisioning residual:** production default ACLs also exist for objects owned by `supabase_admin`. The connected SQL owner is `postgres`, which cannot assume `supabase_admin`; this migration deliberately does not claim to alter those defaults. PostgreSQL functions may also gain `PUBLIC EXECUTE` from **global** default privileges, independent of schema-specific revocations. New function migrations must therefore explicitly revoke `PUBLIC`, `anon`, and `authenticated` per function, and future table migrations must explicitly enable RLS/revoke browser grants and grant `service_role`. Review the Supabase project-level **Automatically expose new tables and functions** setting and the [2026 default-grants change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) before introducing new objects. Do not modify `supabase_admin` privileges without an authorized project-level migration.

The `/api/mfl-season-ratios-v2` REST reader is public to the MFL site **but** its Supabase data access remains server-only. It now requires the service-role key instead of attempting an `anon` fallback (which could not read under zero RLS policies). An HTTP GET to the first-party endpoint remains available; the secret never reaches the browser.

**Release policy:** SEC-05 migration and code changes are **not applied to Supabase production now** and are **not deployed to Vercel**. After all of issue #1034 is ready, execute the versioned Supabase migration in the same coordinated final release as Vercel (database migration first, then protected Vercel site update), verify the role ACLs and API reads/writes, and retain a rollback plan. Until then production uses the original privilege set. CI uses an **isolated PostgreSQL 17** service to verify RLS, grants, migration idempotence, trigger behavior and subsequent table defaults without altering production.

## Tables and owners

### `wallet_opt_ins`

Canonical write owner: `api/_wallet-presence.js`. Callers are `api/wallet-opt-ins.js` for the opt-in flow and `api/wallet-preferences.js` for authenticated visit tracking.

Stored values:
- `wallet_address`: the opted-in wallet identity.
- `agent_name`: the current MFL agent name resolved from the packaged runtime wallet database when the wallet presence record is touched.
- `opted_in_at`: first persisted opt-in timestamp.
- `last_seen_at`: most recent authenticated visit/activity timestamp.

`agent_name` and `last_seen_at` are refreshed when the signed wallet opts in and whenever the authenticated wallet-preferences GET succeeds far enough to run its parallel presence touch. Agent names are refreshed only when the current runtime database contains a non-empty name for that wallet, so a temporary lookup miss does not erase a previously known name. Application startup already requests wallet preferences for a restored valid session marker; the server still requires the HttpOnly session cookie before treating the request as authenticated. An opted-in user's return to the site therefore refreshes presence data without restoring or replaying Flow proof material. A failed presence touch is non-blocking and does not prevent required preferences from loading.

This table is retained as the explicit opt-in/audit and last-seen record. It is not duplicated into `wallet_preferences`.

### `wallet_permissions`

Owners/readers: `api/_data-auth.js` and `api/wallet-permissions-version.js`.

Stored values:
- `wallet_address`: permission subject.
- `can_view_progression`: progression-data access gate.
- `updated_at`: permission-version signal used to invalidate cached authorization state.

These values are server-side access-control data and are not UI preferences.

### `wallet_preferences`

Owner: `api/wallet-preferences.js`. Server-side progression email reads are performed by `scripts/email/send_progression_emails.py`; `.github/workflows/full-database-refresh.yml` only supplies that script with the Supabase credentials.

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

For compatibility, `api/wallet-preferences.js` still accepts legacy player/agent recent-search arrays, folds them into `recentSearchItems`, and derives the legacy arrays in API responses. The duplicate arrays are compatibility output, not cloud storage.

`recentEvaluationPlayerIds` remains separate because it belongs to Evaluation history rather than global search.

All authenticated preference PUT writes are normalized by `api/wallet-preferences.js` and sent as one supplied-domain patch to the atomic database RPC `public.patch_wallet_preferences_atomic`. The RPC creates the wallet row when needed, locks the row with `FOR UPDATE`, merges `recentSearchItems` and `recentEvaluationPlayerIds` inside the same database transaction while preserving incoming-first order, de-duplicating values and keeping the five-item cap, then replaces only the other preference domains explicitly present in that request. This removes the previous table-state read → Node merge → REST PATCH race, so overlapping server requests cannot both read the same stale recent-history snapshot and overwrite one another.

The atomic database RPC is `SECURITY INVOKER`, pins an empty `search_path`, and is service-role-only: `PUBLIC`, `anon`, and `authenticated` have no execute privilege. Browser clients therefore cannot call it directly; the signed-wallet API remains the ownership/authentication boundary. Schema ownership is recorded in `supabase/migrations/20260908131924_atomic_wallet_preferences.sql` and mirrored in `supabase-schema.sql`.

### `wallet_auth_rate_limits`

Owner: `api/_wallet-rate-limit.js`. Migration:
`supabase/migrations/20261001155224_wallet_auth_distributed_rate_limit.sql`,
mirrored in `supabase-schema.sql`.

Only a 64-hex-character HMAC-SHA256 of the trusted request IP and rate-limit
operation, attempt count, and window expiry are stored; no raw IP address,
wallet address, nonce, token, or credential is persisted in rate-limit rows.
The HMAC uses the server-only Supabase service role key. Challenge issuance
and exchange consume an atomic one-minute bucket through the
`public.consume_wallet_auth_rate_limit` RPC before processing the request,
enforcing 20 and 10 requests respectively across serverless instances.
The Postgres function is `SECURITY INVOKER` with a pinned empty search path.
Its table has RLS enabled; both table and RPC have explicit
`anon`/`authenticated`/`PUBLIC` revocations, with service-role grants.
Old buckets are pruned opportunistically. The API fails closed when configured
distributed throttling is unreachable; local development without configured
Supabase uses bounded in-memory fallback. Logout remains locally bounded,
so a failed distributed store cannot prevent cookie cleanup.

### `wallet_auth_consumed_challenges` and `wallet_auth_sessions`

Owner: `api/_wallet-session.js`. Schema/transaction owner:
`supabase/migrations/20260914150000_wallet_auth_sessions.sql`, mirrored in
`supabase-schema.sql`.

These tables are the active durable server-side foundation for challenge replay protection and expiring
wallet sessions. The migration phase is complete: `api/wallet-session.js` issues and exchanges the
server challenge, creates the first-party HttpOnly session cookie, and revokes that session on logout;
`api/_wallet-auth.js` resolves the cookie for private wallet-owned API access. Legacy proof headers are
not an authorization fallback. The browser may retain only a non-authorizing local session marker for UI
restoration; possession of that marker alone cannot authenticate an API request.

`wallet_auth_consumed_challenges` stores only the challenge nonce, verified wallet, challenge expiry
and consumption timestamp. The nonce is unique, so the service-role-only
`public.consume_wallet_challenge_and_create_session` RPC can atomically claim it once across server
instances.

`wallet_auth_sessions` stores only a SHA-256 session-token hash, wallet, creation/expiry timestamps
and optional revocation time. Raw session bearer tokens are never persisted. Application-generated
sessions use a seven-day lifetime; the RPC rejects invalid or already-expired challenge deadlines and
rechecks challenge expiry using the database clock before inserting the session.

The consume RPC inserts the nonce and session in the same transaction, so a session-insert failure
cannot permanently consume the challenge. A duplicate nonce returns no session. The resolve RPC returns
only unexpired, unrevoked sessions; the revoke RPC marks an active session revoked. Expired challenges
and sessions are pruned during successful exchange attempts.

Both tables have RLS enabled, no `PUBLIC`, `anon`, or `authenticated` privileges, and their RPCs are
service-role-only. Browser clients never call these tables/functions directly.

### `evaluation_saves`

Owner: `api/evaluation-save.js`.

Stored values:
- `id`: saved Evaluation identifier.
- `wallet_address`: owner and list/delete scope.
- `player_id`: queryable player identity for the saved Evaluation.
- `payload`: normalized Evaluation state required to restore it.
- `created_at`: ordering/limit metadata.

The API permits up to 100 saved Evaluations per wallet. Overwriting an existing saved Evaluation does not consume another slot, and list reads return the full saved set up to that limit.

`player_id` is retained separately from `payload` because it is a query/identity field; it is not an accidental UI-state duplicate.

### `evaluation_shares`

Write/lifecycle owner: `api/evaluation-share.js`. Active-share lookup owner: `api/_evaluation-share-preview.js`, reused by `api/evaluation-share.js`, the public shared-link metadata endpoint `api/evaluation-preview.js`, and the dynamic social-card endpoint `api/evaluation-preview-image.js`.

Stored values:
- `id`: share identifier.
- `wallet_address`: creator identity retained for ownership/audit context; there is no per-wallet share-count limit.
- `player_id`: validates/resolves the shared player context.
- `payload`: normalized public Evaluation share state.
- `created_at`: share ordering metadata.
- `expires_at`: mandatory expiry and active-share filtering; new shares expire one calendar year after share creation.

Shared Evaluations are unlimited per wallet. Creating a new share never prunes or replaces older active shares; each link remains valid independently until its own `expires_at` timestamp.

The preview lookup selects only `id`, `player_id`, `payload`, and `expires_at`; it never exposes or selects the creator wallet. Only after that active share has been validated, the preview owner resolves the player's current public `name`, `age`, and `retirement_years` from the packaged public player database (`mfl_database.db`). Name and age keep the card aligned with the public player identity shown by the site. For valuation, the saved `overallValues` array is also the canonical saved Expected Seasons horizon because the Evaluation page creates exactly one Overall entry per raw expected season. Public age/retirement context is therefore only a backward-compatibility fallback when a legacy payload does not contain that horizon.

Preview metadata and the dynamic 2400x1260 social card are derived from the validated public share payload plus that public player context. Overall and Position come from the explicitly shared Evaluation inputs. The user-facing `Value` metric is the same discounted present-value sum shown in the Evaluation summary table, using the saved share horizon, shared Evaluation inputs, discount/first-season settings, and late-season reward rates. Invalid or expired links fall back to generic metadata/card output before any player lookup, and saved/private `evaluation_saves` data is never queried by either preview path.

All persisted fields have direct sharing/lifecycle ownership and are retained.

### `planner_plans`

Owner: `api/planner-save.js`.

Stored values:
- `id`: saved plan identifier.
- `wallet_address`: private owner and list/update/delete scope.
- `club_id`: queryable club identity for the plan.
- `name`: user-defined plan name.
- `payload`: normalized Planner snapshot containing schema version, formation, squad player IDs/contracts, and lineup slot assignments.
- `revision`: optimistic-concurrency revision. Updates and deletes must match the current revision; successful overwrites increment it.
- `created_at`: creation metadata.
- `updated_at`: ordering metadata refreshed when the plan is overwritten or renamed.

The API permits up to 50 saved plans per wallet. Saved-plan updates and deletes are wallet-scoped and revision-checked; stale clients receive HTTP 409 instead of overwriting or deleting a newer revision. Deleting a saved plan cascades to its linked share so an external link cannot outlive its source plan. Player names, ratings, portraits, club display metadata, and other public MFL data are intentionally not copied into the plan snapshot; opening a plan resolves player IDs against the current packaged database so public player data stays current.

### `planner_shares`

Owner: `api/planner-share.js`.

Stored values:
- `id`: unlisted share identifier.
- `wallet_address`: creator identity retained only for ownership/audit context and never returned by public reads.
- `source_plan_id`: optional private linkage to the owner's saved Planner plan; it is used only by authenticated share-management reads/revocation and is not returned by public share lookup.
- `club_id`: shared club identity.
- `name`: shared plan name.
- `payload`: the same normalized Planner snapshot used by saved plans.
- `created_at`: share creation metadata.
- `expires_at`: mandatory one-year expiry used by public share lookup.

Creating a share copies the normalized plan state into an independent read-only snapshot. A saved plan owns at most one active share: `(wallet_address, source_plan_id)` is unique and replacement uses a single Supabase upsert, so concurrent Share requests cannot leave two active links for the same saved plan. Replacing the row also invalidates the previous external ID immediately. Authenticated owner reads can list active shares and owners can explicitly revoke a share by ID; DELETE is wallet-scoped. Public GET reads select only share-safe fields and never expose the creator wallet or source-plan linkage. A recipient can view a stable `/planner/<plan_id>` share without opting in; saving a copy requires an authenticated opted-in wallet and creates a new `planner_plans` row rather than mutating the original share.

### `bug_reports`

Owner: `api/bug-reports.js`. The browser-side form owner is `bug-report-runtime.js`; it sends reports only to the same-origin API endpoint and never receives Supabase credentials.

Stored values:
- `id`: generated report identifier.
- `summary`: short reporter-provided problem summary.
- `area`: validated product area matching the repository bug-report taxonomy.
- `route`: route/page where the issue occurred; the form prefills the current route.
- `reproduction`: reporter-provided steps to reproduce.
- `expected_behavior`: expected result.
- `actual_behavior`: observed result.
- `environment`: device/browser context, prefilled by the browser and editable by the reporter.
- `evidence`: optional links, console messages, or additional context.
- `app_version`: current MFL Front Office release when the form is submitted.
- `user_agent`: server-observed browser user-agent metadata.
- `wallet_address`: optional verified wallet identity when the reporter already has a valid server wallet session; bug reporting itself does not require opt-in.
- `reporter_hash`: HMAC-SHA256 of the request address using a server-only key, used only for abuse throttling. The raw IP address is never persisted.
- `status`: internal triage lifecycle (`new`, `triaged`, `planned`, `resolved`, or `dismissed`).
- `created_at`: submission timestamp.

The endpoint accepts POST only, validates lengths and the allowed Area set, caps request size, and permits at most five reports from the same reporter hash per rolling hour. The reporter-hash/time index supports that lookup; the status/time index supports later triage views. `bug_reports` has RLS enabled and intentionally has no client policies or `anon`/`authenticated` table privileges. Only the server-side service-role application path can read or mutate reports.

The GitHub issue URL remains in the footer as a no-JavaScript/modifier-click fallback. Normal in-site submissions are stored in Supabase first so reports can be triaged before any selected report is promoted to a GitHub issue.

### `mfl_season_ratios`

Owner/reader: `api/mfl-season-ratios-v2.js`. Schema/seed owner: `supabase/migrations/20260730160100_create_mfl_season_ratios.sql`.

Stored values:
- `season`: MFL season identifier.
- `ratio`: historical MFL-per-USD ratio.

This is read-only reference data for the application, not user persistence.

## Local/session/cache-only state

The browser may keep local compatibility/preferences and runtime caches for fast first paint and guest behavior. Those are distinct from Supabase ownership. Wallet authentication is now represented locally only by a non-authorizing session marker; Flow signatures and challenge material are not persisted after exchange. Request/loading state, route payload caches, guest watchlists, and legacy per-entity recent-search arrays do not need independent Supabase copies. Server-issued wallet sessions are the deliberate exception: only their one-way token hashes and replay/expiry metadata live in the dedicated private auth tables above.

The wallet presence data is intentionally server-owned rather than stored in the browser: the site proves the wallet to the API, and `api/_wallet-presence.js` resolves the current runtime agent name and writes it with the server timestamp into `wallet_opt_ins`.

## Issue #200 cleanup

The Issue #200 audit removed three redundant keys from new `wallet_preferences.table_state` writes:
1. `linkedWalletAddress` — duplicates the row primary key.
2. `recentSearchPlayerIds` — derivable from canonical `recentSearchItems`.
3. `recentSearchAgentWallets` — derivable from canonical `recentSearchItems`.

The pre-existing watchlist-state cleanup remains in place. Migration `supabase/migrations/20260823140000_minimize_wallet_preferences_table_state.sql` removes redundant keys from existing rows conservatively: legacy recent-search arrays are deleted only when canonical `recentSearchItems` is already present, so legacy-only histories are never discarded before the API can migrate them on the next authenticated save.
