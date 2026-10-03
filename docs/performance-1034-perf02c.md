# PERF-02C — final automated regression evidence and manual release hold

Issue: [#1034](https://github.com/FraGioco9/mfl-front-office/issues/1034). Source after PERF-02B: `22351e4ad8402e7b78a06666ac01ced71ab386cd`.

## Scope and release decision

**Automated testing can validate the browser contract on Chromium, but cannot replace real iPhone/Safari verification or prove production Web Vitals.** No production deployment, no live Supabase database writes, and no interim Vercel preview/production deployment are authorized in this phase. Do not check the PERF-02 parent or the PERF-02C real-device item until the single issue-wide release.

PERF-02B changed only three same-color mobile sticky-Name background-image layers. Keep the existing opaque light/dark background, hover, initial loading behavior, sticky positioning, body-only separator, fade stacking, sorting, selection and local horizontal scroll.

## Automated test matrix

| Responsibility | Automated regression | Acceptance |
| --- | --- | --- |
| 100 rows on narrow mobile | `validation/browser-resp02-long-mobile-table.mjs` (existing, Mobile first-paint CI) | 100 rendered rows and realistic height, scroller overflow |
| Sticky Name and edge fades | `validation/browser-resp02-long-mobile-table.mjs` | Start/middle/end scroll; left/right fade classes, Name pinned within 1px and shared stuck-state |
| Sort and tap hit target | `validation/browser-resp02-long-mobile-table.mjs` | Overall sort updates `aria-sort`, browser path unchanged, header hit-testable |
| Light/dark opaque Name styles | **`validation/browser-perf02c-sticky-theme-regression.mjs` (new)** | Computed solid RGB background, no redundant gradient image, sticky/inset/z-index/clip/isolation, distinct theme surfaces |
| Light/dark scroll & hover | **`validation/browser-perf02c-sticky-theme-regression.mjs` (new)** | 2 themes × 3 positions, edge fade and separator, hover background remains opaque and changes from default; original theme and scroll position restored |
| Responsive crossing | `validation/browser-mobile-table-responsive-resize.mjs` and `validation/browser-responsive-shell-breakpoint.mjs` | Reuse same row across breakpoints; full/compact Name, Age marker, column layout |
| First paint/loading | `validation/browser-mobile-first-paint-regression.mjs` and `validate-mobile-sticky-name-column.mjs` | Header, Name loading-cell CSS, no flash of wrong table labels |
| WCAG + theme contrast | `validation/browser-a11y03-contrast-regression.mjs`, A11Y-01–06 | Light/dark contrast and keyboard/labels/announcements; no new serious/critical errors |
| Cached return, 100 rows | [A/B run #37113860600](https://github.com/FraGioco9/mfl-front-office/actions/runs/37113860600) (PERF-02B; same candidate CSS merged without changes) | 5/5 candidate cached-return pairs improved; paired settled median Δ −38.9ms, long tasks Δ −43ms; cached CLS 0.0411 both. **Historical same-runner evidence, not a new October production measurement** |
| Complete app smoke | `Site quality`, Windows native Next smoke, Table Header, Mobile first-paint CI | Green on exact PR head before squash merge |

The new script only adds **test code** and is called by the existing Mobile first-paint CI job, avoiding additional permanent CI runners.

## Manual iPhone/Safari checklist — pending until coordinated release

- [ ] Physical iPhone Safari portrait, 360/390/430-width equivalents: enter Database Attributes with 100 rows; horizontal finger swipe left/right and reverse; Name remains visible and does not clip/overlap other columns.
- [ ] At scroll start/middle/end confirm fade directions, 1px sticky separator and row divider alignment; tap or click visible Overall/Name header sort and verify sorting and focus do not navigate away.
- [ ] Toggle light/dark; at rest and while hovering where possible, ensure Name cells are fully opaque, text legible, and hover/loading/skeleton colors match other cells; inspect in-progress data load.
- [ ] Repeat Watchlist and alternate Attributes/Stats views, filters, search, 25/100/250 Rows, pagination and selected players; verify row selections and actions remain hit-testable while horizontally scrolled.
- [ ] Visit a Player, return using in-app navigation to the 100-row Database, then reload/revisit: no blank/overlapping parked table, wrong theme, long animation, or newly introduced layout shift. Verify both warm and cold visits.
- [ ] iPhone Safari VoiceOver, keyboard where available, reduced-motion, landscape/orientation and narrow pinch/text-zoom cases: functional tab/focus order, labels, no hidden controls.
- [ ] Only at **final issue-wide coordinated release** collect live Vercel production/Safari performance, CLS and interactions; compare same users/fixture/window and record release confirmation before checking PERF-02C parent.

## Test evidence / CI

The existing workflow `.github/workflows/mobile-first-paint-regression.yml` runs the new theme/scroll probe immediately after the 100-row RESP-02 case; the browser fixture remains local and synthetic. All test results must be linked to the final PR head. If an assertion fails, investigate instead of weakening the sticky Name/opaque/fade contract.

No Vercel deploy, preview deployment, or production Supabase data writes for PERF-02C.
