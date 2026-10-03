# PERF-03A — Universal JavaScript: coverage before moving modules

Issue [#1034](https://github.com/FraGioco9/mfl-front-office/issues/1034), part of PERF-03 · P2 (universal JS payload).

## Current architecture / reason for the audit

- Generated shared classic script `/modules/app-core-runtime.js` is assembled from **26 canonical Shared fragments** via `modules/core-source-manifest.js`. The manifest already enforces a **355,000-source-byte ceiling** on Shared; generated direct source bytes have historically been ~339 KiB. It runs on each application route, including Home.
- Client-side bootstrap includes `bootstrap.js`, `bootstrap-core.js`, `modules/app-entry.js`, Uniform Width runtime and Next page chunks. The first-paint shell is generated from canonical HTML. Specialist cores for Table, Player, Club, Evaluation, MFL Stats, My Clubs, Planner, Settings, Wallet, Watchlist are **already route-lazy**, and must not be loaded universally for apparent bundle optimizations.
- The previous [PERF-01](performance-1034-perf01.md) captures end-to-end page visibility/timing, but does not attribute JS parse, compile, and execution costs or actual scripts loaded by each initial route.

## Phase A: source ownership and browser measurement

The [PERF-03 branch](https://github.com/FraGioco9/mfl-front-office/tree/audit-1034-perf03-js-coverage) has an **opt-in, capture-only** script `validation/perf03-js-audit.mjs` wrapping the existing browser baseline without modifying production JS. It temporarily instruments the existing Chrome DevTools session **before cold navigation** using:

1. `Profiler.startPreciseCoverage({detailed:true})` and `Profiler.takePreciseCoverage` for script URLs and approximate reached/zero-count function ranges.
2. `Performance.enable` / `Performance.getMetrics`, including `ScriptDuration`, `V8CompileDuration`, and `TaskDuration` for cold, refresh, and cached SPA return. Cached counters are differenced from **after the intermediate parking route**, to avoid attributing Home to the revisited page. Chrome's document totals reset at navigation.
3. The original baseline's request counts, transfer bytes and visually useful/settled timings, plus exact static source file sizes from the repository and the declared domain/runtime mapping.
4. Seven representative real routes: Home, Database Attributes, Player, Club, guest My Clubs, Evaluation, and MFL Stats; **desktop + synthetic slow mobile** (390×844, 4× CPU and 150 ms network). One fresh-profile repetition of cold/refresh/cached per route and profile (14 journeys / 42 phase checkpoints), and the validated database snapshot.

The temporary [workflow](../.github/workflows/perf03-js-audit.yml) invokes the preexisting local production Next build and real Chrome on Actions only, records raw JSON, publishes `perf03-report.json` and Markdown, and gates completeness/coverage/compile metrics. It is branch-scoped; it **does not deploy** and will be removed before any merge. The `validation/perf03-js-audit.mjs` and `validation/perf03-js-report.mjs` tools remain available for reproducible, manually invoked measurement.

### Interpret carefully

Chrome's `V8CompileDuration` and `ScriptDuration` are **aggregate counters**, not a standalone parser microbenchmark or per-file cost attribution. Precise coverage instrumentation itself changes absolute timing; do not compare to PERF-01 as if the two workloads were equivalent. Static byte counts are **uncompressed**, not transferred bytes, and source code units/coverage are not a direct memory or performance score. Some browsers skip scripts loaded after a measurement checkpoint; lazy route chunks must be checked against expected on-demand runtime loads, and subsequent SPA route reentry is a separate acceptance gate.

## Verified capture — 2026-10-03 (PERF-03A)

The [one-off GitHub Actions run #37115903677](https://github.com/FraGioco9/mfl-front-office/actions/runs/37115903677) **passed** after correcting a test assumption: it is legitimate for an idle cached My Clubs guest route to have **zero newly executed script entries**. The earlier [run #37115633040](https://github.com/FraGioco9/mfl-front-office/actions/runs/37115633040) already captured all 14 journeys but failed only the overly strict non-empty cached coverage assertion. No app change was needed. The validated final run includes **14 completed journeys/42 phases** with explicit V8 `ScriptDuration` and `V8CompileDuration`, source-coverage entries, same-origin script URLs and canonical fragment function-offset reachability. `perf03-report.json`, Markdown, full raw baseline JSON and Chrome logs are preserved in [artifact #11271374605](https://github.com/FraGioco9/mfl-front-office/actions/runs/37115903677/artifacts/11271374605) (90-day retention, compressed archive SHA-256 `ee0fc08c117b3d12dd9e09a593b099414bb2c5784555ced475712f0f643f41f9`).

Provenance: **measured source commit `479ff650a702e5aa75f4e4c761f465e0edfd12ef`**; pinned validated DB artifact **11242500512** from run 37038069396, **387,258 rows / 7,866 wallets**, generated 2026-10-02T17:17:23.160Z; Next 16.3.6, Node 22.23.3, Chrome 154.0.8037.57, guest routes. The measured source is not the later report/fix PR head; the changed files after measurement are instrumentation/report documentation only.

### Measured desktop / slow-mobile cold JavaScript

One cold sample per route and profile. Values are **Chrome aggregate counters in milliseconds** under CDP precise coverage. They are not individually attributable to the shared JS bundle, and must not be compared to the uninstru-mented PERF-01 browser times or portrayed as production RUM. Uncompressed local sources in the reported source KiB exclude unknown Next internal chunks and should not be confused with HTTP transfer.

| Route | Desktop script / compile ms | Slow mobile script / compile ms | Indexed local source KiB (slow mobile) |
| --- | ---: | ---: | ---: |
| Home | 192.3 / 6.4 | 414.0 / 30.6 | 485.5 |
| Database Attributes | 192.2 / 8.9 | 565.5 / 25.9 | 611.9 |
| Player | 148.3 / 8.7 | 589.4 / 27.9 | 588.1 |
| Club | 169.0 / 9.7 | 568.3 / 28.7 | 638.1 |
| My Clubs (guest) | 107.4 / 7.3 | 410.3 / 26.2 | 512.0 |
| Evaluation | 137.6 / 10.6 | 438.4 / 27.6 | 561.6 |
| MFL Stats | 158.6 / 8.1 | 675.8 / 27.4 | 620.3 |

### Module-load topology: confirmed

**The same six identified source files were loaded on all seven cold routes**: `/bootstrap.js` (**85,214 bytes**), `/bootstrap-core.js` (**22,172**), `/modules/app-entry.js` (**26,081**), `/table-width-runtime.js` (**23,344**), `/first-paint-table-header-runtime.js` (**1,533**) and `/modules/app-core-runtime.js` (**338,850**). They sum to **497,194 uncompressed source bytes (~485.5 KiB)**, **not all universal JS**: additional always-loaded UI scripts and Next framework chunks are not accounted for in this subtotal. Shared is below the existing **355,000-source-byte** cap (about 16.1 KiB headroom).

**Complete browser script-URL intersection:** exactly **17 script URLs** were present on **all seven cold routes**: the six identified files above, **five additional universal frontend scripts** (`control-interactions-runtime.js`, `document-title-runtime.js`, `dropdowns-runtime.js`, `route-core-loader-runtime.js`, `static-ui-runtime.js`) and **six Next framework/manifest chunks**. All **11 same-origin app-authored universal scripts** add up to **572,556 uncompressed source bytes (~559.1 KiB)**; the six Next chunks contribute another ~370,073 Chrome source-code offset units, **not verified UTF-8 bytes or actual network transfer**. The manifest/Next bundling and route-specific payloads must therefore be kept separate rather than claiming the six-file subtotal is the entire client JS cost. Home cold reached ~133/551 Shared JS function spans; the low cold reach does **not** imply those other functions are unused after first interaction.

Route-owned cores loaded in exactly their expected places in this route matrix: Table **126.4 KiB** on Database/Club/MFL Stats, Player **102.5 KiB** on Player, Evaluation **76.1 KiB** on Evaluation, Club **26.2 KiB** on Club, My Clubs **26.4 KiB** on guest My Clubs, and MFL Stats **8.4 KiB** on MFL Stats. Table is **not loaded on Home, Player, Evaluation or guest My Clubs**. Planner, Settings, Wallet and Watchlist cores were not exercised by this seven-route matrix; their startup should remain lazy, rather than being made universal to reduce a request count.

### Function-level source owner candidates

Chrome reported reached/declared function spans for the canonical **Shared** fragments under cold first load. Example slow-mobile results:

| Canonical Shared owner | Source bytes | Home reached/declared | Database | Evaluation |
| --- | ---: | ---: | ---: | ---: |
| `shared-personal-state.js` | 63,644 | 36/136 | 47/138 | 36/136 |
| `shared-data-search.js` | 23,829 | 1/51 | 21/53 | 18/67 |
| `shared-evaluation-lifecycle.js` | 18,097 | 7/37 | 7/37 | 23/41 |
| `shared-global-search.js` | 9,800 | 0/15 | 0/15 | 0/15 |
| `shared-player-first-paint.js` | 4,058 | 0/4 | 0/4 | 0/4 |

Cold coverage **cannot identify dead code**. The global-search helpers are interaction-only and called after deferred search activation; Player first-paint helpers are reached by real route transitions; Evaluation settings helpers are also invoked by **universal startup and Settings flows** (e.g. `loadEvaluationMflPerUsd` and `loadEvaluationLateSeasonRewardRates` in `shared-startup-lifecycle.js`). Naively relocating entire Shared fragments to their specialist route cores would break shared lexical dependencies, direct links, first-paint, modal actions or cached reentry. Precise coverage instrumentation also adds overhead. These observations identify *candidates to isolate in subsequent, targeted A/B tests*, not safe deletions by themselves.

### PERF-03A decision and PERF-03B gate

- **Keep existing production routing and JS ownership unchanged** in PERF-03A. The measurements identify nontrivial universal source weight, but neither prove which individual bytes dominate V8 main-thread cost nor verify a zero-regression split. Moving unrelated Shared code merely because one cold sample did not call it is **not** justified.
- **PERF-03B candidate:** the ~9.6 KiB `shared-global-search.js` fragment, because none of its functions was reached on these cold profiles while `/global-search-runtime.js` is already loaded on first use/evaluation. Before splitting: trace every caller (including keyboard search, query/deep link, wallet session and initial focus), identify script lexical state, ensure no added first-paint request, then measure control vs candidate in **paired same-runner cold/refresh/cached/first-use** Browser CDP captures. Accept only if actual universal bytes/compile or execution decrease without deferred interaction cost or route regressions. A **separate PERF-03B PR** owns any eventual product code.
- The current Shared source ceiling (355000 bytes) and deterministic opt-in browser testing guardrails remain in place. No speculative bootstrap, source concatenation or first-paint preload change is merged.

**PERF-03C** remains open for the final issue-wide release and real iPhone/Safari testing. No Vercel deployment, no live Supabase mutation, no wallet side effects from this audit.

## PERF-03 decision criteria

Use observed route loads and compile/execution times to identify any real oversized universal owner. A route module may be split out of Shared **only** if all lexical/call sites and first-paint dependencies are demonstrably safe and before/after **same-runner** Chrome comparisons show useful reduction without extra fetches, route reentry bugs or shell flashes. Any product-code change should go into a **dedicated PERF-03B PR**, independently CI tested and squash merged only when proven.

Otherwise, document a **no-change** decision rather than migrating code already loaded lazily or adding caching behavior before PERF-04.

**No Vercel deployment, no production database or wallet modification, and no early issue release.**
