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

@media (max-width: 900px) {
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
