# PERF-05C — Deep-page numbered pagination: measured reverse-tail traversal

Tracking: [issue #1034](https://github.com/FraGioco9/mfl-front-office/issues/1034). Implemented only after measuring the canonical server SQL with `EXPLAIN QUERY PLAN` and a same-runner A–B–B–A experiment.

## Query ownership and baseline

The table route `api/_data-page.js` builds one `COUNT(*)` and a separate `SELECT … FROM players … ORDER BY … LIMIT ? OFFSET ?` for every page. The page parameter and the response's `page`, `pageSize`, `totalPages`, `totalRows` and `sourceRows` cannot change without breaking existing navigation; the last sort term is the unique `player_id DESC` tie-break.

This means replacing arbitrary page numbers with a keyset cursor *alone* is not an equivalent optimization: jumping to page 3,869 would still need a cursor anchor. Another exact technique is available on pages close to the end. Query the **same** row-set in mathematically reversed total order, skip only the rows after the target page, and reverse the returned page in memory. This retains arbitrary numbered access and the exact original stable ordering, including `NULL`, `COLLATE NOCASE`, `CASE` expressions, derived progressions, listing-price function sorting and advanced filters.

## Paired experiment

- [Full pinned database refresh #37113407333](https://github.com/FraGioco9/mfl-front-office/actions/runs/37113407333); 387,258 players and 7,866 wallets in the snapshot. The relevant public database scope includes **386,891** players after the hidden-player rule.
- [Initial successful A/B run #37130029247](https://github.com/FraGioco9/mfl-front-office/actions/runs/37130029247); [sanitized JSON artifact #11275909322](https://github.com/FraGioco9/mfl-front-office/actions/runs/37130029247/artifacts/11275909322). One GitHub Actions runner, one immutable SQLite file, Node 22 `node:sqlite`, three warmed query repetitions in each A–B–B–A phase. Both variations reuse **identical filter parameters and SELECT projection**. B changes only the ORDER BY direction and `LIMIT/OFFSET`, then reverses the returned rows in memory.
- **16/16 scenarios matched identical ordered-row SHA-256 digests**, including last, second-last, middle, numeric/text/nationality/position filters, progression, agent scope and a *synthetic* fixed listing-price map. `EXPLAIN QUERY PLAN` remained attached to every control and candidate SQL statement.
- These are repeated **SQL statement wall-clock** timings on a shared runner, not API p95, network latency, real production wallets, Safari timings or a comparison of production CDN behavior.

| Scenario | Canonical A median (ms) | Reverse-tail B median (ms) | Plan information |
| --- | ---: | ---: | --- |
| Overall DESC · last page | 439.445 | **0.388** | Both use `players_overall_order_index` |
| Overall DESC · second-last page | 437.918 | **0.474** | Both use `players_overall_order_index` |
| Overall DESC · page 1,800 | **214.462** | 223.373 | Reverse scans *more* rows here; **do not use** |
| Overall ASC · last page | 1122.812 | 766.409 | Both include temporary sort |
| Age ASC · last page | 799.445 | **81.992** | Both include temporary sort |
| Name ASC · last page | 2374.547 | **85.943** | Both include temporary sort |
| Club name · last page | 1326.266 | **99.746** | Both include temporary sort |
| Division · last page | 1136.278 | **376.688** | Both include temporary sort |
| Hide retired + overall · last page | 458.572 | **0.231** | Existing overall index |
| Nationality + overall · last page | 459.682 | **0.187** | Existing overall index |
| Position + overall · last page | 569.086 | **0.551** | Existing overall index |
| Age-range filter · last page | 256.634 | **99.452** | Both include temporary sort |
| Current progression · last page | 228.340 | **93.148** | Both include temporary sort |
| Listing-price ASC · last page | 799.746 | **217.314** | Both include temporary sort; listing map is synthetic |
| For-sale filter + overall · last page | 100.463 | **1.461** | Existing overall index; listing map is synthetic |
| Agent scoped · last page | 233.445 | **55.936** | Both include temporary sort |

### Same-runner replication after production-path implementation

[Second completed A/B #37130626526](https://github.com/FraGioco9/mfl-front-office/actions/runs/37130626526), [raw sanitized report #11276334116](https://github.com/FraGioco9/mfl-front-office/actions/runs/37130626526/artifacts/11276334116), ran against the same pinned 387,258-player SQLite snapshot **after** the API candidate had been added. The probe independently reconstructed the *original* forward SQL from the application-generated query and `orderSql()`, so it still compared the intended A and B rather than accidentally timing B twice. All **16/16 ordered-row digests matched again**.

| Scenario | Canonical A (ms) | Reverse B (ms) |
| --- | ---: | ---: |
| Overall DESC final | 302.471 | **0.217** |
| Overall DESC second-final | 304.909 | **0.241** |
| Overall DESC page 1,800 | **145.219** | 152.754 |
| Name ASC final | 1535.108 | **46.105** |
| Age ASC final | 450.402 | **61.628** |
| Division final | 631.602 | **206.174** |
| Listing price ASC final (synthetic) | 451.243 | **118.830** |
| Agent last page | 138.348 | **32.847** |

Absolute timings varied between runner runs; the direction and large effect near the end were consistent. Reverse traversal was again slower around the midpoint, further supporting the conservative tail-only gate. Unlike the separate two-row smoke fixture, this probe uses all real rows and the actual API SQL expressions and NULL/collation semantics from the pinned file. The different timing values are **not** production benchmarks or proof of first-paint changes.

**Decision:** The evidence supports an *exact* reverse-tail algorithm only when the tail offset is substantially smaller than the forward offset. The selected conservative switch uses `tailOffset * 2 < offset` (approximately the last third, not pages near the midpoint), while first/middle pages, all-rows scopes, empty result sets and other contexts keep the original query path. There are **no new indexes**, migration, stored cursor, altered row count, page number or API field.

## Implementation and correctness

- `api/_data-page-order.js` parses only the **application-generated** ORDER BY list. It preserves quotes, `CASE` and function parentheses, and inverts explicit `ASC`/`DESC` and implicit `ASC`. It requires the existing unique `player_id DESC` tiebreak before reversing. No user input is evaluated as SQL.
- `api/_data-page.js` continues to use the original `COUNT`, filters, column projection and page clamping. For selected pages only: `remaining=totalRows-offset`, `tailLimit=min(pageSize, remaining)`, `tailOffset=remaining-tailLimit`, query in reverse order and reverse rows in JavaScript. Crucially, an incomplete final page returns **exactly the remainder**, not a full page worth of players.
- `validate-perf05c-tail-pagination.mjs` creates a disposable SQLite fixture with varied names (accented, quoted, comma, empty), nullable fields, tie values, listing-price examples, wallet scopes and progressions. It compares the actual `pagedData` result against independently constructed **original SQL** on first, second, midpoint, penultimate, last and overshot pages for all supported sort/filter types. Both optimization branches are tested, as are page-number and result-array invariants. The validator is part of the existing `npm run validate`.
- `scripts/performance/perf05c-*` retain the opt-in read-only same-runner experiment. **Remove the temporary workflow** before merging; it is not a deploy gate and must never auto-download the full database.
- No cached page cursor or user-session state is added. Since the database is read-only within a request, `totalRows` and the paged query share the same generated snapshot. The in-memory listing map is populated once before both queries.
- Exact-head CI must still pass Site Quality, lint/typecheck, Windows, Mobile, Table Header and A11Y-01–06. Do not merge, run a database refresh or deploy Vercel during PERF-05C.

### Remaining follow-up

PERF-05D investigates text COUNT and listing-price sorting separately. This tail traversal improves *final-page sorting*, but **does not change the expensive `COUNT(*)`** for name-contains filters or the cost of sorting/COUNT when an early page is requested. Additional changes require their own measurements and PRs.

## Rollback

Revert the small `pagedData` tail selection and reverse-order helper; all legacy `OFFSET` queries work unchanged. No schema changes or storage migration required. Real iPhone/Safari and Vercel checks remain deferred to the single issue-wide final release; PERF-03C and PERF-03 stay pending.
