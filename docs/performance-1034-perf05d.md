# PERF-05D — name/price SQL profiling gate (research-only)

Issue: [#1034](https://github.com/FraGioco9/mfl-front-office/issues/1034). After the verified PERF-05A–C changes, the unresolved baseline is name-contains `COUNT(*)` (~371 ms) and dynamic `listing_price` sort (~128 ms on a synthetic marketplace fixture). **These are SQL microbenchmarks, not live site latency.**

## Existing contracts and risks

- Text rules call `normalize_search(column)` with a leading-wildcard SQLite `LIKE`. This is Unicode/case/diacritic-sensitive code shared with other columns. SQL `LIKE` currently preserves literal user `%`/`_` as wildcard metacharacters: optimizing it must not silently escape those characters. The offline builder already creates `runtime_player_search(player_id,normalized_name)`; its Python normalization may differ from the Node/SQLite runtime on some Unicode. A complete full-snapshot comparison must show *zero* normalization mismatches before even considering reuse.
- Marketplace prices come from a short-lived Supabase Storage JSON read and are mapped into a request-local, non-deterministic SQLite scalar function `marketplace_price(player_id)`. A persistent SQLite index on that function would be incorrect. A dynamic JSON-ID membership probe is applicable only to `for_sale` restrictions, **not** to the general sort where unlisted players (NULL prices) must remain.
- The first/last page, all supported sorts and rule connectors, existing `COUNT(*)` cache, NULL ordering, UI page numbers and reverse-tail traversal from PERF-05C remain untouched.

## Test and evidence method

The standalone `scripts/performance/perf05d-text-listing-ab.cjs` instruments **exact parameterized SQL from real `pagedData()`** with a read-only `MFL_DATABASE_PATH`. It:
1. Compares `normalize_search(players.name)` to every cached `runtime_player_search.normalized_name` row, including missing lookups. A mismatch prevents text-candidate substitution.
2. Benchmarks `name` contains (1 and 3 characters, accent/Unicode, `%` and `_`), not-contains, equality, inequality and combined AND/OR rules, using an equivalent `player_id IN` lookup candidate only where applicable.
3. Benchmarks dynamic `for_sale` membership via `json_each(?)` for a synthetic 9,000-player listing map; **does not** claim improvement to general listing-price sorting. It includes ASC/DESC and NULL-preserving baseline-only cases.
4. Captures `EXPLAIN QUERY PLAN`, warms each statement and records three samples per phase in A–B–B–A order on the **same** runner/snapshot. Rejects candidate immediately if full result digests differ. Writes no player/wallet names, IDs, prices or private parameters into the archived report.
5. Includes an isolated two-player SQLite smoke setup and asserts correct results independent of the real refresh. Neither test changes application SQL.

A **temporary** PR-only GitHub Actions workflow downloads the existing successful full-refresh artifact from [run #37113407333](https://github.com/FraGioco9/mfl-front-office/actions/runs/37113407333) (**387,258 players / 7,866 wallets**), validates provenance, runs the smoke and same-runner A/B, and archives sanitized JSON. It **does not initiate a new refresh** and has no Vercel, Supabase or marketplace live writes. The temporary workflow must be removed before merge.

## Decision criteria

Implement production changes only in a **subsequent dedicated change** if A/B results on the pinned snapshot agree with exact digest equivalence *and* meaningfully improve measured latency without unacceptable build/storage/memory cost. Replicate promising findings in another same-runner run, assess index/db size and text drift, run full CI and retain safe fallback for older snapshots. If not demonstrated, close PERF-05D as **NO CHANGE** with evidence.

**State:** diagnostic PR in progress. Performance data, results and CI outcomes must be recorded here before checking PERF-05D. PERF-05, PERF-03C and PERF-03 remain open. No refresh, merge or deploy.
