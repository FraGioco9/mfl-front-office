# PERF-05A — real API SQL query-plan baseline

Issue: [#1034](https://github.com/FraGioco9/mfl-front-office/issues/1034), PERF-05 (P2).

This phase **measures, without changing production query construction, schema or indexes**. The repository already has `scripts/database/runtime_query_plans.py` and `tests/test_runtime_query_plans.py`, which test core overall/wallet/club/watchlist access and VM step regression on a 6,000-player synthetic fixture. PERF-05 expands coverage to the **real parameterized `api/_data-page.js` SQL** with representative combined filters and dynamic sorting against a validated database snapshot.

## Measurement protocol

- **Pinned snapshot:** Successful [Full database refresh #37113407333](https://github.com/FraGioco9/mfl-front-office/actions/runs/37113407333), the `mfl_database` GitHub Actions artifact from the complete four-stage run. Expected runtime metadata: **387,258 players**, **7,866 wallets**, generated 2026-10-03 10:26:45 UTC. This is stored locally on a GitHub runner; no queries or writes to production databases.
- `scripts/performance/perf05-query-profile.cjs` uses Node 22 `node:sqlite` and imports the exact `pagedData()` implementation. It captures the SQL generated through `queryRows`/`queryOne` with bound arguments, executes `EXPLAIN QUERY PLAN` and benchmarks each generated statement after one warm-up with three repetitions. It records per-query full table scans, temporary sorts, indexes, median and individual timings, and hashes of result sets.
- **Privacy:** report prints parameter *types/count* and SQL placeholders, not bound wallet addresses, names, IDs, or player records. Returned results are represented by counts and SHA256 digests. No input secrets are required.
- **Cases:** first and last Database page, combined overall/age range, normalized name substring, position+nationality, nationality+overall range, synthetic listing-price filter and listing-price sort, progression, watchlist, high-count Agent, wallet ownership/progression, and club/position scope. For listing cases, a fixed deterministic synthetic price sample is used to avoid live marketplace requests; this is a useful algorithmic stress test, **not** a claim about current marketplace inventory.
- `validate-perf05-sql-capture.mjs` exercises the profiler using the tiny offline Next SQLite fixture and checks no raw filter parameters leak, row digests are present, SQL EXPLAIN works, and required cases exist. It runs under normal `npm run validate`.
- An **ephemeral** GitHub Actions workflow downloads only the pinned database artifact, checks provenance, runs profiling without DB writes, and stores the sanitized JSON for 90 days. Remove this temporary workflow from the PR **before merge**.

## Verified full-snapshot evidence — October 3, 2026

- [Baseline run #37127771853](https://github.com/FraGioco9/mfl-front-office/actions/runs/37127771853) (snapshot `mfl_database` from successful refresh #37113407333, 387,258 players / 7,866 wallets).
- [Same-runner candidate capture #37127916943](https://github.com/FraGioco9/mfl-front-office/actions/runs/37127916943), [sanitized profile + comparison artifact #11276015237](https://github.com/FraGioco9/mfl-front-office/actions/runs/37127916943/artifacts/11276015237). Candidate was a **copy** of the same 198,037,504-byte SQLite file with only `CREATE INDEX perf05_candidate_nationality_order ON players(nationality, (overall IS NULL), overall DESC, player_id DESC)` and `ANALYZE` applied. It was never published or deployed.
- The control/candidate order was **A–B–B–A** on one GitHub runner, in independent Node processes. Each query was warmed once then measured three times within each repetition. **24 SQL statement pairs**, identical SQL/parameter type shapes and **identical row/result SHA-256 digests**, including first/last pages, combined filter/sort, simulated listing prices, progression, wallet scope and club/watchlist.

| SQL statement (representative) | Control mean of per-run medians | Candidate | Delta |
| --- | ---: | ---: | ---: |
| Position + nationality COUNT | 151.746 ms | 47.278 ms | −68.8% |
| Position + nationality first page | 14.029 ms | 1.422 ms | −89.9% |
| Nationality + overall first page | 1.849 ms | 0.408 ms | −77.9% |
| Nationality + overall COUNT | 78.406 ms | 79.870 ms | +1.9% (noise-scale) |
| Database deep-page read | 368.899 ms | 368.532 ms | −0.1% |
| Name-contains COUNT | 370.551 ms | 371.596 ms | +0.3% |
| Listing price sort | 128.335 ms | 130.579 ms | +1.7% (noise-scale) |

**Cost:** the candidate SQLite file measured **207,056,896 bytes**, versus 198,037,504 bytes, adding **9,019,392 bytes (~4.55%)**. Measured local index creation + `ANALYZE`: **852.49 ms**. This is a local build cost and does not guarantee unchanged full-refresh end-to-end duration. Remaining expensive areas—~369 ms deep-page OFFSET, ~371 ms name-contains count, ~128 ms listing-price sort—were **not solved** by this index.

**Interpretation:** The large nationality-page improvement and resulting index-plan switch to `perf05_candidate_nationality_order`, with identical results across all sampled queries, justify proposing a single new index in a **separate production-code PR**. The measured count benefit for the combined position filter is significant. The nationality-overall COUNT itself did not improve; do not claim a generic count speedup. Two paired replicates on one runner are not user RUM or a broad distribution, and listing prices were deliberately synthetic.

**Status:** PERF-05A baseline/experiment evidence collected; permanent profiler and offline smoke guard remain as opt-in tools. The workflow used to download the full database and create an indexed scratch copy has been **removed before merge** so no automatic database download or index-building job runs on `main`. Candidate SQL/index implementation belongs to PERF-05B with its own CI and rollback.

## Evidence gate for PERF-05B

Review the actual SQL plans and timings before adding indexes. Prioritize tail-heavy statements with recurring table scans / sorts and compare candidate indexes against **the same snapshot** on the same runner (control/candidate interleaved). Require that first-page and deep-page result digests, total counts, text/range/sort semantics, listing-price and wallet-scoped responses are identical. Include added index bytes, rebuild time and write/refresh costs; no index change from a single noisy run or synthetic-only improvement.

Avoid premature seek-pagination rewrites: the existing tests demonstrate lower VM steps for seek on simple overall sorting, but arbitrary rule/sort combinations require reliable cursor contracts and navigation-compatible total page counts. Explicitly separate improvements to an individual query from a change to the product's existing page-number UX.

**Status:** PERF-05A measurement completed, final CI/squash merge pending. PERF-05B has a measured nationality-index candidate for a separate PR; PERF-05 parent remains pending. No Vercel deployment.
