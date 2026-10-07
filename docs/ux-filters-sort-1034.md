# UX-04 — Filters, reset and sort affordance audit (#1034)

Scope: Table controls for Database, Progression, MFL, Agents, My Players, Watchlist, and Club. Preserve existing source-owned markup, responsive geometry, route-specific quick filters, saved table state, sort cycles and incremental data loading.

| Surface | Existing semantics | Clarification and verification |
| --- | --- | --- |
| Filters trigger | Numeric badge counts **completed advanced rules**; quick checkboxes are not included in the number. | Preserve badge number and appearance. First-paint and hydrated trigger announce both the advanced-rule count and checked page-applicable quick filters through the accessible label; the trigger deliberately has no native title tooltip. Keep counts synchronized after toggles, saving, restore and view changes. |
| Quick filters | Hide retired, hide retiring, database-only Hide MFL, MFL-only packable and route-labelled New mints/Aged. Some are enabled by default. | Never silently fold defaults into the existing advanced count. Keep their own visible checkboxes. Report checked settings in the trigger's detailed accessible/hover label, excluding hidden route-inapplicable controls. |
| Advanced filter dialog | A rule can be added and individually removed, with AND/OR operators and two-value operators. Footer Clear affects **only advanced rules**, not quick checkboxes. | Use the concise footer label **Clear** while preserving advanced-only reset semantics; retain individual Remove per rule. Update Remove's accessible name when its column changes. Cancel still restores the original draft; Apply persists. |
| Filtered-empty table | A contextual **Clear filters** action appears only when source rows are present but filtered away. | This is deliberately the *all-family* reset: advanced and quick together, preserving current sort/view/page size/watchlist and the existing reset-visibility policy. Do not restore the hidden global quick Clear. |
| Column sort | Sortable native header buttons; `aria-sort` on the sorted header, arrow for visible direction; numeric columns default descending and others ascending. A third activation of a non-Overall column returns to Overall descending; Overall cycles. | Preserve the sort order, URL, session and view ownership. Add contextual next-action tooltip / accessible description (ascending, descending or reset Overall); restore keyboard focus to the recreated header button after a keyboard-triggered sort. |
| Page/view switching | Per-page saved filters and current view; sort session follows supported columns, normalizing unsupported ones. | Reuse existing session/restore code, no new localStorage keys. Validate linked refresh/parity and view changes in existing browser suites. |
| Club | Column sorting intentionally differs: position order fixed, and quick filter strip is absent. | Do not expose fake quick-filter counts or interactive sort controls. |

### Scope of this PR

UX-04A audit and UX-04B first-pass affordance corrections:
- Canonical `modules/core-sources/table.js`, `html-sources/tables.html`, and `html-sources/dialogs.html` only (plus tests/docs).
- Preserve generated asset ownership; CI builds `modules/app-core-table-runtime.js`, `index.html`, and related parity outputs.
- Cover desktop, phone-width and keyboard focus through existing Site Quality Chromium, mobile-first-paint and table-header pipelines.
- No live wallet proof or Vercel release during this PR.

### Release / manual checks still required

At issue #1034's one final release, verify physical iPhone Safari touch and screen-reader announcement behavior; saved cross-route quick+advanced filters under a real opted-in wallet; deep-linked sort/view resets and populated/empty tables after the Next SSR deployment. Synthetic browser tests are not proof of these environment-specific behaviors.
