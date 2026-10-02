# UI-03 — Icons, semantic states and color contrast (#1034)

Scope: source-level audit of common navigation/control icon roles, specialist badges, semantics for feedback/danger, and interactive rest/hover/focus/disabled. The screenshot/high-contrast/real iPhone keyboard gates remain pending for the **single final issue #1034 deployment**.

## Inventory

| Component / role | Existing contract | Action |
| --- | --- | --- |
| Sidebar and mobile navigation | Shared 18px `--mfl-icon-size-navigation`; active route semantics | Preserve; visible label and icon pair convey active state. |
| Search and Filters icons | Shared 17px `--mfl-icon-size-control` | Preserve sizes and strokes. |
| Account, Settings, Player hero and Player row actions | Specialist SVGs with domain-owned hit boxes; table and dialog aria-labels | Preserve geometry. Regression contracts already exist for Account, Settings, Evaluation share, new Player and action menus. |
| Ordinary Search and Evaluation search clear X | 30px transparent button, labeled, but CSS explicitly suppressed outline in `:focus-visible` with no equivalent focus indicator | **Fix:** add 2px focus ring inset, using shared `--mfl-focus-ring-*` values in `controls.css`. Hover unchanged. |
| Planner Team and Add players search clear X | 30px transparent button with `aria-label`, focus outline explicitly suppressed by Planner Team rule | **Fix:** same inset shared-token ring, in `planner.css` after local no-outline rules. Keep hover, reset, click, hit area and loading unchanged. |
| Planner Saved status pill | Green `#05b925` on light surface mixed with green; approximate contrast **2.42:1** in light theme, ~4.72:1 dark. WCAG AA small text generally targets at least 4.5:1. | **Fix:** preserve background and green semantics, derive foreground with `color-mix(in srgb,#05f82c 38%,var(--text))`, so light text becomes a darker green and dark text stays bright. Calculated ~**5.57:1** light and **9.15:1** dark against each theme's effective pill background. |
| Planner Draft, Shared and Unsaved/Conflict | Surface/text, primary and danger semantic theme tokens | Preserve; active state also conveyed by text. |
| Planner positional familiarity / depth-count chips | Natural/Secondary/Fair/Some and 0/1/2+ have dedicated high-chroma pitch legend colors and numeric text | Preserve the MFL positional knowledge scale instead of overriding it with global brand colors. Check color-vision distinction manually with numeric/label redundancy. |
| Watchlist gold star, positive/negative Progression, rarity and retirement | Game-state data colors; not ordinary success/error controls | Keep domain-owned; separate contrast and color-vision audit later if warranted. |
| Destructive controls | Theme-aware `--danger`, `--danger-hover` and shared danger foreground | Preserve hover/focus parity; don't replace with game rarity reds. |
| Disabled icon controls | Native disabled, pointer suppression and opacity/aria state owners | Preserve and verify in final live touch/keyboard gate. |

## Verification

- `node validate-ui03-icon-color-states.mjs` checks semantic icon sizes, three accessible clear-button label contracts, all four visible keyboard focus-outline owners, original transparent hover contract, status pill foreground formula, and computes WCAG contrast against both light and dark token palettes.
- CI checks generated assets, source lint/typecheck, Planner interaction browser matrix and Windows/mobile/table regressions.
- **Pending final visual and device gate:** light/dark theme screenshots and keyboard-only navigation at 1280px/900px/390px, actual Windows High Contrast/forced-colors mode, Safari iPhone VoiceOver and touch; inspect long badge labels, disabled controls, icons without text, hover/focus differentiation and color-vision semantics. Do not claim these passed based on synthetic or source-only tests.

No production DB migration, no intermediate Vercel deploy; this is a styling/contrast correction only.
