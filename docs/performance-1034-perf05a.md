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

## Evidence gate for PERF-05B

Review the actual SQL plans and timings before adding indexes. Prioritize tail-heavy statements with recurring table scans / sorts and compare candidate indexes against **the same snapshot** on the same runner (control/candidate interleaved). Require that first-page and deep-page result digests, total counts, text/range/sort semantics, listing-price and wallet-scoped responses are identical. Include added index bytes, rebuild time and write/refresh costs; no index change from a single noisy run or synthetic-only improvement.

Avoid premature seek-pagination rewrites: the existing tests demonstrate lower VM steps for seek on simple overall sorting, but arbitrary rule/sort combinations require reliable cursor contracts and navigation-compatible total page counts. Explicitly separate improvements to an individual query from a change to the product's existing page-number UX.

**Status:** evidence capture and CI ongoing; PERF-05A remains unchecked pending CI/merge, PERF-05B and PERF-05 parent pending until a measurable, safe change or documented NO CHANGE decision. No Vercel deployment.
