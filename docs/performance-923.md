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
$env:MFL_BASELINE_JOURNEYS="database,player,club,my-clubs,evaluation,stats"
$env:MFL_BASELINE_LABEL="local-main"
$env:MFL_BASELINE_OUTPUT="performance-baseline.local.json"
npm --prefix site run performance:baseline
```

Omit `MFL_BASELINE_JOURNEYS` to run all six journeys. For a focused smoke test, provide a
comma-separated subset such as `database,club`; the selected journey set is part of the resume
key, so focused runs cannot be mistaken for a complete reference capture.

The benchmark is deliberately **opt-in** and is not added to normal Site Quality CI: browser
wall-clock measurements are noisy and should not make every PR slower. CI instead validates the
harness contract statically. Measurements against a fixture or CI environment must be labelled
as synthetic and must never be described as production latency.

The desktop profile keeps a 60-second route ceiling. The intentionally constrained
`mobile-slow` profile uses a four-minute route ceiling because large payloads are transferred
through its 200 KB/s emulated link; changing that bandwidth would change the reference profile
itself.

When `MFL_BASELINE_OUTPUT` is set, the harness checkpoints the JSON report after every completed
journey repetition. Rerunning the exact same baseline command resumes completed repetitions when
the output file's schema version, base URL, label, run count, profiles, journeys, and representative
entities match. A harness measurement-contract change invalidates older checkpoints instead of
silently reusing incompatible samples, and a late timeout therefore does not discard compatible
earlier completed measurements.

Hard navigations and refreshes are not considered ready until Chrome has committed a new document.
After visual readiness, the harness also waits for requests started inside that measured phase to
become idle before finalizing request counts, transferred bytes and Server-Timing. Late completion
events from a previous phase are ignored rather than leaking into the next measurement. The
harness also refuses to record samples that are missing canonical useful-content or
visually-settled timings; missing timing values are never coerced to zero in summaries.

Long phases print their individual `cold`, `refresh`, and `cached` start/completion plus a
30-second heartbeat. This is especially important for Stats under `mobile-slow`, where the
reference bandwidth makes large payload transfers intentionally slow rather than silently hung.

The harness establishes one repeatable measurement method. The first reference capture below
uses the local Vercel runtime with the harness label `local-reference`; its wall-clock values are
local/synthetic evidence only and must not be presented as production latency.

## Reference browser/runtime baseline — 2026-09-12

Configuration:

- five repetitions per journey/profile;
- `desktop`: 1280x900, unthrottled;
- `mobile-slow`: 390x844, 4x CPU slowdown, 150 ms network latency, 200 KB/s download and
  100 KB/s upload throughput;
- journeys: Database, Player, Club, My Clubs, Evaluation and MFL Stats;
- phases: cold, hard refresh and cached SPA revisit;
- table values: median / observed slowest.

| Profile | Journey | Phase | Useful ms | Settled ms | Requests | API req | KiB | API KiB | Long-task ms | CLS |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desktop | database | cold | 1637.9 / 1764.7 | 1707.8 / 1846.7 | 78 / 78 | 5 / 5 | 2061.2 / 2061.5 | 604.0 / 604.0 | 56.0 / 111.0 | 0.0000 / 0.0000 |
| desktop | database | refresh | 1883.7 / 1999.5 | 1903.8 / 2025.6 | 77 / 77 | 5 / 5 | 610.5 / 610.5 | 604.0 / 604.0 | 274.0 / 318.0 | 0.0000 / 0.0000 |
| desktop | database | cached | 102.4 / 104.3 | 147.5 / 154.9 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 103.0 / 105.0 | 0.0000 / 0.0000 |
| desktop | player | cold | 1343.3 / 1411.2 | 1375.5 / 1433.0 | 28 / 28 | 3 / 3 | 1449.5 / 1450.2 | 5.7 / 5.7 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| desktop | player | refresh | 1349.1 / 1388.5 | 1371.0 / 1420.7 | 28 / 28 | 3 / 3 | 9.9 / 9.9 | 5.7 / 5.7 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| desktop | player | cached | 34.2 / 35.4 | 47.0 / 54.5 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| desktop | club | cold | 1430.4 / 1438.0 | 1457.1 / 1468.6 | 51 / 51 | 4 / 4 | 2098.5 / 2099.1 | 594.5 / 594.5 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| desktop | club | refresh | 1526.2 / 1550.9 | 1561.0 / 1582.6 | 51 / 51 | 4 / 4 | 600.9 / 600.9 | 594.5 / 594.5 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| desktop | club | cached | 45.9 / 65.3 | 60.0 / 80.8 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| desktop | my-clubs | cold | 256.7 / 258.2 | 288.7 / 292.5 | 22 / 22 | 2 / 2 | 1221.0 / 1221.7 | 2.8 / 2.8 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| desktop | my-clubs | refresh | 227.1 / 239.9 | 261.1 / 273.3 | 22 / 22 | 2 / 2 | 157.1 / 157.1 | 2.8 / 2.8 | 0.0 / 0.0 | 0.0046 / 0.0046 |
| desktop | my-clubs | cached | 47.8 / 58.3 | 80.8 / 92.8 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0008 / 0.0008 |
| desktop | evaluation | cold | 1308.8 / 1710.3 | 1342.4 / 1742.7 | 30 / 30 | 5 / 5 | 1322.2 / 1322.2 | 5.2 / 5.2 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| desktop | evaluation | refresh | 1325.0 / 1414.8 | 1359.1 / 1447.6 | 30 / 30 | 5 / 5 | 161.7 / 161.7 | 5.2 / 5.2 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| desktop | evaluation | cached | 56.3 / 59.4 | 88.3 / 92.3 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| desktop | stats | cold | 3111.3 / 3222.6 | 3128.2 / 3243.3 | 35 / 35 | 5 / 5 | 22655.1 / 22655.1 | 21224.0 / 21224.0 | 462.0 / 469.0 | 0.0000 / 0.0000 |
| desktop | stats | refresh | 3063.7 / 3176.1 | 3080.7 / 3204.6 | 35 / 35 | 5 / 5 | 21230.4 / 21230.4 | 21224.0 / 21224.0 | 448.0 / 469.0 | 0.0000 / 0.0000 |
| desktop | stats | cached | 37.6 / 46.4 | 51.4 / 64.5 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| mobile-slow | database | cold | 7634.4 / 8014.5 | 8996.8 / 9539.8 | 80 / 80 | 5 / 5 | 2060.8 / 2061.2 | 604.0 / 604.0 | 5458.0 / 5795.0 | 0.0001 / 0.0001 |
| mobile-slow | database | refresh | 3769.1 / 4070.2 | 3903.5 / 4215.4 | 80 / 80 | 5 / 5 | 610.5 / 610.5 | 604.0 / 604.0 | 3165.0 / 4370.0 | 0.0001 / 0.0001 |
| mobile-slow | database | cached | 724.4 / 931.6 | 948.8 / 1485.0 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 858.0 / 1423.0 | 0.0167 / 0.0167 |
| mobile-slow | player | cold | 4716.8 / 4844.8 | 4744.8 / 4871.3 | 28 / 28 | 3 / 3 | 1449.5 / 1450.1 | 5.7 / 5.7 | 677.0 / 800.0 | 0.0000 / 0.0000 |
| mobile-slow | player | refresh | 1886.3 / 1926.2 | 1914.6 / 1958.2 | 28 / 28 | 3 / 3 | 9.9 / 9.9 | 5.7 / 5.7 | 414.0 / 489.0 | 0.0000 / 0.0000 |
| mobile-slow | player | cached | 254.3 / 373.2 | 296.2 / 422.0 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 280.0 / 388.0 | 0.0054 / 0.0054 |
| mobile-slow | club | cold | 6054.8 / 6539.9 | 6083.3 / 6560.4 | 52 / 52 | 4 / 4 | 2098.4 / 2099.1 | 594.5 / 594.5 | 1340.0 / 1648.0 | 0.0000 / 0.0000 |
| mobile-slow | club | refresh | 2137.7 / 2241.0 | 2158.4 / 2266.9 | 52 / 52 | 4 / 4 | 600.9 / 600.9 | 594.5 / 594.5 | 924.0 / 1196.0 | 0.0000 / 0.0000 |
| mobile-slow | club | cached | 376.7 / 409.5 | 404.0 / 474.5 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 359.0 / 438.0 | 0.0000 / 0.0000 |
| mobile-slow | my-clubs | cold | 2737.8 / 2810.4 | 2768.0 / 2842.3 | 22 / 22 | 2 / 2 | 1221.0 / 1221.7 | 2.8 / 2.8 | 176.0 / 227.0 | 0.0000 / 0.0000 |
| mobile-slow | my-clubs | refresh | 489.9 / 519.2 | 520.7 / 549.2 | 22 / 22 | 2 / 2 | 157.1 / 157.1 | 2.8 / 2.8 | 0.0 / 53.0 | 0.0110 / 0.0110 |
| mobile-slow | my-clubs | cached | 52.1 / 84.3 | 83.7 / 117.8 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0016 / 0.0016 |
| mobile-slow | evaluation | cold | 4215.9 / 4296.0 | 4247.3 / 4327.8 | 29 / 29 | 4 / 4 | 1321.5 / 1321.5 | 5.2 / 5.2 | 263.0 / 547.0 | 0.0001 / 0.0001 |
| mobile-slow | evaluation | refresh | 1446.9 / 1502.3 | 1466.3 / 1518.3 | 30 / 30 | 5 / 5 | 161.7 / 161.7 | 5.2 / 5.2 | 58.0 / 125.0 | 0.0002 / 0.0002 |
| mobile-slow | evaluation | cached | 113.8 / 139.5 | 142.4 / 167.3 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 0.0 / 106.0 | 0.0000 / 0.0000 |
| mobile-slow | stats | cold | 114213.7 / 114618.0 | 114244.3 / 114649.5 | 35 / 35 | 5 / 5 | 22654.4 / 22654.4 | 21224.0 / 21224.0 | 1256.0 / 1409.0 | 0.0362 / 0.0362 |
| mobile-slow | stats | refresh | 111638.8 / 112054.8 | 111669.1 / 112088.8 | 35 / 35 | 5 / 5 | 21230.4 / 21230.4 | 21224.0 / 21224.0 | 1177.0 / 1216.0 | 0.0362 / 0.0362 |
| mobile-slow | stats | cached | 111774.9 / 112349.3 | 111807.1 / 112395.9 | 3 / 3 | 2 / 2 | 21220.2 / 21220.2 | 21219.9 / 21219.9 | 751.0 / 1077.0 | 0.0000 / 0.0000 |

### Baseline findings and first optimization targets

- **Cached navigation works correctly for every representative journey except MFL Stats.** Database,
  Player, Club, My Clubs and Evaluation cached revisits issue zero API requests in both profiles.
- **MFL Stats transfers about 20.7 MiB of API payload per full load.** Desktop is therefore still
  usable on the local reference environment (~3.1 s median), while the fixed 200 KB/s slow-mobile
  profile is transfer-bound at roughly 112–114 s.
- **MFL Stats cached re-entry is incorrect under the slow profile.** It issues two API requests and
  retransfers essentially the entire 20.7 MiB payload (~111.8 s median), despite
  `shared-incremental-routing.js` owning a session cache with no time-based expiry. This is a
  measured cache-key/namespace/re-entry defect and is the highest-priority cache investigation for
  the next performance PR.
- **Database rendering is the next browser-main-thread hotspot on constrained hardware.** Its
  slow-mobile cold median records about 5.46 s of long-task time, and even the network-free cached
  revisit records about 0.86 s.
- **Layout stability is generally strong.** The largest reference CLS is MFL Stats slow-mobile
  cold/refresh at 0.0362; Database and most entity routes are effectively zero. My Clubs retains a
  small refresh shift (0.0110 slow-mobile median).
- **The baseline harness itself is now validated.** Refreshes carry real timings, network accounting
  is phase-isolated, missing metrics are rejected rather than rendered as zero, and the focused
  Database/Club slow-profile smoke test plus the full capture both completed successfully.

The repeatable baseline portion of #923 is therefore complete. Subsequent performance PRs should
use these values as before/after evidence and should not reinterpret the synthetic slow-mobile
numbers as production latency.