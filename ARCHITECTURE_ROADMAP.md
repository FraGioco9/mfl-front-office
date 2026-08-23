# MFL Front Office architecture consolidation roadmap

This document records the architecture review requested by Issue #216 and defines the recommended implementation order for v1.125.0. It is intentionally an analysis and migration plan rather than a single large refactor: the current application contains several tightly validated first-paint, routing, loading, caching, and generated-runtime contracts, so changing all owners at once would make regressions harder to isolate.

## Executive summary

The strongest remaining architecture debt is not CSS. Canonical stylesheets and render-blocking first-paint CSS are already validated to contain no `!important`, scrollbar visuals have one explicit owner, and control/dropdown/style ownership has dedicated regression coverage.

The highest-value work is JavaScript ownership:

1. `site/modules/app-core.js` is still a 473 KB canonical source that is transformed after authoring through a long sequence of exact string replacements and route splitters. The build currently produces a 314 KB shared runtime plus route-specific generated chunks. This protects behavior today, but every source-shape change can require a matching build normalizer and validator update.
2. Route startup and loading are distributed across bootstrap first paint, `app-entry.js`, `route-core-loader-runtime.js`, the generated application core, `table-loading-runtime.js`, Evaluation-specific lifecycles, Stats runtimes, and loading/toast presentation. These layers cooperate successfully but expose multiple transition gates, reason strings, request tokens, and compatibility bridges.
3. First-paint bootstrap code intentionally mirrors runtime route/table metadata so the correct shell can render before the application core loads. The first-paint requirement should stay, but the mirrored definitions should be generated from canonical configuration rather than independently maintained.
4. The validation suite has grown with the architecture. More than 70 validators execute serially and many correctly protect behavior, but a significant portion also encodes exact source/transformation structure. After ownership is simplified, these assertions should be retained while being organized into fewer domain contract suites.
5. Cache/re-entry optimizations are already strong on the expensive paths. Further optimization should be profiling-driven and should not add signature/cache complexity for trivial DOM writes.

The recommended direction is therefore **source ownership first, loading ownership second, then cache/render and validator consolidation**. CSS/static cleanup and database-builder cleanup are lower priority.

## Current baseline

The review is based on the post-v1.124.2 `main` architecture.

| Area | Current baseline | Interpretation |
| --- | ---: | --- |
| Canonical application core | `site/modules/app-core.js`: ~473 KB | Too many domains still originate in one source file. |
| Generated shared core | `app-core-runtime.js`: ~314 KB | Route splitting has reduced eager runtime size, but generation still starts from the monolith. |
| Generated Table runtime | ~69 KB | Table is a substantial independent domain and should be source-owned directly. |
| Generated Evaluation runtime | ~48 KB | Evaluation is already substantially split but still depends on post-source normalization. |
| Bootstrap | ~36 KB | First-paint behavior is valuable, but it mirrors runtime configuration. |
| Global Search runtime | ~32 KB | Already separately loaded; keep it as a domain owner rather than folding it back into core. |
| Static HTML shell | ~52 KB | Large, but much of it exists deliberately for stable first paint. Do not remove it just to reduce file size. |
| Base stylesheet | ~89 KB | Worth later ownership cleanup, but not a priority regression source today. |
| Repository validators | 70+ serial validators | Excellent coverage, but expensive and coupled to source shape in places. |
| Canonical `!important` declarations | 0 | Preserve this invariant. |

The application already contains useful foundations that should be preserved:

- `app-config.js` centralizes route and application configuration used by runtime loaders.
- `app-entry.js` owns a single same-origin API fetch policy and deduplicates dynamic runtime-script requests.
- API data logic is decomposed into shared query/page/view/auth helpers rather than one serverless endpoint monolith.
- `release.json` is the single human-owned current release source; bootstrap/footer copies are generated projections.
- Supabase persistence ownership is documented and redundant cloud state has been reduced.
- CSS priority, scrollbar ownership, controls, dropdowns, motion, stacking, and other shared UI rules have explicit validators.
- Generated runtime verification prevents edited/generated code from drifting silently.

## Priority 0 — move application behavior to source-owned domain modules

### Problem

`app-core-build-normalizer.js` currently takes the canonical application core through a pipeline of splitters and exact `replaceRequired(...)` transformations. These transforms insert or alter real application behavior such as:

