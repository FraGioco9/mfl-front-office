# Performance evidence for issue #923

This document records deterministic evidence used by backend/performance PRs. Wall-clock
production measurements remain separate because CI fixture latency is not representative.

## Paged COUNT reuse

Owner: `site/api/_data-page.js`.

Before the count-cache change, every `pagedData` request executed:

- one `COUNT(*)` when the filtered and source result set were identical;
- two `COUNT(*)` queries when filters changed the result set.

Changing only page number or sort order does not change either count, but previously repeated
those SQLite queries anyway.

The canonical page-query owner now caches counts by:

- current published database generation (`getGeneratedAt()`);
- exact SQL `WHERE` text;
- exact bound parameter list.

The cache is LRU-style and capped at 256 result sets. A new published dataset clears the cache.
Page number and sort order are deliberately excluded from the key.

Therefore, after the first request for a result set, subsequent page/sort requests execute
**zero repeated COUNT queries** for that result set until the dataset generation changes.

## Prepared-statement reuse

Owner: `site/api/_database.js`.

Before this change, every `queryRows(sql, parameters)` and `queryOne(sql, parameters)`
execution called `DatabaseSync.prepare(sql)`, even when the SQL text was identical to a
previous request.

The canonical database owner now retains compiled statements by exact SQL text, promotes them
on reuse, and caps the cache at 128 statements. Bound values are still supplied fresh on every
`.all(...parameters)` or `.get(...parameters)` call.

Deterministic compile-count effect for a repeated SQL shape:

- before: N executions => N calls to `prepare(sql)`;
- after: N executions => 1 initial `prepare(sql)` plus N parameter-bound executions, until
  that SQL text is evicted from the bounded cache or the server process ends.

This records compile-work removal only; production wall-clock improvement remains part of the
separate runtime baseline.

## Precomputed bootstrap manifest counts

Owner: `scripts/database/prepare_runtime_database.py` for snapshot preparation and
`site/api/_database.js` / `site/api/_data-query.js` for reads.

Before this change, each uncached bootstrap manifest built `row_count` and `wallet_count`
with live `COUNT(*)` queries against `players` and `wallets`.

New runtime snapshots store both totals in `runtime_metadata`. The SQLite owner loads that
small metadata table once when opening the process-local database, so manifest construction
performs **zero count queries** on rebuilt snapshots. The former live counts remain only as a
compatibility fallback when either metadata key is absent in an older snapshot.

Deterministic request-work effect on a rebuilt snapshot:

- before: 2 request-time `COUNT(*)` queries per uncached manifest build;
- after: 0 request-time `COUNT(*)` queries for those totals.

## Paged MFL Stats source-count reuse

Owner: `pagedData()` in `site/api/_data-page.js`.

The primary MFL Stats table route uses `scope=mflstats`. Its unfiltered source population is
the same canonical normalized MFL-wallet population precomputed for `mfl-stats-all`.

The paged table owner now reuses `mfl_stats_all_total_players` only when the source SQL
predicate and bound parameters exactly match that canonical population. This preserves access
constraints and avoids applying the snapshot total to a different result set.

Deterministic request-work effect on rebuilt snapshots:

- unfiltered MFL Stats: 1 request-time source/result `COUNT(*)` -> 0;
- filtered MFL Stats: filtered result count remains live, but the separate unfiltered
  `sourceRows` count is read from metadata -> 1 fewer `COUNT(*)`;
- older snapshots: unchanged live-count fallback.

## Precomputed MFL Stats all-player total

Owner: `scripts/database/prepare_runtime_database.py` for snapshot preparation and
`runtimeMetadataCount()` / `mflStatsData()` for reads.

The paginated `mfl-stats-all` mode needs the complete MFL-wallet population size before it can
calculate page bounds. That population is stable for one published database snapshot.

Runtime preparation now stores the exact count for
`lower(coalesce(wallet_address, '')) = MFL_WALLET_ADDRESS` as
`mfl_stats_all_total_players`. Rebuilt snapshots therefore read the count from the metadata
map already loaded at SQLite open. Older snapshots retain the previous live `COUNT(*)`
fallback.

Deterministic request-work effect for `mfl-stats-all` on rebuilt snapshots:

- before: 1 request-time `COUNT(*)` + 1 paged result query;
- after: 0 request-time `COUNT(*)` + 1 paged result query.

## MFL Stats redundant-count removal

Owner: `mflStatsData()` in `site/api/_data-views.js`.

The normal `mfl-stats` mode already loads its complete matching player population in one
ordered query. It previously issued a separate `COUNT(*)` over the identical predicate before
that full-row read.

The normal mode now derives `totalRows`, `sourceRows`, and `pageSize` directly from the
materialized row count. The paginated `mfl-stats-all` mode retains its count query because it
does not load the complete result set on each request.

Deterministic request-work effect for normal MFL Stats:

- before: 1 aggregate count query + 1 full result query;
- after: 0 aggregate count queries + 1 full result query.

## Loaded table-catalog reuse

Owner: `site/api/_database.js`.

Opening the read-only SQLite snapshot already reads every table name from `sqlite_master` to
validate the database contract. Previously, each distinct later `tableExists(name)` check
issued another `sqlite_master` lookup before caching that answer.

The connection owner now retains the table-name set loaded at open time and answers all route
table-existence checks from that in-memory catalog.

Deterministic request-work effect per process/snapshot:

- before: 1 initial full table-catalog read + up to 1 extra sqlite_master query per distinct
  table checked by request paths;
- after: 1 initial full table-catalog read + 0 later table-existence queries.

## Cached Club table schema

Owner: `site/api/_database.js`.

