# MFL Front Office UI foundations

This document defines the global visual and structural defaults for MFL Front Office. New UI should reuse these contracts instead of introducing page-specific literals for the same semantic role.

The goal is **shared ownership, not forced sameness**. Responsive geometry, Player/Evaluation-specific sizing, compact table controls, and other intentionally specialized behavior remain domain-owned.

## Ownership map

| Foundation | Canonical owner |
| --- | --- |
| Cross-site shared control/surface/page-layout tokens | `site/ui-foundations.css` |
| Theme palette and desktop shell geometry | `site/styles-base.css` |
| Table visual foundations, geometry, and Uniform Width | `site/styles.css` |
| Motion timings | `site/motion.css` |
| Dropdown mechanics | `site/dropdowns.css` |
| Scrollbars | `site/scrollbars.css` |
| Cross-site stacking | `site/stacking.css` |
| Responsive scaling | `site/responsive-sources/*.css.inc` -> generated `responsive.css` |

Generated `site/styles-runtime.css`, `site/responsive.css`, and `site/index.html` are projections. Edit their canonical sources instead.

## Colors and theme

### Light

- Page background: `#f6f7f9`
- Surface: `#ffffff`
- Muted surface: `#fbfcfe`
- Border: `#d9dee7`
- Strong border: `#c9d1dc`
- Text: `#172026`
- Muted text: `#5f6b76`
- Soft text: `#687581`
- Header background: `#eef3f7`
- Row hover: `#f4f8fb`
- Contracts-cell hover: `#dbe8f1`
- Primary: `#1d5f8a`
- Primary hover: `#174d70`
- Danger: `#b42318`

### Dark

- Page background: `#101418`
- Surface: `#171d22`
- Muted surface: `#1d252c`
- Border: `#303b44`
- Strong border: `#46535e`
- Text: `#e8eef3`
- Muted text: `#a9b4bd`
- Soft text: `#8f9ba5`
- Header background: `#222b33`
- Row hover: `#202a32`
- Contracts-cell hover: `#31404b`
- Primary: `#4aa3df`
- Primary hover: `#65b5ea`
- Danger: `#ff8a80`

`--danger` is the only global destructive/error-color source. Destructive actions, validation errors, invalid-field borders, and destructive hover/focus states must derive from it rather than introducing a separate red.

Data visualization and game-state colors are intentionally not part of this rule. For example, negative progression, Training deltas, and difficulty/status colors may keep domain-owned reds because they communicate data meaning rather than an error or destructive action.

## Typography

- Font: `"Titillium Web", Arial, Helvetica, sans-serif`
- `font-size-adjust`: `0.500`
- Shared page/table title size: `20px` (`--mfl-page-title-font-size`)
- Shared page-title minimum height: `32px` (`--mfl-page-title-min-height`)
- Phone and compact-phone title scaling override the same token to `18px` / `17px`
- Page-title block margins: `0px` before / `8px` after (`--mfl-page-title-margin-block-start` / `--mfl-page-title-margin-block-end`)
- Page-title line-height: `1.2` (`--mfl-page-title-line-height`)
- Shared section title: `16px` (`--mfl-section-title-font-size`)
- Shared compact section title: `15px` (`--mfl-section-title-compact-font-size`)
- Shared section-title weight / line-height: `700` / `1.1` (`--mfl-section-title-font-weight` / `--mfl-section-title-line-height`)
- Standard metadata/small-label size: `12px` (`--mfl-metadata-font-size`)
- Compact metadata/small-label size: `11px` (`--mfl-metadata-compact-font-size`)
- Shared metadata weight: `700` (`--mfl-metadata-font-weight`); strong metadata: `800` (`--mfl-metadata-strong-font-weight`)
- Shared metadata line-height where the semantic role permits it: `1.1` (`--mfl-metadata-line-height`)
- Ordinary helper/status text size: `12px` (`--mfl-helper-text-font-size`)
- Ordinary helper/status line-height: `1.25` (`--mfl-helper-text-line-height`)
- Ordinary status weight: `400` (`--mfl-helper-text-font-weight`)
- Error feedback weight: `700` (`--mfl-helper-error-font-weight`)
- Numeric/count values use tabular figures where stable alignment matters

