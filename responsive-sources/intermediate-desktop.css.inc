@media (min-width: 901px) and (max-width: 1444px) {
  .stats div {
    width: 116px;
    min-width: 116px;
    padding: 7px 18px;
  }

  .stats > div > span {
    overflow: visible;
    text-overflow: clip;
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

  .accountMenu {
    flex-basis: 44px;
    width: 44px;
  }
}
