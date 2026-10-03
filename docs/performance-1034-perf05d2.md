# PERF-05D2 — Selective SQL candidates: full-response and listing-density gates

Tracking [#1034](https://github.com/FraGioco9/mfl-front-office/issues/1034), continuation of [PERF-05D1](./performance-1034-perf05d.md). The prior same-runner A/B identified promising exact-name / for-sale predicate speedups but showed serious regressions when applying the normalized lookup to general contains filters. **No application change is authorized by those first measurements alone.**

## Fixed source, data and synthetic boundaries

- Snapshot: existing successful full-refresh artifact from GitHub Actions [#37113407333](https://github.com/FraGioco9/mfl-front-office/actions/runs/37113407333), with **387,258 players, 7,866 wallets**, generated 2026-10-03 10:26:45 UTC. Reuse a read-only copy. No refresh or live API.
- Runtime: Node 22 `node:sqlite`, the actual `pagedData()`, `normalize_search()` and `marketplace_price()` implementation; derive original SQL by intercepting database APIs while running the original handler. Each candidate replaces **only** its targeted equality/positive `for_sale` predicate for the diagnostic pass.
- Name: evaluate exact equality separately, including accented/Unicode, empty, SQL wildcard characters, combined `AND`/`OR`, `contains`, `not_contains`, secondary sorted columns, page 2 and overshot last page. Verify that the offline pre-normalized table matches **all** 387k rows on this snapshot. A future normalization mismatch must disable reuse or fall back to the original UDF; do not silently apply the optimization to a newly prepared snapshot.
- Marketplace: deterministic synthetic list maps at densities 0, 1, 100, 9000 and up to 150,000. Test for-sale COUNT, price ASC/DESC, last page, age sorting, nationality/overall/name combinations, `for_sale OR not_for_sale` and unfettered price-sort (which intentionally remains baseline-only). **No live listings or prices are inspected**; these synthetic densities establish no distribution of real inventory.
- SQL candidate for a positive sale predicate: `player_id IN (SELECT CAST(value AS INTEGER) FROM json_each(?))`. Dynamic set comes from the **same request's** validated in-memory price map. The full-price sort without a `for_sale` filter is not equivalent to this candidate because unsold players and NULL placement must remain visible.
- Benchmark: reproduce the **whole API response** (columns, rows, totalRows, sourceRows, totalPages, page, metadata, source) under independent request-count caches; reject on any mismatch. Then warm and measure `A–B–B–A` statement timings on the same runner with `EXPLAIN QUERY PLAN`, row digests, JSON bytes and approximate `heapUsed` change from fixture generation. Do not include raw names, wallet IDs, prices or player data in report.
- Build/index cost: a query-only reuse of `runtime_player_search` introduces **no new database index** (already built by canonical builder); listing-ID JSON candidate is memory- and request-dependent, so evaluate its transfer/serialization and scan costs at high density before choosing a threshold. A raw `heapUsed` delta is directional, not peak memory; repeat when comparing candidates.

## Implementation decision tree

1. If exact-name equivalence fails on a name, locale, or future normalization contract, retain the existing UDF. Do not introduce broad text lookups, FTS or fuzzy matching as part of PERF-05D2.
2. If for-sale `COUNT(*)` improves but a sorted first-page becomes slower, **do not** adopt a global substitution: gate any optimization to the proven filter/sort combination and density.
3. If candidate build/serialization or memory is excessive, retain the current SQL. Avoid fixed-price indexes on the non-deterministic marketplace function.
4. Only propose a **separate small runtime PR** after paired evidence is replicable, full response equivalence is established across combinations and safeguards cover stale count cache, per-request map consistency, empty/NULL states and snapshot changes.
5. Perform exact-head CI before asking to merge anything. Keep PERF-05D and PERF-05 open until all accepted changes are reviewed, and PERF-03C/PERF-03 open for the later release-stage check.

## Evidence and decisions

Benchmark in [PR #1096](https://github.com/FraGioco9/mfl-front-office/pull/1096). Two independent pinned-snapshot captures: [#37132806259](https://github.com/FraGioco9/mfl-front-office/actions/runs/37132806259) ([artifact #11277168557](https://github.com/FraGioco9/mfl-front-office/actions/runs/37132806259/artifacts/11277168557)) and [#37132902273](https://github.com/FraGioco9/mfl-front-office/actions/runs/37132902273). **Both passed 68/68 complete response equivalence and 126/126 statement parity**; 0/387,258 normalized-name mismatches. No SQL schema/index updates or live price reads.

### Replicated representative query medians (all milliseconds; per-run, not absolute across machines)

| Case | Run #37132806259 A → B | Run #37132902273 A → B | Decision |
| --- | --- | --- | --- |
| Name exact COUNT | 241.988 → 0.037 | 348.827 → 0.040 | Candidate for guarded exact-match only |
| Name exact page | 629.460 → 0.049 | 881.652 → 0.068 | Candidate for guarded exact-match only |
| Name OR overall COUNT | 236.425 → 2.025 | 339.025 → 3.040 | Preserves OR and improves COUNT |
| 100 listed, price ASC page | 89.000 → 0.259 | 123.526 → 0.410 | Large gain |
| 9,000 listed, price ASC page | 87.379 → 15.665 | 136.740 → 23.834 | Gain with filtered sort |
| 9,000 listed, overall page | 0.779 → 11.161 | 1.431 → 18.575 | **Regression: preserve original page SQL** |
| 9,000 listed, overall≥75 COUNT | 9.003 → 10.542 | 13.670 → 16.702 | **Regression: preserve original count SQL** |
| 150,000 listed, price ASC page | 106.514 → 86.060 | 159.636 → 139.237 | Weak savings with large overhead |
| 150,000 listed, overall page | 0.891 → 58.100 | 0.439 → 99.811 | **Severe regression** |
| 150,000 listed, for_sale OR not_for_sale COUNT | 90.611 → 106.823 | 146.709 → 175.512 | **Regression, skip compound logic** |

Synthetic JSON price-ID payload: 2 bytes for empty, 4 bytes for 1, 671 bytes for 100, **60,549 bytes for 9,000**, and **1,009,172 bytes for 150,000**. Observed fixture heap-use delta approximately **1.84–1.88MB at 9k**, **7.0–7.2MB at 150k**. They are directional creation-time deltas, not peak concurrent Node memory. Dense lists diminish benefit, even on price sort; the general unfiltered price sort cannot use the candidate at all.

### Decisions

- **Accept for separate guarded implementation investigation:** indexed equality on `name =` only; preserve `contains` untouched, require whole-snapshot JS-vs-Python normalization check and fallback on drift, measure once-per-process cold-check cost.
- **Accept for separate gated price-filter implementation investigation:** positive single `for_sale` with sort `listing_price`, sparse/moderate listings only; for-sale COUNT can be accelerated separately under bounded density. Avoid applying it to overall/age first page or high-density/mixed OR cases where measured regressions were material. Dynamic prices must remain authoritative and COUNT cache must never serve stale listing totals.
- **Reject general predicate rewriting, indiscriminate `json_each` and fixed SQLite price indexes.** No evidence for improvement on unfiltered price sort.
- Implement in distinct PRs with real-handler regression tests, CI, fallback and reverse-tail/page-count compatibility. No merge until requested.

**Status:** benchmarks completed, no runtime modifications in this research PR. PERF-05D, PERF-05, PERF-03C, PERF-03 remain PENDING. No refresh, merge or Vercel deployment.
