# MFL Front Office loading contract

This file records the canonical loading behavior enforced by the routing/loading validator domain.

- Page and view navigation commit the latest destination immediately and remain interactive while data loads.
- A new page or view transition invalidates and aborts obsolete incremental route data before committing the new destination.
- Incremental route responses also carry a generation identity; stale completions are ignored even if abort races completion.
- Route/data loading is non-blocking. Persistent mutations use only their initiating control or local surface for duplicate-submit protection and working feedback; there is no whole-site busy blocker.
- The global `Loading...` toast is not part of route/view loading. Loading presentation is destination-owned.
- Predictable data-dependent regions use the shared `mflDataPlaceholder` presentation foundation. Route/component owners still own their real geometry, so skeleton dimensions follow the loaded layout rather than a parallel set of hard-coded sizes.
- Like the Surebet loading foundation, text skeletons render representative invisible content inside the same loaded element/class hierarchy and mask that footprint with the shared placeholder surface. Font size, weight, line height, alignment, spacing, wrapping, and responsive behavior therefore come from the real component CSS rather than skeleton-specific copies.
- Controls, icons, table cells, and charts likewise reuse their loaded wrappers/classes whenever their final structure is known; placeholder-only CSS must not recreate those components' layout rules.
- Table routes are first-class consumers of the same placeholder foundation: the canonical colgroup owns column widths, the normal table row contract owns row height, and loading cells render non-interactive inner placeholders without replacing table chrome.
- Home, Player, Evaluation, Settings, Database Stats, MFL Stats, and every table-infrastructure route are covered by the same first-paint/SPA loading contract; static pages and opted-out informational shells do not invent placeholders for data they do not load.
- Table headers and static chrome remain destination-owned; loading rows are shown only when the active table request needs placeholders, and `nav.pager` hides as soon as a Table view navigation becomes pending and stays hidden through the full active Table loading window.
- Settled table rows remain visible during background work, and cached destinations may render immediately.
- Refresh and in-site navigation share the same route-loading identity and first-paint/static-shell contract.
- Immutable application-core URLs include a generated content identity; a release version alone must never allow a current shell to execute a stale core.
- Background warm-up must not delay visible route readiness, block navigation, or replace settled route content.
- No loading fix may add `!important`, runtime repair styles, arbitrary delay-based race masking, or weaken stale-response guards.
