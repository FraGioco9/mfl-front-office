
  .playerPage,
.playerDetail,
.playerGrid,
.playerStack,
.playerPanel,
.detailGrid,
.attributeGrid {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.playerDetail {
  gap: var(--mfl-player-panel-gap);
  margin-top: var(--mfl-player-panel-gap);
}

.playerHero {
  display: grid;
  grid-template-columns: var(--mfl-player-hero-media-width) minmax(0, 1fr);
  grid-template-areas:
    "media identity"
    "actions actions";
  align-items: center;
  column-gap: clamp(8px, 2vw, 14px);
  row-gap: var(--mfl-player-panel-gap);
  height: auto;
  min-height: 0;
  max-height: none;
  padding: var(--mfl-player-panel-padding);
  border-radius: var(--mfl-player-panel-radius);
}

.playerHeroMedia {
  grid-area: media;
  max-width: 100%;
}

.playerHeroIdentity {
  grid-area: identity;
  min-width: 0;
  margin-right: 0;
}

.playerHeroIdentity .playerTitle,
.playerHeroIdentity > p {
  overflow-wrap: anywhere;
}

.playerTitle .playerListingBadge {
  flex: 0 0 14px;
  width: 14px;
  min-width: 14px;
  max-width: 14px;
  height: 14px;
  min-height: 14px;
  max-height: 14px;
  margin-left: 4px;
  padding: 0;
  border-radius: 0;
  background: transparent;
  gap: 0;
  cursor: default;
  -webkit-tap-highlight-color: transparent;
  transition: none;
  animation: none;
}

.playerTitle .playerListingBadge .listingCellIcon {
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
}

.playerTitle .playerListingBadge .listingCellPrice {
  display: none;
}

.playerHero h2 .playerNoteIcon {
  font-size: clamp(14px, 3.6vw, 17px);
}

.playerHeroActions {
  grid-area: actions;
  display: block;
  width: 100%;
  min-width: 0;
}

.playerHeroActionMenu {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.playerGrid {
  grid-template-columns: 1fr;
  gap: var(--mfl-player-panel-gap);
}

.playerStack {
  gap: var(--mfl-player-panel-gap);
  grid-template-rows: none;
}

.playerPanel {
  padding: var(--mfl-player-panel-padding);
  border-radius: var(--mfl-player-panel-radius);
}

.playerPanel h3 {
  font-size: clamp(13px, 3.2vw, 16px);
  line-height: 1.1;
}

.playerPanelHeader {
  align-items: flex-start;
  flex-direction: column;
  gap: var(--mfl-player-box-gap);
}

.playerAttributeViews {
  box-sizing: border-box;
  display: flex;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  gap: var(--mfl-player-box-gap);
  overflow-x: hidden;
  overflow-y: hidden;
  overscroll-behavior-x: auto;
  touch-action: pan-y;
}

.playerAttributeViews.mflViewsOverflowing {
  overflow-x: auto;
  overscroll-behavior-x: none;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x pan-y;
}

.playerAttributeViewButton {
  flex: 1 0 clamp(68px, 18vw, 98px);
  width: auto;
  min-width: clamp(68px, 18vw, 98px);
  height: var(--mfl-player-attribute-view-height);
  min-height: var(--mfl-player-attribute-view-height);
  max-height: var(--mfl-player-attribute-view-height);
  padding-inline: 4px;
  border-radius: var(--mfl-player-control-radius);
  font-size: clamp(9px, 2.4vw, 11px);
}

.detailGrid,
.attributeGrid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--mfl-player-box-gap);
  margin-top: var(--mfl-player-box-gap);
}

.playerInfoPanel .detailGrid {
  min-height: 0;
  grid-template-rows: repeat(5, var(--mfl-player-box-height));
}

.playerInfoPanel .detailGrid > .playerInfoFullWidthCard {
  grid-column: 1 / -1;
}

.attributeGrid {
  grid-auto-rows: var(--mfl-player-box-height);
}

.detailGrid > div {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: var(--mfl-player-box-height);
  min-height: var(--mfl-player-box-height);
  max-height: var(--mfl-player-box-height);
  padding: 3px var(--mfl-player-box-padding-inline);
  border-radius: var(--mfl-player-box-radius);
  overflow: hidden;
}

.playerAttributeCard,
.playerAttributeCard.featured {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: var(--mfl-player-box-height);
  min-height: var(--mfl-player-box-height);
  max-height: var(--mfl-player-box-height);
  padding: 3px var(--mfl-player-box-padding-inline);
  border-radius: var(--mfl-player-box-radius);
  overflow: hidden;
}

.detailGrid > div,
.detailGrid strong,
.detailGrid strong > *,
.playerContractLine,
.playerContractTeam,
.playerAttributeCard strong,
.playerAttributeCard .attributeValueText {
  min-width: 0;
}
  .detailGrid strong {
    flex-wrap: nowrap;
    overflow: hidden;
    font-size: var(--mfl-player-value-font-size);
    line-height: 1.2;
    white-space: nowrap;
  }

.detailGrid .contractDetailCard strong .playerContractTeam {
  font-size: var(--mfl-player-value-font-size);
  line-height: 1.2;
}

.detailGrid .contractDetailCard strong .playerContractDivision {
  font-size: var(--mfl-player-contract-division-font-size);
  line-height: 1.2;
}
  .playerInfoPanel .detailGrid .nationalityDetailCard strong {
    gap: var(--mfl-player-nationality-gap);
  }

  .playerInfoPanel .detailGrid .nationalityDetailCard .flagImage {
    width: var(--mfl-player-profile-flag-size);
    height: var(--mfl-player-profile-flag-size);
  }

