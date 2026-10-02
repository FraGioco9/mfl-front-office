# NAV-02 — Back/Forward, cached routes and scroll restoration (#1034)

## Verified gap

Earlier browser routing checks returned by calling setPage again, not native history.back/history.forward. Shared and Club-specific popstate listeners both started a Club navigation. The app scrolls the main element, not the browser viewport, and page changes reset the main scrollTop, so browser history could not restore independently.

## NAV-02A/B implementation

- Loaded Club-specific popstate handles Club URLs exclusively; the shared router only handles Club if that feature core has not loaded. A single browser history event no longer creates two competing Club route transitions.
- The static UI captures body > #appShell > main scrollTop to history.state, tagged by full pathname plus query, without erasing Next or wallet state. Scroll writes are capped to animation frames and flushed on normal page/view commits.
- On popstate, the target entry is captured before chrome resets it. After asynchronous shared or Club route rendering, two animation frames restore its clamped scroll value. A monotonically incremented token and URL signature prevent obsolete asynchronous navigation from restoring into a newer entry. Entries without saved state restore to top.
- Cached incremental route rendering honors preserveScroll, while ordinary cross-page navigation resets to top and same-page views retain vertical scroll. Canonical route replaceState and failed-view URL restoration preserve existing history.state.
- Player horizontal view scrolling, table horizontal scrolling, focus ownership and Planner modal scroll locks remain independently owned.

## Automated regression

- validate-nav02-history-scroll.mjs is in validate-all.mjs and checks the single-owner and scroll/history contracts.
- Real Chromium browser matrix: Database 320px scroll -> Privacy -> native Back -> native Forward -> native Back. Verify restored Database scroll and URL/history state and Privacy top-of-page.
- My Clubs existing browser route test now uses native Back and Forward into the previously visited Club B with stable identity.
- CI covers canonical build, route/view lifecycle, cached rendering, loading, Planner, responsive and Windows smoke.

## NAV-02C pending

Final manual checks: Database -> Player -> Club -> Back, Evaluation edit and Planner saved/share with real wallet; same-view URL query/filters, rapid repeated Back/Forward, aborted fetches, browser background frame throttling, Safari iPhone swipe navigation and VoiceOver, 200% zoom and keyboard focus, nested-dialog scroll locking. Execute against the single final Vercel deployment of #1034; do not treat Chromium CI as a real-device pass.
