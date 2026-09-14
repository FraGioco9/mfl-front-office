# MFL Front Office UI behavior foundations

This document supplements `docs/ui-foundations.md`. The visual token layer stays in `ui-foundations.css`; this document defines cross-site behavioral contracts that must be shared without flattening intentional domain-specific geometry.

The machine-readable contract is `ui-behavior-foundations.json`, and `validate-behavior-foundations.mjs` prevents the implementations below from drifting away from it.

## Responsive breakpoint foundation

The shared shell breakpoints are **900px** (mobile/tablet), **520px** (phone), and **380px** (compact phone). They are recorded once in `ui-behavior-foundations.json` and validated against canonical responsive CSS and responsive runtimes. Specialist domains may keep additional local breakpoints, such as table-only compaction, when they do not redefine the shared shell meaning.

CSS media queries and first-paint/runtime `matchMedia` projections must stay synchronized with the manifest. A new cross-site breakpoint must be added to the manifest and validation matrix before being used as another global shell breakpoint.

## Interaction-state foundation

Equivalent ordinary controls share semantic states rather than page-specific fixes. The canonical disabled state is `opacity: 0.45` plus `cursor: not-allowed` for ordinary disabled buttons. Controls that deliberately use `cursor: default` because they are informational/specialist remain domain-owned.

Active, selected, expanded, busy, destructive, and disabled are separate meanings. A busy state must not be represented by pretending a control is selected; an expanded menu trigger must use its expanded contract; destructive actions continue to derive from the global danger language.

## Touch-target foundation

The shared minimum coarse-pointer target for primary navigation/action controls is **44px**. The rendered glyph or visual box may be smaller when the hit area remains correct, and compact specialist controls may keep smaller geometry when increasing them would change the product contract.

Touch controls use direct-manipulation behavior and shape-aware press feedback. Ordinary text links are not converted into boxed touch controls merely to satisfy a numeric target.

## Form-field foundation

Ordinary text/search/filter fields reuse the existing control visual language: strong border, control radius, surface background, text color, shared focus ring, inherited typography, and consistent placeholder line boxes. Search, Evaluation, Filters, and Bug Report fields consume that shared language where their semantic role matches.

On touch/mobile layouts, editable text fields, selects, and textareas retain a **16px** font-size floor to avoid browser zoom-on-focus. Domain-specific widths, clear-button slots, date mechanics, and compact geometry stay locally owned.

## Scroll and navigation-state foundation

The canonical vertical page scroller is `body > #appShell > main`.

- Changing application page resets main vertical scroll to the top before the destination is revealed.
- Switching a view within the same page preserves main vertical scroll.
- Mobile player-table horizontal scrolling resets when changing page, but not merely because the same page changes view.
- Player attribute-view horizontal position is retained across same-player view rerenders and reset when the player pathname changes.
- Browser history uses the same route/page transition owners instead of a parallel scroll implementation.

These behaviors remain owned by the existing navigation and shared-table runtimes; the foundation validator protects them rather than adding duplicate listeners.

## Modal interaction foundation

Ordinary modal behavior is layered on top of the existing `.modalBackdrop` / `.mflDialog` visual foundation.

- Escape handling has one global priority registry; feature modals register with it rather than adding competing global Escape listeners.
- Visible modal backdrops lock the canonical main scroller without changing its geometry.
- Backdrop-click dismissal remains feature-owned where the feature supports dismissal and must require a genuine backdrop pointer interaction rather than an inside-dialog drag ending outside.
- Initial focus, focus restoration, and feature-specific keyboard ownership remain with the modal runtime that owns the interactive contents; they must not be implemented by page-level CSS.
- Nested/critical modal priority uses the existing semantic stacking and Escape priority systems rather than another z-index or keyboard layer.

## Empty, no-data, and error-state foundation

Empty feedback has semantic states: **searching/loading**, **settled no results/no data**, **unavailable**, and **error**. They must not be visually or behaviorally conflated.

Ordinary helper/status feedback uses the shared helper typography and text/error colors. Search hints, table empty states, Player/Evaluation labels, and other specialist presentation may keep local geometry, but a settled empty state must only appear once its authoritative request/state owner has settled.

## Overflow-affordance foundation

Horizontal overflow cues are presentation state, not route readiness. Shared control strips and player tables use a **2px** measurement tolerance to avoid subpixel false positives. `mflViewsOverflowing` is the shared control-strip overflow state, while the table owner keeps its left/right fade classes.

First paint and hydrated runtime must converge on the same overflow meaning. Individual domains retain their cue width, gradient, icon, and scrolling distance when those are specialist geometry.

## Reduced-motion and accessibility foundation

`motion.css` is the semantic motion owner. Under `prefers-reduced-motion: reduce`, all shared motion-duration tokens resolve to `0ms`, so controls and runtime timers consuming them become immediate. Specialist animations using direct/local timings remain responsible for an explicit reduced-motion branch.

Keyboard focus continues to use the global focus-ring tokens. Touch behavior must not remove keyboard semantics, accessible names, or focus visibility. Escape behavior, focus ownership, touch press feedback, and pointer behavior are complementary interaction modes rather than replacements for one another.

## Responsive validation matrix

`ui-behavior-foundations.json` defines the canonical viewport matrix. It covers desktop, the 901/900 boundary, 520px phone, 380px compact phone, and a smaller compact-phone viewport.

The matrix intentionally includes the **same 1280×900 desktop viewport with and without a vertical scrollbar**. This protects the page-padding foundation: left/right page content alignment must not change because scrollbar chrome is present or absent.

New shared breakpoints or layout foundations must extend this matrix instead of adding one-off viewport assumptions to individual validators.
