# Shared foundations audit and implementation proposal

Part of [#923](https://github.com/FraGioco9/mfl-front-office/issues/923), v1.128.3.

Status: **source audit and proposed rules, ready for review**. This document does
not change runtime behavior. Existing foundation documents describe the current
contracts; the proposals below become canonical only through subsequent PRs.

Baseline commit: `ca6606c95f20c880a99978696276c3a98a925012`.

## Scope and evidence

Reviewed canonical foundation tokens, visual/behavior documentation, shell CSS,
responsive fragments, route HTML shells, specialist page styles, footer ownership,
loading presentation and existing timing validators. There is no AGENTS.md in this
checkout. Generated CSS/HTML/runtime files are outputs, not edit targets.

This is a source-based inventory, not a completed rendered geometry audit. Actual
DOM rectangles, safe areas, wrapping and request timings must be measured in the
implementation PRs. The checkout contains no runtime database, so API latency and
production interaction performance have not been measured. Do not interpret source
byte counts or successful source validators as proof of smooth browser behavior.

## Existing owners to extend

| Concern | Existing canonical owner | Direction |
| --- | --- | --- |
| Shared visual tokens | `site/ui-foundations.css` | Extend existing tokens; do not create a competing token system |
| Desktop shell | `site/styles-base.css` | Keep one shell geometry implementation |
| Responsive shell | `site/responsive-sources/manifest.json`, `chrome-tablet.css.inc`, `parity.css.inc` | Preserve cascade order; replace hard-coded semantic values |
| Breakpoints and viewport matrix | `site/ui-behavior-foundations.json` | Reuse 900/520/380 boundaries and scrollbar cases |
| Page titles and player tables | `site/styles.css` | Preserve Uniform Width and shared title contracts |
| Footer and route height floor | `site/footer.css` | Preserve separate footer placement responsibility |
| Controls and filter controls | `site/controls.css`, `site/filter-controls.css` | Audit role variants before merging values |
| Dropdown mechanics | `site/dropdowns.css` | Preserve positioning and interaction owner |
| Skeleton masking | `site/loading.css`, `site/table-loading-runtime.js` | Real component geometry must remain authoritative |
| Motion, scrolling, layering | `site/motion.css`, `site/scrollbars.css`, `site/stacking.css` | Reuse semantic scales |
| My Clubs cards | `site/my-clubs.css`, responsive My Clubs fragments | Keep card internals separate from page spacing |
| Startup, transport and timings | `site/bootstrap-core.js`, `site/modules/app-entry.js` | Extend existing lifecycle and instrumentation |
| Route/domain code | `site/modules/core-source-manifest.js` | Keep lazy domain ownership and generated equality |
| API page projection/database | `site/api/_data-page.js`, `site/api/_database.js` | Profile query work and payload boundaries |

See [current visual rules](ui-foundations.md), [behavior rules](ui-behavior-foundations.md)
and [source ownership](ownership.md). Those foundations already cover many requested
areas. The work is closing ownership gaps and verifying adoption, not recreating them.

## Confirmed source findings

| ID | Evidence | Consequence / proposed resolution |
| --- | --- | --- |
| L1 | `styles-base.css` main uses `--mfl-page-inset-block-start`; `chrome-tablet.css.inc` main has `padding: 4px 12px calc(...)` | Mobile top inset bypasses the token. Use the shared token at every viewport; retain safe-area logic in parity |
| L2 | `.tablePageTitle` and direct title wrappers in `styles.css` consume 6px top/8px bottom margins; main adds 4px | Standard title start has two contributors. Make shell own the complete leading gap |
| L3 | `.privacyPage` and `.changelogPage` declare 14px top margins; Changelog overrides this to 10px at tablet, 8px at phone and 6px at compact phone | Static routes have independent leading gaps. Remove these route margins when adopting the common start |
| L4 | `.evaluationTitleRow` in base CSS declares 14px/12px margins, while `styles.css` direct-title wrapper rule sets shared margins | Competing declarations obscure ownership even where the shared rule wins. Remove superseded values after checking responsive title/action alignment |
| L5 | `.menuRail` uses literal `top: 102px`, while `--pinned-topbar-height` already exists | A header-height change can leave sidebar offset behind. Consume the existing token |
| L6 | Page widths are intentionally different: Player/Evaluation/Settings 1180px; Changelog 860px; Privacy 780px; tables/My Clubs full width | Keep documented width roles. Centralize repeated 1180px role only after confirming intended equivalence; do not impose a global max-width |
| L7 | `.homePage` vertically centers content; Player starts with a hero instead of a table title | Home needs an explicit centered-layout exception. Player can share page-start spacing without acquiring a title row |
| L8 | `footer.css` gives every route a minimum height and owns first-paint grid fallback | Preserve footer floor and scroll behavior while changing top spacing; page height is not another header-gap owner |

Equal-looking literals inside cards, chart padding and hero media offsets are not
necessarily conflicts. For example My Clubs' 14px grid gap and 128px media column
have a different role from the 6px page-section gap; retain them pending their own
component audit.

## Proposed layout values for review

Measure header-to-content from the **bottom border edge of the topbar to the top
border edge of the first normal-flow title row or content block**, at main scroll
position zero. This does not mean the top of a font glyph. The page shell owns this
space; neither the page root nor its first title adds a second leading margin.

| Rule | Current source | Proposed desktop >900px | Proposed 521–900px | Proposed <=520px |
| --- | --- | --- | --- | --- |
| Header-to-content gap | Main 4px + title 6px; Player 4px; static page root adds 14px (Changelog 10/8/6px at tablet/phone/compact) | **10px** | **10px** | **10px** |
| Main top inset token | 4px, bypassed by mobile literal | **10px** | **10px** | **10px** |
| First title/wrapper top margin | 6px standard; competing Evaluation declaration | **0px** | **0px** | **0px** |
| Standard title bottom margin | 8px | 8px | 8px | 8px |
| Horizontal content gutter | 28 / 12 / 8px | 28px | 12px | 8px |
| Page title font size | 20 / 18 / 17px | 20px | 20px | 18px; 17px <=380px |
| Standard title minimum height | 32px | 32px | 32px | 32px |
| Repeated page-section gap | 6px; phone 5px | 6px | 6px | 5px |
| Bottom inset | 6px; mobile clearance | 6px | Existing nav/safe-area formula | Existing nav/safe-area formula |
| Sidebar width | 190px desktop; mobile rail | 190px | Existing mobile navigation | Existing mobile navigation |
| Global content max-width | None | None | None | None |

The 10px proposal preserves the ordinary title position (4 + 6) while moving Player's
first block down 6px and bringing static-page starts into the same contract. It is
a proposed design normalization, not a measured screenshot result. Home keeps its
intentional centered composition inside the shared shell; document that exception.

Safe-area clearance may legitimately differ between left and right physical edges.
Use equal base gutters without compensating one side for scrollbar chrome. Keep the
existing 1280x900 scrollbar-present/absent cases and 901/900 breakpoint pair.

### Existing component values to preserve initially

| Role | Value / owner |
| --- | --- |
| Standard / compact controls | 40px / 36px, foundation tokens |
| Control / checkbox radius | 6px / 4px, foundation tokens |
| Checkbox size | 16px, foundation token |
| Navigation / ordinary control icon | 18px / 17px, foundation tokens |
| Panel / dialog radius | Both currently 8px, separate semantic tokens |
| Table header / row / outer pitch | 38px / 34px / 39px, Table owner |
| Standard / compact section title | 16px / 15px, foundation tokens |
| Metadata | 12px / 11px, foundation tokens |
| Mobile editable fields / touch targets | 16px floor / 44px primary target, behavior manifest |

These values are not new design changes. Each component PR audits all consumers and
real/skeleton states, documenting variants rather than blindly equalizing them.

## Route and surface migration checklist

All entries below are pending implementation/browser verification, not claims of
completed migration. Reconcile with current main before each PR.

| Surface family | Primary source / review |
| --- | --- |
| Database, MFL, Progression, agent, watchlist and My Players tables | `html-sources/tables.html`, shared Table route; standard title, filters, pager and skeleton |
| Individual Club | Shared table shell plus Club identity; no new filters or removed Info view |
| My Clubs | `html-sources/my-clubs.html`, `my-clubs.css`; title/grid/card loading together |
| Individual Player | `html-sources/player.html`; hero-first gap, cached identity and selected-view timing |
| Evaluation and saved evaluations | `html-sources/evaluation.html`; title/action wrapper, static workspace and dialog |
| Database Stats and MFL Stats | Corresponding HTML fragments; title, filter strips, distributions and loading |
| Settings | `html-sources/settings.html`; standard title, width and fields |
| Privacy / Changelog | `html-sources/static.html`; remove independent leading margins, retain reading widths |
| Home | `html-sources/home.html`; explicit centered-content exception, header summaries |
| Locked / unavailable / not-found | `html-sources/access.html` and first-paint route guards; do not display settled error before request completion |
| Global chrome | Topbar, sidebar/mobile navigation, footer, header wallet/player boxes, toasts |
| Dialogs and menus | Search, Filters, Watchlists, Evaluation Load, Advanced Settings, Bug Report, Player actions/notes; shared shell plus documented body variants |

Planner remains separate feature work (#914); do not restore the discarded PR as
part of foundations. Newly merged routes must join this checklist and inherit the
same rules.

For each family inspect initial loading, populated, empty/error, cached revisit,
same-entity refresh and navigation to another entity where those states apply.

## Performance baseline and next measurements

Measured directly from the baseline checkout using Python `len(read_bytes())` and
`len(gzip.compress(bytes, mtime=0))` with the default compression level:

| Artifact | Raw bytes | Local gzip bytes |
| --- | ---: | ---: |
| Shared application core | 309136 | 62231 |
| Flattened stylesheet | 298511 | 47235 |
| Bootstrap core | 20439 | 4851 |
| App entry | 24897 | 6308 |

These are reproducible artifact sizes, not total route transfer sizes or actual CDN
compression. Do not set new arbitrary domain size ceilings from them.

Existing `validate-client-performance-timing.mjs` confirms canonical marks for
bootstrap, core/runtime readiness, data source (memory/in-flight/network), content
commit and visual settlement. Reuse this stream; do not add duplicate observers.

Before backend optimization, obtain a representative valid database and benchmark
baseline/candidate deployments against the same data and access context. Record:

- cold first visit separately from warm/cached navigation;
- at least five warm repetitions, with median and observed slowest values (do not
  label a small sample as a reliable p95);
- Database, Player, Club, My Clubs, Evaluation and Stats journeys;
- request counts, response bytes, server timing, content-commit/settled duration,
  long tasks and layout shift; fix browser/network settings between comparisons;
- failures, optional enrichment and rapid navigation as correctness scenarios.

Runtime latency, query plans and rendered layout baseline remain **pending**.
Performance budgets should follow these measurements, not invented speed targets.

## PR sequence and completion gates

1. This documentation PR: review the proposed values and ownership findings.
2. Page layout PR: implement L1–L5, migrate the route starts, preserve documented
   width/Home/footer exceptions and verify actual rectangles across the matrix.
3. Spacing/typography and component-family PRs: audit and migrate each family
   everywhere, including skeletons; remove obsolete declarations in the same PR.
4. Loading/cache PRs: consolidate existing owners, verify deduplication and stale
   response protection, preserve useful same-entity content during refresh.
5. Backend/rendering/refresh PRs: prioritize measured bottlenecks; preserve data
   permissions, query semantics and coherent published snapshots.

For the page-layout PR, change the shared inset temporarily during verification and
assert all applicable page starts move by the same delta at desktop and mobile.
Measure title-wrapper and hero rectangles, not only CSS token strings. Test direct
refresh and in-site navigation at the existing viewport matrix, plus a landscape
safe-area case where available. This catches bypasses that current source checks miss.

Test and squash merge **one completed PR at a time**. Provide local sync commands
without cd and a concise checklist; fix reported issues before merging. Build the
next dependent PR from updated main. Backend PRs include timing evidence; the user
checks normal usage and responsiveness. End with one cross-site smoke test.

## Checks performed for this audit

- `node site/validate-ui-foundations.mjs` — passed.
- `node site/validate-behavior-foundations.mjs` — passed.
- `node site/validate-client-performance-timing.mjs` — passed.

These checks confirm existing contracts and instrumentation; they do not invalidate
L1–L8 or replace browser measurements. A documentation-only PR needs value/plan
review rather than a production build or user browser test.

## Cross-project references

- [Baraccano UI foundations](https://github.com/FraGioco9/contabilita-teatro-baraccano/blob/main/docs/ui-foundations.md): explicit semantic ownership and documented variants.
- [Baraccano performance foundations](https://github.com/FraGioco9/contabilita-teatro-baraccano/blob/main/docs/performance-foundations.md): keep useful content during refresh, narrow detail boundaries and request deduplication.
- [Surebet architecture](https://github.com/FraGioco9/surebet/blob/main/README.md): repeatable performance comparisons and database-side aggregation.

Adapt those practices to MFL's existing runtime. New product features and a framework
rewrite are outside this audit.
