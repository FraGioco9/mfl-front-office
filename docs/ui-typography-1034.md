# UI-01 — Page title and header typography audit (#1034)

Source-level audit: canonical HTML fragments, shared typography and specialist CSS, responsive rules, first-paint ownership. **Visual screenshots with the new code have not been taken yet**; those checks remain a release gate.

## Route and type inventory

| Role/routes | At 1280px | At 900px | At 390px | Action |
| --- | --- | --- | --- | --- |
| Database, Progression, MFL Wallet, Agents, My Players, Watchlist, My Clubs, Evaluation, Planner, Settings: shared `.tablePageTitle` | 20px / 700 / line-height 1.2, 32px min-height, 8px bottom gap | same shared heading contract | 18px / 700 / 1.2 (17px at <=380px) | Declare page-title weight in `ui-foundations.css`; consume it in `styles.css`, avoiding implicit browser `h2` defaults. Preserve wrapper margins, first paint and overflow. |
| Planner Squad / Depth / Squad summary: equivalent pane headings | Previously 16px / 800 | same | same | Match the existing section-title 16px / 700 / 1.1 tokens (used by Settings). Keep heights, buttons, gaps and layout unchanged. |
| Settings / Advanced Settings section headings | 16px / 700 / 1.1 | same semantic scale | same | Existing shared contract: preserve. |
| MFL/Database distribution cards, Privacy sections | 15px / 700 / 1.1 | own geometry | own geometry | Compact hierarchy is intentional: preserve. |
| Player hero and club identity, including selected Planner club | Identity titles (~28px / 34px), not route h2 | specialist responsive sizes | specialist responsive sizes | Specialist layout/branding is intentional: preserve. |
| Home | No redundant route heading (brand + intro) | same | same | Preserve. |
| Privacy / Changelog editorial heading | 24px | Changelog 22px | Changelog 19px | Deliberate editorial treatment, leave unchanged pending side-by-side screenshots. |

Shared page typography owner: `ui-foundations.css` defines tokens, `styles.css` consumes them, `html-sources/*.html` owns route markup; generated `styles-runtime.css`, `responsive.css` and `index.html` must not be edited directly. Tablet and phone responsive rules override size tokens, not the shared page-title selector. The Evaluation title/action row deliberately handles its own flex geometry. Planner pane headings remain under `planner.css`, but use existing cross-site section tokens for matching semantic roles.

## Checks and outstanding work

- `node validate-ui01-typography.mjs`: enforce canonical route heading contract, explicit weight, three Planner shared section titles and 18px/17px responsive token ownership.
- Run Site Quality including generated parity, Next build, lint/typecheck, validators, browser routing and Planner; Windows smoke, mobile first paint and table header regression.
- **Pending final single-release visual gate:** capture both light/dark at 1280px, 900px and 390px for Home, Stats, Database, Progression, Agent, My Clubs, Watchlist, Player hero, Club, Evaluation, Planner and Settings. Verify first-paint/loading parity, long names/ellipsis, zoom to 200%, keyboard focus, wrapping, overflow and reduced text visibility. Static tests alone cannot establish optical equivalence.
- No database migration, wallet state change or intermediate Vercel deployment.