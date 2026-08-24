# MFL Front Office loading contract

This file records the canonical loading behavior enforced by the routing/loading validator domain.

- Page and view navigation commit the latest destination immediately and remain interactive while data loads.
- A new page or view transition invalidates and aborts obsolete incremental route data before committing the new destination.
- Incremental route responses also carry a generation identity; stale completions are ignored even if abort races completion.
- Route/data loading is non-blocking. Persistent mutations use only their initiating control or local surface for duplicate-submit protection and working feedback; there is no whole-site busy blocker.
- The global `Loading...` toast is not part of route/view loading. Loading presentation is destination-owned.
- Table headers and static chrome remain destination-owned; loading rows are shown only when the active table request needs placeholders.
- Settled table rows remain visible during background work, and cached destinations may render immediately.
- Refresh and in-site navigation share the same route-loading identity and first-paint/static-shell contract.
- Background warm-up must not delay visible route readiness, block navigation, or replace settled route content.
- No loading fix may add `!important`, runtime repair styles, arbitrary delay-based race masking, or weaken stale-response guards.