The shared section-title scale is used only where the heading has the same structural role. Settings and Advanced Settings use the standard size; MFL Stats distribution and Privacy cards use the compact size. Player and Evaluation headings remain specialist-owned.

Metadata tokens apply only to true small labels/secondary metadata. Component labels whose geometry controls a row height, and Player/Evaluation-specific labels, may keep locally owned line-height or sizing.

## Helper and status feedback

Ordinary helper/status feedback shares:

- Text color: `var(--text-soft)` through `--mfl-helper-text-color`
- Error color: `var(--danger)` through `--mfl-helper-error-color`
- Size: `12px`
- Line-height: `1.25`
- Normal status weight: `400`
- Error feedback weight: `700`

This contract is intentionally narrow. It covers ordinary form/status feedback such as Add Watchlist validation and Bug Report status/error text. Search hints, empty states, table loading/empty states, Player/Evaluation data labels, and domain-specific game-state messages remain locally owned.

## Layout and chrome

- Desktop pinned sidebar: `190px`
- Desktop topbar: `102px`
- Mobile navigation: `58px`
- Desktop page gutter: `28px` (`--mfl-page-gutter-inline`)
- Tablet/mobile page gutter at `<=900px`: `12px`, expressed by overriding the same token
- Phone page gutter at `<=520px`: `8px`, expressed by overriding the same token
- Desktop page block inset: `10px` top / `6px` bottom (`--mfl-page-inset-block-start` / `--mfl-page-inset-block-end`)
- Tablet/mobile bottom page inset derives from the mobile-navigation clearance and safe-area inset through `--mfl-page-inset-block-end`
- Repeated desktop page-section rhythm: `6px` (`--mfl-page-section-gap`)
- Phone page-section rhythm: `5px`, expressed by overriding the same shared token
- Safe-area calculations remain in the responsive layout owner while consuming the shared page-gutter token
- There is intentionally no global content max-width because table-heavy routes use the available width

Page-layout tokens are semantic foundations: use them only when sections play the same structural role. Topbar/footer chrome, component-internal gaps, table overflow, Player/Evaluation geometry, and deliberate exceptions remain locally owned.

## Content surfaces

- Canonical ordinary panel background: `var(--surface)` (`--mfl-panel-background`)
- Canonical ordinary panel border: `1px solid var(--border)` (`--mfl-panel-border`)
- Canonical strong ordinary panel border: `1px solid var(--border-strong)` (`--mfl-panel-border-strong`)
- Canonical ordinary content-panel radius: `8px` (`--mfl-radius-panel`)
- These panel contracts are for equivalent page/content surfaces such as Home summary cards, MFL Stats content panels, Settings surfaces, and Privacy sections.
- Dialogs use `--mfl-radius-dialog`; controls use `--mfl-radius-control`.
- Tables, Player cards, Evaluation surfaces, dialogs, dropdowns, controls, pills, and specialist visualizations keep their own surface ownership even when their current border, background, or radius happens to match an ordinary panel value.

## Keyboard focus

Ordinary keyboard-focus affordances share:

- Ring color: `var(--primary)` through `--mfl-focus-ring-color`
- Ring width: `2px` through `--mfl-focus-ring-width`
- Standard ring offset: `2px` through `--mfl-focus-ring-offset`

Equivalent ordinary controls should consume these tokens. Compact controls may keep a deliberately smaller local offset, while table action menus, selected/expanded controls, and other specialist interaction states retain their domain-owned focus behavior.

## Icons

Only equivalent semantic icon roles share dimensions:

- Navigation icon size: `18px` (`--mfl-icon-size-navigation`)
- Ordinary control icon size: `17px` (`--mfl-icon-size-control`)

The navigation token covers the sidebar/mobile navigation icon cell and its equivalent jersey glyph. The ordinary control token covers Search and Filters icons. Advanced Settings, Account, Evaluation, Player Note/Listing, table actions/markers, branding/social icons, flags, avatars, and game-state/data icons remain specialist-owned even when a numeric size happens to match.

There is intentionally no generic numeric icon scale: new icons should join one of these roles only when their semantic/geometry contract genuinely matches.

