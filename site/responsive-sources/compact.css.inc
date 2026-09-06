
@media (max-width: 380px) {
  body > #appShell > main {
    --mfl-footer-page-floor: max(460px, calc(100dvh - var(--mobile-nav-overlay-clearance)));
  }

  .selectionBar {
    width: min(360px, calc(100vw - 12px - env(safe-area-inset-left) - env(safe-area-inset-right)));
    gap: 4px;
    padding: 6px 7px;
    border-radius: 6px;
  }

  .selectionSummary {
    grid-template-rows: repeat(2, 15px);
    min-width: 68px;
  }

  .selectionBar span {
    font-size: 11px;
    line-height: 14px;
  }

  .selectionBar .textButton {
    height: 22px;
    min-height: 22px;
    font-size: 10px;
    line-height: 13px;
  }

  .selectionActions {
    gap: 4px;
  }

  .selectionBar button:not(.textButton) {
    height: 30px;
    min-height: 30px;
    padding-inline: 6px;
    font-size: 10px;
  }

  .topbar h1 {
    font-size: 18px;
  }

  .navButton {
    padding-inline: 6px;
    font-size: 11px;
  }

  .viewButton {
    flex-basis: 68px;
    width: 68px;
    min-width: 68px;
    max-width: 68px;
    padding-inline: 3px;
    font-size: 9px;
  }

  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page="club"] #progressionPage .viewButton[data-view="attributes"]::after {
    font-size: 9px;
  }

  #progressionPage .views > #openFiltersButton {
    flex-basis: 68px;
    width: 68px;
    min-width: 68px;
    max-width: 68px;
    padding-inline: 4px;
    font-size: 9px;
  }

  .tablePageTitle {
    font-size: 17px;
  }

  .filtersDialog {
    --mfl-filter-box-font-size: 11px;
    --mfl-filter-box-line-height: 14px;
    --mfl-popup-close-size: 26px;
  }


  .addFilterRow select {
    flex-basis: 180px;
    width: min(180px, 100%);
    max-width: 100%;
  }


  .filterRule {
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
    grid-template-rows: 36px 36px;
    gap: 3px;
    min-height: 75px;
  }

  .filterRule > :nth-child(5) {
    width: 10px;
    min-width: 10px;
    max-width: 10px;
    height: 10px;
    min-height: 10px;
  }


  .betweenValue,
  .dateRangeValue {
    grid-template-columns: 1fr;
  }

  .filterRule:has(> :nth-child(4) > :is(.betweenValue, .dateRangeValue)),
  .filterRule:has(> :nth-child(4).betweenValue),
  .filterRule:has(> :nth-child(4).dateRangeValue) {
    grid-template-rows: 36px auto;
    min-height: auto;
  }

  .searchDialog {
    height: min(382px, calc(100dvh - 12px));
  }

  .searchResults {
    gap: 3px;
    height: 232px;
    max-height: 232px;
    grid-auto-rows: 44px;
  }

  .searchResults.filledSearchResults {
    grid-template-rows: repeat(5, 44px);
    padding-bottom: 0;
  }

  .searchResult {
    min-height: 44px;
    padding: 4px 6px;
    border-radius: 5px;
  }

  .searchResult strong {
    font-size: 11px;
  }

  .searchResult span {
    font-size: 8px;
  }

  .searchHint {
    font-size: 8px;
  }

  #progressionPage .playerTableScroller table {
    min-width: 540px;
  }

  #progressionPage .playerTableScroller th {
    font-size: 8px;
  }

  #progressionPage .playerTableScroller td {
    font-size: 10px;
  }

  .advancedPlayerTable {
    min-width: 460px;
  }

  .advancedPlayerTable thead th { height: 22px; }
  .advancedPlayerTable tbody :is(th, td) { height: 20px; }

  #evaluationPage .evaluationTableShell {
    --mfl-evaluation-table-header-height: 25px;
  }

  #evaluationPage .evaluationTableShell::before,
  #evaluationPage .evaluationTableShell::after {
    width: 40px;
  }

  #evaluationPage .evaluationSummaryTable {
    min-width: 0;
  }

  #evaluationPage .evaluationTableShell .evaluationTable {
    min-width: 460px;
  }

  #evaluationPage {
    --mfl-evaluation-header-row-height: 25px;
    --mfl-evaluation-summary-row-height: 25px;
    --mfl-evaluation-season-row-height: 21px;
  }

  #evaluationPage .evaluationSummaryTable th,
  #evaluationPage .evaluationTableShell .evaluationTable th {
    height: var(--mfl-evaluation-header-row-height);
    font-size: 8px;
  }

  #evaluationPage .evaluationSummaryTable td {
    height: var(--mfl-evaluation-summary-row-height);
    font-size: 10px;
  }

  #evaluationPage .evaluationTableShell .evaluationTable td {
    height: var(--mfl-evaluation-season-row-height);
    font-size: 10px;
  }

  #evaluationPage .evaluationButtons,
  #evaluationPage .evaluationMetrics {
    gap: 4px;
  }

  #evaluationPage .evaluationPlayerPageButton {
    padding-inline: 4px;
    font-size: 10px;
  }

  #evaluationPage .evaluationMetric {
    padding-inline: 5px;
  }

  #evaluationPage .evaluationSearchResults {
    gap: 3px;
    padding: 5px;
  }

  #evaluationPage .evaluationSearchResult {
    min-height: 44px;
    padding: 4px 6px;
    border-radius: 5px;
  }

  #evaluationPage .evaluationSearchResult strong {
    font-size: 11px;
  }

  #evaluationPage .evaluationSearchResult span {
    font-size: 8px;
  }

  #evaluationLoadModal .evaluationLoadList {
    gap: 3px;
    height: 242px;
    max-height: 242px;
    grid-auto-rows: 44px;
    padding: 4px 5px 6px;
  }

  #evaluationLoadModal .evaluationLoadResult {
    gap: 3px;
    min-height: 44px;
    padding: 4px 6px;
    border-radius: 5px;
  }

  #evaluationLoadModal .evaluationLoadResultMain strong {
    font-size: 11px;
  }

  #evaluationLoadModal .evaluationLoadResultMain span {
    font-size: 8px;
  }

  #evaluationLoadModal .evaluationLoadPresentValue {
    min-width: 56px;
    font-size: 9px;
  }

  #evaluationLoadModal .evaluationLoadActions {
    gap: 3px;
  }

  #evaluationLoadModal .evaluationLoadIconButton {
    width: 24px;
    min-width: 24px;
    height: 24px;
    min-height: 24px;
  }

  #evaluationLoadModal .evaluationLoadIconButton svg {
    width: 11px;
    height: 11px;
  }

  .mflStatsFilters {
    padding-inline: 5px;
  }

  .mflStatsFilterButtons {
    grid-template-columns: repeat(auto-fit, minmax(62px, 1fr));
    gap: 3px;
  }

  .mflStatsFilterButton {
    height: 22px;
    font-size: 9px;
  }

  .mflStatsCards article {
    min-height: 52px;
    padding: 5px 6px;
  }

  .mflStatsCards strong {
    font-size: 17px;
  }

  .mflStatsDistribution {
    padding: 5px 6px;
  }

  .mflStatsDistributionHeader h3 {
    font-size: 13px;
  }

  .mflStatsDistributionModeButton {
    height: 24px;
    min-height: 24px;
    font-size: 9px;
  }

  .mflStatsAgeDistribution {
    min-height: 185px;
    height: clamp(185px, 40dvh, 260px);
  }

  .mflStatsHistogram {
    width: 100%;
    min-width: 460px;
    gap: 1px;
    padding-top: 20px;
  }

  .mflStatsHistogramBar {
    min-height: 78px;
  }

  .mflStatsHistogramLabel {
    min-height: 10px;
    font-size: 6px;
  }

  .changelogPage {
    margin-top: 6px;
  }

  .changelogPage h2 {
    margin-bottom: 2px;
    font-size: 17px;
  }

  .changelogPage > p {
    margin-bottom: 8px;
    font-size: 11px;
  }

  .changelogList {
    gap: 5px;
  }

  .changelogMinorSection {
    border-radius: 4px;
  }

  .changelogMinorToggle {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px;
    min-height: 34px;
    padding: 5px 6px;
  }

  .changelogMinorVersion {
    font-size: 12px;
  }

  .changelogMinorMeta {
    grid-column: 1;
    grid-row: 2;
    font-size: 9px;
  }

  .changelogMinorChevron {
    grid-column: 2;
    grid-row: 1 / span 2;
    font-size: 12px;
  }

  .changelogPatchList {
    padding: 1px 4px;
  }

  .changelogPatchList li {
    grid-template-columns: 1fr;
    gap: 1px;
    min-height: 0;
    padding: 4px 3px;
    align-items: start;
  }

  .changelogPatchList span,
  .changelogPatchList p {
    min-height: 0;
    font-size: 10px;
  }
}
