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
    width: 18px;
    min-width: 18px;
    max-width: 18px;
    height: 18px;
    min-height: 18px;
    max-height: 18px;
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

  #progressionPage .playerTableScroller td.col-age .tableControlCellContent {
    gap: 3px;
  }

  #progressionPage .playerTableScroller :is(th, td).selectionCell input,
  #progressionPage .quickFilters input[type="checkbox"] {
    box-sizing: border-box;
    flex: 0 0 13px;
    width: 13px;
    min-width: 13px;
    max-width: 13px;
    height: 13px;
    min-height: 13px;
    max-height: 13px;
    aspect-ratio: 1 / 1;
    background-size: 8px 6px;
    border-radius: 3px;
  }

  #progressionPage .playerTableScroller .playerTableActionsButton {
    width: 18px;
    min-width: 18px;
    max-width: 18px;
    height: 18px;
    min-height: 18px;
    max-height: 18px;
    padding: 0;
  }

  #progressionPage .playerTableScroller .playerTableActionsButton svg {
    width: 12px;
    height: 12px;
  }

  #progressionPage .playerTableScroller .flagImage {
    width: 14px;
    height: 14px;
  }

  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) {
    flex: 0 0 11px;
    width: 11px;
    min-width: 11px;
    max-width: 11px;
    height: 11px;
    min-height: 11px;
    max-height: 11px;
    margin: 0;
    transform: none;
  }

  #progressionPage .playerTableScroller .retirementMarker::before,
  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) img,
  #progressionPage .playerTableScroller .newMintMarker .newMintIcon {
    width: 11px;
    height: 11px;
  }

  #progressionPage .playerTableScroller .playerNoteIcon {
    font-size: 9px;
    line-height: 1;
  }

  #progressionPage .playerTableScroller .listingCellIcon {
    flex: 0 0 9px;
    width: 9px;
    height: 9px;
  }

  #progressionPage #tableBody .tableOverallRarityCircle {
    flex: 0 0 5px;
    width: 5px;
    height: 5px;
    margin-right: 1px;
  }

  #progressionPage .playerTableScroller .sortArrow {
    transform: scale(0.75);
    transform-origin: center;
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

@media (max-width: 700px) {
  #progressionPage .playerTableScroller #tableBody td.col-age .tableControlCellContent {
    gap: 2px;
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

@media (max-width: 380px) {
  #progressionPage .playerTableScroller #tableBody td.col-age .tableControlCellContent {
    gap: 1px;
  }
}
