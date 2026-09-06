
  /* Small-screen Stats controls scale down, while the chart remains readable through local horizontal panning. */
  .mflStatsPage {
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }

  .mflStatsPage .tablePageTitle {
    font-size: 18px;
  }

  .mflStatsViews {
    margin-bottom: 5px;
  }

  .mflStatsFilters {
    gap: 4px;
    margin-bottom: 5px;
    padding: 5px 6px;
  }

  .mflStatsFilters > span {
    font-size: 10px;
  }

  .mflStatsFilterButtons {
    gap: 4px;
  }

  .mflStatsFilterButton {
    width: 100%;
    min-width: 0;
    height: 24px;
    padding-inline: 4px;
    font-size: 10px;
  }

  .mflStatsCards {
    gap: 5px;
    margin-bottom: 5px;
  }

  .mflStatsCards article {
    min-height: 56px;
    padding: 6px 7px;
  }

  .mflStatsCards span,
  .mflStatsCards small {
    font-size: 9px;
  }

  .mflStatsCards strong {
    margin-top: 2px;
    font-size: 18px;
  }

  .mflStatsDistribution {
    padding: 6px 7px;
  }

  .mflStatsDistributionHeader {
    gap: 6px;
    margin-bottom: 5px;
  }

  .mflStatsDistributionHeader h3 {
    margin: 0;
    font-size: 14px;
    line-height: 1.1;
  }

  .mflStatsDistributionModeButtons {
    gap: 4px;
  }

  .mflStatsDistributionModeButton {
    width: 100%;
    min-width: 0;
    height: 26px;
    min-height: 26px;
    padding-inline: 6px;
    font-size: 10px;
  }

  .mflStatsAgeDistribution {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    min-height: 200px;
    height: clamp(200px, 42dvh, 300px);
  }

  .mflStatsHistogram {
    width: 100%;
    min-width: 520px;
    gap: clamp(1px, 0.4vw, 3px);
    padding-top: 24px;
  }

  .mflStatsHistogramItem {
    gap: 2px;
  }

  .mflStatsHistogramBar {
    min-height: 90px;
  }

  .mflStatsHistogramLabel {
    min-height: 12px;
    font-size: clamp(6px, 2vw, 9px);
  }

  .evaluationOptionFilters {
    align-items: flex-start;
    flex-direction: column;
  }

  #advancedSettingsModal,
  #evaluationLoadModal {
    padding:
      max(6px, env(safe-area-inset-top))
      max(6px, env(safe-area-inset-right))
      max(6px, env(safe-area-inset-bottom))
      max(6px, env(safe-area-inset-left));
  }

  #advancedSettingsModal .advancedSettingsDialog,
  #evaluationLoadModal .evaluationLoadDialog {
    max-height: calc(100dvh - 12px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  }

  #evaluationLoadModal .evaluationLoadDialog {
    height: auto;
  }

  #advancedSettingsModal .filtersHeader,
  #evaluationLoadModal .filtersHeader {
    min-height: 40px;
    padding: 6px 8px;
  }

  #advancedSettingsModal .filtersHeader h2,
  #evaluationLoadModal .filtersHeader h2 {
    font-size: 14px;
  }

  #advancedSettingsModal .advancedSettingsBody {
    gap: 6px;
    padding: 6px 8px 8px;
  }

  #advancedSettingsModal .advancedSettingsSection {
    gap: 5px;
  }

  #advancedSettingsModal .advancedSettingsSection h3 {
    font-size: 12px;
  }

  #advancedSettingsModal .advancedSettingHeader,
  #advancedSettingsModal .advancedLateSeasonRewardSetting {
    gap: 6px;
  }

  #advancedSettingsModal .advancedMflUsdControl {
    grid-template-columns: 20px 82px;
    gap: 3px;
  }

  #advancedSettingsModal .advancedSettingValue {
    width: 82px;
    min-width: 82px;
    font-size: 12px;
  }

  #advancedSettingsModal .advancedPercentControl {
    grid-template-columns: 20px 66px auto;
    gap: 3px;
  }

  #advancedSettingsModal .advancedSettingsFooter {
    gap: 4px;
    padding: 5px 6px;
  }


  .advancedSettingsFooter {
    grid-template-columns: 1fr;
  }

  .changelogPage {
    margin-top: 8px;
  }

  .changelogPage h2 {
    margin-bottom: 3px;
    font-size: 19px;
  }

  .changelogPage > p {
    margin-bottom: 10px;
    font-size: 12px;
    line-height: 1.2;
  }

  .changelogList {
    gap: 6px;
  }

  .changelogMinorToggle {
    gap: 6px;
    min-height: 36px;
    padding: 6px 8px;
  }

  .changelogMinorVersion {
    font-size: 13px;
  }

  .changelogMinorMeta {
    font-size: 10px;
  }

  .changelogMinorChevron {
    font-size: 14px;
  }

  .changelogPatchList {
    padding: 1px 6px;
  }

  .changelogPatchList li {
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 5px;
    min-height: 27px;
    padding: 3px 4px;
  }

  .changelogPatchList span,
  .changelogPatchList p {
    min-height: 20px;
    font-size: 11px;
  }

  .filtersFooter,
  .advancedSettingsFooter,
  .addWatchlistFooter,
  .deleteWatchlistFooter {
    gap: 8px;
  }

  .filtersFooter button,
  .advancedSettingsFooter button,
  .addWatchlistFooter button,
  .deleteWatchlistFooter button {
    width: 100%;
    min-width: 0;
  }

  .selectionBar {
    width: min(400px, calc(100vw - 16px - env(safe-area-inset-left) - env(safe-area-inset-right)));
    align-items: center;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 6px;
    padding: 7px 8px;
    border-radius: 7px;
  }

  .selectionSummary {
    grid-template-rows: repeat(2, 16px);
    min-width: 74px;
  }

  .selectionBar span {
    font-size: 12px;
    line-height: 15px;
  }

  .selectionBar .textButton {
    height: 24px;
    min-height: 24px;
    padding-inline: 0;
    font-size: 11px;
    line-height: 14px;
  }

  .selectionActions {
    display: inline-flex;
    flex: 1 1 auto;
    flex-wrap: nowrap;
    justify-content: flex-end;
    width: auto;
    gap: 6px;
  }

  .selectionBar button:not(.textButton) {
    width: auto;
    min-width: 0;
    height: 32px;
    min-height: 32px;
    padding-inline: 8px;
    font-size: 11px;
    white-space: nowrap;
  }

  .siteFooter {
    text-align: center;
  }
}
