
  .advancedPlayerTable {
    min-width: 500px;
    font-size: 10px;
  }

  .advancedPlayerTable thead th { height: 24px; }
  .advancedPlayerTable tbody :is(th, td) { height: 22px; }
  .advancedPlayerTable :is(th, td) { padding-inline: 1px; }

  .advancedPlayerTable thead th {
    font-size: 8px;
  }

  #evaluationPage {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-content: start;
    column-gap: 6px;
    row-gap: 6px;
  }

  /* Route-ready Evaluation has a higher-specificity base visibility rule that uses block flow. */
  html body[data-page="evaluation"] #evaluationPage {
    display: grid;
  }

  #advancedSettingsModal,
  #evaluationLoadModal {
    padding:
      max(8px, env(safe-area-inset-top))
      max(8px, env(safe-area-inset-right))
      max(8px, env(safe-area-inset-bottom))
      max(8px, env(safe-area-inset-left));
  }

  #advancedSettingsModal .advancedSettingsDialog,
  #evaluationLoadModal .evaluationLoadDialog {
    width: min(100%, 420px);
    max-width: 420px;
    max-height: calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    border-radius: 8px;
  }

  #evaluationLoadModal .evaluationLoadDialog {
    height: auto;
  }

  #advancedSettingsModal .filtersHeader,
  #evaluationLoadModal .filtersHeader {
    min-height: 42px;
    padding: 7px 9px;
  }

  #advancedSettingsModal .filtersHeader h2,
  #evaluationLoadModal .filtersHeader h2 {
    font-size: 15px;
  }

  #advancedSettingsModal .advancedSettingsBody {
    gap: 8px;
    padding: 8px 10px 10px;
  }

  #advancedSettingsModal .advancedSettingsSection {
    gap: 6px;
  }

  #advancedSettingsModal .advancedSettingsSection h3 {
    font-size: 13px;
  }

  #advancedSettingsModal .advancedSettingHeader,
  #advancedSettingsModal .advancedLateSeasonRewardSetting {
    align-items: center;
    flex-direction: row;
    gap: 8px;
  }

  #advancedSettingsModal .advancedSettingHeader {
    min-height: 36px;
  }

  #advancedSettingsModal .advancedSettingHeaderControl,
  #advancedSettingsModal .advancedRewardRateControlGroup {
    justify-content: flex-end;
    width: auto;
    margin-left: auto;
    gap: 6px;
  }

  #advancedSettingsModal .advancedMflUsdResetButton,
  #advancedSettingsModal .advancedRewardRateResetButton {
    height: 32px;
    min-height: 32px;
  }

  #advancedSettingsModal .advancedMflUsdControl {
    grid-template-columns: 20px 92px;
    gap: 4px;
  }

  #advancedSettingsModal .advancedMflUsdInput {
    height: 36px;
    padding: 3px 8px;
  }

  #advancedSettingsModal .advancedMflUsdStepper button,
  #advancedSettingsModal .advancedRewardRateStepper button {
    width: 20px;
    height: 17px;
    min-height: 17px;
  }

  #advancedSettingsModal .advancedSettingValue {
    width: 92px;
    min-width: 92px;
    padding: 3px 8px;
    font-size: 13px;
  }

  #advancedSettingsModal .advancedLateSeasonRewardsGrid {
    gap: 4px;
  }

  #advancedSettingsModal .advancedLateSeasonRewardSetting {
    min-height: 36px;
  }

  #advancedSettingsModal .advancedPercentControl {
    grid-template-columns: 20px 74px auto;
    gap: 4px;
  }

  #advancedSettingsModal .advancedRewardRateInput {
    height: 36px;
    padding: 3px 7px;
  }

  #advancedSettingsModal .advancedSettingsFooter {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
    padding: 6px 8px;
  }

  #advancedSettingsModal .advancedSettingsFooter button {
    width: 100%;
    min-width: 0;
    height: 36px;
    min-height: 36px;
  }

  #evaluationLoadModal .evaluationLoadList {
    gap: 4px;
    height: 269px;
    max-height: 269px;
    grid-auto-rows: 48px;
    padding: 5px 6px 8px;
  }

  #evaluationLoadModal .evaluationLoadResult {
    gap: 4px;
    min-height: 48px;
    padding: 5px 8px;
    border-radius: 6px;
  }


  #evaluationLoadModal .evaluationLoadResultMain strong {
    font-size: 12px;
  }

  #evaluationLoadModal .evaluationLoadResultMain span {
    font-size: 9px;
  }

  #evaluationLoadModal .evaluationLoadPresentValue {
    min-width: 64px;
    font-size: 10px;
  }

  #evaluationLoadModal .evaluationLoadActions {
    gap: 4px;
  }

  #evaluationLoadModal .evaluationLoadIconButton {
    width: 26px;
    min-width: 26px;
    height: 26px;
    min-height: 26px;
    padding: 0;
  }

  #evaluationLoadModal .evaluationLoadIconButton svg {
    width: 12px;
    height: 12px;
  }
  #evaluationPage .evaluationTitleRow,
  #evaluationPage .evaluationTopBar,
  #evaluationPage .evaluationSearchGroup,
  #evaluationPage .evaluationActions {
    display: contents;
  }

  #evaluationPage .evaluationTitleRow > .tablePageTitle {
    grid-column: 1 / -1;
    grid-row: 1;
    margin-bottom: 2px;
  }

  #evaluationPage .advancedSettingsButton {
    grid-column: 1;
    grid-row: 2;
    width: 100%;
    min-width: 0;
    height: 42px;
    min-height: 42px;
    justify-content: center;
    gap: 4px;
    padding: 0 5px;
    font-size: 11px;
    line-height: 1;
    text-align: center;
  }

  #evaluationPage .advancedSettingsButton span {
    font-size: 13px;
  }

  #evaluationPage .evaluationMetrics {
    grid-column: 2 / -1;
    grid-row: 2;
    width: 100%;
    min-width: 0;
    align-self: stretch;
    justify-self: stretch;
  }

  #evaluationPage .evaluationSearch {
    grid-column: 1 / -1;
    grid-row: 3;
    gap: 6px;
  }

  #evaluationPage .evaluationSearch input {
    height: 40px;
  }

  #evaluationPage .evaluationSearchResults {
    top: 66px;
    gap: 4px;
    padding: 6px;
  }

  #evaluationPage .evaluationSearchResult {
    min-height: 48px;
    padding: 6px 8px;
    border-radius: 6px;
  }

  #evaluationPage .evaluationSearchResult strong {
    font-size: 12px;
  }

  #evaluationPage .evaluationSearchResult span {
    font-size: 9px;
  }

  #evaluationPage .evaluationButtons {
    display: grid;
    grid-column: 1 / -1;
    grid-row: 4;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
    gap: 6px;
    width: 100%;
    justify-self: stretch;
  }

  #evaluationPage .evaluationButtons .evaluationPlayerPageButton {
    width: 100%;
  }

  #evaluationPage .evaluationMetrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  #evaluationPage .evaluationSearchGroup:has(#evaluationLoadButton:not([hidden])) .evaluationSearch,
  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-page="evaluation"][data-initial-evaluation-selection="false"] #evaluationPage .evaluationSearch {
    grid-column: 1 / -1;
    grid-row: 3;
    width: calc(100% - 82px);
  }

  #evaluationPage .evaluationButtons:has(#evaluationLoadButton:not([hidden])),
  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-page="evaluation"][data-initial-evaluation-selection="false"] #evaluationPage .evaluationButtons {
    grid-column: 1 / -1;
    grid-row: 3;
    grid-template-columns: 1fr;
    width: 76px;
    justify-self: end;
    align-self: end;
  }

  #evaluationPage #evaluationLoadButton {
    height: 40px;
    min-height: 40px;
  }

  #evaluationPage .evaluationOptionFilters {
    grid-column: 1 / -1;
    grid-row: 5;
  }

  #evaluationPage .evaluationPlayerPageButton {
    height: 42px;
    min-height: 42px;
    padding-inline: 6px;
    font-size: 11px;
  }

  #evaluationPage .evaluationMetric {
    grid-template-rows: 15px 1fr;
    gap: 1px;
    width: 100%;
    min-width: 0;
    height: 42px;
    min-height: 42px;
    justify-items: end;
    padding: 3px 5px;
    border-radius: 6px;
    text-align: right;
  }

  #evaluationPage .evaluationMetric span {
    font-size: 9px;
    line-height: 1;
  }

  #evaluationPage .evaluationMetric strong {
    font-size: 15px;
    line-height: 1;
    text-align: right;
  }

  #evaluationPage .evaluationMetricLabel {
    width: 100%;
    justify-content: flex-end;
    text-align: right;
  }

  #evaluationPage .evaluationMetricIconButton {
    flex-basis: 15px;
    width: 15px;
    height: 15px;
    min-height: 15px;
    padding: 0;
    font-size: 10px;
  }

  #evaluationPage .evaluationMflUsdGroup {
    width: 100%;
    min-width: 0;
    height: 42px;
    gap: 2px;
  }

  #evaluationPage .evaluationMflUsdEditor {
    grid-template-columns: minmax(0, 1fr) 12px;
    gap: 2px;
  }

  #evaluationPage .evaluationMflUsdInput {
    height: 20px;
    min-height: 20px;
    padding: 0 2px;
    font-size: 12px;
    line-height: 18px;
    text-align: right;
  }

  #evaluationPage .evaluationMflUsdStepper {
    gap: 1px;
  }

  #evaluationPage .evaluationMflUsdStepper button {
    width: 12px;
    height: 8px;
    min-height: 8px;
    padding: 0;
    font-size: 6px;
    line-height: 1;
  }

  #evaluationPage .evaluationOptionFilters {
    align-items: center;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 6px;
    font-size: 12px;
    white-space: nowrap;
  }

  #evaluationPage > .evaluationPanel {
    grid-column: 1 / -1;
  }

  #evaluationPage .evaluationPanel h3 {
    margin-bottom: 6px;
    font-size: 16px;
  }

  #evaluationPage .evaluationSummaryShell {
    margin-bottom: 10px;
  }

  #evaluationPage .evaluationSummaryShell .tableScroller {
    overflow-x: hidden;
    touch-action: pan-y;
  }

  #evaluationPage .evaluationTableShell {
    --mfl-evaluation-table-header-height: 27px;
  }

  #evaluationPage .evaluationTableShell .tableScroller {
    display: block;
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x pan-y;
  }

  #evaluationPage .evaluationTableShell::before,
  #evaluationPage .evaluationTableShell::after {
    width: 46px;
  }

  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-page="evaluation"][data-initial-evaluation-selection="true"] #evaluationPage .evaluationTableShell::after {
    opacity: 0.94;
    visibility: visible;
    transition: none;
  }

  #evaluationPage .evaluationSummaryTable {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    table-layout: fixed;
    line-height: 1.05;
  }

  #evaluationPage .evaluationTableShell .evaluationTable {
    width: 100%;
    min-width: 500px;
    max-width: none;
    table-layout: fixed;
    line-height: 1.05;
  }

  #evaluationPage {
    --mfl-evaluation-header-row-height: 27px;
    --mfl-evaluation-summary-row-height: 27px;
    --mfl-evaluation-season-row-height: 23px;
  }

  #evaluationPage .evaluationHeaderFull {
    display: none;
  }

  #evaluationPage .evaluationHeaderCompact {
    display: inline;
  }

  #evaluationPage .evaluationSummaryTable td {
    height: var(--mfl-evaluation-summary-row-height);
    font-size: 11px;
  }

  #evaluationPage .evaluationTableShell .evaluationTable td {
    height: var(--mfl-evaluation-season-row-height);
    font-size: 11px;
  }

  #evaluationPage .evaluationSummaryTable :is(th, td),
  #evaluationPage .evaluationTableShell .evaluationTable :is(th, td) {
    min-width: 0;
    padding-inline: 1px;
    overflow-wrap: anywhere;
  }

  #evaluationPage .evaluationSummaryTable :is(th, td):first-child,
  #evaluationPage .evaluationTableShell .evaluationTable :is(th, td):first-child {
    padding-left: 6px;
  }

  #evaluationPage .evaluationSummaryTable th,
  #evaluationPage .evaluationTableShell .evaluationTable th {
    height: var(--mfl-evaluation-header-row-height);
    font-size: 9px;
    line-height: 1.05;
  }

  #evaluationPage .evaluationSummaryPositionSelect {
    width: max-content;
    max-width: 100%;
    min-height: 28px;
    padding: 0;
    font-size: inherit;
  }



  #evaluationPage .evaluationOverallControl {
    grid-template-columns: 16px 18px 16px;
    gap: 0;
    width: 100%;
    height: 16px;
    justify-content: start;
  }

  #evaluationPage .evaluationOverallControl strong {
    min-width: 18px;
  }

  #evaluationPage .evaluationOverallControl button,
  #evaluationPage .evaluationOverallControlSpacer {
    width: 16px;
    min-width: 16px;
    height: 16px;
    min-height: 16px;
  }

  #evaluationPage .evaluationOverallControl button {
    font-size: 11px;
  }

  #evaluationPage .evaluationOverallControl strong {
    min-width: 0;
    font-size: inherit;
    line-height: 16px;
  }

  #evaluationPage .evaluationFooterActions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
    gap: 6px;
    margin-top: 10px;
    margin-bottom: 10px;
  }

  #evaluationPage .evaluationFooterSavedActions {
    display: contents;
  }

  #evaluationPage #evaluationShareButton {
    grid-column: 1;
    grid-row: 1;
    width: 100%;
  }

  #evaluationPage #evaluationSaveButton {
    grid-column: 2;
    grid-row: 1;
    width: 100%;
  }

  #evaluationPage #evaluationDeleteButton {
    grid-column: 1 / -1;
    grid-row: 2;
    width: 100%;
  }
