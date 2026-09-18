/* Responsive player-table content presentation.
 * Canonical rows keep full and compact values in the DOM; media queries choose presentation.
 */
#progressionPage .playerTableScroller .playerNameFullValue,
#progressionPage .playerTableScroller .joinedAgencyFullValue {
  display: inline;
}

#progressionPage .playerTableScroller .playerNameCompactValue,
#progressionPage .playerTableScroller .joinedAgencyCompactValue {
  display: none;
}

@media (max-width: 1664px) {
  #progressionPage .playerTableScroller .sortArrow {
    margin-left: var(--mfl-responsive-table-sort-arrow-gap);
    transform: none;
    transform-origin: center;
  }

  #progressionPage .playerTableScroller .sortArrow.asc {
    border-left: var(--mfl-responsive-table-sort-arrow-half-width) solid transparent;
    border-right: var(--mfl-responsive-table-sort-arrow-half-width) solid transparent;
    border-bottom: var(--mfl-responsive-table-sort-arrow-height) solid var(--text);
  }

  #progressionPage .playerTableScroller .sortArrow.desc {
    border-left: var(--mfl-responsive-table-sort-arrow-half-width) solid transparent;
    border-right: var(--mfl-responsive-table-sort-arrow-half-width) solid transparent;
    border-top: var(--mfl-responsive-table-sort-arrow-height) solid var(--text);
  }

  #progressionPage .playerTableScroller td.col-age .tableControlCellContent {
    gap: var(--mfl-responsive-table-age-marker-gap);
  }

  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker),
  #progressionPage .playerTableScroller .retirementMarker::before,
  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) img,
  #progressionPage .playerTableScroller .newMintMarker .newMintIcon {
    aspect-ratio: 1 / 1;
  }

  #progressionPage .playerTableScroller .retirementMarker::before {
    -webkit-mask-size: contain;
    mask-size: contain;
  }

  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) img {
    object-fit: contain;
  }
}

/* The full intermediate 901-1366px shell shares compact table presentation.
 * Narrower 700/520/380 layers continue to own progressively tighter geometry.
 */
@media (min-width: 901px) and (max-width: 1366px) {
  #progressionPage {
    --mfl-table-header-height: 30px;
    --mfl-table-row-height: 26px;
    --mfl-table-row-outer-height: 30px;
  }

  #progressionPage .tableShell {
    position: relative;
  }

  #progressionPage .playerTableScroller {
    display: block;
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
    touch-action: auto;
    -webkit-mask-image: none;
    mask-image: none;
  }

  #progressionPage .playerTableScroller table {
    width: 100%;
    min-width: 760px;
    max-width: none;
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

  #progressionPage .playerTableScroller :is(th, td).col-listing {
    padding-inline: 0;
    text-align: center;
  }

  #progressionPage #tableBody .listingCellTableHost {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    margin-inline: auto;
  }

  #progressionPage .playerTableScroller .listingCellContent {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--mfl-responsive-table-listing-content-size);
    min-width: var(--mfl-responsive-table-listing-content-size);
    max-width: var(--mfl-responsive-table-listing-content-size);
    height: var(--mfl-responsive-table-listing-content-size);
    min-height: var(--mfl-responsive-table-listing-content-size);
    max-height: var(--mfl-responsive-table-listing-content-size);
    margin-inline: auto;
    gap: 0;
    padding: 0;
  }

  #progressionPage #tableBody :is(.tableControlCellContent, .tableOverallCellContent) {
    align-items: center;
  }

  #progressionPage #tableBody :is(.tableControlCellContent, .tableOverallCellContent) > * {
    align-self: center;
  }

  #progressionPage .playerTableScroller :is(th, td).selectionCell input,
  #progressionPage .quickFilters input[type="checkbox"] {
    box-sizing: border-box;
    flex: 0 0 var(--mfl-responsive-table-checkbox-size);
    width: var(--mfl-responsive-table-checkbox-size);
    min-width: var(--mfl-responsive-table-checkbox-size);
    max-width: var(--mfl-responsive-table-checkbox-size);
    height: var(--mfl-responsive-table-checkbox-size);
    min-height: var(--mfl-responsive-table-checkbox-size);
    max-height: var(--mfl-responsive-table-checkbox-size);
    aspect-ratio: 1 / 1;
    background-size: var(--mfl-responsive-table-checkbox-check-width) var(--mfl-responsive-table-checkbox-check-height);
    border-radius: 3px;
  }

  #progressionPage .playerTableScroller .playerTableActionsButton {
    width: var(--mfl-responsive-table-action-size);
    min-width: var(--mfl-responsive-table-action-size);
    max-width: var(--mfl-responsive-table-action-size);
    height: var(--mfl-responsive-table-action-size);
    min-height: var(--mfl-responsive-table-action-size);
    max-height: var(--mfl-responsive-table-action-size);
    padding: 0;
  }

  #progressionPage .playerTableScroller .playerTableActionsButton svg {
    width: var(--mfl-responsive-table-action-icon-size);
    height: var(--mfl-responsive-table-action-icon-size);
  }

  #progressionPage .playerTableScroller .flagImage {
    width: var(--mfl-responsive-table-flag-size);
    height: var(--mfl-responsive-table-flag-size);
  }

  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) {
    flex: 0 0 var(--mfl-responsive-table-age-marker-size);
    width: var(--mfl-responsive-table-age-marker-size);
    min-width: var(--mfl-responsive-table-age-marker-size);
    max-width: var(--mfl-responsive-table-age-marker-size);
    height: var(--mfl-responsive-table-age-marker-size);
    min-height: var(--mfl-responsive-table-age-marker-size);
    max-height: var(--mfl-responsive-table-age-marker-size);
    margin: 0;
    transform: none;
  }

  #progressionPage .playerTableScroller .retirementMarker::before,
  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) img,
  #progressionPage .playerTableScroller .newMintMarker .newMintIcon {
    width: var(--mfl-responsive-table-age-marker-size);
    height: var(--mfl-responsive-table-age-marker-size);
  }

  #progressionPage .playerTableScroller .playerNoteIcon {
    font-size: var(--mfl-responsive-table-note-icon-size);
    line-height: 1;
  }

  #progressionPage .playerTableScroller .listingCellIcon {
    flex: 0 0 var(--mfl-responsive-table-listing-icon-size);
    width: var(--mfl-responsive-table-listing-icon-size);
    height: var(--mfl-responsive-table-listing-icon-size);
  }

  #progressionPage #tableBody .tableOverallRarityCircle {
    flex: 0 0 var(--mfl-responsive-table-rarity-size);
    width: var(--mfl-responsive-table-rarity-size);
    height: var(--mfl-responsive-table-rarity-size);
    margin-right: 1px;
  }
}

