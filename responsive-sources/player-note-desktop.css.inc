
/* Desktop Player title controls align to the existing Player-name line without changing its geometry. */
@media (min-width: 901px) {
  .playerHeroIdentity {
    flex: 1 1 360px;
    width: auto;
    max-width: 600px;
  }

  .playerHeroIdentity .playerTitle {
    align-items: baseline;
    flex-wrap: nowrap;
  }

  .playerHeroIdentity .playerTitle > .playerTitleName {
    order: 0;
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .playerHeroIdentity .playerTitle > .playerTitleNoteIcon {
    position: static;
    order: 1;
    display: grid;
    place-items: center;
    flex: 0 0 22px;
    align-self: center;
    width: 22px;
    min-width: 22px;
    max-width: 22px;
    height: 22px;
    min-height: 22px;
    max-height: 22px;
    margin: 0;
    padding: 0;
    line-height: 0;
  }

  .playerHeroIdentity .playerTitle > .playerTitleNoteIcon:empty {
    display: none;
  }

  .playerHeroIdentity .playerTitle > .playerTitleNoteIcon > .playerNoteIcon {
    position: relative;
    display: grid;
    place-items: center;
    width: 18px;
    min-width: 18px;
    max-width: 18px;
    height: 18px;
    min-height: 18px;
    max-height: 18px;
    margin: 0;
    padding: 0;
    overflow: visible;
    color: var(--text-soft);
    font-size: 0;
    line-height: 0;
  }

  .playerHeroIdentity .playerTitle > .playerTitleNoteIcon > .playerNoteIcon > .playerNoteIconSvg {
    display: block;
    flex: 0 0 18px;
    width: 18px;
    min-width: 18px;
    max-width: 18px;
    height: 18px;
    min-height: 18px;
    max-height: 18px;
    margin: 0;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .playerHeroIdentity .playerTitle > .playerTitleNoteIcon > .playerNoteIcon[data-tooltip]::after {
    font-size: 12px;
    line-height: 1.35;
  }

  .playerHeroIdentity .playerTitle > .playerListingBadge {
    position: relative;
    top: auto;
    right: auto;
    order: 2;
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    align-self: center;
    width: max-content;
    min-width: 0;
    max-width: none;
    height: 22px;
    min-height: 22px;
    max-height: 22px;
    margin: 0;
    padding: 0 5px 0 23px;
    font-size: 16px;
    line-height: 1;
    white-space: nowrap;
  }

  .playerHeroIdentity .playerTitle > .playerListingBadge .listingCellIcon {
    position: absolute;
    top: 4px;
    left: 5px;
    display: block;
    width: 14px;
    height: 14px;
    margin: 0;
  }

  .playerHeroIdentity .playerTitle > .playerListingBadge .listingCellPrice {
    display: block;
    line-height: 1;
  }

  .playerNotesInput {
    min-height: 150px;
  }
}
