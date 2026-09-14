
  /* Mobile Player Note and Listing share one exact 14px corner alignment axis. */
  .playerHeroIdentity .playerTitle > .playerTitleNoteIcon:empty {
    display: none;
  }

  .playerHeroIdentity .playerTitle > :is(.playerTitleNoteIcon:not(:empty), .playerListingBadge) {
    position: absolute;
    top: var(--mfl-player-panel-padding);
    display: grid;
    place-items: center;
    box-sizing: border-box;
    width: 14px;
    min-width: 14px;
    max-width: 14px;
    height: 14px;
    min-height: 14px;
    max-height: 14px;
    margin: 0;
    padding: 0;
    line-height: 0;
  }

  .playerHeroIdentity .playerTitle > .playerListingBadge {
    right: var(--mfl-player-panel-padding);
  }

  .playerHeroIdentity .playerTitle > .playerTitleNoteIcon:not(:empty) {
    right: calc(var(--mfl-player-panel-padding) + 22px);
    overflow: visible;
  }

  .playerHeroIdentity .playerTitle > .playerTitleNoteIcon > .playerNoteIcon {
    position: relative;
    display: grid;
    place-items: center;
    width: 14px;
    min-width: 14px;
    max-width: 14px;
    height: 14px;
    min-height: 14px;
    max-height: 14px;
    margin: 0;
    padding: 0;
    overflow: visible;
    color: var(--text-soft);
    font-size: 0;
    line-height: 0;
  }

  .playerHeroIdentity .playerTitle > .playerTitleNoteIcon > .playerNoteIcon > .playerNoteIconSvg,
  .playerHeroIdentity .playerTitle > .playerListingBadge .listingCellIcon {
    display: block;
    place-self: center;
    width: 14px;
    min-width: 14px;
    max-width: 14px;
    height: 14px;
    min-height: 14px;
    max-height: 14px;
    margin: 0;
  }

  .playerHeroIdentity .playerTitle > .playerTitleNoteIcon > .playerNoteIcon > .playerNoteIconSvg {
    flex: 0 0 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .playerHeroIdentity .playerTitle > .playerListingBadge .listingCellIcon {
    object-fit: contain;
    object-position: center;
  }

  .playerHeroIdentity .playerTitle > .playerTitleNoteIcon > .playerNoteIcon[data-tooltip]::after {
    font-size: 12px;
    line-height: 1.35;
  }

