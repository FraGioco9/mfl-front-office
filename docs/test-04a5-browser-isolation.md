# TEST-04A5 — isolate the responsive browser fixture from its own navigation regression

## Identified interference path

The responsive test dynamically copies the canonical `validation/browser-routing-regression.mjs` browser fixture and replaces the Chrome runner's normal wait with 15 sequential CDP viewport measurements. But before TEST-04A5 the fixture **also** independently started `runRepresentativeRoute()` in the same browser tab as soon as `mflRouteReady` became true.

For `scenario === "database"` at desktop width, that full routing regression eventually calls `runNav02HistoryMatrix(setPage)`: it invokes `setPage("privacy", true)`, goes Back/Forward and returns to Database. During Privacy, the app intentionally hides `#progressionPage`, but leaves its player row attached to the DOM. Therefore another test sampling that row concurrently can read correct viewport and computed media-query CSS while `getBoundingClientRect()` returns zero for both the Age and Listing icons.

This matches the prior four captured 1366/1367px failure signatures (Age/Listing boxes 0px; pseudo-icon computed width 12px; original row still attached). **The independent concurrent navigation is verified in source code.** The exact historical millisecond at which each failed measurement overlapped a Privacy route was not logged, so the historical trigger remains an evidence-supported explanation rather than a retroactively proven event.

## Targeted correction

Only in the generated temporary responsive fixture, replace the borrowed browser runner's `else await runRepresentativeRoute();` call with `else if (scenario !== "database") await runRepresentativeRoute();`. The canonical standalone browser routing regression stays entirely unchanged and still covers NAV-02 with its own workflow. The responsive test now exclusively owns the Database tab while it changes viewport dimensions.

Additionally:
- Before the live sweep, a deterministic *controlled hidden-ancestor probe* sets `#progressionPage.hidden = true` and immediately restores it, asserting both icons lose their layout boxes even while their computed pseudo-icon CSS remains nonzero. This is **not** a claim that the historical route was observed entering Privacy.
- Assert every responsive sample reports body page `database`, a visible `#progressionPage`, and the original, attached row.
- Run **two entire 15-width sweep sequences** (30 captures), including 1367⇄1366 and desktop⇄mobile transitions; retain all existing assertions for Age marker, Listing, widths, NULL-safe names, columns, cell bounds and touch/media modes.
- Keep TEST-04 diagnostics introduced by PR #1099: if an icon box becomes zero during a sweep, record both captures and fail on the first.

## Scope, tests, and rollout

Only the browser validator and this report change; no app runtime, CSS, schema, API, permissions or live data change. Browser routing checks remain independently required in Site Quality. Full exact-head CI must be green and the deterministic hidden-ancestor control must pass before review.

**Rollback:** revert this validator-only PR; no database or deploy operations needed.

**Gate:** test fixture overlap has a dedicated correction but parent TEST-04 stays open for other intermittent failures/CI timing triage and release checks. No merge, database refresh, Supabase change or Vercel deploy for this PR.
