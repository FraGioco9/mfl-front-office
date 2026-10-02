# RESP-03 — Player and Planner orientation transition audit (#1034)

## Scope
Use a real Chromium fixture, with the application fully loaded **before** changing CSS viewport dimensions from 390×844 portrait → 844×390 landscape → 390×844 portrait. This probes a *live resize*, not just two separate page loads. The fixture is synthetic: it does not emulate an actual iPhone notch, browser bars, virtual keyboard, real finger events, Safari WebKit, hardware orientation events or an authenticated wallet.

## Existing ownership and expected behavior
- The Player hero and pitch are controlled by existing Player/responsive layout CSS. A live rotation must not introduce root horizontal overflow, hide the pitch or move the hero outside the CSS viewport.
- The selected Planner club, roster, 4-4-2 pitch and goalkeeper caption must survive all three dimensions.
- The Planner position picker is fixed to a pitch token. Its canonical owner in `html-sources/planner.html` already closes it on `window.resize` rather than retaining a stale floating-menu anchor. The test deliberately opens the picker before rotation, verifies the stale pointer and aria-expanded state disappear, then reopens it in landscape and checks the menu is within the viewport. Escape should close it.
- The Add player(s) modal should remain bounded and available in landscape and after returning to portrait, with its own scrollable content. No global overflow mask or unconditional width change is justified without a failure.

## Automated test
Run `node validation/browser-resp03-orientation-regression.mjs` after `npm run build`. It reuses the existing Chromium routing fixture and CDP pre-navigation narrow viewport. For each route, the test checks actual CSS/document widths and height, root horizontal overflow, Player/Planner pitch bounds, and retained route state. For Planner, it also checks the goalkeeper label, picker close/reopen/arrow/aria state, and Add player(s) modal boundaries. Its outcome is gated in the Mobile first-paint workflow.

## Deferred manual release checks
At the **single** final release of issue #1034: rotate a real iPhone Safari device while the position menu is open and while the Add player(s) dialog is open; exercise touch scrolling, selecting a starter, closing with Escape/accessible action, on-screen keyboard, long names, GK caption, safe-area/notch in both orientations, home/footer bars and page scroll restoration. Repeat with accessibility text enlargement/VoiceOver and with a saved private Planner session. Record visual artifacts and only make source-owned CSS/runtime changes if there is a reproducible failure.

No Vercel deployment, database migration or real wallet data access in this test PR.
