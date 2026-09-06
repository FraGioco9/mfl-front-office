
  .mflStatsFilterButtons {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  #databaseStatsPage .databaseStatsCards,
  .mflStatsCards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mflStatsDistributionHeader {
    align-items: stretch;
    flex-direction: column;
  }

  .mflStatsDistributionModeButtons {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mflStatsDistributionModeButton {
    width: 100%;
    min-width: 0;
  }

  .mflStatsAgeDistribution {
    min-height: 280px;
    height: min(52dvh, 420px);
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    overscroll-behavior-y: auto;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-x;
  }

  .mflStatsAgeDistribution.mflStatsCanScrollRight:not(.mflStatsCanScrollLeft) {
    -webkit-mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 44px), transparent 100%);
    mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 44px), transparent 100%);
  }

  .mflStatsAgeDistribution.mflStatsCanScrollLeft:not(.mflStatsCanScrollRight) {
    -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 44px, #000 100%);
    mask-image: linear-gradient(90deg, transparent 0, #000 44px, #000 100%);
  }

  .mflStatsAgeDistribution.mflStatsCanScrollLeft.mflStatsCanScrollRight {
    -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 44px, #000 calc(100% - 44px), transparent 100%);
    mask-image: linear-gradient(90deg, transparent 0, #000 44px, #000 calc(100% - 44px), transparent 100%);
  }

  .mflStatsHistogram {
    min-width: 620px;
  }

  .settingsPanel {
    max-width: 100%;
  }

  .settingsIdentity {
    grid-template-columns: 1fr;
  }

  .settingsDateFormatOptions,
  .settingsEmailAddressRow:not([data-settings-page-actions]) {
    display: grid;
    grid-template-columns: 1fr;
  }

  .settingsEmailAddressRow[data-settings-page-actions] {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .settingsToggleButton,
  .settingsEmailAddressInput,
  .settingsEmailActionButton {
    width: 100%;
    max-width: none;
  }

  .settingsEmailAddressRow[data-settings-page-actions] .settingsEmailActionButton {
    min-width: 0;
    padding-inline: 12px;
  }

  .changelogPage {
    margin-top: 10px;
  }

  .changelogPage h2 {
    margin-bottom: 4px;
    font-size: 22px;
    line-height: 1.1;
  }

  .changelogPage > p {
    margin-bottom: 14px;
    font-size: 14px;
    line-height: 1.25;
  }

  .changelogList {
    gap: 8px;
  }

  .changelogMinorSection {
    border-radius: 5px;
  }

  .changelogMinorToggle {
    gap: 8px;
    min-height: 40px;
    padding: 8px 10px;
  }

  .changelogMinorVersion {
    font-size: 14px;
  }

  .changelogMinorMeta {
    font-size: 11px;
  }

  .changelogMinorChevron {
    font-size: 16px;
  }

  .changelogPatchList {
    padding: 2px 8px;
  }

  .changelogPatchList li {
    grid-template-columns: 76px minmax(0, 1fr);
    gap: 7px;
    min-height: 31px;
    padding: 4px 6px;
  }

  .changelogPatchList span,
  .changelogPatchList p {
    min-height: 22px;
    font-size: 13px;
    line-height: 1.15;
  }

  .siteFooter {
    padding-inline: 12px;
  }
}
