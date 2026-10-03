# TEST-04A — responsive Age/Listing zero-geometry investigation

**Scope:** diagnostics-only CI test change. No application/runtime/CSS change, no assertion suppression or retry-to-pass behavior, no production databases or Vercel deployment.

## Repro evidence (3 October 2026)

The recurring `responsive-table-resize` test has failed intermittently at the 1366/1367px boundary in Mobile GitHub Actions, later passing isolated reruns with no UI change.

- [Mobile job failure, first attempt, run #37131829461](https://github.com/FraGioco9/mfl-front-office/actions/runs/37131829461/attempts/1) at 1366px:
  - `window.innerWidth/clientWidth/visualViewportWidth=1366`
  - same original player row, name already compact `N. Barella`, compact media query matches, listing price hidden
  - retirement marker DOM present, but `ageMarkerPresent=false`, bounding width and height both 0
  - the marker pseudo graphic width remains 12px and mask-size remains `contain`
  - listing icon bounding width also 0; age gap remains 5.62884px.
- [Exact job retry, run #37131829461 attempt 2](https://github.com/FraGioco9/mfl-front-office/actions/runs/37131829461/attempts/2) passed on the same head.
- Prior independent intermittent failures are recorded in issue #1034 (runs #37113207104, #37115389553, #37117867139).

This is **not evidence of a root cause**. Both missing icon boxes at a single sampled instant are compatible with delayed layout or a transient hidden ancestor, but may instead indicate an actual temporary rendering defect. Do not weaken the visual contract without an isolated root-cause experiment.

## Changes made

In `validation/browser-mobile-table-responsive-resize.mjs`:

1. Record row/scroller/Age-host box widths, computed CSS visibility/display/width of both icon elements, and attachment of the marker to the DOM in the normal diagnostic snapshot.
2. If the **first** snapshot has no visible Age marker or has a zero-width Listing icon, capture a **second** reading at the same viewport and emit both as structured error diagnostics.
3. Preserve the original first reading in `stages` and keep all existing width, icon, responsive breakpoint, layout and name assertions unchanged. The second measurement **cannot** turn a failure into a pass.

## Verification and next gate

- Confirm generated temporary browser fixture parses and runs in Mobile `responsive-table-resize` CI; all other mobile jobs unchanged.
- A green run validates instrumentation compatibility, **not** a root-cause fix or elimination of this intermittent flake.
- If a future CI run fails again, compare both snapshots (row/scroller/icon computed display and width) and distinguish delayed painting from a persistent CSS/layout issue; then implement a separately tested fix only if supported by evidence.
- Keep parent TEST-04 open pending reproduced diagnosis, durable fix, and CI stability evidence.
