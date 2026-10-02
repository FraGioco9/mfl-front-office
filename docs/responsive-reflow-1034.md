# RESP-01 — Zoom-equivalent CSS reflow and text scaling audit (#1034)

## Scope and measurement

Source audit (2026-10-02): `responsive-sources/*` owns the responsive
layout and `build-responsive.mjs` produces the tracked `responsive.css`.
Shared chrome/layout CSS is consumed by the generated site stylesheet; Planner
and Player have specialist layouts and their own responsive contracts. Avoid
editing generated CSS and broad `overflow-x: hidden` masks to conceal content.

A desktop layout at 1280 CSS px corresponds *approximately* to a **640 CSS-px
layout at 200% zoom** and **320 CSS-px at 400% zoom**, assuming the browser
reduces the CSS layout viewport. A narrow CSS viewport is **not** proof of
actual browser zoom behavior, font enlargement, or operating-system
text-only scaling. Browser zoom also affects pixel density, font rasterization,
available vertical space and browser UI. The viewport meta tag intentionally
does not disable user zoom.

## Component audit

| Surface | Canonical owners | Existing adaptations | Regression questions |
| --- | --- | --- | --- |
| Topbar, search, theme, account, section rail | `responsive-sources/chrome-tablet.css.inc`, `chrome-compact-shell.css.inc`, `compact.css.inc` | compact shell at <=1366px, phone nav at <=900px, smaller title at <=380px | 320/360px: do all visible controls remain in bounds and operable? 900/901px: is the transition stable? |
| Database tables and sticky name | `responsive-sources/tables-phone.css.inc`, `mobile-table-content.css.inc`, Table runtime | table-specific horizontal scroll, sticky headers/name; body root stays non-scrolling horizontally | Page and chrome must not overflow horizontally. Table can scroll inside its designated scrollport. |
| Player detail/hero/pitch | `responsive-sources/player-tablet.css.inc`, shared Player CSS | grid stacks below 1366px, phone geometry scale | At 320px, hero, action menu, pitch and panels remain within main scrollport. |
| Planner Squad/Depth/modals | `planner.css`, responsive styles | pitch geometry, body modal portals/scroll lock | 320px Planner shell and actions must remain in bounds; modal contents should scroll independently. |
| Global search, filters and saved-list dialogs | `dropdowns.css`, `responsive-sources/static-phone.css.inc`, component CSS | viewport-limited dialogs and internal scroll areas | Browser/text scaling, long labels, focus ring, accessible close, no controls beyond viewport. |

## New automated baseline (RESP-01A)

- `node validation/browser-resp01-reflow-regression.mjs` runs the actual
  Chromium application fixture at **320, 360, 520, 640, 900, 901 CSS px**,
  plus 900×360 landscape, Player 320, and Planner 320.
- The browser starts at `about:blank`; CDP `Emulation.setDeviceMetricsOverride`
  is applied **before navigation**. Test assertions require that both
  `innerWidth` and document `clientWidth` equal the selected CSS width,
  preventing false passes from Chrome's minimum headless window width.
- Reuses existing page/chrome geometry, root horizontal-overflow,
  in-route navigation, table sticky-column, runtime-error and basic
  accessibility assertions from `browser-routing-regression.mjs`.
- Site Quality enforces the matrix and `validate-resp01-reflow.mjs` checks
  coverage/CI ownership. No database, wallet or production mutations.

## Outstanding (do not mark complete from a viewport-only emulation)

- **RESP-01B:** only after failure evidence, make narrow, source-owned CSS
  fixes to any clipped controls, dialog scrollports or non-table overflow.
  Keep the existing table horizontal-scroll contract.
- **RESP-01C / final issue-wide deploy:** real browser zoom at 200% and 400%
  on Windows Chromium/Firefox (including vertical viewport changes);
  **text-only scaling** at 200%, browser default font-size preference,
  OS enlarged fonts, zoom keyboard/focus and high-contrast modes; Safari
  iPhone portrait/landscape, 320px device and 200% accessibility text size.
  Cover title/header, filtered tables, Planner Save/Share/Revoke dialogs,
  search/filter builders, Player pitch and footer with long/translated names.
  Inspect screen reader announcements and horizontal scrolling. Record
  screenshots and observed failures; the synthetic CI cannot establish this.

No intermediate Vercel deployment or Supabase production change.
