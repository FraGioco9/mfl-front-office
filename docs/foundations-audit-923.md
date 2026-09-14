# Shared foundations final state — issue #923

Part of [#923](https://github.com/FraGioco9/mfl-front-office/issues/923), v1.128.3.

Status: **implemented and enforced**.

This document is the final state summary for the foundations/performance project. The original
source audit, migration plan and performance baseline have been completed through the #923 PR
stack. Current implementation details remain documented in `ui-foundations.md`,
`ui-behavior-foundations.md`, `ownership.md`, `architecture-guardrails.md` and
`performance-923.md`.

## Canonical ownership

| Concern | Canonical owner |
| --- | --- |
| Shared visual tokens | `ui-foundations.css` |
| Responsive behavior/breakpoints | `ui-behavior-foundations.json` and responsive source manifest |
| Page shell/start spacing | shared shell/base CSS; route-specific margins must not create a second page-start owner |
| Tables and table loading | shared table UI/runtime + table loading owner |
| Skeleton geometry | real component geometry remains authoritative; loading styles mask rather than invent layout |
| Route parsing/navigation | canonical app config + Shared routing/navigation owners |
| Completed route data cache | `shared-incremental-routing.js` |
| SQLite connection/query metadata | `api/_database.js` |
| Page projection/filter/sort SQL | `api/_data-page.js` |
| Optional marketplace enrichment | canonical marketplace overlay; core Player/Evaluation data remains nonblocking |
| Global Search | first-use runtime, with Evaluation-specific preloading |
| Player-only responsive/view interactions | Player route runtime |
| Bug Report | first-use runtime |
| Database refresh checkpoints/publication | staged rebuild workflow + extracted workflow helpers |
| Local development | root `npm run dev` → Vercel `site` project on port 4000 |
| Generated assets | canonical build/Site Quality pipeline |

Generated HTML/CSS/runtime artifacts remain outputs, not primary edit targets.

## Shared UI rules now in force

The migration normalized the shared page-start/header relationship and removed competing route
ownership where identified by the original audit. Keep these deliberate exceptions:

- Home retains its centered composition.
- Player remains hero-first rather than acquiring a standard title row.
- Privacy/Changelog keep narrower reading widths.
- Table routes, My Clubs and specialist workspaces retain their role-specific width/content models.
- Safe-area/mobile navigation clearance may differ from desktop geometry while still consuming the
  same semantic foundation rules.

Control sizes, typography roles, table geometry, skeletons, dialogs, menus and loading states are
validated through their existing domain validators. New surfaces should extend those owners rather
than introduce route-local copies.

## Loading, navigation and cache rules

- Navigation commits the destination immediately and keeps the shell interactive while route data
  resolves.
- Obsolete route requests are aborted/ignored through generation/request ownership.
- Completed incremental payloads are cached in one bounded 64-entry LRU-style cache.
- Cache identity includes published dataset generation and linked wallet; namespace changes clear
  completed route payloads before reuse.
- A valid completed cache hit resolves before the network branch.
- Same-entity refresh/revisit must preserve useful content where the owning route supports it.
- My Clubs keeps exact ownership-card count semantics and avoids duplicate pending/completed requests.
- MFL Stats cached re-entry must reuse its completed summary/data ownership rather than retransferring
  the full payload.

## Backend and refresh rules

The backend phase removed repeated request-time work through count reuse, prepared statements,
runtime metadata/precomputed totals, table/schema/catalog reuse and compact route payloads.

The refresh pipeline now:

- publishes only validated coherent stage snapshots;
- preserves an immutable previous-production baseline per workflow run;
- records a validated same-run resume checkpoint with explicit stage state;
- skips completed stages on a GitHub rerun;
- includes progression-email completion in the player-data resume boundary;
- can retry publication from an already materialized final snapshot;
- overlaps independent core wallet/player upstream work with one bounded background worker while
  retaining the existing shared rate limiter and main-thread SQLite writes.

## Browser/runtime rules

Performance work is ownership-driven rather than arbitrary byte cutting:

- Bug Report is first-use lazy.
- Global Search recent hydration and the full Global Search runtime are first-use work on ordinary
  routes; Evaluation preloads Search because its field is immediately interactive.
- Player-only responsive/title/listing/view-strip code is scoped to Player routes.
- Cached table revisits reuse committed table/body state where identity matches.
- The canonical browser baseline remains opt-in and records cold, refresh and cached SPA phases
  separately.

Normal Site Quality enforces deterministic architecture/performance invariants. It intentionally does
not gate ordinary PRs on noisy browser millisecond thresholds.

## Final cross-site smoke gate

After the final #923 PR is merged, perform one integration pass rather than repeating every earlier
PR test:

1. Start local development from the repository root with `npm run dev`.
2. Navigate Home → Database → Player → Club → My Clubs → Evaluation → MFL Stats → Settings →
   Privacy/Changelog using in-site navigation.
3. Confirm header/sidebar/mobile navigation, page-start spacing, title/hero alignment, filters,
   dropdowns, dialogs and Escape handling remain consistent.
4. Revisit Database, Player, Club, My Clubs and MFL Stats and confirm useful cached content appears
   without unnecessary fresh route requests.
5. On mobile width, verify Player view-strip scroll/fades, table horizontal affordances and page
   geometry.
6. Open Global Search and Bug Report on first use and confirm both load correctly.
7. Confirm a listed Player receives asynchronous Listing enrichment without blocking core Player
   content.
8. Refresh representative Database/Player/Club/Evaluation routes and confirm loading/skeleton geometry
   does not jump or expose stale previous-entity content.

The full database refresh workflow is validated separately through its workflow/Python contracts; no
production refresh should be launched solely as a UI smoke test.

## Performance evidence

`docs/performance-923.md` contains the reference 2026-09-12 synthetic browser capture and the
deterministic before/after evidence for subsequent optimizations. Synthetic client throttling and local
fixture/CI latency must never be presented as production latency.

Future optimization work should:
- measure first;
- change one owner at a time;
- use a one-run focused candidate only when runtime evidence is needed;
- use a five-run confirmation only for a candidate that actually improves the measured target;
- keep ordinary Site Quality deterministic and fast.

## Completion

The #923 work is complete when:
- the final cleanup/enforcement PR is merged;
- the final cross-site smoke gate above passes;
- the issue checklist is fully checked.

New features remain separate work and should inherit these foundations rather than reopen them.
