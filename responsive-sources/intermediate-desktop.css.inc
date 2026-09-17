#progressionPage #tableHead .rowActionsCell .playerTableActionsButton {
  display: none;
}

@media (min-width: 901px) and (max-width: 1444px) {
  #progressionPage #tableHead .rowActionsCell {
    overflow: hidden;
  }

  #progressionPage #tableHead .rowActionsCell > * {
    display: none;
  }

  #progressionPage #tableHead .rowActionsCell::before,
  #progressionPage #tableHead .rowActionsCell::after {
    content: none;
    display: none;
  }
}

@media (min-width: 901px) and (max-width: 1366px) {
  .playerPage .playerHero {
    padding-bottom: 4px;
  }
}

@media (min-width: 1041px) and (max-width: 1366px) {
  .topbar {
    grid-template-columns: minmax(0, 1fr) minmax(180px, 320px) max-content;
  }

  .stats div {
    width: 72px;
    min-width: 72px;
    padding-inline: 6px;
  }

  .accountMenu {
    flex: 0 0 96px;
    width: 96px;
  }
}

@media (min-width: 901px) and (max-width: 1040px) {
  .topbar {
    grid-template-columns: minmax(0, 1fr) 44px max-content;
    gap: 8px;
    padding-inline: 12px;
  }

  .stats div {
    width: 68px;
    min-width: 68px;
    padding-inline: 5px;
  }

  .accountMenu {
    flex-basis: 44px;
    width: 44px;
  }
}
