# PERF-02 — 100-row mobile Table layout isolation

Issue: [#1034](https://github.com/FraGioco9/mfl-front-office/issues/1034). Phase **PERF-02A — measurement first**.

## Why

The verified [PERF-01 baseline](performance-1034-perf01.md) recorded a slow-mobile cached Database settled median of **401.5 ms**, cached useful content **36.1 ms**, long tasks **352.0 ms**, observed long-animation-frame rendering **274.3 ms**, and CLS **0.0411**. These are five synthetic samples against the local Next production server with the 2026-10-02 database artifact, **not production Web Vitals** and not proof that any specific CSS rule is defective.

The previous [September layout experiment](performance-969.md#focused-cached-database-rendering-profile--2026-09-15) identified table layout, per-row scroll-state and offscreen parked layout as contributors. Those latter two owners were already optimized, so this phase must re-check the **current** source before changing them again.

## Measurement — existing opt-in harness, no app mutation

Temporary, branch-only [PERF-02 capture workflow](../.github/workflows/perf02-one-off-capture.yml) runs on `audit-1034-perf02-mobile-layout`. It reuses the existing `validation/performance-baseline.mjs`, current validated `mfl_database` artifact, Node 22, local production Next and Chromium. Five repetitions each, **one** slow-mobile profile (390×844, CPU ×4, 150 ms network latency), fresh browser profile per repetition, cold/refresh/cached, with the same page and data across these diagnostic probes:

| Existing journey | Isolated comparison | User-visible product change? |
| --- | --- | --- |
| `database-100` | Production 100-row Attributes table control | No |
| `database-100-no-paint` | Hide table-body paint only | No; measurement-only injected CSS |
| `database-100-no-layout` | Suppress table layout | No; destroys usable table for diagnostic only |
| `database-100-no-scroll-state` | Remove legacy per-row scroll container behavior | No; diagnostic probe, may now be a no-op |
| `database-100-no-sticky-name` | Disable sticky Name and per-row containers | No; intentionally breaks product behavior to isolate cost |
| `database-100-keep-parked-layout` | Preserve parked Table layout on return | No; diagnostic probe, may now be a no-op |

Expect **30 complete journey repetitions / 90 phases**. Check that the actual control contains 100 rows; retain full JSON/CI logs as Actions artifacts. Do not combine unlike fixtures, compare September to October causally, or treat hide-table metrics as product performance.

## Decision gate

Inspect **cached** median/slowest settled duration, useful duration, long tasks, LoAF rendering/style+layout, CLS, table size and rendered row/cell count; compare cold/refresh for counter-effects. Workload differences among six sequential cases and shared CI runner can create noise; an apparent small difference alone is not cause for a CSS patch. If no actionable owner remains, document **no-change** for PERF-02 rather than degrading sticky/fades/selection.

If a measurable new source-owned candidate is identified, use a **separate narrow PR** and a same-runner A/B measurement (same source generation, database, browser, order counterbalancing if possible). Keep 100-row horizontal scroll/sticky Name, sorted header, filters, pagination, cached SPA return, CLS and reflow functional regression green.

## Release boundaries

No Vercel deployment, production Supabase write or wallet session is involved. Only after green CI and review should this temporary workflow be removed; no routine always-on performance cost is added. The final issue-wide release still requires physical iPhone/Safari touch, slow network and populated/filtered tables.