- Club startup, entry, and sorting lifecycle;
- Evaluation route, search, readiness, loading, and saved-valuation behavior;
- same-page view filter persistence;
- page filter reset timing;
- Table request/loading boundaries;
- Filters summary and close timing;
- editable pager behavior;
- Table cell alignment;
- Home summary behavior;
- Global Search opening behavior.

The result is correct and heavily validated, but the source of truth for a behavior can effectively be split between `app-core.js` and a normalizer that rewrites it later. That makes refactoring fragile and makes validators depend on exact source text.

### Target architecture

Create source-owned domain modules for the behavior that is currently extracted or rewritten:

- shared application state/routing contracts;
- Table;
- Evaluation;
- Club;
- Player;
- Settings;
- Wallet/preferences;
- Watchlist/My Players;
- MFL Stats;
- Home/Global Search lifecycle where they are not already independently owned.

The build should assemble or bundle those source modules and write generated browser artifacts. It should not change application semantics through string replacement.

### Migration rules

- Move one normalizer-owned behavior at a time into its canonical source module.
- Keep the old validator during each migration and add source/generated equivalence where useful.
- Delete a normalizer only after its behavior has an explicit source owner and the generated artifact remains equivalent.
- Do not combine unrelated route migrations in one PR merely to reduce file count.
- Generated files remain generated; they are not new edit surfaces.

### Measurable target

- **0 behavior-changing `replaceRequired(...)` rewrites** in the production build path.
- `app-core.js` is eliminated as a 473 KB mixed-responsibility owner or reduced to a small composition/shared entry rather than containing all route implementations.
- Each generated route chunk is built directly from the corresponding route source module.
- Generated-artifact verification remains green throughout the migration.

This phase is the prerequisite for the major loading and validator simplifications below.

## Priority 0 — establish one route and loading transition contract

### Problem

Loading state is currently coordinated correctly but through several layers:

- bootstrap owns static first-paint state;
- `app-entry.js` loads route runtimes and the prebuilt core and waits for route paint;
- `route-core-loader-runtime.js` loads route core dependencies and contains an additional Club route gate;
- application-core code owns route/data requests;
- `table-loading-runtime.js` owns a separate active Table request token and presentation details;
- `loading-toast-runtime.js` interprets busy reasons and route cache state to decide toast/footer behavior;
- Evaluation and Stats have domain-specific loading/readiness coordination.

The shared `__mflInteractionBusy` controller is a useful foundation, but too many modules know reason-string and transition details.

### Target architecture

Define one lifecycle contract whose state distinguishes at least:

- initial route bootstrap;
- route transition/navigation;
- blocking route data load;
- background refresh while valid content is already rendered;
- route dependency/core loading;
- ready;
- terminal/error state.

The lifecycle owner decides when interaction is blocked and when a transition is complete. Other modules become consumers:

- **bootstrap:** project the correct static shell only;
- **app entry:** load dependencies and orchestrate the lifecycle;
- **route dependency loader:** load/cache scripts only, not own a second route transition;
- **Table loading:** present blank/loading rows or preserve valid rows according to lifecycle state;
- **loading toast/footer:** pure lifecycle presentation subscribers;
- **Evaluation/Stats:** report their domain data readiness through the same contract instead of creating independent global loading concepts.

### Specific consolidation opportunities

- Remove duplicate Club route-gate implementations from `app-entry.js` and `route-core-loader-runtime.js`; keep one canonical transition entry.
- Keep one promise cache for each type of route dependency and one place that composes dependencies for a route.
- Replace direct cross-module knowledge of busy reason strings with lifecycle queries/events where possible.
- Fold Table request tokens into the central data-load lifecycle if this can be done without losing stale-request protection.
- Keep background loading distinct from blocking loading: already-rendered valid rows must stay rendered during a background request.

### Measurable target

For any route reached by refresh or by SPA navigation:

1. the same route identity and view are committed;
2. the same static content is present before data is ready;
3. exactly one blocking lifecycle begins when blocking work is required;
4. exactly one ready transition releases interaction;
5. cached/background requests do not replace valid DOM with loading placeholders;
6. pager/title/filter/search visibility follows the same lifecycle state in both entry modes.

Additional targets:

- one owner for `mflNavigationPending`/equivalent navigation state;
- one owner for route interaction block/unblock;
- zero duplicate Club transition gates;
- no duplicate loading toast, blank-row prime, or completion animation on one request;
- dependency-load failure produces one consistent error/recovery state.

## Priority 1 — generate first-paint projections from canonical configuration

