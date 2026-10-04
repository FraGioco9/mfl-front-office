# LOAD-01A — Skeleton footprint audit and measurable follow-up (#1034)

Date: 2026-10-04. Baseline: `main` `3f5204515c4e5d51ac278f6bbee13bb5527290b4` (post-PERF-06A).
Scope: **read-only code and existing test-contract audit**. No screenshot A/B or real-device measurement is claimed here. Do not mark the parent LOAD-01 as completed.

## Existing contracts and evidence

- `LOADING_CONTRACT.md` requires representative invisible text in the **same loaded element/class geometry**, shared `.mflDataPlaceholder` masking, the canonical table colgroup/rows, immediately committed destinations, and preserved settled content during background work. It expressly forbids arbitrary delays, `!important`, and runtime style repair.
- `loading.css` owns placeholder appearance (`.mflDataPlaceholder`, `.mflSkeletonText`), while component styles own geometry. `validate-loading-ownership.mjs` and `validate-data-shaped-loading-foundation.mjs` assert portions of this static contract.
- Existing browser fixture `validation/browser-routing-regression.mjs` checks selected Planner parser paint (64 roster placeholders / 8 rows × 8 cells), My Clubs loading card presentation, first-paint route readiness, populated rows, routing, and modal actions. `validation/browser-mobile-first-paint-regression.mjs` checks selected responsive first-paint states. **These checks do not establish pixel/box equality between pending and settled Planner columns**.

## Candidate discrepancies — not yet established layout regressions

1. **Planner selected-club Squad table — P2 candidate.** Both `html-sources/planner.html` (parser paint) and `modules/core-sources/planner.js` (network pending) create **eight rows of eight indistinguishable `<span class="plannerRosterSkeleton">` cells**. `planner.css` fixes those placeholders to `width:75%;height:10px;margin:5px auto`, with a special third-column left margin. The loaded table instead has eight semantically different columns: Slot, Nationality, Player, Position, Age, Overall, Contract, Remove, sized by the existing `<colgroup>`. This is a **candidate** for inconsistent inner-cell visual width/vertical footprint, particularly Slot/Flag/Contract/Remove and mobile. The table shell and colgroup *are* shared, so do **not** infer a row-height shift from code inspection alone.
2. **Saved Plans modal — P2 candidate.** `modules/core-sources/planner.js` opens the real `plannerPlansModal` shell, writes “Loading saved plans…” into `plannerPlansStatus`, and empties `plannerPlansList` pending two authenticated requests. The settled list consists of plan rows; status-only pending state can change modal body size, but this is not necessarily a defect: an unknown/empty list cannot truthfully preallocate an arbitrary number of rows. Measure dialog shell and focus/scroll stability before deciding.
3. **Planner club search — P3 investigation.** An owned-clubs request renders a `.searchHint` status in its existing results host. Treat this as unknown-length search, **not** a full-table skeleton requirement. Confirm no unexpected panel jump and that stale requests cannot replace current results.
4. **Control routes — existing foundation, no candidate patch.** Home/Player/Evaluation, canonical tables, My Clubs cards, and static/SPA first paint have explicit shared-geometry validators and Chromium regression coverage. Keep their current ownership; test before touching.

## LOAD-01B — Isolated Chromium visual/geometry gate (proposed next PR)

Reuse the existing fake routes and data fixtures, *not* an authenticated wallet or live Supabase. Capture a true unresolved loading state with a deterministic held response, then release that response and compare the same route/state. No script-inserted final DOM or forged resolution.

| Surface | Loading → loaded pair | Stable comparison target |
| --- | --- | --- |
| Planner selected club | Parser-first paint / roster GET held → 8+ fetched rows | table rect, colgroup widths, `tr` and `td` heights, status strip, Squad/Depth column alignment |
| Planner Saved Plans | dialog open, two requests held → populated / empty / 503 | dialog/header/footer positions, body scroll, focus owner, non-modal background, list footprint |
| Planner search | owned-clubs pending → results/empty/error | search field, results host, title, top-of-panel position |
| Database & Watchlist | pending table → rows / filtered empty | header/colgroup width, sticky Name, row geometry, pager and scrollbar |
| My Clubs / Player / Club / Evaluation | data pending → settled | top-level card/hero/result wrappers, start/end anchors, text representative classes |

- Run desktop **1280×900**, iPhone-like Chromium **390×844**, intermediate **768×1024**, light/dark and at least two repetitions. Include refresh and SPA return; reduce motion for deterministic captures. These viewports are simulated Chromium, **not Safari/iPhone proof**.
- Record per-state rects/row height/viewport overflow plus screenshots; compare wrapper deltas for regions expected to remain stable; avoid comparing invisible placeholder pixels to final text/icons as if the colors should match.
- Track layout shifts with `PerformanceObserver` during the held→released transition, explicitly excluding user-input-related shifts. Record confounders (fonts, DPR, image decode, network) and the measured tolerance *before* accepting a fix.
- If a real discrepancy is found, make a **separate small source-owned product PR**. Reuse existing loaded cell classes/flag host/slot badge rather than introducing parallel geometry, regenerate owned bundles, run same-runner A/B and all existing CI gates. No cosmetic changes solely on intuition.
- Keep **real Safari/iPhone, wallet-auth modal behavior and post-deploy UX** in the final issue gate; do not mark them validated by Chromium.

## Decision and release constraints

**LOAD-01A: code/coverage inventory complete, diagnosis only.** Existing skeleton foundation is deliberately preserved. LOAD-01B measurable browser proof, LOAD-01C evidence-backed correction or NO CHANGE, and LOAD-01D final Safari/iPhone/release verification remain pending. Maintain PERF-06.5, PERF-06 and TEST-04B6.6 pending. **No merge, no database refresh/live changes, no Vercel deploy.**
