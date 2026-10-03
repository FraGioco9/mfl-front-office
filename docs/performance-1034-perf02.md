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

## Verified capture — 2026-10-02 (PERF-02A)

The [run #37049447418](https://github.com/FraGioco9/mfl-front-office/actions/runs/37049447418) **passed**: all 30/30 journeys and 90/90 cold/refresh/cached phases were collected; 100 visible DOM rows and 1,600 cells in every condition. The full raw JSON and local Next logs are in the [run artifact #11246007937](https://github.com/FraGioco9/mfl-front-office/actions/runs/37049447418/artifacts/11246007937) (GitHub Actions retention 90 days; SHA-256 artifact archive `aefd0da42b4b8ba3b9c27cad2a72c72d1504d8fd78d28d77507258914c9b7e86`). Validated database **11242500512**, 387,258 rows and 7,866 wallets, generated **2026-10-02T17:17:23.160Z**; source commit **`57d82a4c3b7c4d547d1ddab347c913cefd1ddc9b`**, Chrome **154.0.8037.57**, Node 22.23.3, Next 16.3.6, local production server, guest.

### Cached slow-mobile measurements

Medians over five sequential (not randomized) complete repetitions. The observed slowest cached settlement is included to expose variability. All 100-row conditions retained the same 1,600 DOM cells, but `display:none` intentionally made the table's layout box zero. Injection applies on the **parking route** ahead of cached return only; cold/refresh still exercise normal table CSS.

| Condition | Cached useful ms | Cached settled ms (median / slowest) | Long-task ms | LoAF render-phase ms | Cached CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| Normal 100-row control | 44.3 | 578.2 / 695.1 | 531 | 404.1 | 0.0411 |
| Hide table-body paint | 36.4 | 361.3 / 392.2 | 308 | 278.6 | 0.0411 |
| Remove table layout | 37.9 | 68.9 / 70.9 | 0 | 21.7 | 0 |
| Disable 'scroll-state' cell styling | 35.7 | 453.6 / 580.9 | 397 | 302.3 | 0.0411 |
| Disable sticky Name | 44.7 | 615.1 / 664.3 | 602 | 438.3 | 0.0411 |
| Keep parked layout | 43.0 | 574.2 / 705.4 | 538 | 403.8 | 0.0411 |

For the normal control, all five individual settled samples were **504, 635, 578, 695, 380 ms** (rounded). That spread is material: do not interpret differences against later sequential probes as a paired causal speedup, and do not compare their medians directly with PERF-01's **401.5 ms**, captured in a different run. No per-frame Chrome trace/filmstrip was captured; LoAF aggregate rendering does not isolate Paint from Layout.

### Evidence and decision

1. Layout/paint of the full 100-row mobile table remains an expensive renderer; removing the table from layout almost eliminates the cached long task, but **is not an acceptable optimization** because users lose the table. Hidden paint also reduces the cost, but hiding rows is likewise not a product behavior.
2. The **sticky Name** disabling probe was not faster. Preserve the tested sticky column, horizontal local scroll, edge fades, sorting, and selection.
3. The 'scroll-state' and 'keep parked layout' probes are **stale as implementation candidates**: the September improvements already removed per-row scroll-state query containers and made parked cached page descendants layout-visible. The old probe CSS may still perturb style recalculation and its apparent duration changes must not be attributed to removing a still-existing per-row container.
4. **No safe source-owned CSS fix can be established from this six-condition capture alone.** PERF-02A is a **completed diagnosis**, not a speedup PR. Defer a functional PERF-02B patch until a focused same-runner A/B on a *specific* accessible visible-table change (e.g. isolate sticky Name compositing/painting without altering behavior). Compare real visible output, cold/refresh, CLS, long tasks and performance samples; use a separate PR, never move diagnostic `display:none`/visibility into production.
5. **PERF-02C** remains open until final issue-wide release: real iPhone/Safari touch, cached return, selection/filter/sort/pagination, layout and visual CLS. No Vercel deployment in this phase.

**No product code, persistent CSS behavior or runtime data was changed by PERF-02A.** The temporary branch-scoped workflow was removed after this successful capture; the original manual opt-in performance baseline remains available.

## Decision gate

Inspect **cached** median/slowest settled duration, useful duration, long tasks, LoAF rendering/style+layout, CLS, table size and rendered row/cell count; compare cold/refresh for counter-effects. Workload differences among six sequential cases and shared CI runner can create noise; an apparent small difference alone is not cause for a CSS patch. If no actionable owner remains, document **no-change** for PERF-02 rather than degrading sticky/fades/selection.

If a measurable new source-owned candidate is identified, use a **separate narrow PR** and a same-runner A/B measurement (same source generation, database, browser, order counterbalancing if possible). Keep 100-row horizontal scroll/sticky Name, sorted header, filters, pagination, cached SPA return, CLS and reflow functional regression green.

## Release boundaries

No Vercel deployment, production Supabase write or wallet session is involved. Only after green CI and review should this temporary workflow be removed; no routine always-on performance cost is added. The final issue-wide release still requires physical iPhone/Safari touch, slow network and populated/filtered tables.
