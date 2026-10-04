# LOAD-01B.4 — Isolated pending, settled and real SPA-return geometry (#1034)

Date: 2026-10-04. Companion stacked PR [#1110](https://github.com/FraGioco9/mfl-front-office/pull/1110), based on diagnostic PR #1109. **Diagnostic evidence, not a production UI change.**

## Reproducible comparison

- The new `validation/browser-load01b4-geometry.mjs` uses the real, unchanged app assets and the **existing canonical Chromium routing fixture's synthetic API server**. It replaces anchors in a **temporary copy** to mount `browser-load01b4-probe.js` before the app's parser first paint and disable only the *test fixture's automatic navigation driver* (which otherwise clicks away before photos are taken).
- The runner loads a fresh headless Chromium profile and establishes each route by **direct navigation**, sets device viewport *before navigation*, blocks external HTTPS and persists only synthetic local data / the existing fixture fake wallet proof. No live authentication, account, Supabase, marketplace, shared SQLite, CloudFront, or deploy is involved.
- The probe holds a real app GET, records the visible **pending** state and a CDP PNG. It then releases the original GET, asserts the **settled** route's real fixture content and records geometry, CLS and screenshot. Finally it uses the app's `setPage("privacy", true)` and an actual `setPage` return (or `history.back()` for the Club URL), captures the **third** screenshot and checks API request reuse. This is a real route change, not a repeated DOM snapshot.
- Tests cover **1280×900, 768×1024, 390×844** at **light/dark**; six combinations each across My Clubs, Home, Club, Evaluation and Database: **30 comparisons** plus independent My Clubs and Home smoke gates. The report includes per-selector element count, bounding boxes, CLS from `PerformanceObserver`, delta maps, per-return requests, PNG hashes and limitations. Each case produces three PNGs and one JSON.
- Independent canonical routing, responsive, accessibility and Site Quality workflow suites continue unchanged. The five-route suite does **not** replace those regressions.

## Observations from the initial five-route run

The 30 successful cases within initial CI diagnostic run #37219699140 established the following geometry; this first overall job was **red** solely because a later *extra* selected-Planner cold-start CDP attempt timed out. The final five-route workflow must be independently green before this item is considered validated.

| Surface | Cases | Loading to loaded | True loaded to SPA return | Maximum synthetic CLS |
| --- | ---: | --- | --- | --- |
| My Clubs | 6 | 3 real loading cards → 3 fetched cards; outer page/grid x/y/width/height unchanged | cards and grid x/y/width/height unchanged, **no extra `my-clubs` or competitions GET** | loading **0**, SPA **0.001528** at 390px |
| Home | 6 | summary values resolve from synthetic bootstrap; page bounds stable | Home numeric summary retained, page/metric x/y bounds stable, no new API request | loading and SPA up to **0.006225** |
| Club | 6 | synthetic Club identity and owner resolve; root geometry measured | browser history returns to original Club URL; measured anchors unchanged, no new API request | **0** in captured windows |
| Evaluation | 6 | synthetic bootstrap held/released; empty Evaluation route's search/panel anchors unchanged | plain Evaluation route returns with x/y/size unchanged; no new API request | **0** |
| Database | 6 | 10 skeleton rows → one fixture row; table content height shortens **270px** (desktop/tablet) or **234px** (390px) due to **row cardinality**; header and route shell unchanged | real rows/header/shell retain x/y/size, no new API request | **0** |

**Important limits:** synthetic fixture timings are not Web Vitals field CLS, LCP, Safari/iPhone measurements or Pixel-level A/B against a product change. The Home/Club/Evaluation fixture does not populate arbitrary live records; stable shells do not prove visual parity for every possible state. The test records the full-page screenshots for human inspection but does not equate naturally different content pixels with a bug. Absence of API refetch is measured for *these* cached routes under a single local runner; not a blanket HTTP cache claim.

## Explicitly inconclusive probe

A sixth, optional selected-Planner **SPA** case twice hit `Chrome DevTools request timed out: Runtime.evaluate` in headless Chromium cold start, before a comparable triple-state capture. It is **not** counted as a product defect or passed test. The existing #1109 Planner pending/loaded screenshots and the untouched canonical routing/Planner regression CI remain applicable. A future isolated Planner SPA stress test may be undertaken separately with a dedicated fixture and monitoring. Real Safari/iPhone/opted-in device validation remains at final issue gate.

## Decision

**NO CHANGE** to application sources at LOAD-01B.4: same-card-count My Clubs transitions and true cached SPA returns do not demonstrate an actionable geometry mismatch in the measured regions. Any future application adjustment must have a separate **controlled same-runner A/B** (equal real row counts / consistent images / repeated runs) and show improved results without regression. The parent LOAD-01 and final Safari/iPhone checks remain pending; do not merge, refresh shared/live data or deploy to Vercel.
