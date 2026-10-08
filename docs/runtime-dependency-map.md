# ARCH-04 — runtime dependency map

ARCH-04 records the existing dependency topology and adds a deterministic guardrail. It does not introduce a new runtime layer or a route-size threshold.

## Universal startup

1. `modules/app-entry.js` is the bootstrap owner.
2. `UNIVERSAL_RUNTIME_SCRIPTS` contains only truly universal support runtimes.
3. The manifest's `shared` domain is generated as the single `modules/app-core-runtime.js` universal core.
4. Shared retains the existing **355000-byte** no-growth ceiling. ARCH-04 does not replace or relax that ceiling.

## Lazy route domains

`modules/core-source-manifest.js` owns one generated runtime per non-Shared domain:

- Evaluation → `app-core-evaluation-runtime.js`
- MFL Stats → `app-core-mfl-stats-runtime.js`
- Club → `app-core-club-runtime.js`
- My Clubs → `app-core-my-clubs-runtime.js`
- Planner → `app-core-planner-runtime.js`
- Settings → `app-core-settings-runtime.js`
- Player → `app-core-player-runtime.js`
- Table → `app-core-table-runtime.js`
- Wallet → `app-core-wallet-runtime.js`
- Watchlist → `app-core-watchlist-runtime.js`

`modules/app-config.js` maps route/page state to the required core domains and pre/post route runtimes. `modules/app-entry.js` consumes that plan through `ensureRouteRuntime`, deduplicates concurrent loads by runtime key, loads `preCore`, ensures the requested core, then loads `postCore`.

## Table composition

Table infrastructure is shared by Database, MFL, Progression, Agents, Watchlist, My Players and Club without making those route domains universal. MFL Stats, Club and Watchlist explicitly compose Table with their own route domain where needed.

## Optional first-use runtimes

Global Search and Bug Report remain first-use lazy and are intentionally absent from `UNIVERSAL_RUNTIME_SCRIPTS`.

## No route-size ceiling

ARCH-04 intentionally adds **no route-size ceiling**. Route chunks should be split when ownership, testability or measured startup cost justifies it; an arbitrary byte target would encourage cosmetic fragmentation. The stable enforcement boundary is:

- Shared universal bytes may not exceed the existing manifest ceiling.
- Route-domain runtimes may not be promoted into universal startup accidentally.
- Route dependency plans remain the canonical load graph.
- Deep-link/refresh and transition behavior continue to be covered by existing browser routing and Site Quality regressions.
