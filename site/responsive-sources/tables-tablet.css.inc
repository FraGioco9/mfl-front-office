
  .tablePageTitle,
  .evaluationTitleRow {
    margin-top: 2px;
  }

  .viewsScrollerShell {
    position: relative;
    width: 100%;
    max-width: 100%;
    clip-path: inset(0);
  }

  .views {
    --mfl-views-gap: 6px;
    position: relative;
    display: flex;
    flex-wrap: nowrap;
    gap: var(--mfl-views-gap);
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
    overflow-y: hidden;
    overscroll-behavior-x: auto;
    touch-action: pan-y;
  }

  .views.mflViewsOverflowing {
    overflow-x: auto;
    overscroll-behavior-x: none;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x pan-y;
  }

  #progressionPage .views::before,
  #progressionPage .views::after,
  #progressionPage .quickFilters::before,
  #progressionPage .quickFilters::after {
    content: "";
    position: absolute;
    top: 50%;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }

  #progressionPage .views::before {
    right: -2px;
    z-index: 3;
    width: 86px;
    height: 48px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      color-mix(in srgb, var(--page-bg) 54%, transparent) 38%,
      color-mix(in srgb, var(--page-bg) 88%, transparent) 70%,
      var(--page-bg) 100%
    );
    transform: translateY(-50%);
  }

  #progressionPage .views::after {
    right: 6px;
    z-index: 4;
    width: 18px;
    height: 18px;
    background: var(--text-soft);
    -webkit-mask: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='black'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpath%20d='M5%2012h14'/%3E%3Cpath%20d='m12%205%207%207-7%207'/%3E%3C/svg%3E") center / contain no-repeat;
    mask: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='black'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpath%20d='M5%2012h14'/%3E%3Cpath%20d='m12%205%207%207-7%207'/%3E%3C/svg%3E") center / contain no-repeat;
    transform: translateY(-50%);
  }

  #progressionPage .quickFilters::before {
    right: -2px;
    z-index: 3;
    width: 60px;
    height: 28px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      color-mix(in srgb, var(--page-bg) 54%, transparent) 38%,
      color-mix(in srgb, var(--page-bg) 88%, transparent) 70%,
      var(--page-bg) 100%
    );
    transform: translateY(-50%);
  }

  #progressionPage .quickFilters::after {
    right: 5px;
    z-index: 4;
    width: 14px;
    height: 14px;
    background: var(--text-soft);
    -webkit-mask: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='black'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpath%20d='M5%2012h14'/%3E%3Cpath%20d='m12%205%207%207-7%207'/%3E%3C/svg%3E") center / contain no-repeat;
    mask: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20fill='none'%20stroke='black'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpath%20d='M5%2012h14'/%3E%3Cpath%20d='m12%205%207%207-7%207'/%3E%3C/svg%3E") center / contain no-repeat;
    transform: translateY(-50%);
  }

  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded) #progressionPage > .views.mflViewsOverflowing::before,
  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded) #progressionPage > .views.mflViewsOverflowing::after,
  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded) #progressionPage > .quickFilters.mflViewsOverflowing::before,
  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded) #progressionPage > .quickFilters.mflViewsOverflowing::after {
    opacity: 0.92;
    visibility: visible;
  }

  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded) #progressionPage .views.mflViewsOverflowing {
    box-shadow: inset -96px 0 96px -69px var(--page-bg);
  }

  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded) #progressionPage .quickFilters.mflViewsOverflowing {
    box-shadow: inset -72px 0 72px -52px var(--page-bg);
  }

  .viewsScrollButton {
    position: absolute;
    top: 50%;
    z-index: 4;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    min-width: 30px;
    height: 30px;
    min-height: 30px;
    margin: 0;
    padding: 6px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--text-soft);
    box-shadow: none;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    cursor: pointer;
    transform: translateY(-50%) scale(0.94);
    transition:
      opacity 180ms ease,
      transform 180ms ease,
      visibility 0s linear 180ms;
  }

  .viewsScrollButton.mflViewsScrollButtonVisible {
    opacity: 0.92;
    visibility: visible;
    pointer-events: auto;
    transform: translateY(-50%) scale(1);
    transition-delay: 0s;
  }

  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded) .viewsScrollerShell .viewsScrollButton {
    transition: none;
  }

  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded) .viewsScrollerShell:has(> .mflViewsOverflowing) > .viewsScrollButtonRight {
    opacity: 0.92;
    visibility: visible;
    pointer-events: auto;
    transform: translateY(-50%) scale(1);
  }

  .viewsScrollButtonRight {
    right: 0;
  }

  .viewsScrollButtonLeft {
    left: 0;
  }

  .viewsScrollButton::before {
    content: "";
    position: absolute;
    top: -9px;
    bottom: -9px;
    width: 86px;
    pointer-events: none;
  }

  .viewsScrollButtonRight::before {
    right: -2px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      color-mix(in srgb, var(--page-bg) 54%, transparent) 38%,
      color-mix(in srgb, var(--page-bg) 88%, transparent) 70%,
      var(--page-bg) 100%
    );
  }

  .viewsScrollButtonLeft::before {
    left: -2px;
    background: linear-gradient(
      270deg,
      transparent 0%,
      color-mix(in srgb, var(--page-bg) 54%, transparent) 38%,
      color-mix(in srgb, var(--page-bg) 88%, transparent) 70%,
      var(--page-bg) 100%
    );
  }

  .viewsScrollButton:hover,
  .viewsScrollButton:focus-visible,
  .viewsScrollButton:active {
    background: transparent;
    opacity: 1;
  }

  .viewsScrollButton svg {
    position: relative;
    z-index: 1;
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .viewsScrollButtonLeft svg {
    transform: scaleX(-1);
  }

  .viewButton {
    flex: 0 0 100px;
    width: 100px;
    min-width: 100px;
    max-width: 100px;
    height: 44px;
    font-size: 12px;
    white-space: nowrap;
  }

  .watchlistSwitcher,
  .watchlistSwitcher.mflMobileWatchlistSwitcher {
    flex: 1 0 100%;
    width: 100%;
    min-width: 0;
    margin-left: 0;
  }

  .watchlistSwitcher.mflMobileWatchlistSwitcher {
    margin-top: 6px;
    margin-bottom: 5px;
  }

  .watchlistSwitcherLabel {
    flex: 0 0 auto;
  }

  .watchlistButton {
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
  }

  .watchlistDropdown {
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }

  #progressionPage > .quickFilters {
    height: 46px;
    min-height: 46px;
    margin-bottom: 0;
    padding: 0;
    align-items: flex-start;
  }

  .quickFiltersScrollerShell {
    position: relative;
    height: 46px;
    min-height: 46px;
    margin-bottom: 0;
  }

  .quickFiltersScrollerShell > .quickFilters {
    height: 28px;
    min-height: 28px;
    margin-bottom: 0;
    padding: 0;
  }

  .quickFiltersScrollerShell:has(> .quickFilters.mflViewsOverflowing) > .viewsScrollButton {
    top: 14px;
  }

  .quickFiltersScrollerShell .viewsScrollButton {
    width: 24px;
    min-width: 24px;
    height: 24px;
    min-height: 24px;
    padding: 5px;
  }

  .quickFiltersScrollerShell .viewsScrollButton::before {
    top: -2px;
    bottom: -2px;
    width: 60px;
  }

  .quickFiltersScrollerShell .viewsScrollButton svg {
    width: 14px;
    height: 14px;
  }

  .quickFilters {
    position: relative;
    display: flex;
    flex-direction: row;
    align-items: center;
    flex-wrap: nowrap;
    gap: 8px;
    width: 100%;
    max-width: 100%;
    margin-bottom: 0;
    padding: 0;
    overflow-x: hidden;
    overflow-y: hidden;
    overscroll-behavior-x: auto;
    touch-action: pan-y;
  }

  .quickFilters.mflViewsOverflowing {
    overflow-x: auto;
    overscroll-behavior-x: none;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x pan-y;
  }

  .quickFilters label {
    flex: 0 0 auto;
    min-height: 28px;
    gap: 5px;
    padding: 0;
    font-size: 12px;
    line-height: 1.1;
    white-space: nowrap;
  }

  .quickFilters input[type="checkbox"] {
    flex: 0 0 16px;
    width: 16px;
    min-width: 16px;
    height: 16px;
    border-radius: 4px;
  }

  #progressionPage .watchlistPlayerCount:not([hidden]) {
    display: flex;
    align-items: center;
    width: 100%;
    height: 14px;
    min-height: 14px;
    margin: 0;
    color: var(--text-soft);
    font-size: 11px;
    line-height: 1;
    white-space: nowrap;
  }

  #progressionPage .quickFiltersScrollerShell + .watchlistPlayerCount:not([hidden]) {
    position: static;
    margin-top: -16px;
    margin-bottom: 2px;
  }

  #progressionPage > .quickFilters > .watchlistPlayerCount:not([hidden]) {
    position: absolute;
    top: 30px;
    left: 0;
  }

  #progressionPage > .controlsBar {
    display: none;
  }

  #openFiltersButton {
    flex: 0 0 100px;
    width: 100px;
    min-width: 100px;
    max-width: 100px;
  }

  #filterSummary {
    grid-column: 1 / -1;
    align-items: center;
    justify-content: center;
    height: 28px;
  }

  #progressionPage .tableShell {
    max-width: 100%;
    overflow: hidden;
  }

  #progressionPage .tableScroller,
  .tableScroller {
    max-width: 100%;
    overflow-x: auto;
    overflow-y: visible;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
  }

  #progressionPage .playerTableScroller table {
    width: 100%;
    min-width: 760px;
    max-width: none;
  }

  .tableScroller table :is(th, td) {
    padding-inline: 4px;
  }

  #progressionPage .playerTableScroller :is(th, td) {
    padding-inline: 1px;
  }

  #progressionPage .playerTableScroller th {
    font-size: 10px;
  }

  #progressionPage .playerTableScroller td {
    font-size: 12px;
  }

  #progressionPage .playerTableScroller .flagImage {
    width: 16px;
    height: 16px;
  }

  .advancedPlayerTable {
    min-width: 620px;
    font-size: 11px;
  }

  .advancedPlayerTable thead th { height: 28px; }
  .advancedPlayerTable tbody :is(th, td) { height: 26px; }
  .advancedPlayerTable :is(th, td) { padding-inline: 2px; }

  .advancedPlayerTable thead th {
    font-size: 9px;
  }

  .evaluationSummaryShell .tableScroller,
  .evaluationTableShell .tableScroller {
    overflow-x: auto;
  }

  .evaluationTableShell {
    --mfl-evaluation-table-header-height: 35.625px;
    position: relative;
  }

  .evaluationTableShell::before,
  .evaluationTableShell::after {
    content: "";
    position: absolute;
    top: var(--mfl-evaluation-table-body-top, var(--mfl-evaluation-table-header-height));
    bottom: 0;
    z-index: 2;
    width: 54px;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 140ms ease, visibility 0s linear 140ms;
  }

  .evaluationTableShell::before {
    left: 0;
    background: linear-gradient(90deg, var(--page-bg) 0%, color-mix(in srgb, var(--page-bg) 92%, transparent) 34%, color-mix(in srgb, var(--page-bg) 55%, transparent) 68%, transparent 100%);
  }

  .evaluationTableShell::after {
    right: 0;
    background: linear-gradient(270deg, var(--page-bg) 0%, color-mix(in srgb, var(--page-bg) 92%, transparent) 34%, color-mix(in srgb, var(--page-bg) 55%, transparent) 68%, transparent 100%);
  }

  .evaluationTableShell.mflPlayerTableCanScrollLeft::before,
  .evaluationTableShell.mflPlayerTableCanScrollRight::after {
    opacity: 0.94;
    visibility: visible;
    transition-delay: 0s;
  }

  .evaluationSummaryTable {
    min-width: 480px;
  }

  .evaluationTableShell .evaluationTable {
    min-width: 540px;
  }

  .pager {
    left: 0;
    width: 100%;
    gap: 8px;
  }

  .pager button {
    width: auto;
    min-width: 82px;
    min-height: 44px;
    flex: 0 0 auto;
  }

  #pageText {
    min-width: 0;
    flex: 1 1 auto;
  }

  .selectionBar {
    width: calc(100vw - 24px);
    max-width: 520px;
    flex-wrap: wrap;
    justify-content: center;
    bottom: var(--mobile-nav-overlay-clearance);
  }

  .toastMessage {
    bottom: var(--mobile-nav-overlay-clearance);
  }

  .selectionSummary,
  .selectionActions {
    min-width: 0;
  }

  .selectionActions {
    flex-wrap: wrap;
    justify-content: center;
  }

  .modalBackdrop {
    padding: 8px;
  }

  .searchDialog {
    width: min(680px, calc(100vw - 24px));
    max-width: calc(100vw - 24px);
    height: auto;
    max-height: calc(100dvh - 24px);
  }

  .filtersDialog {
    width: min(640px, calc(100vw - 16px));
    max-width: calc(100vw - 16px);
    height: auto;
    max-height: calc(100dvh - 16px);
    overflow: hidden;
  }

  .advancedSettingsDialog,
  .evaluationLoadDialog,
  .watchlistChoiceDialog,
  .addWatchlistDialog,
  .deleteWatchlistDialog {
    width: calc(100vw - 16px);
    max-width: calc(100vw - 16px);
    max-height: calc(100dvh - 16px);
  }

  .evaluationLoadDialog {
    height: auto;
  }

  .filtersHeader,
  .filtersFooter {
    flex: 0 0 auto;
    gap: 6px;
    padding: 6px 8px;
  }
