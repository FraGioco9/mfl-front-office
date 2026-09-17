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
    --mfl-intermediate-age-marker-size: clamp(11px, calc(5.1871px + 0.645161vw), 14px);
    --mfl-intermediate-listing-icon-size: clamp(9px, calc(3.1871px + 0.645161vw), 12px);
    --mfl-intermediate-flag-size: clamp(14px, calc(2.3742px + 1.290323vw), 20px);
    --mfl-intermediate-note-icon-size: clamp(9px, calc(-0.6882px + 1.075269vw), 14px);
    --mfl-intermediate-rarity-size: clamp(5px, calc(-0.8129px + 0.645161vw), 8px);
    --mfl-intermediate-checkbox-size: clamp(13px, calc(7.1871px + 0.645161vw), 16px);
    --mfl-intermediate-checkbox-check-width: clamp(8px, calc(4.1247px + 0.430108vw), 10px);
    --mfl-intermediate-checkbox-check-height: clamp(6px, calc(2.1247px + 0.430108vw), 8px);
    --mfl-intermediate-action-size: clamp(18px, calc(14.1247px + 0.430108vw), 20px);
    --mfl-intermediate-listing-content-size: var(--mfl-intermediate-action-size);
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
    width: var(--mfl-intermediate-listing-content-size);
    min-width: var(--mfl-intermediate-listing-content-size);
    max-width: var(--mfl-intermediate-listing-content-size);
    height: var(--mfl-intermediate-listing-content-size);
    min-height: var(--mfl-intermediate-listing-content-size);
    max-height: var(--mfl-intermediate-listing-content-size);
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
    flex: 0 0 var(--mfl-intermediate-checkbox-size);
    width: var(--mfl-intermediate-checkbox-size);
    min-width: var(--mfl-intermediate-checkbox-size);
    max-width: var(--mfl-intermediate-checkbox-size);
    height: var(--mfl-intermediate-checkbox-size);
    min-height: var(--mfl-intermediate-checkbox-size);
    max-height: var(--mfl-intermediate-checkbox-size);
    aspect-ratio: 1 / 1;
    background-size: var(--mfl-intermediate-checkbox-check-width) var(--mfl-intermediate-checkbox-check-height);
    border-radius: 3px;
  }

  #progressionPage .playerTableScroller .playerTableActionsButton {
    width: var(--mfl-intermediate-action-size);
    min-width: var(--mfl-intermediate-action-size);
    max-width: var(--mfl-intermediate-action-size);
    height: var(--mfl-intermediate-action-size);
    min-height: var(--mfl-intermediate-action-size);
    max-height: var(--mfl-intermediate-action-size);
    padding: 0;
  }

  #progressionPage .playerTableScroller .playerTableActionsButton svg {
    width: 12px;
    height: 12px;
  }

  #progressionPage .playerTableScroller .flagImage {
    width: var(--mfl-intermediate-flag-size);
    height: var(--mfl-intermediate-flag-size);
  }

  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) {
    flex: 0 0 var(--mfl-intermediate-age-marker-size);
    width: var(--mfl-intermediate-age-marker-size);
    min-width: var(--mfl-intermediate-age-marker-size);
    max-width: var(--mfl-intermediate-age-marker-size);
    height: var(--mfl-intermediate-age-marker-size);
    min-height: var(--mfl-intermediate-age-marker-size);
    max-height: var(--mfl-intermediate-age-marker-size);
    margin: 0;
    transform: none;
  }

  #progressionPage .playerTableScroller .retirementMarker::before,
  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) img,
  #progressionPage .playerTableScroller .newMintMarker .newMintIcon {
    width: var(--mfl-intermediate-age-marker-size);
    height: var(--mfl-intermediate-age-marker-size);
  }

  #progressionPage .playerTableScroller .playerNoteIcon {
    font-size: var(--mfl-intermediate-note-icon-size);
    line-height: 1;
  }

  #progressionPage .playerTableScroller .listingCellIcon {
    flex: 0 0 var(--mfl-intermediate-listing-icon-size);
    width: var(--mfl-intermediate-listing-icon-size);
    height: var(--mfl-intermediate-listing-icon-size);
  }

  #progressionPage #tableBody .tableOverallRarityCircle {
    flex: 0 0 var(--mfl-intermediate-rarity-size);
    width: var(--mfl-intermediate-rarity-size);
    height: var(--mfl-intermediate-rarity-size);
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
