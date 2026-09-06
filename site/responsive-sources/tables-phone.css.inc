
@media (max-width: 520px) {
  body > .topbar {
    column-gap: 8px;
    padding-right: max(10px, env(safe-area-inset-right));
    padding-left: max(10px, env(safe-area-inset-left));
  }

  body > #appShell > main {
    --mfl-footer-page-floor: max(500px, calc(100dvh - var(--mobile-nav-overlay-clearance)));
    padding-right: max(8px, env(safe-area-inset-right));
    padding-left: max(8px, env(safe-area-inset-left));
  }

  .topbar h1 {
    font-size: 20px;
  }

  .topbar .searchButton {
    height: 38px;
  }

  #progressionPage .views {
    --mfl-views-gap: 4px;
    margin-bottom: 5px;
  }

  #progressionPage > .quickFilters {
    height: 42px;
    min-height: 42px;
    padding: 0;
  }

  #progressionPage .quickFiltersScrollerShell {
    height: 42px;
    min-height: 42px;
  }

  #progressionPage .quickFiltersScrollerShell > .quickFilters {
    height: 26px;
    min-height: 26px;
  }

  #progressionPage .quickFiltersScrollerShell:has(> .quickFilters.mflViewsOverflowing) > .viewsScrollButton {
    top: 13px;
  }

  .quickFiltersScrollerShell .viewsScrollButton {
    width: 20px;
    min-width: 20px;
    height: 20px;
    min-height: 20px;
    padding: 4px;
  }

  .quickFiltersScrollerShell .viewsScrollButton::before {
    top: -3px;
    bottom: -3px;
    width: 50px;
  }

  .quickFiltersScrollerShell .viewsScrollButton svg {
    width: 12px;
    height: 12px;
  }

  #progressionPage .quickFilters::before {
    width: 50px;
    height: 26px;
  }

  #progressionPage .quickFilters::after {
    right: 4px;
    width: 12px;
    height: 12px;
  }

  .navButton {
    padding-inline: 8px;
    font-size: 12px;
  }

  .viewButton {
    flex-basis: 74px;
    width: 74px;
    min-width: 74px;
    max-width: 74px;
    height: 32px;
    min-height: 32px;
    padding-inline: 4px;
    border-radius: 5px;
    font-size: 10px;
  }

  #progressionPage .views > #openFiltersButton {
    flex-basis: 74px;
    width: 74px;
    min-width: 74px;
    max-width: 74px;
    height: 32px;
    min-height: 32px;
    gap: 4px;
    padding: 0 5px;
    border-radius: 5px;
    font-size: 10px;
  }

  #progressionPage .filtersViewIcon {
    flex: 0 0 14px;
    width: 14px;
    height: 14px;
  }

  #progressionPage #filterSummary {
    display: inline-grid;
    flex: 0 0 13px;
    place-items: center;
    align-self: stretch;
    width: 13px;
    min-width: 13px;
    max-width: 13px;
    min-height: 0;
    height: auto;
    font-size: 9px;
    line-height: 1;
    transform: none;
  }

  #progressionPage .viewControlsSeparator {
    height: 18px;
    margin-inline: 1px;
  }

  .tablePageTitle {
    font-size: 18px;
  }

  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page="club"] #progressionPage .viewButton[data-view="attributes"]::after {
    font-size: 10px;
  }

  .homeStats {
    grid-template-columns: 1fr;
  }

  #databaseStatsPage .databaseStatsCards,
  .mflStatsCards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .playerHeroActions,
  .mflStatsFilterButtons,
  .mflStatsDistributionModeButtons {
    grid-template-columns: 1fr;
  }

  #databaseStatsPage .databaseStatsCustomFilter {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  #databaseStatsPage .databaseStatsCustomFilter > button {
    grid-column: 1 / -1;
  }

  .mflStatsFilterButtons {
    grid-template-columns: repeat(auto-fit, minmax(68px, 1fr));
  }

  .mflStatsDistributionModeButtons {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .quickFilters {
    gap: 6px;
    padding: 0;
  }

  .quickFilters label {
    min-height: 26px;
    gap: 4px;
    padding: 0;
    font-size: 11px;
    line-height: 1.1;
  }

  .quickFilters input[type="checkbox"] {
    flex-basis: 16px;
    width: 16px;
    min-width: 16px;
    height: 16px;
  }

  #progressionPage .watchlistPlayerCount:not([hidden]) {
    height: 14px;
    min-height: 14px;
    font-size: 10px;
  }

  #progressionPage .quickFiltersScrollerShell + .watchlistPlayerCount:not([hidden]) {
    margin-top: -16px;
  }

  #progressionPage > .quickFilters > .watchlistPlayerCount:not([hidden]) {
    top: 28px;
  }

  .filtersDialog {
    --mfl-filter-box-font-size: 12px;
    --mfl-filter-box-line-height: 15px;
    --mfl-popup-close-size: 28px;
    width: min(100%, 420px);
    height: auto;
    max-height: calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  }

  .filtersHeader,
  .filtersFooter {
    gap: 5px;
    padding: 5px 7px;
  }

  .filtersHeader h2 {
    font-size: 15px;
  }

  .filterBuilder {
    gap: 4px;
    padding: 6px;
  }

  .addFilterRow {
    gap: 4px;
  }

  .addFilterRow select {
    flex: 0 1 200px;
    width: min(200px, 100%);
    min-width: 0;
    max-width: 100%;
  }



  .filterRules {
    gap: 4px;
  }

  .filterRule {
    --mfl-filter-builder-inline-padding: 6px;
    --mfl-filter-remove-size: 14px;
    width: calc(100% - var(--mfl-filter-remove-strip));
    max-width: calc(100% - var(--mfl-filter-remove-strip));
    margin-left: 0;
    margin-right: var(--mfl-filter-remove-strip);
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
    grid-template-rows: 36px 36px;
    gap: 3px;
    min-height: 75px;
  }

  .filterRule > :nth-child(1) {
    grid-column: 1;
    grid-row: 1;
  }

  .filterRule > :nth-child(2) {
    grid-column: 2;
    grid-row: 1;
  }

  .filterRule > :nth-child(5) {
    position: absolute;
    top: 18px;
    right: calc(var(--mfl-filter-edge-gap) - var(--mfl-filter-builder-inline-padding) - var(--mfl-filter-remove-strip));
    width: var(--mfl-filter-remove-size);
    min-width: var(--mfl-filter-remove-size);
    max-width: var(--mfl-filter-remove-size);
    height: var(--mfl-filter-remove-size);
    min-height: var(--mfl-filter-remove-size);
    transform: translateY(-50%);
  }

  .filterRule > :nth-child(3) {
    grid-column: 1;
    grid-row: 2;
  }

  .filterRule > :nth-child(4) {
    grid-column: 2;
    grid-row: 2;
    min-width: 0;
  }


  .filterRule:first-child > :nth-child(1) {
    display: none;
  }

  .filterRule:first-child > :nth-child(2) {
    grid-column: 1 / 3;
  }

  .filterRule > :nth-child(3)[hidden] + :nth-child(4) {
    grid-column: 1 / 3;
  }

  .filterRule > select,
  .filterRule [data-filter-value] {
    min-width: 0;
    max-width: 100%;
  }

  .filterRule select[hidden] {
    display: none;
  }

  .betweenValue,
  .dateRangeValue {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 3px;
  }

  .filtersFooter {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .filtersFooter button {
    height: 36px;
    min-height: 36px;
  }

  .searchDialog {
    height: auto;
  }

  .searchBody {
    gap: 6px;
    padding: 10px;
  }

  .globalSearchControl #playerSearchInput {
    height: 36px;
    min-height: 36px;
    padding-left: 9px;
    padding-right: 36px;
    font-size: 16px;
  }

  .playerSearchClearButton {
    right: 2px;
    width: 27px;
    height: 27px;
  }

  .searchResults {
    gap: 4px;
    height: 256px;
    max-height: 256px;
    grid-auto-rows: 48px;
  }

  .searchResults.filledSearchResults {
    grid-template-rows: repeat(5, 48px);
    padding-bottom: 0;
  }

  .searchResult {
    min-height: 48px;
    padding: 6px 8px;
    border-radius: 6px;
  }

  .searchResult strong {
    font-size: 12px;
  }

  .searchResult span {
    font-size: 9px;
  }

  .searchHint {
    font-size: 9px;
  }

  #progressionPage .playerTableScroller table {
    min-width: 600px;
  }

  /* Every resolved or active mobile table view uses the same readable 760px floor. */
  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-view] #progressionPage .playerTableScroller table,
  #progressionPage:has(.viewButton.active) .playerTableScroller table {
    min-width: 760px;
  }

  #progressionPage .playerTableScroller th {
    font-size: 9px;
  }

  #progressionPage .playerTableScroller td {
    font-size: 11px;
  }

  #progressionPage .playerTableScroller .flagImage {
    width: 14px;
    height: 14px;
  }

  #progressionPage .playerTableScroller .listingCellContent {
    gap: 2px;
    padding-inline: 3px;
    font-size: 10px;
  }

  #progressionPage .playerTableScroller .listingCellIcon {
    width: 11px;
    height: 11px;
    flex-basis: 11px;
  }
