# LOAD-04B — Sticky toast lifecycle fix (#1034)

**Clean reconstruction:** 2026-10-05 on `main` `afe961d21b13cd1cb8bf908ae33aa1f77f0e2484`. Diagnostic PR #1116 and stacked implementation PR #1117 remain unmerged evidence; PR #1118 continues to depend on the historical #1117 branch and is intentionally untouched. No database refresh, wallet/account action, Supabase change or Vercel deploy.

## Reproduced failure

The isolated source-execution fixture showed that `showToast(..., { sticky: true })` correctly avoided the initial auto-hide timer, but the existing `mouseleave` handler always called `scheduleToastHide`, creating a new 2200 ms timer. A sticky opt-in toast therefore became non-sticky after pointer hover/leave.

## Targeted change

- store the current toast sticky state in `data-sticky`;
- on `mouseleave`, resume the 2200 ms timer only when `data-sticky !== "true"`;
- overwrite `data-sticky` on every subsequent `showToast`, so a normal toast after a sticky one returns to the ordinary hover/pause/resume lifecycle;
- keep duration, ARIA/live-region ownership, focus behavior and toast DOM identity unchanged.

The canonical owner is `modules/core-sources/shared-toast-core.js`; the checked-in generated projection is `modules/app-core-runtime.js`.

## Verification

`validation/load04-feedback-context-isolation.mjs` executes the real toast owner in a fake DOM. With `LOAD04_EXPECT_STICKY=1` it requires zero hide timers after sticky `mouseleave`, one 2200 ms timer for a subsequent ordinary toast, pause-on-hover/resume-on-leave, stable live regions and no duplicate toast nodes. Planner/Settings feedback remains baseline here and will be handled separately in LOAD-04C.

These are deterministic synthetic checks, not Safari/iPhone or live wallet/network tests. Real-device checks remain at the final issue gate.

## Decision

Integrate only the sticky lifecycle correction after exact-head CI. Do not import #1116 history, do not modify #1117/#1118, and do not merge without explicit maintainer approval.
## Generated artifact synchronization

Site Quality on user head `e120c00b952d92019ed06995309df3031be602c9` passed the application/browser gates and produced CI-owned commit `25ded4e0208ca49fa1eef774d632507ec2715aba`, changing only the derived `table-width-runtime.js` core build ID. The automatic pull-request events on that bot-authored head are `action_required`, so this documentation-only commit intentionally retriggers the complete exact-head workflow set on the synchronized generated state. No application behavior changes here.
