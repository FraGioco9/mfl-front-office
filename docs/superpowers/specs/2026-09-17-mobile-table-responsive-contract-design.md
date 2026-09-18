# Mobile Table Responsive Contract Design

## Context

PR #1017 currently mixes two different responsive models for player tables:

- shared responsive CSS/runtime changes table geometry at 900px, 700px, 520px, and 380px;
- the canonical row renderer also branches on `matchMedia()` while rows are created.

That means row content can become stale after a live resize. A table rendered above 900px can keep desktop name and Listing markup after crossing into mobile; a table rendered below 900px can keep compact markup after widening again. The same pattern exists for Joined Agency at 520px.

The mobile table should have one responsive contract that applies consistently to all player-table pages and survives breakpoint crossings without requiring a data rerender.

## Goals

1. Listing always enters mobile icon-only presentation at <=900px, including after resizing an already-rendered desktop table.
2. Player names display as `N. Surname` at <=900px and restore the full name above 900px without rerendering rows.
3. The spacing between Age and its retirement/new-mint marker becomes tighter as screens narrow.
4. Joined Agency keeps its existing phone compact presentation at <=520px, but becomes resize-safe.
5. Database, MFL, Progression, Watchlist, Agents, My Players, Club and any other table using the canonical player-table renderer inherit the same responsive behavior.
6. Existing desktop behavior and the current mobile table geometry remain unchanged unless explicitly described here.

## Non-goals

- Redesigning table column widths beyond the existing responsive contracts.
- Changing desktop Listing badge appearance.
- Changing the actual full player name stored or used for accessibility/navigation.
- Introducing page-specific mobile table implementations.

## Design

### 1. Breakpoint-neutral row DOM

The canonical table renderer must stop removing or replacing responsive content based on viewport width.

#### Player name

Always render both forms inside the existing player-name link:

- full name, e.g. `Nicolò Barella`;
- compact name, e.g. `N. Barella`.

Only one is visually exposed at a time through responsive CSS. The link keeps the full name as its accessible label.

This avoids rewriting link text when crossing 900px and keeps route/link behavior identical.

#### Listing

Always render the canonical Listing badge with icon and price text. Never remove `.listingCellPrice` from the DOM for mobile.

Responsive CSS owns icon-only mobile presentation by hiding `.listingCellPrice` at <=900px and scaling the existing badge/icon at <=520px and <=380px. The full price remains available via the badge accessibility/tooltip data.

Desktop content-aware compaction from #1017 may still add the shared compact class when a five-digit Listing would overflow. Mobile no longer depends on a renderer-specific compact markup branch.

#### Joined Agency

Always render both the full value and the compact date-only value. Responsive CSS switches to the compact value only at <=520px. This removes another render-time viewport branch.

### 2. Responsive styling ownership

`shared-table-ui-runtime.js` remains the canonical responsive table presentation owner.

At <=900px:

- compact player-name span is shown;
- full player-name span is hidden;
- Listing price is hidden and Listing badge/icon uses the existing mobile geometry;
- Age/marker gap keeps the current tablet value unless a narrower breakpoint overrides it.

At <=700px:

- Age/marker gap becomes `2px`.

At <=520px:

- existing phone row/icon geometry remains;
- Joined Agency switches to the compact date-only value;
- Age/marker gap remains `2px` unless the tiny breakpoint overrides it.

At <=380px:

- Age/marker gap becomes `1px`;
- existing tiny Listing/marker geometry remains.

Above 900px all responsive visibility rules reverse immediately without rebuilding rows.

### 3. Desktop Listing overflow behavior

The existing #1017 content-aware Listing overflow behavior remains valid above 900px:

- if any visible five-digit Listing would clip, all visible Listing prices hide together;
- when enough width returns, all prices reappear together.

At <=900px, mobile presentation wins and keeps Listing icon-only regardless of desktop overflow measurement.

The implementation should continue to have one production owner for the desktop overflow class and must not reintroduce a standalone Listing runtime.

### 4. Render reuse and breakpoint independence

Table render signatures should no longer include viewport-dependent booleans solely used to decide responsive row markup.

Removing those inputs prevents breakpoint changes from being treated as a reason to rebuild rows and makes the responsive model explicit: data/state changes render rows; CSS/runtime presentation changes how those rows look.

Any viewport-dependent renderer branch that remains must be justified as structural rather than presentational.

## Regression coverage

Add one browser regression that uses one rendered Database table and resizes the same DOM through:

1. desktop (>900px),
2. 900px mobile,
3. 700px,
4. 520px phone,
5. 380px tiny,
6. back to desktop.

Without reloading or forcing a table rerender, assert:

- desktop name is full;
- <=900px name is `N. Surname`;
- widening restores the full name;
- Listing price is visible on desktop when it fits;
- Listing is icon-only at every <=900px stage;
- widening restores Listing price text;
- Age/marker gap is the tablet value above 700px, `2px` at <=700/520px, and `1px` at <=380px;
- Joined Agency is full above 520px and compact at <=520px, then restores when widened;
- the same row nodes remain connected across all breakpoint changes to prove the behavior does not depend on rerendering.

Existing focused regressions for 1374px headers, first paint, Listing overflow, generated shell, repository validation, lint/typecheck, and browser routing must remain green.

## Files expected to change

- `modules/core-sources/table-render-lifecycle.js` — remove presentation-only viewport branching and emit breakpoint-neutral responsive content.
- generated table runtime/artifacts through the normal build pipeline.
- `shared-table-ui-runtime.js` — responsive visibility and Age/marker spacing rules.
- `validate-mobile-table-compact-contract.mjs` — source-level ownership assertions updated to the new neutral-DOM contract.
- browser regression under `validation/` covering live breakpoint crossings.
- workflow only if a dedicated regression job is needed; otherwise attach the new test to an existing relevant mobile/table workflow.

## Acceptance criteria

The change is ready for manual testing only when:

- the new live-resize regression has been demonstrated RED against the pre-fix behavior and GREEN after the implementation;
- the table renderer contains no presentation-only `matchMedia()` branch for Name, Listing, or Joined Agency;
- Listing switches to icon-only below 900px on live resize;
- Name switches to `N. Surname` below 900px on live resize;
- Age/marker gap is 2px at <=700px and 1px at <=380px;
- Joined Agency switches correctly at 520px on live resize;
- full Site Quality, browser routing, generated artifacts, Next rendered shell, Windows/native SQLite smoke, lint, typecheck and repository validation pass on the exact final PR head;
- PR #1017 remains unmerged until manual approval.
