/* Canonical responsive layout owner.
 * Desktop geometry remains in styles.css; viewport-specific adaptations live here.
 * Keep new mobile/tablet media queries out of component and runtime files.
 */

html:not(.mflInitialRouteResolved):is(
  [data-initial-page^="database"],
  [data-initial-page^="mfl"],
  [data-initial-page^="progression"],
  [data-initial-page^="agents"],
  [data-initial-page^="watchlist"],
  [data-initial-page^="my-players"],
  [data-initial-page^="clubs/"],
  [data-initial-page^="club/"]
) #homePage {
  display: none;
}

@media (max-width: 1100px) {
  .topbar {
    grid-template-columns: minmax(0, 1fr) minmax(280px, 1.35fr) auto;
    gap: 12px;
    padding-inline: 18px;
  }

  .searchButton {
    min-width: 0;
  }

  .stats div {
    min-width: 96px;
    padding-inline: 12px;
  }

  #databaseStatsPage .databaseStatsCards,
  .mflStatsCards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  #evaluationPage .evaluationPlayerNameFull {
    display: none;
  }

  #evaluationPage .evaluationPlayerNameCompact {
    display: inline;
  }

  :root {
    --pinned-sidebar-width: 0px;
    --mobile-nav-height: 58px;
    --mobile-nav-overlay-clearance: 126px;
    --mfl-player-panel-gap: clamp(4px, 1vw, 8px);
    --mfl-player-panel-padding: clamp(6px, 1.5vw, 10px);
    --mfl-player-panel-radius: clamp(5px, 1.2vw, 8px);
    --mfl-player-box-gap: clamp(3px, 0.8vw, 4px);
    --mfl-player-box-height: clamp(38px, 8.4vw, 43px);
    --mfl-player-box-padding-inline: clamp(6px, 1.8vw, 10px);
    --mfl-player-contract-division-font-size: clamp(7.5px, 2vw, 10px);
    --mfl-player-profile-flag-size: calc(var(--mfl-player-value-font-size) * 1.25);
    --mfl-player-profile-icon-size: calc(var(--mfl-player-value-font-size) * 0.72);
    --mfl-player-age-icon-gap: clamp(1px, 0.35vw, 2px);
    --mfl-player-nationality-gap: calc(var(--mfl-player-age-icon-gap) + 2px);
    --mfl-player-box-radius: clamp(5px, 1.2vw, 8px);
    --mfl-player-label-font-size: clamp(9px, 2.1vw, 10px);
    --mfl-player-value-font-size: clamp(12px, 3vw, 15px);
    --mfl-player-attribute-font-size: clamp(16px, 4vw, 20px);
    --mfl-player-featured-font-size: clamp(19px, 4.8vw, 24px);
    --mfl-player-control-height: clamp(30px, 6.5vw, 34px);
    --mfl-player-attribute-view-height: clamp(24px, 5vw, 26px);
    --mfl-player-control-radius: clamp(5px, 1.2vw, 6px);
    --mfl-player-training-control-size: clamp(16px, 4vw, 20px);
    --mfl-player-training-control-gap: calc(var(--mfl-player-training-control-size) * 0.2);
    --mfl-player-training-control-radius: calc(var(--mfl-player-training-control-size) * 0.3);
    --mfl-player-training-control-font-size: calc(var(--mfl-player-training-control-size) * 0.7);
    --mfl-player-training-reset-width: calc(var(--mfl-player-training-control-size) * 2.5);
    --mfl-player-training-reset-font-size: calc(var(--mfl-player-training-control-size) * 0.55);
    --mfl-player-hero-overall-size: clamp(58px, 15vw, 84px);
    --mfl-player-portrait-height: clamp(66px, 17vw, 96px);
    --mfl-player-portrait-width: clamp(120px, 31vw, 175px);
    --mfl-player-portrait-radius: clamp(4px, 1vw, 6px);
    --mfl-player-card-radius: var(--mfl-player-panel-radius);
    --mfl-player-hero-media-gap: clamp(4px, 1vw, 6px);
    --mfl-player-hero-media-width: clamp(182px, 47vw, 265px);
    --mfl-player-hero-identity-width: 100%;
    --mfl-player-hero-identity-action-gap: 0px;
    --mfl-player-hero-identity-align-self: center;
    --mfl-player-hero-actions-align-self: stretch;
    --mfl-player-hero-actions-margin-left: 0px;
    --mfl-player-hero-section-gap: var(--mfl-player-panel-gap);
    --mfl-player-hero-overall-font-size: clamp(28px, 7.5vw, 42px);
    --mfl-player-hero-eyebrow-font-size: clamp(10px, 2.4vw, 12px);
    --mfl-player-hero-title-font-size: clamp(19px, 5vw, 25px);
    --mfl-player-hero-positions-font-size: clamp(11px, 2.8vw, 14px);
    --mfl-player-hero-action-menu-width: 100%;
    --mfl-player-hero-primary-action-width: calc(100% - 38px);
    --mfl-player-hero-action-chevron-width: 34px;
    --mfl-player-hero-action-height: clamp(32px, 7vw, 36px);
    --mfl-player-hero-action-font-size: clamp(12px, 3vw, 14px);
    --mfl-player-hero-action-gap: 4px;
    --mfl-player-hero-chevron-icon-size: clamp(13px, 3vw, 15px);
    --mfl-player-hero-menu-item-height: 40px;
    --mfl-player-hero-menu-item-font-size: clamp(11px, 2.8vw, 13px);
    --mfl-player-hero-menu-icon-size: clamp(14px, 3.2vw, 16px);
    --mfl-player-hero-menu-item-gap: clamp(5px, 1.2vw, 7px);
    --mfl-player-hero-menu-item-padding-inline: clamp(7px, 1.8vw, 10px);
    --mfl-player-hero-menu-padding: 4px;
    --mfl-player-hero-menu-offset: 5px;
  }

  html,
  body {
    max-width: 100%;
  }

  button {
    -webkit-tap-highlight-color: transparent;
  }

  button:active:not(:disabled) {
    filter: brightness(0.9);
  }

  body > .topbar {
    grid-template-columns: minmax(0, 1fr) 44px auto;
    grid-template-areas: "brand search controls";
    column-gap: 6px;
    row-gap: 0;
    height: auto;
    min-height: 0;
    padding: 10px 12px;
  }

  .topbar > :first-child {
    grid-area: brand;
    min-width: 0;
  }

  .topbar h1 {
    overflow: hidden;
    font-size: 22px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .topbar .searchButton {
    grid-area: search;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  :is(.topbar .searchButton, .themeButton) {
    flex: 0 0 44px;
    width: 44px;
    min-width: 44px;
    max-width: 44px;
    height: 44px;
    min-height: 44px;
    max-height: 44px;
    padding: 0;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
  }

  .topbar .searchButton .searchLabel {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    gap: 0;
  }

  .topbar .searchButton .searchLabelText {
    display: none;
  }

  .topbar .searchButton .searchIcon {
    flex: 0 0 22px;
    width: 22px;
    height: 22px;
  }

  .searchShortcut {
    display: none;
  }

  .headerControls {
    grid-area: controls;
    min-width: 0;
    gap: 6px;
    justify-content: flex-end;
  }

  .topbar .stats {
    display: none;
  }

  .accountMenu {
    width: 44px;
    flex: 0 0 44px;
  }

  #accountButton {
    width: 44px;
    height: 44px;
    overflow: hidden;
    gap: 0;
    padding: 0;
  }

  #accountButton > span {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    border: 0;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  #accountButton .accountButtonIcon {
    width: 20px;
    height: 20px;
  }

  #accountDropdown {
    left: auto;
    right: 0;
    width: min(190px, calc(100vw - 24px));
    transform-origin: top right;
  }

  .appShell {
    --sidebar-offset: 0px;
    position: relative;
  }

  .menuRail {
    position: absolute;
    inset: auto auto 8px 50%;
    z-index: var(--mfl-z-navigation-mobile);
    width: min(720px, calc(100% - 16px - env(safe-area-inset-left) - env(safe-area-inset-right)));
    height: var(--mobile-nav-height);
    min-height: var(--mobile-nav-height);
    padding: 4px;
    overflow: visible;
    border: 1px solid color-mix(in srgb, var(--border-strong) 72%, transparent);
    border-radius: 16px;
    background: color-mix(in srgb, var(--surface) 88%, transparent);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
    backdrop-filter: blur(14px);
    transform: translateX(-50%);
  }

  .menuButton {
    display: none;
  }

  .sidebar {
    display: flex;
    flex-direction: row;
    align-items: stretch;
    gap: 2px;
    width: 100%;
    min-height: 0;
    height: 48px;
    margin: 0;
    padding: 0;
    overflow: visible;
  }

  .sidebarGrid {
    display: contents;
  }

  .menuRail .navButton {
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: auto;
    min-width: 0;
    height: 48px;
    margin: 0;
    gap: 2px;
    padding: 4px 2px;
    overflow: visible;
    border-color: transparent;
    border-radius: 12px;
    background: transparent;
    color: var(--text-soft);
    line-height: 1;
    text-align: center;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
  }

  .menuRail .navButton .navEmoji {
    flex: 0 0 18px;
    width: 18px;
    height: 18px;
    color: inherit;
    font-size: 18px;
    line-height: 18px;
  }

  .menuRail .navButton .navText {
    display: block;
    width: max-content;
    min-height: 9px;
    max-width: none;
    margin-left: 0;
    overflow: visible;
    color: inherit;
    font-size: 9px;
    font-weight: 600;
    line-height: 1;
    text-align: center;
    text-overflow: clip;
    white-space: nowrap;
    opacity: 1;
  }

  .menuRail .navButton.active,
  .menuRail .navButton.active:hover {
    border-color: var(--primary);
    background: var(--primary);
    color: #ffffff;
    box-shadow: none;
  }

  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page="database"] #sidebar .navButton[data-page="database"],
  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page="mfl"] #sidebar .navButton[data-page="mfl"],
  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page="progression"] #sidebar .navButton[data-page="progression"],
  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page="watchlist"] #sidebar .navButton[data-page="watchlist"],
  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page="myplayers"] #sidebar .navButton[data-page="myplayers"],
  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page="agents"] #sidebar .navButton[data-page="agents"],
  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page="club"] #sidebar .navButton[data-page="club"],
  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-page="evaluation"] #sidebar .navButton[data-page="evaluation"] {
    border-color: var(--primary);
    background: var(--primary);
    color: #ffffff;
    box-shadow: none;
  }

  .menuRail .navButton:not(.active):hover:not(:disabled),
  .menuRail .navButton:not(.active):focus-visible {
    border-color: transparent;
    background: var(--row-hover);
    color: var(--text);
  }

  .menuRail #sidebar .navButton:not(.active):active {
    border-color: var(--primary);
    background: var(--primary);
    color: #ffffff;
    filter: brightness(0.9);
  }

  body.pinnedSidebarVisible main,
  body.pinnedSidebarVisible .siteFooter,
  body:not(.pinnedSidebarVisible) main,
  body:not(.pinnedSidebarVisible) .siteFooter {
    width: 100%;
    margin-left: 0;
  }

  body > #appShell > main {
    --mfl-footer-page-floor: max(560px, calc(100dvh - var(--mobile-nav-overlay-clearance)));
    padding: 4px 12px calc(var(--mobile-nav-height) + 18px);
    overflow-x: hidden;
  }

  body.pinnedSidebarVisible .myPlayersLockedPage,
  body:not(.pinnedSidebarVisible) .myPlayersLockedPage {
    left: 0;
    width: auto;
  }

  .homePage,
  .changelogPage,
  .playerPage,
  .evaluationPage,
  .settingsPage,
  .mflStatsPage,
  .progressionPage {
    max-width: 100%;
    min-width: 0;
  }

  .homePage {
    min-height: calc(100dvh - 220px);
  }

  .homeIntro p {
    font-size: 16px;
  }

  .homeStats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .homeStats span {
    font-size: 24px;
  }