.playerInfoPanel .detailGrid strong .playerDetailAgeLine {
  gap: var(--mfl-player-age-icon-gap);
  overflow: visible;
  line-height: 1;
}

.playerInfoPanel .detailGrid .playerAgeMarker {
  flex: 0 0 var(--mfl-player-profile-icon-size);
  width: var(--mfl-player-profile-icon-size);
  min-width: var(--mfl-player-profile-icon-size);
  max-width: var(--mfl-player-profile-icon-size);
  height: var(--mfl-player-profile-icon-size);
  min-height: var(--mfl-player-profile-icon-size);
  max-height: var(--mfl-player-profile-icon-size);
  overflow: visible;
  font-size: inherit;
}

.playerInfoPanel .detailGrid .playerAgeMarker::before,
.playerInfoPanel .detailGrid .playerAgeMarker > img {
  width: var(--mfl-player-profile-icon-size);
  height: var(--mfl-player-profile-icon-size);
}

.playerInfoPanel .detailGrid .playerAgeMarker::before {
  -webkit-mask-size: var(--mfl-player-profile-icon-size) var(--mfl-player-profile-icon-size);
  mask-size: var(--mfl-player-profile-icon-size) var(--mfl-player-profile-icon-size);
  background: var(--retirement-marker-color);
}

.playerInfoPanel .detailGrid .playerAgeMarker > img {
  display: block;
  flex: 0 0 var(--mfl-player-profile-icon-size);
  object-fit: contain;
}

.detailGrid strong > a,
.playerContractLine,
.playerContractTeam {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.playerContractLine {
  line-height: 1.2;
}

.detailGrid > div > span,
.playerAttributeCard > span {
  font-size: var(--mfl-player-label-font-size);
  line-height: 1.1;
}

.playerAttributeCard strong {
  flex-wrap: nowrap;
  gap: 3px;
  overflow: hidden;
  font-size: var(--mfl-player-attribute-font-size);
  line-height: 1.1;
}

.playerAttributeCard .attributeValueText {
  line-height: inherit;
}

.playerAttributeCard.featured strong {
  font-size: var(--mfl-player-featured-font-size);
}

.playerAttributeCard .progressionValue,
.playerAttributeCard .nextOverallValue,
.playerAttributeCard .trainingDelta,
.playerAttributeCard.featured .progressionValue,
.playerAttributeCard.featured .nextOverallValue {
  flex: 0 0 auto;
  font-size: clamp(9px, 2.3vw, 11px);
}

.playerAttributeCard.fullWidth {
  grid-column: 1 / -1;
}


.trainingStatControls {
  min-width: 0;
  max-width: 100%;
  gap: var(--mfl-player-training-control-gap);
}

.trainingStatControls button {
  width: var(--mfl-player-training-control-size);
  min-width: var(--mfl-player-training-control-size);
  max-width: var(--mfl-player-training-control-size);
  height: var(--mfl-player-training-control-size);
  min-height: var(--mfl-player-training-control-size);
  max-height: var(--mfl-player-training-control-size);
  border-radius: var(--mfl-player-training-control-radius);
  font-size: var(--mfl-player-training-control-font-size);
  line-height: var(--mfl-player-training-control-size);
}

.trainingStatControls .trainingResetButton {
  width: var(--mfl-player-training-reset-width);
  min-width: var(--mfl-player-training-reset-width);
  max-width: var(--mfl-player-training-reset-width);
  padding-inline: 0;
  font-size: var(--mfl-player-training-reset-font-size);
}

.playerNotesInput {
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: clamp(56px, 15vw, 72px);
  padding: clamp(6px, 1.5vw, 8px) 34px clamp(6px, 1.5vw, 8px) var(--mfl-player-box-padding-inline);
  border-radius: var(--mfl-player-box-radius);
  font-size: clamp(11px, 2.8vw, 13px);
}

.playerNotesCount {
  font-size: clamp(9px, 2.2vw, 10px);
}

.pitch {
  width: min(100%, clamp(240px, 70vw, 320px));
  height: auto;
  aspect-ratio: 360 / 498;
  gap: clamp(3px, 0.8vw, 5px);
  margin-top: var(--mfl-player-panel-gap);
  padding: clamp(6px, 1.6vw, 9px) clamp(5px, 1.4vw, 8px);
  border-width: 1px;
  border-radius: var(--mfl-player-panel-radius);
}

.pitchRow {
  gap: clamp(3px, 1vw, 6px);
}

.pitchPositionSlot {
  min-width: clamp(38px, 10vw, 54px);
}

.pitchPositionCircle,
.pitchPositionBlank {
  width: clamp(33.333px, 9.722vw, 44.444px);
  height: clamp(33.333px, 9.722vw, 44.444px);
}

.pitchPositionCircle {
  gap: 2px;
}

.pitchPositionCircle strong {
  font-size: clamp(12px, 3.5vw, 16px);
}

.pitchPositionCircle small {
  font-size: clamp(7.333px, 2.139vw, 9.778px);
}

  .evaluationTitleRow {
    align-items: stretch;
    flex-direction: column;
  }

  .advancedSettingsButton {
    width: 100%;
  }

  .evaluationSearchGroup {
    grid-template-columns: minmax(0, 1fr);
  }

  .evaluationSearch {
    width: 100%;
    max-width: none;
  }

  .evaluationActions {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    align-items: stretch;
  }

  .evaluationButtons,