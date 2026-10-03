# PERF-05B — measured nationality / overall SQLite index

Parent: [issue #1034](https://github.com/FraGioco9/mfl-front-office/issues/1034), PERF-05. Companion: [PERF-05A baseline PR #1092](https://github.com/FraGioco9/mfl-front-office/pull/1092) and its [same-runner A/B artifact #11276015237](https://github.com/FraGioco9/mfl-front-office/actions/runs/37127916943/artifacts/11276015237).

## Index and evidence

```sql
CREATE INDEX IF NOT EXISTS players_nationality_order_index
  ON players(nationality, (overall IS NULL), overall DESC, player_id DESC);
```

This exact index definition was tested on a **local copy** of the verified 2026-10-03 full-refresh SQLite artifact: **387,258 players / 7,866 wallets**. It does not alter `api/_data-page.js`, filtering behavior, sorting, page counting, or any current production database. It is installed only during a future regular `prepare_runtime_database` regeneration after the final issue-wide Vercel release.

The ABBA (control, candidate, candidate, control) comparison ran on one GitHub runner with three warmed repetitions per statement in each capture. All **24** real API-generated SQL/result-pairs had identical row and response digests, SQL/parameter shape and pagination metadata. The captured query plans show use of the new index.

| Query | Control | Candidate | Relative |
| --- | ---: | ---: | ---: |
| Position + nationality COUNT | 151.746 ms | 47.278 ms | **−68.8%** |
| Position + nationality first page | 14.029 ms | 1.422 ms | **−89.9%** |
| Nationality + overall first page | 1.849 ms | 0.408 ms | **−77.9%** |
| Nationality + overall COUNT | 78.406 ms | 79.870 ms | +1.9%, within noise |
| Unfiltered last page | 368.899 ms | 368.532 ms | Essentially unchanged |
| Listing-price sort | 128.335 ms | 130.579 ms | +1.7%, within noise |

**Cost:** SQLite file size grew **198,037,504 → 207,056,896 bytes** (**+9,019,392 bytes; ~4.55%**). Candidate index creation + ANALYZE took **852.49 ms** in the local runner. These are same-runner database microbenchmarks, not production API p95 measurements; full database refresh/write overhead remains to be verified after release. No broad claims are made for other queries.

## Implementation, safeguards and rollback

- Add the one index in `scripts/database/prepare_runtime_database.py`, after the existing overall indexes. The index is `IF NOT EXISTS` and is included in the builder's existing transaction and `ANALYZE`. It does not change player rows or introduce a new table.
- Extend Python fixture schemas with nullable nationality and a representative Italy/France distribution.
- Add representative nationality + overall and position + nationality **EXPLAIN QUERY PLAN** budgets requiring the new index without temp sorting.
- Test equivalent first/deep pages, range, position filters and sort results with and without the index, including ties and pagination. Tests run on a throwaway SQLite fixture, not on live data.
- **Do not run database refresh or deploy to Vercel yet.** No application SQL/source changed; existing production files remain unchanged until the controlled final issue release.
- Rollback if index rebuild/write overhead becomes unacceptable: remove the index creation statement and restore an old prepared snapshot (or drop the named index during an offline rebuild), never alter live Vercel/Supabase in this audit.

## Validation

```bash
python -m unittest -v tests.test_runtime_query_plans tests.test_runtime_database_preparation
python -m unittest discover -v -p 'test_*.py'
npm run validate
```

Final CI must pass Site Quality, Python builder checks, Windows, Mobile 8/8, Table Header and A11Y-01–06 on the exact PR head. Final production/Safari checks remain within issue #1034's single-release stage, and PERF-03C/PERF-03 remain pending.
