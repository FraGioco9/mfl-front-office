
  .filtersHeader h2 {
    font-size: 16px;
  }

  .searchBody {
    flex: 1 1 auto;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 8px;
    min-height: 0;
    padding: 12px;
  }

  .globalSearchControl #playerSearchInput {
    height: 38px;
    min-height: 38px;
    padding-left: 10px;
    padding-right: 38px;
    font-size: 16px;
  }

  .playerSearchClearButton {
    right: 3px;
    width: 28px;
    height: 28px;
  }

  .searchResults {
    gap: 5px;
    min-height: 0;
    height: 290px;
    max-height: 290px;
    grid-auto-rows: 54px;
  }

  .searchResults.filledSearchResults {
    grid-template-rows: repeat(5, 54px);
    padding-bottom: 0;
  }

  .searchResult {
    min-height: 54px;
    padding: 7px 10px;
    border-radius: 7px;
  }

  .searchResult strong {
    font-size: 13px;
    line-height: 1.1;
  }

  .searchResult span {
    font-size: 10px;
    line-height: 1.15;
  }

  .searchHint {
    font-size: 10px;
  }

  .filterBuilder,
  .advancedSettingsBody,
  .evaluationLoadList {
    padding-inline: 12px;
  }

  .filterBuilder {
    flex: 0 1 auto;
    gap: 6px;
    min-width: 0;
    min-height: 0;
    padding: 8px 10px;
    overflow-x: hidden;
  }

  .addFilterRow,
  .filterRules {
    min-width: 0;
    max-width: 100%;
    gap: 6px;
  }


  .filtersDialog .addFilterRow > *,
  .filtersDialog .filterRule,
  .filtersDialog .filterRule > *,
  .filtersDialog .filterRule :is(
    input,
    select,
    button,
    [data-filter-value],
    [data-filter-value-group],
    .mflNumericStepperControl,
    .betweenValue,
    .dateValue,
    .dateRangeValue
  ),
  .filtersDialog .filterRule :is(.betweenValue, .dateValue, .dateRangeValue, .mflNumericStepperControl, [data-filter-value-group]) > * {
    min-width: 0;
    max-width: 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
  }

  .filtersDialog .filterRule :is(
    input,
    select,
    [data-filter-value],
    [data-filter-value-group],
    .mflNumericStepperControl,
    .betweenValue,
    .dateValue,
    .dateRangeValue
  ),
  .filtersDialog .filterRule :is(.betweenValue, .dateValue, .dateRangeValue, .mflNumericStepperControl, [data-filter-value-group]) > :is(input, select, [data-filter-value]) {
    width: 100%;
    inline-size: 100%;
  }

  .filtersDialog .mflNumericStepperControl {
    grid-template-columns: minmax(0, 1fr) 16px;
    gap: 2px;
  }

  .filtersDialog .mflNumericStepperControl > input[type="number"] {
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }

  .filtersDialog .mflIncrementStepper {
    width: 16px;
    min-width: 16px;
    max-width: 16px;
  }

  .filtersDialog .mflIncrementStepper button {
    width: 16px;
    min-width: 16px;
    max-width: 16px;
  }


  .filterRule {
    --mfl-filter-edge-gap: 8px;
    --mfl-filter-builder-inline-padding: 10px;
    --mfl-filter-remove-size: 18px;
    --mfl-filter-remove-strip: calc((2 * var(--mfl-filter-edge-gap)) + var(--mfl-filter-remove-size) - var(--mfl-filter-builder-inline-padding));
    position: relative;
    box-sizing: border-box;
    width: calc(100% - var(--mfl-filter-remove-strip));
    max-width: calc(100% - var(--mfl-filter-remove-strip));
    margin-left: 0;
    margin-right: var(--mfl-filter-remove-strip);
    overflow: visible;
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
    grid-template-rows: 36px 36px;
    gap: 4px;
    min-height: 76px;
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

  .filterRule > :nth-child(5)::before,
  .filterRule > :nth-child(5)::after {
    width: 8px;
    height: 1.5px;
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

  .filtersDialog .filterRule > :is(:nth-child(2), :nth-child(4)) {
    width: 100%;
    inline-size: 100%;
    min-width: 0;
    min-inline-size: 0;
    max-width: 100%;
    max-inline-size: 100%;
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

  .filterRule select[hidden] {
    display: none;
  }

  .betweenValue,
  .dateRangeValue {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
  }

  .filtersFooter button {
    height: 36px;
    min-height: 36px;
  }

  .advancedSettingHeader,
  .advancedLateSeasonRewardSetting {
    align-items: stretch;
    flex-direction: column;
  }

  .advancedSettingHeaderControl,
  .advancedRewardRateControlGroup {
    justify-content: space-between;
    width: 100%;
  }

  .advancedMflUsdControl,
  .advancedPercentControl {
    margin-left: auto;
  }

  .advancedPlayerTableSection {
    overflow-x: auto;
    overscroll-behavior-x: contain;
  }
