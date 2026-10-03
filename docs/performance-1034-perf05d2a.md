# PERF-05D2A — selective indexed player-name equality

Tracking [issue #1034](https://github.com/FraGioco9/mfl-front-office/issues/1034), [research PR #1096](https://github.com/FraGioco9/mfl-front-office/pull/1096), [implementation PR #1097](https://github.com/FraGioco9/mfl-front-office/pull/1097).

## Evidence and cold-start tradeoff

The two PERF-05D2 full-response A/B runs [#37132806259](https://github.com/FraGioco9/mfl-front-office/actions/runs/37132806259) and [#37132902273](https://github.com/FraGioco9/mfl-front-office/actions/runs/37132902273) returned **68/68 identical API response digests, 126/126 equivalent SQL statements each**, zero normalized-name mismatches among 387,258 players. On the isolated equality query, indexed COUNT and first page reduced to sub-millisecond from hundreds of milliseconds in both runs.

**One-time safety validation has real cost**. Opt-in pinned-snapshot GitHub runner [#37133433203](https://github.com/FraGioco9/mfl-front-office/actions/runs/37133433203) and its [rerun](https://github.com/FraGioco9/mfl-front-office/actions/runs/37133433203) (independent runner invocation) recorded:

| Metric | Initial run | Repeat |
| --- | ---: | ---: |
| Full-table Python/JS normalized-name parity check (cold, per process) | 411.238 ms | 429.379 ms |
| Subsequent parity-check lookup | 0.003 ms | 0.002 ms |
| Observed heapUsed delta after check | 28,161,824 bytes | 28,092,512 bytes |
| Original exact-name COUNT, A median | 311.898 ms | 289.370 ms |
| Indexed exact-name COUNT, B median | 0.010 ms | 0.016 ms |
| Original exact-name first page, A median | 677.759 ms | 758.723 ms |
| Indexed exact-name first page, B median | 0.050 ms | 0.056 ms |

These are **runner SQL and one-time guard measurements**, not user RUM, CDN p95, worst-case pause, or peak memory. The first verified unfiltered exact-name query is expected to save time on this snapshot even including cold validation, but an `AND` filter or alternate sort can be faster than this first-use check. Therefore the implementation was **narrowed after measuring the guard**.

## Narrow safe gate

- Fast path **only** for Database scope, default overall descending sort, **exactly one advanced name equality rule**, no hidden/retirement/new-mint toggles, and no restricted ownership scope. All other sorts, combined `AND`/`OR`, other scopes and general `contains` continue to use the canonical UDF and plans, avoiding a 400ms guard during otherwise cheap requests.
- On first eligible query in a Node process, verify every row of the **immutable** runtime SQLite snapshot: total player rows equal pre-normalized lookup rows, and no missing ID or `normalized_name !== normalize_search(name)` under the JS SQLite function. After this, cache the **boolean only**, not any player/PII list. A missing, corrupt or Unicode-drifted table fails closed to the original predicate.
- Retain the original `name IS NOT NULL AND CAST(name AS TEXT) <> ''` predicate before membership lookup: empty/blank/NULL semantics remain identical.
- No new SQLite index or writer. The builder already owns `runtime_player_search_name_index`. No change to database refresh artifacts, and no live database validation or deployment.
- Regression validator `validate-perf05d2-name-equality.mjs` compares canonical and optimized result digests on isolated fixtures including Unicode, missing/stale lookup, mixed rules, alternative sorting and table absence. Integrated with `npm run validate`.

## Rollback / release gate

Revert the guarded equality branch in `api/_data-page.js` and `canUseNormalizedPlayerNameLookup()` in `api/_database.js`; all old queries and table schemas still work. The source affects no live site until issue-wide single Vercel deployment. CI full exact-head green and maintainer review are required before any squash merge; the PR remains open without merge.

**PERF-05D, PERF-05, PERF-03C and PERF-03 remain open.**
