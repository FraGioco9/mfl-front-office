# NAV-01 — Entity deep links, real HTTP status and first-response metadata

## Problem
The wildcard Next shell returned HTTP 200 for every syntactically valid-looking `/players/<id>` and `/clubs/<id>/<view>` link, including completely absent IDs. The SPA later detected missing players/clubs and rendered its own Not Found state; crawlers and shared link previews received a soft-404. An unavailable data backend must not be confused with a missing entity.

## Decision / implementation
- The existing Next `getServerSideProps` resolves **only** Player/Club deep links before returning the initial HTML; all other routes avoid SQLite and keep their original SSR metadata/behavior.
- Strict positive decimal, safe-integer IDs and known club view slugs are required before touching the database. Malformed IDs and unsupported views return 404 immediately.
- Player existence uses a single read-only `SELECT 1 ... WHERE player_id = ? LIMIT 1`, binding the ID **as text** to match SQLite's `TEXT` identity storage even under Node's `node:sqlite`. The same applies to Club ID probes. **Retired players are valid identities**: no `retirement_years > 0` filter. Club existence checks `runtime_clubs` followed by `clubs`, matching profile fallback. If neither club identity table exists, presence is unknown and the request stays 200 (no fabricated missing entity); the SPA and API still own full profile loading.
- Definitively missing records send HTTP 404, with a public `Player/Club not found` title and description in initial HTML; the existing application shell and route renderer stay present (no Next generic 404 shell). Database failure returns HTTP 503 with `Could not load Player/Club` public metadata; internal error details are neither reflected nor logged into the public response.
- Native Node `createRequire` loads the canonical CommonJS SQLite layer by a fixed server-local absolute path **only for entity routes**, avoiding the Next 16 SSR Turbopack `node:sqlite` external incompatibility. The wildcard route explicitly traces the SQLite module and snapshot in `next.config.mjs`. SQLite read-only connection and prepared statements are cached by the existing API module. **No profile/roster fetch or database mutation is added to first paint.**
- Search query strings, wallets and shared-plan IDs are never interpolated into public HTML metadata.
- Keep the existing browser route, history, selected view and client-side retry/error UI; page title changes on hydration remain SPA-owned. Unknown-route behavior is not changed.

## Verification
- `validate-nav01-entity-http.mjs`: correct parsing of malformed/encoded/overflow IDs, club view aliases, no SQL on invalid routes, simulated found/missing/unknown/backend-failed records, public-safe 404/503 titles, no retired-player filter and SSR status wiring.
- **Actual Next HTTP test:** `validation/next-initial-page-metadata-http.mjs` on built production Next with an ephemeral **CI-only SQLite fixture**, checking 200 on Player 1/2 and Club 123, 404 on Player 999999999/abc/0/unsupported subpath and invalid Club views/IDs, and correct title/meta in raw HTML.
- Use the existing smoke fixture (two valid Player IDs, one sample runtime club ID) created inside the Next CI smoke step and discarded with the ephemeral runner. No production database changes.
- Existing source checks, lint, typecheck, browser routing, Planner, mobile, Windows smoke and generated asset parity.

## Pending final gate
- Direct-refresh/bookmark in deployed production: real existing Player and Club, legitimately retired Player, deleted Player/Club, stale snapshots, unknown Club ID, malformed percent encoding, query parameters, tab/back/fwd history, unauthorized guest, and slow API / 503 fallback. Real Safari iPhone and Next/Vercel CDN cache/header behavior. Do not claim real production coverage from synthetic CI.
- Avoid increasing synchronous DB work further; if production SQLite lookup ever becomes costly, measure P95 first-response TTFB and adjust before release.