## Controls

Cross-site semantic values live in `ui-foundations.css`:

- Standard control height: `40px` (`--mfl-control-height`)
- Compact control height: `36px` (`--mfl-control-compact-height`)
- Standard View/Filters label size: `14px` (`--mfl-control-label-font-size`)
- Shared ordinary selector-control weight: `700` (`--mfl-control-font-weight`)
- Shared ordinary selector-control line-height: `1` (`--mfl-control-line-height`)
- Ordinary control resting border: `var(--border-strong)` (`--mfl-control-border-color`)
- Ordinary control resting background: `var(--surface)` (`--mfl-control-background`)
- Ordinary control resting text: `var(--text)` (`--mfl-control-text-color`)
- Ordinary control hover border: `var(--primary-hover)` (`--mfl-control-hover-border-color`)
- Ordinary control hover background: `var(--row-hover)` (`--mfl-control-hover-background`)
- Ordinary control hover text: `var(--text)` (`--mfl-control-hover-text-color`)
- Standard control radius: `6px` (`--mfl-radius-control`)
- Checkbox size: `16px` (`--mfl-checkbox-size`)
- Checkbox radius: `4px` (`--mfl-radius-checkbox`)

Specialized tiny steppers, table action buttons, mobile-only touch geometry, and other domain-specific controls keep their own sizes. View and Filters share the standard 14px label size and 700 weight; View, Filters, Search, and refresh-first-paint View controls share the ordinary resting/hover state language. Smaller Stats and Player controls retain locally owned font sizes, and navigation, Stats, Player, dropdown, destructive, opt-in, and other specialist states remain independently owned even when their current colors match.

## Dropdowns and menus

- Ordinary dropdown/menu surface: `var(--surface)` (`--mfl-dropdown-background`)
- Ordinary dropdown/menu border: `1px solid var(--border-strong)` (`--mfl-dropdown-border`)
- Ordinary dropdown/menu radius: `8px` (`--mfl-radius-dropdown`)
- Ordinary dropdown/menu shadow: `0 12px 36px rgba(0, 0, 0, 0.16)` (`--mfl-shadow-dropdown`)
- Ordinary option radius: `6px` (`--mfl-radius-dropdown-option`)
- Ordinary option rest/hover/selected colors are semantic foundation tokens; enhanced native pickers and generic custom menus consume them where their visual role matches.
- `dropdowns.css` remains the sole owner of dropdown mechanics: positioning, gaps, max-height, z-index, chevrons, transitions, native picker enhancement, and responsive/menu-specific geometry.
- Watchlist active rows/actions, Account wallet semantic colors, destructive items, Player action geometry/icons, and Database Stats Custom layout remain specialist-owned.
- Database Stats Custom keeps specialist layout/positioning while its ordinary menu shell consumes the shared dropdown visual foundations.

## Dialogs and overlays

- Canonical backdrop surface: `rgba(0, 0, 0, 0.45)` (`--mfl-modal-backdrop-background`)
- Canonical ordinary dialog surface: `var(--surface)` (`--mfl-dialog-background`)
- Canonical ordinary dialog border: `1px solid var(--border)` (`--mfl-dialog-border`)
- Canonical dialog header/footer divider: `1px solid var(--border)` (`--mfl-dialog-divider`)
- Canonical dialog radius: `8px` (`--mfl-radius-dialog`)
- Canonical modal/dialog shadow: `0 20px 80px rgba(0, 0, 0, 0.28)` (`--mfl-shadow-modal`)
- `.mflDialog` owns the shared ordinary shell; `.mflDialogHeader` and `.mflDialogFooter` own shared dialog chrome.
- Search, Filters, saved Evaluation, Watchlist chooser/add/delete, Advanced Settings, and Bug Report consume those generic structural classes while retaining their domain-specific widths, bodies, controls, and responsive geometry.
- Responsive dialog owners may change dimensions but must not re-declare the shared dialog shell radius/surface/border/shadow.
- The shared backdrop uses `--mfl-motion-standard` for its existing 180ms opacity/transform timing.
- Tooltip shadow: `0 10px 26px rgba(0, 0, 0, 0.28)` (`--mfl-shadow-tooltip`)
- Mobile navigation surface shadow: `0 10px 28px rgba(0, 0, 0, 0.18)` (`--mfl-shadow-mobile-navigation`), consumed by the canonical responsive mobile navigation rail
- Ordinary dialogs remain fixed application-layer elements rather than browser top-layer popovers
- Main scrolling is locked while a modal backdrop is open
- Toasts remain above every modal/overlay