### Problem

`bootstrap.js` must know enough to render the correct route before the main core executes. It currently contains first-paint copies of table view mappings, column groups, sortable columns, column classes/labels, MFL Stats labels, Settings date/time labels, and route identity/title logic.

The first-paint work itself is intentional and should remain synchronous. The risk is independent maintenance of concepts that also exist in runtime configuration.

### Target architecture

Extend the existing generated-configuration approach so bootstrap consumes **generated projections** of canonical source configuration.

Candidates include:

- page/view order and view slugs;
- Table base/stat/contract column definitions;
- Table column labels/classes and sortability where identical at first paint/runtime;
- MFL Stats preset labels;
- Settings format labels;
- route title/identity formatting inputs where deterministic without network data.

Runtime-only behavior must not be pushed into bootstrap. Bootstrap remains a small static first-paint consumer.

### Measurable target

- one editable source definition for each shared route/view/column/label concept;
- bootstrap copies are generated, never manually synchronized;
- validators compare projected bootstrap metadata with canonical configuration;
- first-paint geometry and route title behavior remain unchanged.

## Priority 1 — standardize route cache and render reuse

### Problem

Several expensive routes now have carefully implemented cache/re-entry behavior, but the patterns are route-specific. Without a shared contract, future routes can accidentally reintroduce full subtree rebuilds, stale reuse, or duplicated payload copies.

### Target architecture

Use a small common cache/render contract where it genuinely fits. A route cache entry should be able to describe:

- canonical route/cache key;
- payload/data revision;
- freshness/validity;
- in-flight request identity;
- last rendered signature where DOM reuse is worthwhile;
- invalidation dependencies such as wallet, settings, permissions, or database revision.

Heavy routes may use a render signature plus a structural DOM guard. Small routes should not add signatures merely to avoid a handful of text assignments.

### Measurable target

- unchanged cached re-entry causes **0 full subtree replacements** on heavy routes already rendered;
- background refresh keeps current valid content until replacement data is accepted;
- stale requests cannot overwrite a newer route/request;
- invalidation dependencies are explicit rather than incidental booleans;
- no cache layer is added without a measurable repeated-work reduction.

## Priority 1 — consolidate shared UI and interaction ownership

The site already has dedicated owners for controls, dropdowns, stacking, scrolling, selection, and global interactions. Consolidation should build on those owners rather than introducing a new generic UI framework.

Focus only on repeated behavior that is truly identical:

- modal open/close/backdrop/escape lifecycle;
- global Escape routing;
- tooltip lifecycle/positioning primitives;
- route title identity formatting;
- Table header/pager/filter chrome;
- route dependency loading and transition gates.

Avoid abstractions that only reduce line count while hiding meaningful route differences.

### Measurable target

- one canonical modal lifecycle;
- one global Escape broker;
- one route-title identity formatter/source contract;
- one Table chrome owner for header/filter/pager state;
- no runtime-injected CSS repair rules where a stylesheet owner exists.

## Priority 1 — reorganize validators around domain contracts

### Problem

The current 70+ validators are valuable, but they run as many serial Node processes and several assert exact transformed source fragments. This is partly a symptom of the build architecture rather than an inherent testing requirement.

### Target architecture

After source ownership migration, group existing assertions into domain runners such as:

1. build/generated artifacts;
2. routing/loading/first paint;
3. Table;
4. Evaluation;
5. Stats;
6. shared UI/style/accessibility interactions;
7. API/persistence;
8. release/deployment.

Keep the assertions. Reduce process and maintenance overhead by running related checks in one domain process and, where CI allows, running independent domain suites in parallel.

Prefer contracts such as “source config produces this runtime behavior” over “this exact replacement string appears at this exact point in the monolith.” Exact source assertions remain appropriate when they intentionally enforce a single owner.

### Measurable target

- reduce **70+ serial validator processes to approximately 8–12 domain runners** without reducing behavioral assertions;
- generated-artifact equivalence remains mandatory;
- validator changes caused solely by harmless source reshaping become uncommon;
- CI reports the failing domain directly.

The target is process/ownership consolidation, not deletion of regression coverage.

## Priority 2 — CSS and static shell ownership cleanup

CSS is not a current priority defect. `validate-css-priority.mjs` already enforces zero `!important` across canonical CSS and first-paint CSS, and dedicated files own scrollbars, controls, dropdowns, loading, responsive behavior, footer behavior, motion, and stacking.

