# Post-foundations browser baseline — 2026-09-15

This is a local production Next runtime on a GitHub-hosted runner with synthetic client throttling.
These measurements **must never be described as production latency**. No application behavior changes
are included in this evidence PR.

## Provenance

- Capture: [workflow run 34915579098](https://github.com/FraGioco9/mfl-front-office/actions/runs/34915579098), completed `2026-09-15T01:08:06.523Z`.
- PR source head: `6e70554f5a64b875c04c0c20a2ba5119da6f2741`, branch `perf/969-current-performance-baseline`.
- Actual checkout: `f5af00634528d0275973b3a74350852b26f5945e`, the GitHub PR merge ref onto `2e14676f9e5b401964addffce812ac5adae26bdd` (post-#979).
- Both source head and actual checkout have tree `e54feba8ce691ee058ea8209f2fa09248bd06356`, verified with Git. The original JSON's `sourceCommit` labels the PR head; its samples are retained unchanged. Future captures record `git rev-parse HEAD` directly.
- Runtime: `next build --webpack` + `next start`, Next 16.3.4, Node v22.23.2, Linux x64, Google Chrome 152.0.7977.82; local server `http://127.0.0.1:4000`.
- Validated database artifact `10370002986`, from [database run 34896539604](https://github.com/FraGioco9/mfl-front-office/actions/runs/34896539604); generated `2026-09-14T21:35:10.196Z`, 388,227 rows and 9,950 wallets, `sqlite-runtime` source.
- Guest/public-database access, fresh browser profile per repetition. My Clubs covers the guest `/my-clubs/opted-out` destination, not an authenticated club collection.
- Player `171888`, Club `7`, Database Attributes (default 100 rows), Evaluation with that Player, and MFL Stats.
- Five repetitions × six journeys × two profiles = 60 complete runs / 180 phase samples; schema version 12.
- Desktop: 1280×900, unthrottled. Slow mobile: 390×844, 4× CPU slowdown, 150 ms latency, 200,000 bytes/s download and 100,000 bytes/s upload.
- Cold: new browser profile and cleared browser cache; the production server is already running and its dataset discovery has occurred. This is not a serverless cold-start measurement.
- Refresh: full document reload with HTTP cache enabled (`Page.reload({ignoreCache: false})`). It is not a cache-bypassing hard reload.
- Cached: SPA revisit after navigating Home within the same browser session.
- [Original complete JSON](performance-baselines/2026-09-15.json) contains every raw sample, Server-Timing aggregate and stage breakdown. It is checked in so evidence survives Actions artifact expiry.

The capture's original Actions summary lost values because Markdown backticks were evaluated by Bash.
The downloadable JSON/logs were intact. This PR switches summary rendering to Python and removes the
temporary PR trigger; future captures are manual-only and remain outside Site Quality.

## Findings and next work

- Every cached journey recorded zero API requests in all five runs on both profiles. The one remaining request transfers about 0.2 KiB; do not claim zero total network requests.
- Slow-mobile Database is the main measured rendering target: cold useful/settled medians are 2447.2/3101.7 ms, with 2235 ms of long tasks. Cached useful content returns in 29.7 ms but settles at 422.2 ms, with 387 ms of long tasks and CLS 0.0167.
- Database cached settlement's long-animation-frame render phase is 308.8 ms median (326.9 ms slowest), versus 0.0 ms attributed script time. This supports investigating browser layout/paint after revealing the cached table; it does not identify a specific CSS rule as the cause.
- MFL Stats cold/refresh API transfer is 8.5 KiB here; cached API transfer is zero. Slow-mobile cached useful/settled medians are 172.0/203.8 ms. Do not reopen the old large-payload cached-fetch problem without contrary evidence.
- Secondary targets: slow-mobile Player/Stats cached frame callbacks show forced style/layout medians of 37.6/39.6 ms. Slow-mobile Stats cold/refresh CLS remains 0.0362.
- Next implementation should profile Database reveal/settlement at 100 and 250 rows, identify the expensive rendering owner, and capture focused before/after runs using the same runtime, dataset, browser, profiles and journey semantics. Preserve sorting/filtering, pagination and cache correctness.
- This capture does not cover 250-row tables, search/deep pagination, authenticated flows, wallet changes, prolonged navigation or production network/server latency. Those acceptance items remain open in #969.

### Focused cached Database rendering profile — 2026-09-15

Follow-up profiling used the same validated dataset, Chrome version, guest/public-database access and
slow-mobile client profile as the current baseline. These are synthetic GitHub-runner measurements,
not production latency. No production UI behavior was changed for these probes.

Evidence:
- [layout/paint isolation run 34918989984](https://github.com/FraGioco9/mfl-front-office/actions/runs/34918989984)
- [sticky Name isolation run 34919366020](https://github.com/FraGioco9/mfl-front-office/actions/runs/34919366020)
- [parked-layout isolation run 34919644508](https://github.com/FraGioco9/mfl-front-office/actions/runs/34919644508)

Cached slow-mobile medians:

| Probe | Settled ms | Long-task ms | LoAF render phase ms | Rows |
| --- | ---: | ---: | ---: | ---: |
| Normal 100-row table | 397.8 | 368.0 | 296.9 | 100 |
| Hide table-body paint only | 334.3 | 303.0 | 277.1 | 100 |
| Remove table from layout | 50.9 | 0.0 | 17.6 | 100 |
| Disable per-row scroll-state containers | 277.2 | 248.0 | 191.0 | 100 |
| Disable sticky Name positioning too | 256.2 | 234.0 | 181.0 | 100 |
| Keep cached table layout while parked | 230.2 | 197.0 | 153.9 | 100 |
| Keep parked layout + disable scroll-state containers | 227.8 | 197.0 | 152.2 | 100 |

The isolation is strong enough to select the next implementation target:
- browser table **layout** dominates cached Database settlement; hiding paint alone removes little of the cost while removing the table from layout removes the long task;
- the 100 per-row mobile `scroll-state` containers account for a substantial share of first layout work;
- `content-visibility: hidden` on the parked cached Table page discards useful layout state and makes the next reveal pay much of that work again;
- keeping parked layout and disabling scroll-state containers are mostly non-additive on the cached return, because preserving layout already avoids repeating much of the scroll-state/layout work;
- the synthetic `database-250` attempt rendered 100 rows in every sample because production mobile intentionally fixes the hidden Rows control to 100. It is **not** valid 250-row mobile evidence. The 250-row acceptance check remains open and should be measured separately in a context where 250 rows are actually supported.

The first production optimization now preserves the cached Table layout while parked. It uses the exact
measured probe semantics: the parked shared Table page remains zero-height, clipped, invisible and
non-interactive, but no longer applies `content-visibility: hidden` to its descendants. The focused probe
measured 230.2 ms cached settlement versus 397.8 ms for the normal 100-row slow-mobile case. Treat that
as the profiling evidence that selected this implementation, not as an independent measurement of the
final production commit.

The next measured candidate after this PR is replacing the per-row scroll-state container query with
the existing shared horizontal-scroll state/class ownership while preserving the sticky Name column
and its separator. Because the two probes were mostly non-additive on cached return, that change should
remain a separate PR and must earn its own evidence before merge.

The historical [2026-09-12 baseline](performance-923.md#reference-browserruntime-baseline--2026-09-12)
used a local Vercel runtime and lacks equivalent recorded build/dataset/browser provenance. The journey
method is retained, but runtime/compression, dataset and hardware differ. Do not calculate a causal
speedup percentage from the two tables. This capture establishes a reproducible current reference.

## Measurements

All values are median / observed slowest across five repetitions. Missing stage observations are `-`,
not zero. Network KiB values are transferred bytes, not uncompressed source size. Long-task totals
may overlap other timing columns and must not be added to them.

| Profile | Journey | Phase | Useful ms | Settled ms | Requests | API req | KiB | API KiB | Long-task ms | CLS |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desktop | database | cold | 567.9 / 876.9 | 688.6 / 1024.3 | 82 / 82 | 4 / 4 | 470.6 / 470.6 | 7.9 / 7.9 | 232.0 / 476.0 | 0.0000 / 0.0000 |
| desktop | database | refresh | 369.2 / 481.3 | 398.3 / 513.4 | 81 / 81 | 4 / 4 | 192.5 / 192.5 | 7.9 / 7.9 | 181.0 / 376.0 | 0.0000 / 0.0000 |
| desktop | database | cached | 13.5 / 23.7 | 183.4 / 196.5 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 167.0 / 182.0 | 0.0000 / 0.0000 |
| desktop | player | cold | 211.7 / 221.5 | 240.0 / 253.4 | 35 / 35 | 3 / 3 | 506.2 / 506.2 | 3.0 / 3.0 | 64.0 / 103.0 | 0.0000 / 0.0000 |
| desktop | player | refresh | 92.8 / 103.8 | 120.8 / 136.7 | 35 / 35 | 3 / 3 | 174.2 / 174.2 | 3.0 / 3.0 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| desktop | player | cached | 35.5 / 46.3 | 44.1 / 60.3 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| desktop | club | cold | 266.5 / 282.3 | 309.6 / 325.4 | 62 / 62 | 3 / 3 | 499.6 / 499.6 | 3.9 / 3.9 | 58.0 / 61.0 | 0.0000 / 0.0000 |
| desktop | club | refresh | 139.1 / 146.2 | 167.4 / 176.1 | 62 / 62 | 3 / 3 | 188.5 / 188.5 | 3.9 / 3.9 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| desktop | club | cached | 5.9 / 7.0 | 23.7 / 30.4 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| desktop | my-clubs | cold | 126.2 / 138.2 | 159.0 / 171.4 | 26 / 26 | 1 / 1 | 369.2 / 369.2 | 1.0 / 1.0 | 0.0 / 53.0 | 0.0019 / 0.0046 |
| desktop | my-clubs | refresh | 76.5 / 81.9 | 109.6 / 115.0 | 26 / 26 | 1 / 1 | 187.0 / 187.0 | 1.0 / 1.0 | 0.0 / 0.0 | 0.0046 / 0.0046 |
| desktop | my-clubs | cached | 45.2 / 61.4 | 78.5 / 94.4 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0008 / 0.0008 |
| desktop | evaluation | cold | 176.2 / 204.8 | 209.1 / 237.5 | 35 / 35 | 4 / 4 | 399.4 / 399.4 | 3.2 / 3.2 | 57.0 / 105.0 | 0.0000 / 0.0000 |
| desktop | evaluation | refresh | 130.6 / 154.6 | 163.7 / 187.7 | 35 / 35 | 4 / 4 | 181.2 / 181.2 | 3.2 / 3.2 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| desktop | evaluation | cached | 45.5 / 62.0 | 78.3 / 95.0 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| desktop | stats | cold | 311.2 / 338.9 | 343.5 / 367.5 | 39 / 39 | 4 / 4 | 428.7 / 428.7 | 8.5 / 8.5 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| desktop | stats | refresh | 228.6 / 244.3 | 264.3 / 277.2 | 39 / 39 | 4 / 4 | 196.2 / 196.2 | 8.5 / 8.5 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| desktop | stats | cached | 36.3 / 37.1 | 62.1 / 62.1 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| mobile-slow | database | cold | 2447.2 / 2629.2 | 3101.7 / 3290.5 | 84 / 84 | 4 / 4 | 460.9 / 470.6 | 7.9 / 7.9 | 2235.0 / 2310.0 | 0.0001 / 0.0001 |
| mobile-slow | database | refresh | 1802.4 / 1903.7 | 1891.9 / 1999.3 | 84 / 84 | 4 / 4 | 192.5 / 192.5 | 7.9 / 7.9 | 1330.0 / 1423.0 | 0.0001 / 0.0001 |
| mobile-slow | database | cached | 29.7 / 30.6 | 422.2 / 477.3 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 387.0 / 421.0 | 0.0167 / 0.0167 |
| mobile-slow | player | cold | 1657.4 / 1802.8 | 1789.7 / 1828.6 | 35 / 35 | 3 / 3 | 505.9 / 505.9 | 3.0 / 3.0 | 721.0 / 787.0 | 0.0000 / 0.0000 |
| mobile-slow | player | refresh | 779.3 / 797.3 | 806.5 / 815.8 | 35 / 35 | 3 / 3 | 174.2 / 174.2 | 3.0 / 3.0 | 144.0 / 203.0 | 0.0000 / 0.0000 |
| mobile-slow | player | cached | 169.3 / 182.6 | 194.3 / 201.6 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 164.0 / 176.0 | 0.0054 / 0.0054 |
| mobile-slow | club | cold | 2019.9 / 2034.9 | 2113.5 / 2126.0 | 63 / 63 | 3 / 3 | 494.3 / 494.3 | 3.9 / 3.9 | 769.0 / 882.0 | 0.0000 / 0.0000 |
| mobile-slow | club | refresh | 1238.6 / 1248.4 | 1262.1 / 1273.2 | 63 / 63 | 3 / 3 | 188.5 / 188.5 | 3.9 / 3.9 | 421.0 / 437.0 | 0.0000 / 0.0000 |
| mobile-slow | club | cached | 25.6 / 26.0 | 130.9 / 132.2 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 102.0 / 104.0 | 0.0017 / 0.0017 |
| mobile-slow | my-clubs | cold | 1007.7 / 1031.6 | 1039.2 / 1064.4 | 26 / 26 | 1 / 1 | 369.2 / 369.2 | 1.0 / 1.0 | 189.0 / 197.0 | 0.0000 / 0.0000 |
| mobile-slow | my-clubs | refresh | 355.2 / 366.0 | 384.7 / 393.6 | 26 / 26 | 1 / 1 | 187.0 / 187.0 | 1.0 / 1.0 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| mobile-slow | my-clubs | cached | 52.5 / 55.0 | 86.2 / 87.5 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0016 / 0.0016 |
| mobile-slow | evaluation | cold | 1508.7 / 1596.1 | 1538.3 / 1628.6 | 35 / 35 | 4 / 4 | 399.4 / 399.4 | 3.2 / 3.2 | 265.0 / 274.0 | 0.0000 / 0.0000 |
| mobile-slow | evaluation | refresh | 1012.2 / 1016.8 | 1044.2 / 1049.7 | 35 / 35 | 4 / 4 | 181.2 / 181.2 | 3.2 / 3.2 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| mobile-slow | evaluation | cached | 70.1 / 70.4 | 102.2 / 102.6 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0000 / 0.0000 |
| mobile-slow | stats | cold | 1776.2 / 1795.5 | 1816.6 / 1836.1 | 39 / 39 | 4 / 4 | 428.7 / 428.7 | 8.5 / 8.5 | 341.0 / 367.0 | 0.0362 / 0.0362 |
| mobile-slow | stats | refresh | 1144.0 / 1150.9 | 1175.6 / 1185.4 | 39 / 39 | 4 / 4 | 196.2 / 196.2 | 8.5 / 8.5 | 118.0 / 123.0 | 0.0362 / 0.0362 |
| mobile-slow | stats | cached | 172.0 / 181.1 | 203.8 / 217.0 | 1 / 1 | 0 / 0 | 0.2 / 0.2 | 0.0 / 0.0 | 167.0 / 168.0 | 0.0000 / 0.0000 |

Cached SPA stage breakdown (median / observed slowest)
| Profile | Journey | Commit prep ms | Shell sync ms | Reveal wait ms | Preloader wait skipped | Loader ms | Loading paint ms | Release ms | Settle paint ms |
| --- | --- | ---: | ---: | ---: | :---: | ---: | ---: | ---: | ---: |
| desktop | database | 1.5 / 4.0 | 6.4 / 10.0 | 0.1 / 0.2 | yes | 5.8 / 9.6 | - / - | 0.0 / 0.1 | 169.2 / 184.4 |
| desktop | player | 0.4 / 0.4 | 8.8 / 13.2 | 12.4 / 18.5 | no | 13.8 / 16.4 | - / - | 0.1 / 0.1 | 10.7 / 19.4 |
| desktop | club | 0.7 / 0.7 | 2.3 / 3.2 | 0.1 / 0.2 | yes | 2.8 / 3.1 | - / - | 0.0 / 0.1 | 18.0 / 23.6 |
| desktop | my-clubs | 0.5 / 0.5 | 2.1 / 2.2 | 9.4 / 25.3 | no | 0.2 / 0.3 | 33.1 / 33.1 | 0.2 / 0.2 | 33.2 / 33.3 |
| desktop | evaluation | 0.5 / 0.5 | 5.0 / 6.1 | 8.1 / 21.9 | no | 31.9 / 33.4 | - / - | 0.0 / 0.1 | 32.9 / 33.0 |
| desktop | stats | 0.4 / 0.4 | 8.6 / 10.5 | 19.4 / 19.5 | no | 7.9 / 8.8 | - / - | 0.0 / 0.1 | 25.6 / 25.8 |
| mobile-slow | database | 4.6 / 7.0 | 12.8 / 13.6 | 0.1 / 0.5 | yes | 11.0 / 12.1 | - / - | 0.1 / 0.9 | 392.5 / 447.0 |
| mobile-slow | player | 2.0 / 2.1 | 40.0 / 44.1 | 63.6 / 66.9 | no | 61.9 / 71.2 | - / - | 0.7 / 1.0 | 21.1 / 25.0 |
| mobile-slow | club | 2.8 / 4.0 | 11.4 / 11.9 | 0.4 / 1.0 | yes | 10.7 / 11.5 | - / - | 0.1 / 0.4 | 105.3 / 106.2 |
| mobile-slow | my-clubs | 1.7 / 2.2 | 10.5 / 11.9 | 13.1 / 14.1 | no | 1.0 / 1.1 | 26.9 / 28.4 | 0.5 / 0.5 | 32.7 / 33.7 |
| mobile-slow | evaluation | 1.8 / 2.2 | 23.1 / 24.1 | 12.8 / 14.7 | no | 31.1 / 33.3 | - / - | 0.5 / 0.7 | 32.1 / 33.0 |
| mobile-slow | stats | 1.5 / 1.9 | 76.1 / 79.4 | 33.1 / 38.5 | no | 62.7 / 63.6 | - / - | 0.6 / 0.9 | 32.3 / 35.9 |

Cached settlement breakdown (median / observed slowest)
| Profile | Journey | Commit → frame 1 ms | Frame 1 → frame 2 ms | Settlement long-task ms | Player immediate ms | View frame ms | Player frame ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| desktop | database | 1.2 / 4.7 | 168.6 / 183.9 | 167.0 / 182.0 | 0.1 / 0.2 | 0.0 / 0.0 | 0.0 / 0.0 |
| desktop | player | 3.8 / 4.0 | 7.2 / 15.7 | 0.0 / 0.0 | 0.0 / 0.0 | 0.6 / 0.6 | 0.0 / 0.0 |
| desktop | club | 0.4 / 5.4 | 17.6 / 18.8 | 0.0 / 0.0 | 0.1 / 0.1 | 0.0 / 0.0 | 0.0 / 0.0 |
| desktop | my-clubs | 16.5 / 16.6 | 16.6 / 16.9 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 |
| desktop | evaluation | 16.3 / 16.5 | 16.6 / 16.6 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 |
| desktop | stats | 8.9 / 9.6 | 16.4 / 17.1 | 0.0 / 0.0 | 0.0 / 0.0 | 2.2 / 2.3 | 0.0 / 0.0 |
| mobile-slow | database | 2.0 / 2.2 | 390.3 / 445.1 | 387.0 / 421.0 | 0.5 / 1.0 | 0.0 / 0.0 | 0.0 / 0.0 |
| mobile-slow | player | 15.1 / 16.1 | 5.0 / 10.0 | 12.0 / 12.8 | 0.0 / 0.0 | 3.1 / 4.2 | 0.0 / 0.0 |
| mobile-slow | club | 1.6 / 1.8 | 103.9 / 104.6 | 102.0 / 104.0 | 0.7 / 1.0 | 0.0 / 0.0 | 0.0 / 0.0 |
| mobile-slow | my-clubs | 16.4 / 16.7 | 17.0 / 17.3 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 |
| mobile-slow | evaluation | 15.2 / 16.3 | 16.7 / 17.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 |
| mobile-slow | stats | 21.4 / 22.7 | 10.1 / 14.7 | 19.0 / 20.6 | 0.0 / 0.0 | 2.5 / 3.5 | 0.0 / 0.0 |

Cached settlement long-animation-frame breakdown (median / observed slowest)
| Profile | Journey | LoAF ms | Blocking ms | Script ms | Forced style/layout ms | Render phase ms | Style/layout→end ms | Top script ms | Top script |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| desktop | database | 147.3 / 170.4 | 83.2 / 107.7 | 0.0 / 9.4 | 0.0 / 0.0 | 133.0 / 157.8 | 132.2 / 157.5 | 9.4 / 9.4 | ResizeObserverCallback |
| desktop | player | - / - | - / - | - / - | - / - | - / - | - / - | - / - | - |
| desktop | club | - / - | - / - | - / - | - / - | - / - | - / - | - / - | - |
| desktop | my-clubs | - / - | - / - | - / - | - / - | - / - | - / - | - / - | - |
| desktop | evaluation | - / - | - / - | - / - | - / - | - / - | - / - | - / - | - |
| desktop | stats | - / - | - / - | - / - | - / - | - / - | - / - | - / - | - |
| mobile-slow | database | 344.4 / 378.0 | 258.8 / 277.3 | 0.0 / 0.0 | 0.0 / 0.0 | 308.8 / 326.9 | 307.8 / 326.8 | - / - | - |
| mobile-slow | player | 71.7 / 79.6 | 21.0 / 28.7 | 64.0 / 71.4 | 37.6 / 44.2 | 69.0 / 77.8 | 2.4 / 2.5 | 64.0 / 71.4 | FrameRequestCallback |
| mobile-slow | club | 109.1 / 116.2 | 30.7 / 36.8 | 0.0 / 0.0 | 0.0 / 0.0 | 79.8 / 86.2 | 79.5 / 85.3 | - / - | - |
| mobile-slow | my-clubs | - / - | - / - | - / - | - / - | - / - | - / - | - / - | - |
| mobile-slow | evaluation | - / - | - / - | - / - | - / - | - / - | - / - | - / - | - |
| mobile-slow | stats | 71.4 / 74.3 | 21.3 / 24.1 | 63.4 / 65.5 | 39.6 / 41.1 | 70.7 / 73.2 | 2.9 / 3.2 | 63.4 / 65.5 | FrameRequestCallback |

Cached shell sync breakdown (median / observed slowest)
| Profile | Journey | Footer ms | Navigation ms | Views ms | Table chrome ms | Prime ms | Visibility ms | Horizontal cues ms | Show total ms | Static total ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desktop | database | 0.6 / 0.6 | 0.0 / 0.1 | 0.1 / 0.1 | 0.3 / 4.3 | 0.2 / 0.2 | 0.2 / 2.3 | 0.1 / 0.1 | 0.7 / 4.8 | 1.4 / 5.5 |
| desktop | player | 0.1 / 0.1 | 0.0 / 0.1 | 0.0 / 0.0 | 0.0 / 0.0 | 1.4 / 1.5 | 0.2 / 0.2 | 5.7 / 10.0 | 7.2 / 11.7 | 7.3 / 11.8 |
| desktop | club | 0.2 / 0.3 | 0.0 / 0.1 | 0.1 / 0.1 | 0.3 / 0.4 | 0.2 / 0.2 | 0.0 / 0.1 | 0.0 / 0.1 | 0.6 / 0.8 | 0.8 / 1.2 |
| desktop | my-clubs | 0.1 / 0.2 | 0.0 / 0.1 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.1 | 0.1 / 0.1 | 0.0 / 0.0 | 0.1 / 0.2 | 0.3 / 0.3 |
| desktop | evaluation | 0.1 / 0.2 | 0.1 / 0.1 | 0.0 / 0.1 | 0.0 / 0.0 | 0.2 / 0.2 | 0.1 / 0.1 | 0.0 / 0.0 | 0.3 / 0.3 | 0.5 / 0.5 |
| desktop | stats | 0.1 / 0.2 | 0.0 / 0.1 | 0.0 / 0.2 | 0.0 / 0.1 | 1.1 / 1.3 | 0.1 / 0.2 | 5.9 / 7.3 | 7.0 / 8.8 | 7.2 / 9.0 |
| mobile-slow | database | 1.8 / 2.4 | 0.0 / 0.1 | 0.1 / 0.2 | 1.4 / 1.6 | 0.5 / 0.8 | 0.7 / 0.8 | 0.1 / 0.3 | 2.7 / 3.1 | 4.9 / 4.9 |
| mobile-slow | player | 0.2 / 0.9 | 0.0 / 0.1 | 0.0 / 0.6 | 0.0 / 0.1 | 5.1 / 5.8 | 0.1 / 0.4 | 27.7 / 29.3 | 32.7 / 35.4 | 33.5 / 36.1 |
| mobile-slow | club | 0.5 / 1.0 | 0.0 / 0.8 | 0.2 / 0.9 | 1.4 / 2.1 | 0.6 / 1.1 | 0.1 / 0.7 | 0.0 / 0.1 | 2.2 / 2.9 | 3.3 / 4.1 |
| mobile-slow | my-clubs | 0.7 / 0.9 | 0.1 / 1.0 | 0.0 / 0.0 | 0.0 / 0.5 | 0.0 / 0.1 | 0.2 / 0.8 | 0.0 / 0.0 | 0.7 / 0.9 | 1.4 / 1.8 |
| mobile-slow | evaluation | 0.8 / 1.2 | 0.1 / 0.5 | 0.0 / 0.5 | 0.0 / 0.1 | 0.9 / 1.2 | 0.1 / 0.6 | 0.0 / 0.6 | 1.1 / 2.0 | 2.3 / 2.5 |
| mobile-slow | stats | 0.8 / 1.1 | 0.0 / 0.0 | 0.2 / 0.8 | 0.0 / 0.8 | 3.5 / 4.1 | 0.7 / 0.9 | 61.2 / 65.6 | 66.4 / 69.9 | 67.6 / 70.9 |

Cached horizontal cue breakdown (median / observed slowest)
| Profile | Journey | Watchlist ms | Ensure views ms | View sync ms | Player sync ms | Measured total ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| desktop | database | - / - | - / - | - / - | - / - | - / - |
| desktop | player | 0.0 / 0.1 | 0.1 / 0.2 | 5.5 / 9.8 | 0.1 / 0.1 | 5.7 / 10.0 |
| desktop | club | - / - | - / - | - / - | - / - | - / - |
| desktop | my-clubs | - / - | - / - | - / - | - / - | - / - |
| desktop | evaluation | - / - | - / - | - / - | - / - | - / - |
| desktop | stats | 0.0 / 0.1 | 0.1 / 0.2 | 5.7 / 7.0 | 0.0 / 0.1 | 5.8 / 7.1 |
| mobile-slow | database | - / - | - / - | - / - | - / - | - / - |
| mobile-slow | player | 0.0 / 0.9 | 1.1 / 1.2 | 26.4 / 27.6 | 0.1 / 0.6 | 27.7 / 29.3 |
| mobile-slow | club | - / - | - / - | - / - | - / - | - / - |
| mobile-slow | my-clubs | - / - | - / - | - / - | - / - | - / - |
| mobile-slow | evaluation | - / - | - / - | - / - | - / - | - / - |
| mobile-slow | stats | 0.0 / 0.1 | 0.1 / 0.8 | 30.7 / 33.2 | 0.1 / 1.1 | 31.0 / 35.2 |

Cached loader overview (median / observed slowest)
| Profile | Journey | Cache apply ms | Outer restore ms | Render pre-chrome ms | Page chrome ms | Table controls ms | Quick filters ms | RenderPage total ms | RenderPage direct ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| desktop | database | 0.2 / 0.2 | 0.1 / 0.3 | 0.0 / 0.1 | 0.3 / 0.4 | 1.0 / 2.6 | 0.0 / 0.1 | 4.6 / 8.4 | 4.6 / 8.4 |
| desktop | player | 0.4 / 0.5 | - / - | 0.1 / 0.1 | 0.1 / 0.1 | - / - | 0.0 / 0.0 | 13.0 / 15.1 | 13.0 / 15.1 |
| desktop | club | 0.2 / 0.2 | - / - | 0.0 / 0.1 | 0.2 / 0.3 | 0.5 / 0.7 | 0.0 / 0.0 | 1.5 / 1.9 | 1.6 / 1.9 |
| desktop | my-clubs | - / - | - / - | - / - | - / - | - / - | - / - | - / - | - / - |
| desktop | evaluation | 0.1 / 0.2 | - / - | 0.0 / 0.1 | 0.1 / 0.2 | - / - | 0.0 / 0.0 | 31.4 / 33.0 | 31.3 / 33.0 |
| desktop | stats | - / - | - / - | - / - | 0.0 / 0.1 | - / - | 0.0 / 0.1 | - / - | - / - |
| mobile-slow | database | 0.7 / 1.0 | 0.1 / 0.7 | 0.1 / 0.9 | 0.9 / 1.2 | 2.1 / 2.7 | 0.0 / 0.1 | 7.5 / 8.9 | 7.5 / 8.9 |
| mobile-slow | player | 2.2 / 2.5 | - / - | 0.1 / 0.3 | 0.0 / 0.2 | - / - | 0.0 / 0.0 | 58.9 / 66.8 | 58.9 / 66.8 |
| mobile-slow | club | 0.9 / 1.0 | - / - | 0.1 / 0.4 | 0.6 / 0.9 | 2.2 / 2.8 | 0.0 / 0.8 | 6.5 / 7.0 | 6.5 / 7.0 |
| mobile-slow | my-clubs | - / - | - / - | - / - | - / - | - / - | - / - | - / - | - / - |
| mobile-slow | evaluation | 0.8 / 0.9 | - / - | 0.0 / 2.1 | 0.5 / 0.7 | - / - | 0.0 / 0.0 | 29.5 / 30.3 | 29.5 / 30.3 |
| mobile-slow | stats | - / - | - / - | - / - | 0.3 / 1.4 | - / - | 0.0 / 0.1 | - / - | - / - |

Cached filter/render breakdown (median / observed slowest)
| Profile | Journey | ApplyFilters total ms | Filter prep ms | Row filter ms | Filter UI ms | Table render total ms | Table build ms | Body reused | DOM commit ms | Table post ms | Apply tail ms | Page tail ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | :---: | ---: | ---: | ---: | ---: |
| desktop | database | 1.5 / 5.7 | 0.1 / 0.2 | 0.1 / 0.2 | 0.1 / 0.4 | 1.2 / 2.0 | 0.2 / 0.4 | yes | 0.0 / 0.0 | 1.0 / 1.8 | 0.0 / 3.6 | 0.3 / 0.9 |
| desktop | player | - / - | - / - | - / - | - / - | - / - | - / - | no | - / - | - / - | - / - | - / - |
| desktop | club | 0.7 / 0.8 | - / - | - / - | - / - | 0.4 / 0.5 | 0.1 / 0.2 | yes | 0.0 / 0.1 | 0.3 / 0.4 | 0.0 / 0.0 | 0.1 / 0.1 |
| desktop | my-clubs | - / - | - / - | - / - | - / - | - / - | - / - | no | - / - | - / - | - / - | - / - |
| desktop | evaluation | - / - | - / - | - / - | - / - | - / - | - / - | no | - / - | - / - | - / - | - / - |
| desktop | stats | - / - | - / - | - / - | - / - | - / - | - / - | no | - / - | - / - | - / - | - / - |
| mobile-slow | database | 3.3 / 3.5 | 0.6 / 1.0 | 0.1 / 0.4 | 0.0 / 0.0 | 2.2 / 2.8 | 1.0 / 1.2 | yes | 0.0 / 0.1 | 1.3 / 2.1 | 0.0 / 0.0 | 1.0 / 1.1 |
| mobile-slow | player | - / - | - / - | - / - | - / - | - / - | - / - | no | - / - | - / - | - / - | - / - |
| mobile-slow | club | 2.7 / 2.8 | - / - | - / - | - / - | 1.6 / 1.9 | 0.7 / 0.9 | yes | 0.0 / 0.0 | 0.9 / 1.3 | 0.0 / 0.0 | 0.9 / 1.0 |
| mobile-slow | my-clubs | - / - | - / - | - / - | - / - | - / - | - / - | no | - / - | - / - | - / - | - / - |
| mobile-slow | evaluation | - / - | - / - | - / - | - / - | - / - | - / - | no | - / - | - / - | - / - | - / - |
| mobile-slow | stats | - / - | - / - | - / - | - / - | - / - | - / - | no | - / - | - / - | - / - | - / - |

Cached renderPage tail breakdown (median / observed slowest)
| Profile | Journey | Loading finish ms | Navigation guard ms | Scroll reset ms | Home sync ms | Async continuation ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| desktop | database | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.1 | 0.0 / 0.0 | 0.3 / 0.9 |
| desktop | player | - / - | - / - | - / - | - / - | - / - |
| desktop | club | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.1 | 0.1 / 0.1 |
| desktop | my-clubs | - / - | - / - | - / - | - / - | - / - |
| desktop | evaluation | - / - | - / - | - / - | - / - | - / - |
| desktop | stats | - / - | - / - | - / - | - / - | - / - |
| mobile-slow | database | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | 1.0 / 1.1 |
| mobile-slow | player | - / - | - / - | - / - | - / - | - / - |
| mobile-slow | club | 0.0 / 0.0 | 0.0 / 0.1 | 0.0 / 0.0 | 0.0 / 0.1 | 0.8 / 1.0 |
| mobile-slow | my-clubs | - / - | - / - | - / - | - / - | - / - |
| mobile-slow | evaluation | - / - | - / - | - / - | - / - | - / - |
| mobile-slow | stats | - / - | - / - | - / - | - / - | - / - |

