# PERF-05D2B — bounded positive for-sale SQL COUNT and price-sort

Issue [#1034](https://github.com/FraGioco9/mfl-front-office/issues/1034); [PERF-05D2 research PR #1096](https://github.com/FraGioco9/mfl-front-office/pull/1096); [implementation PR #1098](https://github.com/FraGioco9/mfl-front-office/pull/1098). No runtime deployment, refresh or live marketplace calls.

## Repeated A–B evidence

Same pinned SQLite snapshot (**387,258 players; 7,866 wallets**), fully reusing the **actual pagedData SQL and complete API response**: [benchmark #37132806259](https://github.com/FraGioco9/mfl-front-office/actions/runs/37132806259) and [replication #37132902273](https://github.com/FraGioco9/mfl-front-office/actions/runs/37132902273). Each achieved **68/68 equivalent responses and 126/126 identical statement row digests**, with `EXPLAIN QUERY PLAN`. No schema modifications.

| Synthetic listing context | A canonical query | B indexed JSON IDs | Interpretation |
| --- | ---: | ---: | --- |
| 100 listings, price ASC first page (run 1) | 89.000 ms | 0.259 ms | Large benefit |
| 9,000 listings, price ASC first page (run 1) | 87.379 ms | 15.665 ms | Meaningful benefit |
| 9,000 listings, price ASC first page (repeat) | 136.740 ms | 23.834 ms | Replicated |
| 9,000 listings, overall first page (repeat) | **1.431 ms** | 18.575 ms | **Reject substitution on overall sort** |
| 9,000 listings + overall≥75 COUNT (repeat) | **13.670 ms** | 16.702 ms | **Reject substitution on combined filter** |
| 150,000 listings, overall first page (repeat) | **0.439 ms** | 99.811 ms | **Severe regression; forbid large map** |
| 150,000 listings, price ASC first page (repeat) | 159.636 ms | 139.237 ms | Marginal gain despite high memory |
| 150,000 listings, for_sale OR not_for_sale COUNT (repeat) | **146.709 ms** | 175.512 ms | **Reject mixed/OR filter substitution** |

**Payload/heap costs:** fixed synthetic price-ID map JSON ~60,549 bytes at 9k IDs and ~1,009,172 bytes at 150k. The observed fixture creation `heapUsed` delta was ~1.84–1.88MB and ~7.0–7.2MB respectively (not a production heap peak). The general sort-by-price with no positive `for_sale` filter has **no proven equivalent optimization**. Captures are same-runner SQL timings, not server API p95/RUM; no current marketplace inventory is observed.

## Small implementation and fallbacks

- Only a **single positive `for_sale` advanced rule**, within a hard cap of **9,000 valid price IDs**, gets a request-local `json_each(?)` membership predicate. Cap is checked before constructing JSON; higher-density snapshots fall back to canonical `marketplace_price(player_id)` with **no large JSON allocation**.
- For eligible queries, use membership predicate on `COUNT(*)`. The **paged SELECT uses the membership predicate only when sorting by listing_price** (ASC or DESC, including reverse-tail); ordinary overall/age/other sorts retain the original page SQL. Source row counts stay under the existing DB-only count cache, since they do not depend on prices.
- Do not reuse `COUNT(*)` between listing-sensitive requests even when the SQLite generation and filters are unchanged. The underlying JSON marketplace state can change independently of SQLite; a generation-only LRU entry could return stale totals, incorrect page count and page clamp. Offline test covers updates of the mapping with **the same generatedAt**, plus 0/1/10/150/9000/9001 synthetic listings, OR/AND/no-filter/NULL/pagination.
- No fixed price index and no writes to any DB. `setMarketplacePrices` continues to normalize authoritative prices. Existing security and source/cache tests have been updated to **enforce the narrow exception**, rather than dropping the restrictions.
- This PR does not optimize general unfiltered price sorting; cost of dynamic marketplace fetch, Vercel and real device remains unmeasured until single release.

## Rollback / CI / release

Revert bounded `saleWhere`/COUNT exception and predicate selection from `api/_data-page.js`; no migration required. API result schemas, sort order, arbitrary page numbering and owners are unchanged. Run source-head Site Quality, all accessibility audits, Mobile and Table Header, then exact-head CI. Keep PR open until maintainer explicitly requests merge; do not deploy/rebuild runtime DB.

**PERF-05D, PERF-05, PERF-03C and PERF-03 remain pending.**
