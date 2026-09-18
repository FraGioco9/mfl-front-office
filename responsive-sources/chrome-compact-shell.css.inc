/* One responsive icon scale from small phones to large desktop.
 * 360px keeps the refined tiny-screen sizes; 1664px reaches the normal desktop geometry.
 */
@media (max-width: 1664px) {
  :root {
    --mfl-responsive-shell-search-icon-size: clamp(14px, calc(13.171779px + 0.230061vw), 17px);
    --mfl-responsive-shell-account-icon-size: clamp(15px, calc(14.171779px + 0.230061vw), 18px);
    --mfl-responsive-shell-theme-icon-size: clamp(16px, calc(14.343558px + 0.460123vw), 22px);
    --mfl-responsive-navigation-icon-size: clamp(14px, calc(12.895706px + 0.306748vw), 18px);
    --mfl-icon-size-navigation: var(--mfl-responsive-navigation-icon-size);

    --mfl-responsive-table-listing-icon-size: clamp(6px, calc(4.343558px + 0.460123vw), 12px);
    --mfl-responsive-table-flag-size: clamp(10px, calc(7.791411px + 0.613497vw), 18px);
    --mfl-responsive-table-age-marker-size: clamp(8px, calc(5.791411px + 0.613497vw), 16px);
    --mfl-responsive-table-note-icon-size: clamp(7px, calc(5.067485px + 0.536810vw), 14px);
    --mfl-responsive-table-rarity-size: clamp(5px, calc(4.171779px + 0.230061vw), 8px);
    --mfl-responsive-table-checkbox-size: clamp(10px, calc(8.343558px + 0.460123vw), 16px);
    --mfl-responsive-table-checkbox-check-width: clamp(6px, calc(4.895706px + 0.306748vw), 10px);
    --mfl-responsive-table-checkbox-check-height: clamp(4px, calc(2.895706px + 0.306748vw), 8px);
    --mfl-responsive-table-action-size: clamp(13px, calc(11.067485px + 0.536810vw), 20px);
    --mfl-responsive-table-action-icon-size: clamp(8px, calc(6.895706px + 0.306748vw), 12px);
    --mfl-responsive-table-sort-arrow-half-width: clamp(2px, calc(1.447853px + 0.153374vw), 4px);
    --mfl-responsive-table-sort-arrow-height: clamp(3px, calc(2.171779px + 0.230061vw), 6px);
    --mfl-responsive-table-sort-arrow-gap: clamp(1px, calc(0.447853px + 0.153374vw), 3px);
    --mfl-responsive-table-listing-content-size: var(--mfl-responsive-table-action-size);
  }

  .topbar .searchButton .searchIcon {
    flex-basis: var(--mfl-responsive-shell-search-icon-size);
    width: var(--mfl-responsive-shell-search-icon-size);
    height: var(--mfl-responsive-shell-search-icon-size);
  }

  #accountButton .accountButtonIcon {
    width: var(--mfl-responsive-shell-account-icon-size);
    height: var(--mfl-responsive-shell-account-icon-size);
  }

  .themeButton .themeModeIcon {
    width: var(--mfl-responsive-shell-theme-icon-size);
    height: var(--mfl-responsive-shell-theme-icon-size);
  }

  .menuRail .navButton .navEmoji {
    flex-basis: var(--mfl-responsive-navigation-icon-size);
    width: var(--mfl-responsive-navigation-icon-size);
    height: var(--mfl-responsive-navigation-icon-size);
    font-size: var(--mfl-responsive-navigation-icon-size);
    line-height: var(--mfl-responsive-navigation-icon-size);
  }
}

/* Age-adjacent status markers need a quieter scale than the other table controls.
 * Keep <=700px behavior intact, hold around 10px near the mobile/tablet handoff,
 * then grow gradually through the compact shell before rejoining the 16px desktop size.
 */
@media (min-width: 701px) and (max-width: 900px) {
  :root {
    --mfl-responsive-table-age-marker-size: 10px;
  }
}

@media (min-width: 901px) and (max-width: 1366px) {
  :root {
    --mfl-responsive-table-age-marker-size: clamp(10px, calc(6.124731px + 0.430108vw), 12px);
  }
}

@media (min-width: 1367px) and (max-width: 1664px) {
  :root {
    --mfl-responsive-table-age-marker-size: clamp(12px, calc(-6.410774px + 1.346801vw), 16px);
  }
}

/* Compact application shell for the intermediate 901-1366px range.
 * Content-specific phone layouts remain owned by the existing <=900/520/380 layers.
 */
@media (min-width: 901px) and (max-width: 1366px) {
  :root {
    --pinned-sidebar-width: 0px;
    --mobile-nav-height: 58px;
    --mobile-nav-overlay-clearance: 126px;
    --mfl-page-gutter-inline: 12px;
    --mfl-page-inset-block-end: max(calc(var(--mobile-nav-height) + 18px), env(safe-area-inset-bottom));
  }

  html,
  body {
    max-width: 100%;
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
    text-align: center;
  }

  .topbar .searchButton .searchLabel {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--mfl-responsive-shell-search-icon-size);
    height: var(--mfl-responsive-shell-search-icon-size);
    gap: 0;
  }

  .topbar .searchButton .searchLabelText,
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

  .topbar .searchButton .searchIcon {
    flex: 0 0 var(--mfl-responsive-shell-search-icon-size);
    width: var(--mfl-responsive-shell-search-icon-size);
    height: var(--mfl-responsive-shell-search-icon-size);
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

  .themeButton {
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

  .accountMenu {
    width: 44px;
    flex: 0 0 44px;
  }

  #accountButton {
    width: 44px;
    min-width: 44px;
    max-width: 44px;
    height: 44px;
    min-height: 44px;
    max-height: 44px;
    overflow: hidden;
    gap: 0;
    padding: 0;
  }

  #accountButton .accountButtonIcon {
    width: var(--mfl-responsive-shell-account-icon-size);
    height: var(--mfl-responsive-shell-account-icon-size);
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
    box-shadow: var(--mfl-shadow-mobile-navigation);
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
    flex: 0 0 var(--mfl-responsive-navigation-icon-size);
    width: var(--mfl-responsive-navigation-icon-size);
    height: var(--mfl-responsive-navigation-icon-size);
    color: inherit;
    font-size: var(--mfl-responsive-navigation-icon-size);
    line-height: var(--mfl-responsive-navigation-icon-size);
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
    padding: var(--mfl-page-inset-block-start) var(--mfl-page-gutter-inline) var(--mfl-page-inset-block-end);
    overflow-x: hidden;
  }

  .selectionBar {
    width: min(520px, calc(100vw - 24px - env(safe-area-inset-left) - env(safe-area-inset-right)));
    bottom: calc(var(--mobile-nav-overlay-clearance) + env(safe-area-inset-bottom));
  }

  .toastMessage {
    bottom: calc(var(--mobile-nav-overlay-clearance) + env(safe-area-inset-bottom));
  }
}
