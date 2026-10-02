# UI-02 — Overlay, dropdown, scrollbar and clipping audit (#1034)

Scope: stacking/pointer behavior, menu anchoring, header/body scroll separation and scroll-lock. Reviewed canonical sources only; no claim of real authenticated Safari/touch proof until final issue-wide release.

## Component ownership matrix

| Component | Layer/anchor/scroll ownership | Review and action |
| --- | --- | --- |
| Ordinary table sticky headers/Player first column | Local z-index below 300, `styles-base.css` + table CSS | Preserve. Never raise above global overlays. |
| Account menu | Absolute at its trigger, `--mfl-z-dropdown` 400; `dropdowns.css` | Preserve focus/Escape and 8px gap. Review viewport edge in final smoke. |
| Watchlist switcher | Absolute, max-width from viewport, scroll-y auto; `dropdowns.css` | Preserve active/edit actions, mobile widths and clipping. |
| Table row action menu | Fixed at 400 and dynamically placed; `dropdowns.css` + table runtime | Preserve overflow and touch handling; test edge rows in final smoke. |
| Filter builder and native enhanced select | Body modal at 900, browser picker may use top layer; `dropdowns.css` | Preserve scrollable filter builder, clear/Apply actions and Escape ownership. |
| Evaluation recent-search dropdown | Local z=1 inside isolated route; `stacking.css` | Preserve; it must layer over its own table but below global chrome and modal. |
| Planner pitch position picker | Fixed inside route, menu content scrolls independently, pointer sits outside the scrollport; `planner.css`, `html-sources/planner.html` | Preserve arrow, auto flip near viewport edge, capture-scroll dismiss, Escape/focus and touch. |
| Planner Add players | Existing body-level modal, sticky header visually separate from body-only scroll, `planner.css` | Preserve body-only `tbody` overflow and horizontal header sync. |
| **Planner Saved Plans, Save/Rename, Delete, Revoke** | **Previously nested under `.plannerPage`/isolated `#appShell`** while `.modalBackdrop` scroll lock only matches direct body children; their z-index couldn't escape the page content stack | **Fix UI-02B:** move hidden dialog elements to `document.body` once on route initialization, matching Add players. Existing z-index 900/901, backdrop, overlay, focus traps, no extra CSS override. |
| Shared modal scrollbar | Page `main` scrollport hidden while any visible body-level modal exists, gutter preserved; `scrollbars.css` | After Planner portal, existing scroll lock works and restores on close. Preserve 8px WebKit thumb, 5px compact, no arrows, transparent track. |
| Planner popup search/selection tables | Scroll on table `tbody` only, header `thead` overflow hidden with matching gutter; `planner.css` | Preserve; no scrollbar drawn over header. |
| Global toast | Body-level 1100 above all modal/tooltip layers; `stacking.css`, `loading.css` | Preserve. |

## Tests

- `validate-ui02-overlay-scroll.mjs` verifies Planner modal portals, top-level scrollbar lock, distinct critical modal z-order, generated first-paint markup and focus contract without reauthoring CSS.
- UX-03 Chromium desktop/phone matrix checks all 4 Planner overlays are direct body children, backdrop outranks topbar, underlying `main` scrolls only before/after overlays, nested dialog remains above its parent and Cancel/Escape/failed mutation preserve lock. Existing Planner and routing browser suites remain mandatory.
- Site Quality generated assets parity, lint/typecheck/Next build; Mobile, Windows and Table Header CI.
- **Pending final manual gate:** on desktop Chromium/Firefox and Safari iPhone, scroll wheel/touch behind Save/Rename/Delete/Revoke, open list + nested confirm, 200% zoom, narrow 390px/320px edge clipping, lengthy lists and horizontal tables. Check backdrop click/Escape and real wallet state. CI fixture does not prove physical-device behavior.

No new CSS component, dependency, database change or intermediate Vercel deployment. This PR changes modal DOM ownership only, not API behaviors or modal layout.