# NAV-03 — Section discoverability, active route and wallet access (#1034)

## Information architecture audit

| Destination | Public/guest | Opted out | Verified opt-in | Active route |
| --- | --- | --- | --- | --- |
| Home (brand) | Public | Public | Public | Brand has aria-current on Home only |
| Database | Public | Public | Public | Sidebar Database |
| MFL | Public | Public | Public | Sidebar MFL, including /mfl/stats |
| Progression | Not listed without permission | Hidden without permission | Listed only if explicit progression permission allowed | Sidebar Progression |
| Evaluation | Public plain and share route | Public plain and share route | Can save/load private evaluations | Sidebar Evaluation |
| Watchlist | Link opens existing opt-in shell | Link opens opt-in shell | Full account features | Sidebar Watchlist |
| My Players | Link opens opt-in shell | Link opens opt-in shell | Full owned players | Sidebar My Players |
| My Clubs | Link opens opt-in shell | Link opens opt-in shell | Full owned clubs | Sidebar My Clubs |
| Planner | Public shared plans possible | Shared-plan URLs possible, saved/private require opt-in | Save/edit/share available | Sidebar Planner |
| Settings | Link opens opt-in shell | Link opens opt-in shell | Account settings | Sidebar Settings (desktop); mobile via existing account menu |
| Player/Club/Agent | Public individual routes | Public individual routes | Public individual routes | No invented sidebar entry; current-page marker cleared |

## Problem

The visual `active` class on sidebar links did not announce the current page to assistive technology. The first-paint stylesheet painted the selected sidebar destination before hydration, but no `aria-current` existed until this change. The first-paint `data-stored-progression-access` flag was set from a cached wallet permission and not consistently updated on live opt-in, opt-out or permission resolution, leaving Progression undiscoverable until refresh. Wallet-protected links stayed navigable to the locked opt-in shell, but the link itself gave no explanation to screen-reader users.

## NAV-03A/B implementation

- Preserve all existing links and their precise desktop three-row/sidebar geometry, mobile bottom rail, and mobile Settings parking. **Do not add tabs or new navigation groups.**
- Initial inline chrome sets `aria-current="page"` on the selected sidebar anchor or Home brand before the shared core loads, using the canonical initial-table/page flags. Shared static route chrome maintains exactly one `aria-current` on navigation, view changes and browser Back/Forward; entity routes with no sidebar destination have no selected sidebar item.
- Protected links (Watchlist, My Players, My Clubs, Settings, Planner) remain keyboard-clickable. For guest/opted-out accounts, the static nav owner adds a meaningful `aria-description` (“Dapper opt-in required…”; Planner distinguishes public shared plans). The description is removed immediately when verified opt-in exists. Do **not** set `disabled`, `aria-disabled`, or hide these links, since locked routes are valid destinations and shared plans can be public.
- The established permission/session owner updates `data-stored-wallet-opt-in` and `data-stored-progression-access` as live permissions change, then asks passive chrome to resynchronize descriptions. This fixes a stale Progression link on desktop and mobile without overriding the permission security gate or changing the locked shell.
- No new CSS, breakpoints, animation, hover tooltips or navigation routes.

## Automated tests

- `validate-nav03-navigation-state.mjs` validates the destination matrix, first-paint and runtime semantic owners, no duplicate owner, protected link semantics, live permission flags and mobile Settings placement. Registered in `validate-all.mjs`.
- Existing real Chromium routing regression checks `aria-current`, active visual state, guest/verified opt-in descriptions, Progression computed visibility, Home brand and locked links on direct refresh and cached route return, plus Privacy and real Back/Forward navigation.
- Full Site Quality, Windows Next dev smoke, Mobile first-paint, Table Header and exact generated-head parity.
  
## NAV-03C (final gate, pending)

Verify actual wallet permission transitions for guest/opt-out/opt-in (including Progression denied/granted/revoked), mobile bottom navigation at 390px/900px, Safari iPhone VoiceOver link names and descriptions, keyboard tab/Shift+Tab, Account Settings parking, Home brand, deep-link refresh and Back/Forward across Player/Club/Evaluation/Planner/Watchlist/Settings. Do not claim these are completed based on the CI fixture. Single Vercel deployment only when issue #1034 is ready.
