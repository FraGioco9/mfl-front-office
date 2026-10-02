# RESP-02 — Long mobile Table and sticky-column audit

Issue: #1034  
Scope: Database Table on a 390×844 touch viewport, with the existing maximum-width Attributes view and a deterministic 100-row rendered body.

## Contract under test

- Table horizontal overflow stays inside `.playerTableScroller`; the page itself is not made horizontally scrollable.
- The right edge fade is visible at the leading edge, both fades are visible mid-scroll, and only the left fade remains at the trailing edge.
- The existing Name column becomes sticky only after its natural edge crosses the scroller boundary and remains pinned to that boundary.
- A long body (100 rendered rows) does not change the horizontal-scroll/sticky ownership model.
- A sortable header remains hit-testable after horizontal scrolling; activating Overall changes `aria-sort` without accidental row/page navigation.
- The test deliberately does not add global overflow hiding or duplicate sticky-width ownership.

## Automated coverage

`validation/browser-resp02-long-mobile-table.mjs` reuses the production browser-routing harness and real Chromium. It starts the Database route at 390×844, expands the already-rendered fixture row to exactly 100 rows inside the browser, exercises start/middle/end horizontal scroll, checks the shared edge-state classes and sticky Name geometry, then activates the real Overall sort button.

This is a layout/interaction baseline, not a replacement for final real-device touch testing. In particular, momentum scrolling, Safari overscroll, physical finger accuracy, browser UI chrome, OS text scaling and very long real-world names still belong to RESP-02C/final #1034 release.

## Current finding

No CSS correction is justified before this matrix runs in CI. Existing sticky Name and edge-fade foundations are intentionally preserved. If CI exposes a measurable defect, fix only the responsible source-owned rule and add the failing geometry to this test rather than masking overflow globally.
