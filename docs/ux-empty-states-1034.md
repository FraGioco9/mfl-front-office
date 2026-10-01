# UX-02 — Empty, gated and failed states audit

Part of GitHub issue #1034, v1.129.0. Source audit: 1 October 2026.

Scope: canonical page HTML, core route files, existing test coverage and shared state owners. This is a source/CI inventory, NOT a claim that every live wallet and production error path has already been browser-tested.

## Route inventory

| Page or flow | While loading / protected | Confirmed zero data | Failed request | Action and next step |
| --- | --- | --- | --- | --- |
| Home | Summary skeletons and public data loading | Summaries are separate from search results | Shared route/data loading owns errors | UX-02F: a confirmed numeric zero renders as **0** (not an unavailable dash); incomplete responses or offline/bootstrap API errors leave unknown stats as `-` and expose a compact Retry without lying about real counts. Successful recovery hides it, updates summary once, and respects the existing cache. Manual offline/keyboard validation remains UX-02G. |
| Database, MFL, Progression | Shared table loading hides the empty-result element | Message distinguishes no source rows from rows filtered out | Route/data error is separate from zero-row table rendering | UX-02C branch: a contextual **Clear filters** button appears only after an authoritative filtered-empty render with source players and active advanced/quick filters. Clicking it clears only filters, resets pagination to page 1, preserves sort/view/watchlist/page size, persists through existing routing, and delegates incremental loading to the established owner. Pending CI validation and merge. |
| Player and Club | Entity route shell and authoritative loading | Missing entity routes use typed not-found presentation | Entity fetch errors belong to route loaders | UX-02D branch: Player 200+no-row remains typed Player not found, and Club 200+no-profile identity remains typed Club not found. Transport/5xx/timeouts in Player data or Club roster/identity now use a separate entity load-error page with Retry (safe GET reload of current URL) and Home, never claiming the entity is absent. This preserves the original route URL and avoids stale player/club pages. Validate with negative fixtures and route/UI contracts; final real-network browser checks remain UX-02G. |
| My Clubs | Wallet opt-in gate; grid skeleton and competition loading | A completed ownership request may return zero clubs | Ownership fetch displays an error with Retry; competition enrichment failure leaves cards intact | THIS PR: after a successful zero-club response offer Search clubs, reusing the existing global Search dialog. Hide Search clubs during loading, populated/error and opt-out states. |
| Watchlist and My Players | Opt-in gate and shared table skeleton | Unfiltered empty roster differs from filtered-empty copy | Shared table data error | UX-02E branch: an authoritative zero-source Watchlist shows **Find players**, and an empty My Players shows **Explore players**, both opening the existing global Search instead of adding a new dialog. Filtered-empty tables retain their separate Clear filters action, and the opt-in gate prevents the CTA for guests. Verify branch CI and wallet browser state before marking complete. |
| Planner club search | Owned-club loading, debounce, query sequence guard | No owned club or no matching team | Previously a request failure could display No teams found and a separate error | THIS PR: distinguish failed search inline and allow Retry of the same typed query or owned-club fetch; discard stale query failures. Never claim no matches while typing. |
| Planner squad | Eight-row roster skeleton | No players in this squad, with Add player(s) available | Failure shows Retry | Existing action retained. |
| Planner saved plans | Loading status in existing Plans modal | No saved plans | Failure showed only error text | THIS PR: guide user to Save if a club is selected, otherwise offer Choose a club. On non-auth errors offer Retry; do not repeatedly retry an expired wallet. |
| Evaluation saved evaluations | Opt-in required, preloaded list or loading state | No saved evaluations | Failure showed only an error paragraph | THIS PR: Search players closes modal and focuses the existing Evaluation search. Retry reruns the saved-list load in the same dialog. |
| Global Search | Recent-result and request lifecycle | Separate genuine zero matches | Shared search error handling | UX-02F: typed requests debounce 200 ms; every edit immediately aborts the previous request, invalidates its sequence and shows Searching, so a zero-results message only appears for a successfully settled current query. Failure exposes inline Retry while retaining text. Failed recent-search hydration offers Retry without a browser-local history fallback. Manual rapid typing, offline, focus and wallet checks remain UX-02G. |

## UX invariants

- Never show No results while the user is still typing or the current request has not resolved.
- Distinguish confirmed zero data, user filters, absent permission, expired opt-in, and network/server failures.
- Preserve typed queries and existing navigation when retrying; ignore stale query responses and old errors.
- Use existing compact buttons, search and dialog infrastructure; no new modal or layout redesign.
- Keep the owned-wallet gate; no user-specific information is exposed by public search fallback.
- Retain status and accessible actions with keyboard/touch interaction.

## Verification

Run the UX-02 validator within the existing route-feature validator group and full CI. Existing browser regressions cover My Clubs opted-out/owned/stale/competition-failure and Planner selection, search, squad and depth. Complete manual browser verification before the final issue release for a wallet with no clubs, no saved plans/evaluations, intentionally failing requests, a delayed search, Retry, focus return and mobile/keyboard interactions.

## Unfinished sub-scope

The current PR closes actionable gaps in My Clubs, Planner and saved Evaluation dialogs. Home offline summaries, Player/Club API-error handling, shared table filtered-empty reset, Watchlist onboarding and end-to-end network-failure browser coverage remain to be reviewed or deliberately excluded. Do not check off UX-02 until that disposition is recorded.


## UX-02G — Focused real-browser recovery matrix (no production deploy)

Deterministic Chromium test: node validation/browser-ux02-recovery-regression.mjs, executed in Site Quality after general routing. Uses the repository's real Chromium/DevTools browser runner against a stubbed local HTTP server, not Vercel or actual wallet secrets.

| Scenario | Width | Assertions |
| --- | ---: | --- |
| Home valid zero counts | 520px | Both values 0, no error or inappropriate Retry. |
| Home API failure and recovery | 390px | Unknown counts remain unavailable, descriptive error and focusable Retry restore values and clear error. |
| Global Search | 390px | No premature zero while typing, distinct API failure, Retry, settled zero, stale delayed query cannot override fresh Player, viewport safe. |
| My Clubs, valid synthetic wallet, zero clubs | 390px | No cards; no inappropriate error Retry; discovery action opens shared Search. |
| Watchlist, valid synthetic wallet, zero players | 390px | Find players, no inappropriate Clear filters; shared Search opens. |
| Player HTTP 503 | 390px | Dedicated Could not load Player; typed 404 hidden; Retry focusable; deep-link intact. |
| Club HTTP 503 | 390px | Dedicated Could not load Club; typed 404 hidden; Retry focusable; deep-link intact. |

These are *synthetic* wallet fixtures. The suite runs separately so standard route CI scenario coverage does not expand.

**Final-release verification still pending:** actual opted-in wallets with no clubs, no saved plans/evaluations, revoked/expired permissions during in-flight requests; Safari/iPhone touch interaction, native-keyboard Tab/Enter/Escape, real-network interruptions, and the one final production deploy verification for UX-01 titles and release integrity. Do not check UX-02G or parent UX-02 off until these checks are completed or explicitly scoped out.