@media (min-width: 1367px) and (max-width: 1664px) {
  #progressionPage .playerTableScroller :is(th, td).selectionCell input,
  #progressionPage .quickFilters input[type="checkbox"] {
    flex-basis: var(--mfl-responsive-table-checkbox-size);
    width: var(--mfl-responsive-table-checkbox-size);
    min-width: var(--mfl-responsive-table-checkbox-size);
    max-width: var(--mfl-responsive-table-checkbox-size);
    height: var(--mfl-responsive-table-checkbox-size);
    min-height: var(--mfl-responsive-table-checkbox-size);
    max-height: var(--mfl-responsive-table-checkbox-size);
    background-size: var(--mfl-responsive-table-checkbox-check-width) var(--mfl-responsive-table-checkbox-check-height);
  }

  #progressionPage .playerTableScroller .playerTableActionsButton {
    width: var(--mfl-responsive-table-action-size);
    min-width: var(--mfl-responsive-table-action-size);
    max-width: var(--mfl-responsive-table-action-size);
    height: var(--mfl-responsive-table-action-size);
    min-height: var(--mfl-responsive-table-action-size);
    max-height: var(--mfl-responsive-table-action-size);
  }

  #progressionPage .playerTableScroller .playerTableActionsButton svg {
    width: var(--mfl-responsive-table-action-icon-size);
    height: var(--mfl-responsive-table-action-icon-size);
  }

  #progressionPage .playerTableScroller .flagImage {
    width: var(--mfl-responsive-table-flag-size);
    height: var(--mfl-responsive-table-flag-size);
  }

  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) {
    flex: 0 0 var(--mfl-responsive-table-age-marker-size);
    width: var(--mfl-responsive-table-age-marker-size);
    min-width: var(--mfl-responsive-table-age-marker-size);
    max-width: var(--mfl-responsive-table-age-marker-size);
    height: var(--mfl-responsive-table-age-marker-size);
    min-height: var(--mfl-responsive-table-age-marker-size);
    max-height: var(--mfl-responsive-table-age-marker-size);
    margin: 0;
  }

  #progressionPage .playerTableScroller .retirementMarker::before,
  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) img,
  #progressionPage .playerTableScroller .newMintMarker .newMintIcon {
    width: var(--mfl-responsive-table-age-marker-size);
    height: var(--mfl-responsive-table-age-marker-size);
  }

  #progressionPage .playerTableScroller .playerNoteIcon {
    font-size: var(--mfl-responsive-table-note-icon-size);
  }

  #progressionPage .playerTableScroller .listingCellIcon {
    flex-basis: var(--mfl-responsive-table-listing-icon-size);
    width: var(--mfl-responsive-table-listing-icon-size);
    height: var(--mfl-responsive-table-listing-icon-size);
  }

  #progressionPage #tableBody .tableOverallRarityCircle {
    flex-basis: var(--mfl-responsive-table-rarity-size);
    width: var(--mfl-responsive-table-rarity-size);
    height: var(--mfl-responsive-table-rarity-size);
  }
}

@media (max-width: 1366px) {
  #progressionPage .playerTableScroller .playerNameFullValue {
    display: none;
  }

  #progressionPage .playerTableScroller .playerNameCompactValue {
    display: inline;
  }

  #progressionPage .playerTableScroller .listingCellPrice {
    display: none;
  }
}

@media (max-width: 520px) {
  #progressionPage .playerTableScroller .joinedAgencyFullValue {
    display: none;
  }

  #progressionPage .playerTableScroller .joinedAgencyCompactValue {
    display: inline;
  }
}
