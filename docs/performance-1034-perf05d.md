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

## First full-snapshot A/B result — 03 October 2026

[Workflow #37131829479](https://github.com/FraGioco9/mfl-front-office/actions/runs/37131829479) **passed**, including isolated 15-scenario smoke and pinned full-snapshot A–B–B–A. [Sanitized JSON artifact #11276912880](https://github.com/FraGioco9/mfl-front-office/actions/runs/37131829479/artifacts/11276912880). **0 out of 387,258 normalized player names differ** between the offline Python-built table and JS runtime in *this particular snapshot*. **24/24 candidate statement digests matched**. SQL plans included for every statement. This validates parity on the snapshot only; it does not guarantee future Unicode inputs or marketplace density.

| Query / scenario | Baseline A (ms) | Candidate B (ms) | Decision |
| --- | ---: | ---: | --- |
| Name contains `a`, COUNT | 408.503 | 341.442 | modest COUNT improvement, **first-page 0.463→364.519 ms regression** |
| Name contains `mar`, COUNT | 396.672 | 54.818 | large COUNT benefit, **first-page 4.348→57.177 ms regression** |
| Name contains `%_`, COUNT | 393.705 | 447.147 | slower even at COUNT |
| Name exact `=`, COUNT | 368.190 | 0.017 | promising indexed equality-only candidate; page 829.765→0.087 ms |
| Name AND Overall, COUNT | 98.092 | 349.404 | substantial regression, despite equal results |
| Name OR Overall, COUNT | 437.645 | 59.166 | better COUNT; sampled first page ~0.4ms both |
| Synthetic `for_sale`, COUNT | 139.409 | 12.490 | promising for COUNT, but page 1.631→14.241 ms slower |
| Synthetic `for_sale` price ASC, page | 143.020 | 17.969 | promising only with selective for-sale clause |
| Synthetic `for_sale` price DESC, page | 144.278 | 18.241 | promising only with selective for-sale clause |
| General price-sort page (no for-sale) | 222.269 ASC, 217.263 DESC | *No safe candidate* | remains unresolved |

**Conclusion from first run:** Reject any broad substitution of text predicates with `runtime_player_search`: many inexpensive indexed first-page queries become dramatically slower and composite filters can regress. SQL-only testing justifies researching **selective** equality and for-sale strategies with full response, combined filter, cache and Unicode validation. The general listing-price sort still has no measured safe replacement. Do not ship from this experiment alone; **replication triggered on the same PR head** and any resulting runtime change must be separately gated. No schema/index/app runtime changed.

## Decision criteria

Implement production changes only in a **subsequent dedicated change** if A/B results on the pinned snapshot agree with exact digest equivalence *and* meaningfully improve measured latency without unacceptable build/storage/memory cost. Replicate promising findings in another same-runner run, assess index/db size and text drift, run full CI and retain safe fallback for older snapshots. If not demonstrated, close PERF-05D as **NO CHANGE** with evidence.

**State:** diagnostic PR in progress. Performance data, results and CI outcomes must be recorded here before checking PERF-05D. PERF-05, PERF-03C and PERF-03 remain open. No refresh, merge or deploy.
