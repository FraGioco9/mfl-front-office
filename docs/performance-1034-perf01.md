# PERF-01 — React/Next 2026-10-02 synthetic performance reference

This is a **five-repetition, local production Next browser capture on a GitHub-hosted runner**, not a measurement of Vercel or live-user latency. It establishes the baseline to be used by issue [#1034](https://github.com/FraGioco9/mfl-front-office/issues/1034), particularly follow-ups PERF-02 and PERF-03. **This evidence-only PR did not change application presentation or deploy the site.**

## Provenance and reproducibility

- Capture [GitHub Actions run 37046160943](https://github.com/FraGioco9/mfl-front-office/actions/runs/37046160943), completed successfully. The harness marked the report `complete: true`: **70 complete journey repetitions / 210 cold-refresh-cached phase samples**.
- Source **`40f40b4208b29bbfab82a0a61ba6f1beedd86fe1`**, ref `audit-1034-perf01-baseline`. This is the code **actually checked out and measured**; subsequent report commits and the final squash merge do not retroactively change the capture.
- Runtime: **Next 16.3.6, React 19.3.0**, Node v22.23.3, linux/x64; **Google Chrome 154.0.8037.57**. Local `next build --webpack` and `next start` on port 4000. The server was already running and data discovery had completed; browser cold is **not** a serverless cold start.
- Validated database artifact **11242500512**, from [run 37038069396](https://github.com/FraGioco9/mfl-front-office/actions/runs/37038069396); `generated_at` **2026-10-02T17:17:23.160Z**, **387,258 rows** and **7,866 wallets**, source `sqlite-runtime`. Guest/public-database context; no authenticated wallet or owner flows.
- Dynamic but repeatable fixture discovery returned Player **171888** and Club **7**. Database Attributes uses the ordinary 100-row default. My Clubs is the guest `/my-clubs/opted-out` outcome.
- **Profiles:** desktop 1280×900 unthrottled; `mobile-slow` 390×844, 4× CPU slowdown, 150 ms added network latency, 200,000 bytes/s download and 100,000 bytes/s upload. Five repetitions per journey per profile, fresh Chrome user profile per complete cold/refresh/cached repetition.
- **Cold:** direct route load with fresh profile and browser cache cleared. **Refresh:** real `Page.reload({ignoreCache:false})`, allowing HTTP cache. **Cached:** SPA revisit within the existing session after parking on Home; **Home** uniquely parks on Database, then returns to Home, avoiding the incorrect same-page no-op.
- Capture retains useful-content and visually-settled times, network requests/transfer, Server-Timing, long tasks, long-animation-frame stage breakdown and CLS. Long-task durations overlap other timings: do not add them to settled latency.
- Full raw samples (gzip): [2026-10-02-perf01.json.gz](../performance-baselines/2026-10-02-perf01.json.gz); readable full-metric summary: [2026-10-02-perf01-summary.json](../performance-baselines/2026-10-02-perf01-summary.json). SHA-256 of the **uncompressed exact raw JSON**: `61de68c0dee96199078c59b1056a0c75b3809d719e044b94db2c5ae8a564498b`. To verify: `gzip -dc performance-baselines/2026-10-02-perf01.json.gz | sha256sum`. The original capture is also in the 90-day Actions artifact; repository evidence persists beyond artifact expiration.

## Current metrics

Median milliseconds over **five repetitions**. `Useful` is the first measured useful-content commit, while `settled` includes visually settled work; neither is a production Web Vitals score. Missing metrics remain missing rather than zero.

| Profile | Journey | Cold useful ms | Cold settled ms | Refresh settled ms | Cached useful ms | Cached settled ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| desktop | Home | 93.3 | 124.3 | 84.4 | 237.8 | 266.1 |
| desktop | Database | 548.5 | 648.0 | 396.0 | 22.5 | 171.9 |
| desktop | Player | 219.9 | 242.3 | 129.2 | 35.6 | 46.4 |
| desktop | Club | 295.1 | 348.2 | 178.7 | 8.0 | 31.4 |
| desktop | My Clubs (guest) | 116.0 | 144.8 | 103.5 | 61.2 | 94.4 |
| desktop | Evaluation | 184.3 | 217.0 | 173.3 | 60.6 | 93.7 |
| desktop | MFL Stats | 317.8 | 348.6 | 248.0 | 37.2 | 61.2 |
| mobile-slow | Home | 1031.8 | 1057.4 | 490.0 | 641.4 | 708.7 |
| mobile-slow | Database | 2615.6 | 3189.5 | 1883.6 | 36.1 | 401.5 |
| mobile-slow | Player | 1820.1 | 1935.2 | 798.0 | 173.8 | 200.1 |
| mobile-slow | Club | 2108.1 | 2186.0 | 1360.3 | 31.5 | 142.2 |
| mobile-slow | My Clubs (guest) | 1099.1 | 1130.5 | 355.9 | 51.8 | 84.6 |
| mobile-slow | Evaluation | 1728.5 | 1761.2 | 1151.6 | 77.8 | 110.0 |
| mobile-slow | MFL Stats | 2009.6 | 2033.9 | 1281.9 | 163.3 | 199.6 |

### Cached slow-mobile rendering and noise guard

Each pair of settled values is **median / observed slowest**. Render phase is the observed long-animation-frame rendering phase in the cached settlement window, **not** total rendering cost; `—` means no qualifying observation. The full JSON contains the other profiles and every median/slowest pair.

| Journey | Settled ms (median / slowest) | Long-task ms | LoAF render ms | CLS | Cached API requests |
| --- | ---: | ---: | ---: | ---: | ---: |
| Home | 708.7 / 744.8 | 648.0 | 50.0 | 0.0474 | 0.0 |
| Database | 401.5 / 429.2 | 352.0 | 274.3 | 0.0411 | 0.0 |
| Player | 200.1 / 221.0 | 173.0 | 67.6 | 0.0151 | 0.0 |
| Club | 142.2 / 161.9 | 104.0 | 86.0 | 0.0066 | 0.0 |
| My Clubs (guest) | 84.6 / 86.3 | 0.0 | — | 0.0024 | 0.0 |
| Evaluation | 110.0 / 118.4 | 0.0 | — | 0.0000 | 0.0 |
| MFL Stats | 199.6 / 220.1 | 165.0 | 70.2 | 0.0000 | 0.0 |

All 14 cached profile/journey combinations had **zero API requests in every captured repetition**; that does **not** mean zero total network traffic. Each slow-mobile cached journey still observed a median of one total request. **Home** cached revisits transferred a median **50,169 bytes (~49.0 KiB) of non-API data** even though API requests were zero; the request category and cache policy should be inspected before inferring a fully network-free Home revisit.

### Main observations

1. **Home (new journey) warrants investigation.** Slow-mobile cached revisit from Database settled in **708.7 ms** (slowest **744.8 ms**), including **648.0 ms** of long tasks and median CLS **0.0474**. There is **no September Home baseline**; this does not establish a regression or a root cause.
2. **Database mobile cached remains a layout/rendering investigation target for PERF-02.** Its useful-content median was **36.1 ms**, but visual settlement was **401.5 ms**, with **352.0 ms** of long tasks and **274.3 ms** observed LoAF render phase. This measurement does not isolate any particular CSS rule.
3. **Cached data-fetch behavior remains bounded in this guest fixture.** With zero API requests across all five repetitions of every cached journey, do not reopen API payload work solely on the basis of cached settlement latency; browser work and observed layout shifts need separate investigation.
4. **Layout shifts remain measurable on slow mobile.** Cached Home CLS **0.0474** and Database CLS **0.0411** are worth isolating with filmstrips/trace data before changing behavior. The previous *later* paired #982/#983 September control already reproduced Database cached CLS of **0.0411**; do not mistake this baseline's ~0.0411 for a newly introduced defect.

## Historical September comparison — descriptive, not causal

The [2026-09-15 #969 baseline](performance-969.md) used **Next 16.3.4 / React 19.2.6**, Node v22.23.2, Chrome 152.0.7977.82, source `f5af0063` / tree `e54feba8`, database artifact `10370002986` generated 2026-09-14 with **388,227 rows / 9,950 wallets**. Today uses Next 16.3.6 / React 19.3.0, a *different* database generation (**387,258 rows / 7,866 wallets**), Chrome 154 and a later GitHub runner. Many independent code and fixture changes occurred between the dates. The old raw JSON link is **no longer present in the current repository**, so the older raw distribution cannot be independently rechecked here.

The table presents *historical median settled ms → October median settled ms*, **not an isolated React/Next upgrade speedup**. Do not compute causal percentages or interpret small movements as improvement/regression without a same-runner, same-dataset paired capture. September excludes Home, so it is deliberately absent below.

| Profile | Journey | Cold settled ms (Sep → Oct) | Refresh settled ms (Sep → Oct) | Cached settled ms (Sep → Oct) |
| --- | --- | ---: | ---: | ---: |
| desktop | Database | 688.6 → 648.0 | 398.3 → 396.0 | 183.4 → 171.9 |
| desktop | Player | 240.0 → 242.3 | 120.8 → 129.2 | 44.1 → 46.4 |
| desktop | Club | 309.6 → 348.2 | 167.4 → 178.7 | 23.7 → 31.4 |
| desktop | My Clubs (guest) | 159.0 → 144.8 | 109.6 → 103.5 | 78.5 → 94.4 |
| desktop | Evaluation | 209.1 → 217.0 | 163.7 → 173.3 | 78.3 → 93.7 |
| desktop | MFL Stats | 343.5 → 348.6 | 264.3 → 248.0 | 62.1 → 61.2 |
| mobile-slow | Database | 3101.7 → 3189.5 | 1891.9 → 1883.6 | 422.2 → 401.5 |
| mobile-slow | Player | 1789.7 → 1935.2 | 806.5 → 798.0 | 194.3 → 200.1 |
| mobile-slow | Club | 2113.5 → 2186.0 | 1262.1 → 1360.3 | 130.9 → 142.2 |
| mobile-slow | My Clubs (guest) | 1039.2 → 1130.5 | 384.7 → 355.9 | 86.2 → 84.6 |
| mobile-slow | Evaluation | 1538.3 → 1761.2 | 1044.2 → 1151.6 | 102.2 → 110.0 |
| mobile-slow | MFL Stats | 1816.6 → 2033.9 | 1175.6 → 1281.9 | 203.8 → 199.6 |

## Limitations and follow-up acceptance

- Five samples are useful as a reproducible reference but insufficient to infer a stable production distribution, especially under runner CPU scheduling and synthetic throttling. The **median / observed slowest** pairs disclose within-run variation; there is no confidence interval or real-user percentiles.
- The local test records frontend/runtime timing with real browser instrumentation but uses a CI-hosted database, not Vercel infrastructure or live network latency. Cache state is defined by the harness; refresh is cache-allowed, not hard reload.
- Home is the only newly added route; comparisons for the other six preserve their journey definitions. Do not treat `mobile-slow` as an iPhone performance measurement or infer Next 16.3.6/React 19.3.0's isolated effect.
- No authenticated club collection, wallet switch, real users, deep pagination, sustained workload, or 250-row phone table was measured. The desktop and mobile default Table route reflects the current product's 100-row behavior.
- **PERF-02** should profile 100-row cached Database layout/paint and CLS using focused paired conditions, preserving table rendering and navigation semantics. Home's cached long-task/CLS observation should be triaged separately. **PERF-03** should be selected from independent bundle/parse coverage evidence, not inferred from these wall-clock totals.
- The normal Site Quality suite should continue enforcing deterministic contracts, **not hard millisecond thresholds**. This full capture was opt-in and branch-scoped; its temporary PR trigger was removed after evidence generation, while the permanent manual-only `performance:baseline` workflow remains available.
