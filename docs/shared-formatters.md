# ARCH-05 — shared formatter audit

**Result: NO CHANGE runtime.**

The audit found that the formatters which genuinely express the same application contract are already owned by the universal Shared core. Moving more functions only because their names look similar would increase coupling rather than reduce it.

## Existing Shared owners

`shared-data-search.js` owns the cross-route formatting contracts for:

- count formatting used by the canonical core;
- Settings date/time normalization and labels;
- Joined Agency timestamps;
- division names/colors;
- contract percentage/revenue-share formatting;
- contract club/division display.

`shared-player-display.js` owns cross-route Player display/calculation helpers such as positions and decimal rendering. Player and Table consumers reuse these Shared functions rather than redefining them in their route chunks.

## Database Stats exception

`database-stats-runtime.js` has a small local `formatCount` because that runtime can be loaded in the route **pre-core** phase. Its contract also intentionally coerces blank/invalid count input through `Number(value || 0)`. Making it depend on the later Shared core solely to eliminate a three-line helper would invert the current load boundary.

This exception is therefore retained deliberately.

## Planner exception

`plannerPlanUpdatedLabel` is not the same contract as Settings/Joined Agency date formatting. It formats saved-plan metadata using the browser locale and `dateStyle: "medium", timeStyle: "short"`; it does not obey the user's table date-format preference.

It remains Planner-owned.

## Do not unify by name alone

A formatter should move to Shared only when all consumers have the same input semantics, locale/time-zone contract, null behavior and load lifecycle. ARCH-05 adds a validator preventing route-domain redefinitions of the established Shared formatter owners while keeping the two reviewed exceptions explicit.
