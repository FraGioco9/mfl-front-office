
/* Mobile parity contract.
 * Viewport-specific behavior belongs here so desktop changes cannot silently
 * gain a second, competing mobile implementation in a runtime or base style.
 */
@media (max-width: 900px) {
  html,
  body {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
    overflow-x: clip;
  }

  body {
    min-height: 100dvh;
  }

  body > .topbar {
    padding-top: max(10px, env(safe-area-inset-top));
    padding-right: max(12px, env(safe-area-inset-right));
    padding-left: max(12px, env(safe-area-inset-left));
  }

  .menuRail {
    max-width: calc(100% - 16px - env(safe-area-inset-left) - env(safe-area-inset-right));
  }

  body > #appShell > main {
    min-width: 0;
    padding-right: max(12px, env(safe-area-inset-right));
    padding-bottom: max(calc(var(--mobile-nav-height) + 18px), env(safe-area-inset-bottom));
    padding-left: max(12px, env(safe-area-inset-left));
  }

  #progressionPage,
  #progressionPage .tableShell,
  #progressionPage .tableScroller,
  .tableShell,
  .tableScroller {
    min-width: 0;
    max-width: 100%;
  }

  #progressionPage .tableShell,
  .tableShell {
    overflow: hidden;
  }

  #progressionPage .tableScroller,
  .tableShell > .tableScroller,
  .tableScroller {
    display: block;
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x pan-y;
  }

  .advancedPlayerTableSection,
  .sidebar,
  .playerAttributeViews,
  .evaluationLoadList,
  .searchBody,
  .filterBuilder,
  .advancedSettingsBody {
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x pan-y;
  }

  .views,
  .quickFilters {
    scroll-padding-inline: 10px;
  }

  .selectionBar {
    width: min(520px, calc(100vw - 24px - env(safe-area-inset-left) - env(safe-area-inset-right)));
    bottom: calc(var(--mobile-nav-overlay-clearance) + env(safe-area-inset-bottom));
  }

  .toastMessage {
    bottom: calc(var(--mobile-nav-overlay-clearance) + env(safe-area-inset-bottom));
  }

  .modalBackdrop {
    padding-top: max(8px, env(safe-area-inset-top));
    padding-right: max(8px, env(safe-area-inset-right));
    padding-bottom: max(8px, env(safe-area-inset-bottom));
    padding-left: max(8px, env(safe-area-inset-left));
  }

  .searchDialog {
    width: min(680px, 100%);
    max-width: 100%;
    max-height: calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  }

  .filtersDialog {
    --mfl-filter-box-font-size: 13px;
    --mfl-filter-box-line-height: 16px;
    --mfl-popup-close-size: 30px;
    width: min(640px, 100%);
    max-width: 100%;
    height: auto;
    max-height: calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    overflow: hidden;
  }

  .advancedSettingsDialog,
  .evaluationLoadDialog,
  .watchlistChoiceDialog,
  .addWatchlistDialog,
  .deleteWatchlistDialog {
    width: 100%;
    max-width: 100%;
    max-height: calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  }

  input:where(:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"])),
  select,
  textarea {
    font-size: 16px;
  }


  #databaseStatsPage .databaseStatsCustomFilter {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
    width: 100%;
    margin-left: 0;
  }

  html[data-initial-page="evaluation"] body #evaluationPage .evaluationSearchGroup,
  body[data-page="evaluation"] #evaluationPage .evaluationSearchGroup {
    grid-template-columns: minmax(0, 1fr);
  }

  html[data-initial-page="evaluation"] body #evaluationPage .evaluationSearch,
  body[data-page="evaluation"] #evaluationPage .evaluationSearch {
    width: 100%;
    max-width: none;
  }

  .siteFooter {
    padding-right: max(12px, env(safe-area-inset-right));
    padding-bottom: max(12px, env(safe-area-inset-bottom));
    padding-left: max(12px, env(safe-area-inset-left));
  }
}
