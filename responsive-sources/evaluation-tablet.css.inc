  .evaluationMetrics {
    width: 100%;
    min-width: 0;
  }

  .evaluationButtons {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    justify-self: stretch;
  }

  .evaluationPlayerPageButton {
    width: 100%;
    min-width: 0;
  }

  .evaluationMetrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    justify-self: stretch;
  }

  .evaluationMetric,
  .evaluationMflUsdGroup {
    width: 100%;
    min-width: 0;
    justify-self: stretch;
  }

  .evaluationMetric {
    text-align: left;
  }

  .evaluationMetricLabel {
    justify-content: flex-start;
  }

  .evaluationFooterActions {
    align-items: stretch;
    flex-direction: column;
  }

  .evaluationFooterSavedActions {
    justify-content: stretch;
  }

  .evaluationFooterButton,
  .evaluationFooterSavedActions > * {
    flex: 1 1 auto;
  }

  .evaluationSummaryShell,
  .evaluationTableShell {
    max-width: 100%;
  }

  #evaluationPage {
    --mfl-evaluation-header-row-height: 32px;
    --mfl-evaluation-summary-row-height: 32px;
    --mfl-evaluation-season-row-height: 27px;
  }

  #evaluationPage .evaluationHeaderFull { display: none; }
  #evaluationPage .evaluationHeaderCompact { display: inline; }

  .evaluationSummaryTable thead tr,
  .evaluationTableShell .evaluationTable thead tr,
  .evaluationSummaryTable th,
  .evaluationTableShell .evaluationTable th {
    height: var(--mfl-evaluation-header-row-height);
  }

  .evaluationSummaryTable tbody tr,
  .evaluationSummaryTable td {
    height: var(--mfl-evaluation-summary-row-height);
  }

  .evaluationTableShell .evaluationTable tbody tr,
  .evaluationTableShell .evaluationTable td {
    height: var(--mfl-evaluation-season-row-height);
  }

  .evaluationSummaryTable th,
  .evaluationTableShell .evaluationTable th {
    font-size: 10px;
  }

  .evaluationSummaryTable td,
  .evaluationTableShell .evaluationTable td {
    font-size: 12px;
  }

  .evaluationSummaryTable th,
  .evaluationSummaryTable td {
    padding-inline: 3px;
  }

  #evaluationPage .evaluationSearchResults {
    gap: 5px;
    padding: 7px;
  }

  #evaluationPage .evaluationSearchResult {
    min-height: 54px;
    padding: 7px 10px;
    border-radius: 7px;
  }

  #evaluationPage .evaluationSearchResult strong {
    font-size: 13px;
    line-height: 1.1;
  }

  #evaluationPage .evaluationSearchResult span {
    font-size: 10px;
    line-height: 1.15;
  }

  #evaluationLoadModal .evaluationLoadList {
    gap: 5px;
    height: 342px;
    max-height: 342px;
    grid-auto-rows: 60px;
    padding: 10px 12px 12px;
  }

  #evaluationLoadModal .evaluationLoadResult {
    gap: 8px;
    min-height: 60px;
    padding: 8px 10px;
    border-radius: 7px;
  }


  #evaluationLoadModal .evaluationLoadResultMain strong {
    font-size: 13px;
    line-height: 1.1;
  }

  #evaluationLoadModal .evaluationLoadResultMain span {
    font-size: 10px;
    line-height: 1.15;
  }

  #evaluationLoadModal .evaluationLoadPresentValue {
    min-width: 82px;
    font-size: 12px;
  }

  #evaluationLoadModal .evaluationLoadActions {
    gap: 5px;
  }

  #evaluationLoadModal .evaluationLoadIconButton {
    width: 28px;
    min-width: 28px;
    height: 28px;
    min-height: 28px;
    padding: 0;
  }

  #evaluationLoadModal .evaluationLoadIconButton svg {
    width: 14px;
    height: 14px;
  }
