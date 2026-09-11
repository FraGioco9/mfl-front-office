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

## Existing query-plan evidence

`scripts/database/runtime_query_plans.py` and `tests/test_runtime_query_plans.py` already
protect representative Database, Agent, MFL, Club and Watchlist planner shapes.

The deep Database test also shows a seek-pagination query performs at most 35% of the SQLite
VM work of the equivalent deep OFFSET query on the deterministic fixture. Production still
supports arbitrary page jumps and arbitrary sorts/filters, so cursor pagination requires a
separate contract rather than replacing OFFSET opportunistically.

## Still required

Representative browser/runtime baselines for Database, Player, Club, My Clubs, Evaluation and
Stats remain to be captured separately, including request counts/bytes, Server-Timing,
content-commit/settled duration, long tasks and layout shift under fixed test conditions.