My Clubs and individual Club profile reads previously executed `PRAGMA table_info(...)` at
request time to rediscover columns in `runtime_clubs` and, when needed, `clubs`.

Table schema is immutable for the lifetime of the process-local read-only snapshot. The
database owner now caches the normalized column-name list on first inspection and returns the
same frozen metadata object on later reads.

Deterministic request-work effect:

- first access to a Club table in one process: 1 schema PRAGMA;
- subsequent My Clubs / Club profile reads: 0 repeated schema PRAGMAs for that table.

## Database Stats read-path reuse

Owner: `site/api/_database-stats.js`.

The prepared Database Stats path already reads the compact `runtime_database_stats` table, but
it still queried `runtime_metadata` three times per request for the contract, total-player,
and active-player values. Those metadata rows are now supplied by the process-local metadata
map loaded once by `site/api/_database.js`.

The older-snapshot live fallback also previously ran a separate retired-player aggregate after
already computing total and active players. Retired players are now derived as
`totalPlayers - totalActivePlayers`.

Deterministic request-work effect:

- rebuilt snapshot: 3 runtime-metadata SELECTs -> 0 per Database Stats request;
- older-snapshot fallback: 3 aggregate queries against `players` -> 2, with identical totals.

## Shared summary/manifest counts

Owner: `manifestPayload()` in `site/api/_data-query.js`.

The public `mode=summary` endpoint previously duplicated the bootstrap manifest's player and
wallet `COUNT(*)` queries. It now reads the same manifest payload used by bootstrap.

On rebuilt snapshots this means both endpoints consume the precomputed runtime metadata counts.
On older snapshots both endpoints share the same compatibility fallback.

Deterministic request-work effect for `mode=summary` on a rebuilt snapshot:

- before: 2 request-time `COUNT(*)` queries;
- after: 0 request-time `COUNT(*)` queries.

## Precomputed MFL Stats summary

Owner: `scripts/database/prepare_runtime_database.py` for snapshot preparation and
`site/api/_mfl-stats-summary.js` for reads.

Before this change, every MFL Stats summary request grouped the full MFL-owned subset of
`players` by derived overall, age and category at request time. Those values are stable for
the lifetime of one published database snapshot.

The runtime database now materializes the exact `overall / age / category / player_count`
summary once during preparation in `runtime_mfl_stats_summary`. The API reads that compact
table when available and retains the previous live aggregate only as an older-snapshot fallback.

`test_precomputed_mfl_stats_summary_reduces_sqlite_work` verifies both paths return identical
rows and that the precomputed read executes fewer SQLite VM steps, with no temporary sort
B-tree in the compact-table plan.

## Existing query-plan evidence

`scripts/database/runtime_query_plans.py` and `tests/test_runtime_query_plans.py` already
protect representative Database, Agent, MFL, Club and Watchlist planner shapes.

The deep Database test also shows a seek-pagination query performs at most 35% of the SQLite
VM work of the equivalent deep OFFSET query on the deterministic fixture. Production still
supports arbitrary page jumps and arbitrary sorts/filters, so cursor pagination requires a
separate contract rather than replacing OFFSET opportunistically.

## Repeatable browser/runtime baseline harness

Owner: `site/validation/performance-baseline.mjs`.

Run the real application in local Vercel development mode (port 4000 by default), then execute:

```powershell
npm --prefix site run performance:baseline
```

The harness discovers a representative Player and contracted Club from the live database before
measurement, then covers exactly the representative #923 journeys:

- Database: `/database/attributes`;
- Player: discovered `/players/<id>`;
- Club: discovered `/clubs/<id>/squad`;
- My Clubs: `/my-clubs`;
- Evaluation: `/evaluation?player=<id>`;
- Stats: `/mfl/stats`.

For each journey it captures **cold**, **refresh**, and **cached SPA revisit** behavior. The
default run count is five repetitions per phase/profile; reports show the median and observed
slowest result. Profiles are:

- `desktop`: 1280x900, unthrottled;
- `mobile-slow`: 390x844, 4x CPU slowdown plus explicit network latency/throughput
  throttling.

Collected metrics include:

- total/API request counts;
- total/API transferred bytes from Chrome's network events;
- canonical `window.__mflClientPerformance` useful-content and visually-settled timing;
- existing API `Server-Timing` durations;
- browser long-task count/duration;
- cumulative layout shift.

On Windows, the harness automatically checks standard Chrome, Edge (Chromium), and Chromium
install locations under Program Files and LocalAppData. `CHROME_PATH` remains available only as
an explicit fallback for non-standard installations.

Useful overrides:

```powershell
$env:MFL_BASE_URL="http://127.0.0.1:4000"
$env:MFL_BASELINE_RUNS="5"
$env:MFL_BASELINE_PROFILES="desktop,mobile-slow"
$env:MFL_BASELINE_LABEL="local-main"
$env:MFL_BASELINE_OUTPUT="performance-baseline.local.json"
npm --prefix site run performance:baseline
```

The benchmark is deliberately **opt-in** and is not added to normal Site Quality CI: browser
wall-clock measurements are noisy and should not make every PR slower. CI instead validates the
harness contract statically. Measurements against a fixture or CI environment must be labelled
as synthetic and must never be described as production latency.

The harness establishes one repeatable measurement method; committed/current baseline values
still need to be captured against the chosen local or deployed environment before the first
delivery-plan baseline checkbox can be closed.

## Still required

Run the repeatable harness against the chosen reference environment and record the resulting
baseline values before closing the #923 baseline deliverable. The measurement tooling itself is
now canonical; fixture/CI latency must remain clearly separated from local/production results.