## Tables

Table visual foundations are specialist Table-domain contracts owned by `site/styles.css`; they do not collapse tables into the ordinary panel/control surface language.

- Table surface: `var(--surface)` (`--mfl-table-surface`)
- Table border/divider color: `var(--border)` (`--mfl-table-border-color`)
- Table radius: `8px` (`--mfl-table-radius`)
- Header background/text: `var(--header-bg)` / `var(--text)` (`--mfl-table-header-background` / `--mfl-table-header-text-color`)
- Sortable-header hover background: `var(--surface-muted)` (`--mfl-table-sort-hover-background`)
- Row-hover background: `var(--row-hover)` (`--mfl-table-row-hover-background`)
- Standard desktop header/body typography: `12px` / `14px` (`--mfl-table-header-font-size` / `--mfl-table-row-font-size`)

The shared player table and equivalent Advanced Settings surface/header/divider roles consume these foundations. Advanced Settings retains its smaller row/header typography, sticky cells, and Contracts-cell hover behavior. Mobile sticky Name cells reuse the same table surface/header/row-hover tokens while retaining their stronger stuck separator and responsive geometry.

Uniform Width remains the only numeric player-table column-width contract.

- Header height: `38px`
- Body row height: `34px`
- Outer row pitch: `39px`
- Column percentages remain owned by the `--mfl-table-col-*` variables
- Responsive table typography and geometry remain in the responsive owner and may scale at the existing breakpoints
- Evaluation-specific geometry, loading surfaces, table action controls, sticky mechanics, and specialist cell states remain domain-owned

## Motion

`motion.css` owns the timing scale:

- Fast: `120ms`
- Tooltip: `170ms`
- Standard: `180ms`
- Expand: `200ms`
- Slow: `220ms`

Equivalent transitions should consume these tokens when the semantic timing is the same.

## Dropdown mechanics

`dropdowns.css` remains the specialist mechanics owner:

- Gap: `8px`
- Maximum height: `min(320px, calc(100vh - 16px))`
- Chevron inset: `10px`
- Open/close positioning, native picker enhancement, and responsive/menu-specific geometry remain local to this owner.
- Dropdown visual surface/radius/shadow values are foundation-owned and consumed by `dropdowns.css`; they are not mechanics literals.

Inline selectors such as the Evaluation position selector may intentionally use different geometry.

## Scrollbars

`scrollbars.css` owns:

- Normal size: `8px`
- Compact size: `5px`
- Track end inset: `4px`
- Theme-derived thumb, hover, and active colors

## Stacking

`stacking.css` owns the semantic global z-index scale:

- Content: `0`
- Navigation: `300`
- Mobile navigation: `310`
- Dropdown: `400`
- Chrome: `500`
- Floating tooltip: `600`
- Selection: `700`
- Table action menu: `720`
- Busy shield: `740`
- Highest ordinary UI: `780`
- Modal: `900`
- Critical modal: `1000`
- Toast: `1100`

Component-local z-index values stay below the global application layers.

## Chosen normalizations for v1.127.12

