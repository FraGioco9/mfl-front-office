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

## PERF-03 decision criteria

Use observed route loads and compile/execution times to identify any real oversized universal owner. A route module may be split out of Shared **only** if all lexical/call sites and first-paint dependencies are demonstrably safe and before/after **same-runner** Chrome comparisons show useful reduction without extra fetches, route reentry bugs or shell flashes. Any product-code change should go into a **dedicated PERF-03B PR**, independently CI tested and squash merged only when proven.

Otherwise, document a **no-change** decision rather than migrating code already loaded lazily or adding caching behavior before PERF-04.

**No Vercel deployment, no production database or wallet modification, and no early issue release.**
