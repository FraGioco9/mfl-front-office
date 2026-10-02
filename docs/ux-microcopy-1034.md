# UX-06 — Terminology and microcopy contract (#1034)

Scope: English interface in Database, Progression, MFL, Agents, My Players, Watchlist, Evaluation, Planner and Settings. Keep the existing layout, IDs, endpoints, keyboard behavior, wallet permissions and workflows. **This is a copy audit, not a new i18n system.**

## Vocabulary

| Context | Canonical wording | Do not conflate |
| --- | --- | --- |
| Planner sections | **Plans**, **Squad**, **Depth** | Plans are saved collections; Squad is roster membership; Depth is formation slots. |
| Planner plan status | **Draft**, **Saved**, **Shared** | **Unsaved changes** is a modifier of an owned Saved plan, not a separate saved-state label; **Shared** means received read-only plan, not the owner's active share link. |
| Planner ownership | **Share** creates a link, **Revoke** invalidates it, **Copy share link** copies an existing link, **Copy to my plans** creates an owned copy | A copy or link does not modify the original recipient plan. |
| Editor actions | **Save** persists changes; **Discard** abandons a draft; **Cancel** aborts a confirmation; **Close** dismisses a dialog | **Clear** empties a selected scope and **Delete** removes a persisted resource; do not reword those interchangeably. |
| List collections | **Saved plans**, **Saved evaluations** | Use plural for a picker/list title; singular for one saved evaluation or plan, including delete confirmations. |
| Player and filter state | **Select** is an action; **Selected** is the resulting state; **Clear rules** affects advanced rules only; **Clear filters** clears the current filter scope | Do not change filter reset semantics, selected-player availability or table sorting with copy edits. |
| Network states | **Loading…**, **Retry**, specific **Could not…** messages, **No … yet** for genuine emptiness | A request failure must not be presented as a successful empty result. |
| Entity terms | **Club** refers to an MFL club identity; **Team** refers to the team's player-selection UI | No global renaming of existing API entities or schema terms. |

**Style:** sentence case for buttons, dialog headings, placeholders, accessible labels and messages, except proper product and section names (MFL, Planner, Dapper, FCL). Spell **read-only** consistently. Use the action's real object in an accessible name; preserve keyboard focus and announcements. Keep the user-approved **Add player(s)** button label and existing **Discard** semantics for unsaved forms.

## Inventory and first small copy pass (UX-06A/B)

| UI | Previous copy | New copy | Owner | Why |
| --- | --- | --- | --- | --- |
| Evaluation saved-list modal heading | Load saved evaluation | Saved evaluations | `html-sources/dialogs.html` | This dialog is a list/picker, matching its existing close label and Planner's Saved plans list. Loading an item remains an action, not the dialog's title. |
| Planner shared-view banner | — read only | — read-only | `html-sources/planner.html` | Consistent adjectival spelling; does not alter readonly permissions. |
| Planner Add players close control | Close Add players | Close add players | `html-sources/planner.html` | Consistent sentence-case accessible label; user-visible button **Add player(s)** is unchanged. |
| Settings Save accessible name | Save all Settings changes | Save settings changes | `modules/core-sources/settings.js` | Sentence case and concise action; persists the same settings domain. |

Reviewed without changing: modal **Cancel/Discard** semantics, destructive **Delete/Revoke** confirmations, search/empty/retry distinctions, **Selected/Select** state, Filter **Clear rules** vs route **Clear filters**, owner vs recipient Planner share status. These are deliberate differences and should not be blanket-replaced.

## Automated and release validation

- `node validate-ux06-microcopy.mjs` checks canonical copy, relevant dialog IDs and no reintroduction of stale wording. Included in `validate-all.mjs`.
- Site Quality should build source-owned fragments, regenerate and compare projections, run lint/typecheck/Next build, Planner/Evaluation/browser checks, and Mobile/Table Header/Windows regressions.
- Final single #1034 deployment: manually inspect saved Evaluation picker, Planner shared banner, Add player(s) modal close button with screen reader, Settings Save, and all confirmation flows on desktop and Safari iPhone (including keyboard and touch). Do not claim live wallet or accessibility verification based only on static checks.
- No Supabase migration, auth change or interim Vercel feature deployment.