1. Filter-rule removal uses the theme-aware global `--danger` value instead of hard-coded `#ff2020`.
2. Bug Report uses the same `8px` dialog radius as the other shared dialogs instead of `10px`.
3. Semantic destructive/error UI uses `--danger` end to end. This includes Bug Report errors, Watchlist and Evaluation delete actions, Add Watchlist validation, Settings invalid/discard states, wallet opt-out, and destructive hover/focus states that previously used separate fixed reds such as `#e06b6b`, `#ff8a8a`, `#c92a2a`, `#d84b4b`, `#ff6b6b`, and `#e95656`.
4. Page/table title typography and repeated page-section vertical rhythm use the shared `--mfl-page-title-*` / `--mfl-page-section-gap` contracts. Phone and compact-phone title sizes override the same semantic token instead of redefining `.tablePageTitle`.
5. Main page gutters and block insets use the shared `--mfl-page-gutter-inline` / `--mfl-page-inset-block-*` contracts while responsive safe-area logic remains in the responsive owner.
6. Equivalent section headings use the shared standard/compact section-title typography contracts; Player and Evaluation keep their domain-specific heading geometry.
7. Equivalent ordinary content surfaces consume `--mfl-radius-panel` without collapsing dialog, control, table, Player, or Evaluation radius ownership into one token.
8. Ordinary keyboard focus consumes shared ring color/width/offset tokens while specialist interaction states remain locally owned.
9. Repeated small-label and secondary metadata roles consume the shared 12px/11px metadata scale with 700/800 weight variants.
10. Ordinary form/status feedback uses one 12px/1.25 helper contract with soft normal text and stronger danger-derived error feedback; search hints, empty states, table states, and domain-specific data messages remain separate.
11. Sidebar/mobile navigation icons consume the shared 18px navigation-icon contract, while Search and Filters consume the shared 17px ordinary-control icon contract; numerically similar specialist icons remain locally owned.
12. Standard View/Filters controls consume one 14px control-label size and 700 weight, while equivalent selector controls consume the shared line-height foundation without flattening smaller Stats or Player-specific sizes.
13. Equivalent ordinary Home, Stats, Settings, and Privacy panels consume shared surface background and normal/strong border contracts alongside the shared panel radius; specialist surfaces keep local ownership.
14. View, Filters, Search, and refresh-first-paint View controls consume shared ordinary resting/hover surface-state contracts, while navigation, Stats, Player, dropdown, destructive, opt-in, and other specialist states remain locally owned.
15. Equivalent table surfaces, headers, dividers, sortable-header hover, row hover, and standard desktop table typography consume Table-domain semantic foundations from `styles.css`; Uniform Width, responsive geometry, Advanced Settings specialist interactions, Evaluation geometry, loading surfaces, and table action controls keep their existing owners.
16. Ordinary modal/dialog shells consume shared backdrop, surface, border/divider, radius, and shadow foundations; responsive owners keep dimensions and layout only.
17. Ordinary dropdown/menu shells and option states consume shared dropdown visual foundations while `dropdowns.css` keeps mechanics and specialist menu geometry.
18. Tooltip, dropdown, modal, and mobile-navigation shadows each have one semantic source and canonical consumer.
19. The final ownership audit removes retired semantic-token references and rejects responsive re-ownership of shared dialog visuals.

## What must remain intentionally separate

Do not globalize a value merely because two numbers or colors match. In particular, preserve intentional differences between:

- desktop / tablet / phone / compact layouts
- standard `40px` and compact `36px` controls
- normal controls and tiny steppers/table actions
- shared navigation/control icons and specialist Account/Evaluation/Player/table/branding/data icons
- content-panel, control, dialog/popover, table, Player/Evaluation, and pill radii
- ordinary focus rings and specialist table/dropdown/selected interaction states
- ordinary helper/status feedback and domain-specific empty/loading/data states
- tooltip, dropdown, modal, and mobile-navigation shadows
- topbar/footer chrome and main page-content gutters
- Player/Evaluation-specific geometry
- page-level semantic rhythm and component-internal spacing
- data visualization/game-state colors such as progression, Training deltas, and difficulty/status scales

When a new value is genuinely global, add it to the appropriate canonical owner and update validation so a competing one-off literal cannot silently reappear.

## Page-start ownership (issue #923)

The main scroller owns the complete **10px header-to-content gap** on desktop and mobile. First title rows and static page roots add no leading margin. Measure the gap from the topbar bottom border to the first title/content block border at scroll position zero, not to font glyphs. Home and locked/opt-in feedback keep their intentional centered compositions inside the shell. Player starts with its hero; Evaluation retains its responsive title/action grid.

Mobile consumes the same inset token and preserves safe-area gutters and navigation clearance. Reading widths, Player/Evaluation widths, footer floors and component-internal spacing remain with their existing owners. The sidebar top offset consumes the existing header-height token.
