# PERF-03B2 — same-runner A/B: do not split Global Search

Part of [issue #1034](https://github.com/FraGioco9/mfl-front-office/issues/1034). Follows [PERF-03A](performance-1034-perf03.md) and the [PERF-03B1 lexical dependency audit](performance-1034-perf03b.md).

## Decision

**No runtime optimization is justified by the current evidence.** Retain the canonical Shared and Global Search owners unchanged. An experimental move of eight dormant-on-cold helper functions reduces universal Shared JavaScript by **4,560 uncompressed bytes** (338,850 → 334,290) but increases the existing lazy Global Search script by **4,620 bytes** (35,379 → 39,999), a net 60-byte increase across those two scripts. Under simulated slow-mobile Chrome, opening Search was slower on every sampled route, including cached SPA reentry. Cold script-duration differences are mixed with noise and instrumentation overhead; these measurements are neither production RUM nor sufficient causal proof of a useful improvement.

**No application source, generated runtime, network request configuration, Supabase data, or Vercel deployment was changed** in the candidate. The experiment substituted responses only inside local test proxies; removing those proxies restores the unmodified build.

## Reproducible capture

- [Successful complete run #37118182237](https://github.com/FraGioco9/mfl-front-office/actions/runs/37118182237), [raw JSON/Markdown/log artifact #11271884782](https://github.com/FraGioco9/mfl-front-office/actions/runs/37118182237/artifacts/11271884782) (90-day retention).
- Source from capture: `c1c5c9dbfc0f95fe28e2cf07b58eecb41e9ef113`; pinned validated SQLite from successful [four-stage refresh #37113407333](https://github.com/FraGioco9/mfl-front-office/actions/runs/37113407333): 387,258 players / 7,866 wallets, database generated 2026-10-03T10:26:45.673Z.
- One GitHub Actions Ubuntu runner, one local Next 16.3.6 production build, two symmetric same-origin proxy variants, Node 22.23.3 and Chrome 154.0.8037.57 with CDP precise coverage. Control/candidate order **A–B–B–A**; two fresh-browser repetitions per variant, for three routes (Home, Database Attributes and direct Evaluation), two profiles (desktop and synthetic 4× CPU-throttled slow mobile), **24 complete journeys**. Each journey covered cold, refresh and cached SPA return; Search first use exercised Ctrl+K and first-use after cached route reentry exercised the Search button. Checks included modal focus, typed query, results, close-animation dismissal, request counts, and no added cold script URLs.
- A first incomplete attempt [#37117798060](https://github.com/FraGioco9/mfl-front-office/actions/runs/37117798060) failed a test assertion that incorrectly required immediate modal dismissal instead of respecting the existing 180 ms closing animation; fixed **only** the experiment probe. A second partial run [#37117867147](https://github.com/FraGioco9/mfl-front-office/actions/runs/37117867147) ended after Chrome CDP detached during one mobile/database journey; a bounded retry now handles **only** a transient CDP transport closure, never a product failure. The third run completed all journeys and analytical checks.

### Actual A/B medians (two repetitions per variant)

A = unchanged control. B = experimental candidate. Times are approximate milliseconds measured using intrusive CDP profiling; the small sample is not statistically decisive.

| Profile / route | Cold ScriptDuration A → B | Cold V8 compile A → B | Cold HTTP requests A → B | First Search focus A → B | Cached Search focus A → B |
| --- | ---: | ---: | ---: | ---: | ---: |
| Desktop · Home | 148.10 → 82.97 | 4.18 → 10.04 | 26 → 26 | 57 → 54 | 54.5 → 54 |
| Desktop · Database | 118.90 → 117.88 | 6.63 → 4.44 | 81 → 81 | 54 → 54 | 55 → 54 |
| Desktop · Evaluation | 89.64 → 88.29 | 4.77 → 6.44 | 36 → 36 | 10 → 12 | 7.5 → 7.5 |
| Slow mobile · Home | 259.23 → 241.29 | 15.02 → 14.42 | 26 → 26 | **385 → 415** | **375.5 → 417** |
| Slow mobile · Database | 344.90 → 334.96 | 16.75 → 16.90 | 83 → 83 | **539 → 572.5** | **529.5 → 554** |
| Slow mobile · Evaluation | 281.02 → 278.18 | 16.70 → 16.46 | 36 → 36 | **37 → 46** | **25.5 → 35.5** |

The candidate had **no new cold script URLs**; the comparator required identical sets on each paired run and the same observed Search result counts after cold and cached first use. Those checks passed. These measurements do **not** validate real FCL/Dapper wallet interaction, iPhone Safari, or all deep-link and keyboard variants.

### Follow-up and cleanup

PERF-03B2 is an evidence-backed **no-change** decision: retain the existing runtime; a tiny initial-payload reduction does not outweigh likely Search interaction cost or the current measurement uncertainty. No runtime product PR is warranted for this candidate. The temporary `.github/workflows/perf03b2-ab.yml` is removed before merging the documentation/test tooling PR; the baseline and release CI behavior are unchanged. Keep PERF-03C pending until the final issue-wide Vercel release and real-device checks.

An unrelated recurring `responsive-table-resize` age-marker assertion at 1366px appeared in a standard mobile job on the measurement-only branch and passed an isolated retry without UI changes. This remains tracked under **TEST-04** in [issue #1034](https://github.com/FraGioco9/mfl-front-office/issues/1034); do not suppress the assertion.

## Archived experiment implementation

Read-only probe and comparison tools remain in `validation/perf03b2-{candidate-proxy,measure,compare}.mjs` plus `validation/perf03b2-first-use-snippet.txt`. They require a **local** Next build on port 4000 with an explicitly pinned, validated database. A separate temporary workflow was used for the original measurement, and its successful run/artifact above preserve complete evidence. No automatic A/B capture is added to the default CI or release path.
