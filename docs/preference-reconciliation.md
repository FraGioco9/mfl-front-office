# DATA-02 — Multi-device preference reconciliation

Issue: #1034  
Scope: wallet-backed preferences only. No live Supabase mutation, database refresh or Vercel deploy is required by this change.

## Decision

The server treats each top-level preference domain as the unit of reconciliation:

- `watchlists`
- `playerNotes`
- `tableState`
- `evaluationSettings`
- `settings`

A client sends only the domains it intentionally changed. The API converts those domains to a patch and calls `patch_wallet_preferences_atomic`. The RPC locks the wallet row and updates only keys present in the patch.

### Concurrent changes to different domains

Different-domain writes are preserved, even when one device started from an older snapshot.

Example:

1. Device A and B both load the same state.
2. Device A saves Settings.
3. Device B, still holding the old Settings snapshot locally, changes only Watchlists.
4. Device B sends only `watchlists`; the newer Settings value is not overwritten.
5. The next forced/normal hydration reads the combined authoritative server state.

This is the intended DATA-02 reconciliation rule.

### Concurrent changes to the same domain

There is no general CAS/version field for wallet preferences. Two writes to the same whole domain therefore use **last successful server write wins** semantics.

This is deliberate for the current scope:

- do not claim collaborative or real-time merging;
- do not silently merge arbitrary Watchlist, Settings, Player Note or Evaluation Settings payloads;
- a later hydration is the convergence point between devices.

`tableState` is the one domain with finer-grained server behavior: ordinary keys are merged into the existing object, while `recentSearchItems` and `recentEvaluationPlayerIds` are combined with incoming entries first, de-duplicated and bounded.

## Client behavior

Browser writes are serialized locally through `walletPreferencesWritePromise`, preventing same-tab races.

Local persistence remains a resilience layer, not an independent authority:

- Watchlists and Player Notes keep local copies.
- Settings can retain a pending local draft when cloud save fails.
- EDGE-04 adds explicit Watchlist cloud-sync failure feedback and user-triggered Retry.
- Cross-device changes are not pushed live into another open browser. They become visible when that browser hydrates/refetches the wallet preferences.

No background polling or opaque retry queue is introduced by DATA-02.

## Regression fixture

`tests/test_wallet_preferences_multidevice.mjs` executes the real `api/_handler-wallet-preferences.js` handler with an isolated in-memory Supabase transport and verifies:

- two devices can start from the same stale snapshot;
- a Settings write followed by a stale Watchlist write preserves both;
- a stale Player Notes write cannot overwrite unrelated Watchlists/Settings;
- `tableState` recent items keep the existing bounded merge rule;
- a later GET returns the converged state;
- same-domain writes are explicitly verified as last-successful-write-wins;
- the API still delegates persistence to `patch_wallet_preferences_atomic`;
- the SQL owner still locks the row and patches domains conditionally.

The fixture uses no account, production database, Supabase network request or Vercel environment.

## Result

No application-runtime change is justified for DATA-02. The existing domain-scoped atomic patching already prevents the cross-domain lost-update class described by the roadmap. The remaining same-domain last-write-wins behavior is documented rather than hidden behind an unsupported merge policy.