Later cleanup can review the ~89 KB `styles-base.css` and move rules only when a more specific existing stylesheet is clearly the canonical owner. Do not create a stronger override stylesheet.

The ~52 KB `index.html` should also not be split simply because it is large. Static route shells and table headers are part of the first-paint contract. Any extraction must preserve synchronous first paint and layout geometry.

### Measurable target

- canonical `!important` count remains **0**;
- each shared UI family has one stylesheet owner;
- JavaScript does not inject style repair layers for behavior owned by CSS;
- static-shell extraction, if any, produces no first-paint layout shift or placeholder flash.

## Priority 2 — backend and database-builder cleanup

The server/runtime data architecture is already more modular than the frontend core. API query, view, auth, request-body, Supabase, wallet proof, Evaluation payload, Stats, and database access have separate owners. Preserve that structure.

The Python rebuild pipeline is split across several substantial modules. Further consolidation should only follow measured duplication in batching, rate limiting, authentication, error handling, or workflow entrypoint plumbing. Do not merge modules simply to reduce file count.

Progression-email delivery now has a regression that covers a real progression-counter event; keep that test attached to builder changes.

### Measurable target

- one owner for MFL API authentication/rate-limit policy per request class;
- thin workflow/runner entrypoints;
- no duplicated database preparation/deployment transformation;
- builder changes retain focused regression coverage.

## Optimization policy after consolidation

### Worthwhile when profiling proves repeated work

- eliminating repeated full-row scans or sorts;
- one-pass aggregation;
- reusing canonical payload arrays instead of copying them;
- deduplicating script/request promises;
- preserving valid DOM during background refresh;
- render signatures for expensive unchanged subtrees;
- partial rerenders when only a bounded subtree changed.

### Usually not worthwhile

- adding a cache/signature to avoid a few `textContent` assignments;
- abstractions whose only metric is fewer lines of code;
- removing static first-paint markup at the cost of layout instability;
- merging blocking and background loading presentation into one visual state;
- replacing explicit domain ownership with a generic system that requires more exceptions than it removes.

Every optimization PR should state the targeted work being reduced and, where possible, a before/after count. Percentage claims should describe that targeted operation, not imply an unmeasured end-to-end latency improvement.

## Recommended implementation order

The work should be split into reviewable PRs in this dependency order:

1. **Source-owned application domains** — migrate behavior out of build-time string normalizers incrementally.
2. **Route dependency loader consolidation** — one dependency graph/promise owner and one Club/route gate.
3. **Unified loading lifecycle** — one blocking/background/ready contract consumed by Table, toast, Evaluation, and Stats.
4. **Generated first-paint configuration** — eliminate manually mirrored bootstrap domain constants without weakening first paint.
5. **Shared cache/render contract** — standardize only the proven heavy-route reuse patterns.
6. **Validator domain suites** — preserve assertions while removing transform-specific coupling and serial process sprawl.
7. **CSS/static-shell ownership cleanup** — lower-risk cleanup after JavaScript ownership settles.
8. **Builder/backend cleanup** — only where profiling/audit shows real duplication.

Steps 1–4 are the architectural foundation of v1.125.0. Steps 5–8 should remain profiling- or ownership-driven and can stop when additional abstraction would cost more than it saves.

## PR guardrails for the migration

Each follow-up PR should:

- have one named owner/lifecycle being migrated;
- preserve existing user-visible behavior unless the PR explicitly fixes a defect;
- add no `!important` or stronger CSS repair layer;
- delete the superseded compatibility/normalizer path when the new owner is proven;
- keep generated artifacts reproducible;
- include a focused validator for the new ownership and keep relevant existing regressions green;
- state measurable targeted before/after work when performance is part of the change;
- avoid Vercel deployment as part of architecture refactoring.

## Definition of done for the architecture program

The architecture consolidation can be considered complete when:

- application behavior is authored in explicit domain modules rather than injected by build-time string rewrites;
- route dependency loading and transition/loading state each have one canonical owner;
- refresh and SPA navigation use the same route lifecycle contract;
- bootstrap first-paint metadata is generated from canonical configuration;
- heavy cached routes reuse valid data/DOM through a common, explicit contract where useful;
- shared UI behavior has one owner without CSS priority overrides;
- validators are organized around domain behavior and generated equivalence rather than historical transform internals;
- the production build, first-paint behavior, loading behavior, and data-access semantics remain unchanged unless a separately identified bug requires a change.
