# A11Y-01 · Axe and keyboard baseline (#1034)

## Automated scope

`npm ci && npm run build && npm run test:a11y` (Node.js 22) executes the existing isolated Chromium browser fixture with deterministic public player/club data and simulated opt-in/wallet state. No external login, real wallet, Supabase access or production data is used.

The audit covers the **hydrated visible page** on Home, Database/Attributes, Player, Planner and Settings at desktop width, plus Database and Planner at 390 × 844. The app's existing route assertions must complete before any audit begins. It uses pinned `axe-core@4.10.3` via CDP, not injected application source or a remote script.

- Axe WCAG 2.0 A/AA and 2.1 A/AA violations are reported with rule, impact, count and target selectors. **Critical violations fail CI**. Serious/moderate findings are reported rather than silently waived. Incomplete/manual checks are counted.
- Real Chrome keyboard events validate forward and reverse Tab order on each route; Planner also checks Enter and Space activation, Escape dismissal and restored focus for a selectable position.
- No blanket axe rule exclusions or ignored-element baselines are applied.

## Initial desktop findings (02 October 2026)

The desktop audits of Home, Database, Player, Planner and Settings returned **zero critical** violations (Settings: zero axe violations). These noncritical but actionable findings remain open for targeted work under the existing A11Y tasks:

| Route | Axe rule | Severity | Affected element |
| --- | --- | --- | --- |
| Home | `color-contrast` | Serious | `#homeOptInButton > span` |
| Database | `color-contrast` | Serious | `#watchlistPlayerCount` |
| Player | `color-contrast` | Serious | `.playerContractDivision`, `button[data-player-attribute-view="attributes"]` |
| Planner | `aria-prohibited-attr` | Serious | `.retirementMarker` |
| Planner | `nested-interactive` | Serious | `.plannerPitch` |
| Planner | `color-contrast` | Serious | `#plannerTeamDivision`, `#plannerRosterCount`, `#plannerSquadStatusPrimary`, `.plannerFormationControl > span` |

The initial 390px Database audit identified a **critical** `button-name` failure in `#prevButton` and `#nextButton`, because compact CSS hides their text labels. Both now have persistent `aria-label` attributes in the canonical `html-sources/tables.html` and generated `index.html`; the full seven-case A11Y-01 axe and keyboard matrix passed in [run 37028934139](https://github.com/FraGioco9/mfl-front-office/actions/runs/37028934139).

A11Y-02 owns icon/control semantics and nested interactions; A11Y-03 owns light/dark contrast and accessible focus styling. A11Y-06 owns landmark and skip navigation checks. Findings are **not** marked remediated solely because the smoke test permits noncritical severity.

The complete seven-case axe/keyboard matrix, Site Quality, Mobile first-paint, Table Header and Next rendered shell all passed on final validated head `24fa9891` ([A11Y-01 run 37029268667](https://github.com/FraGioco9/mfl-front-office/actions/runs/37029268667), [Site Quality run 37029268675](https://github.com/FraGioco9/mfl-front-office/actions/runs/37029268675)). All seven axe scans had zero critical issues, while Settings and 390px Database had zero violations. Serious contrast/ARIA/nested-interactive findings remain assigned to A11Y-02/A11Y-03 rather than being silently baselined.

## Manual release checks

Axe does not replace NVDA/VoiceOver or touch testing. The final issue release requires real iPhone/Safari orientation, screen reader reading order, keyboard/switch focus management, high contrast, reduced motion and 200–400% text zoom, especially in the Planner picker and dialogs. Keep Vercel deployment deferred until the agreed final release.
