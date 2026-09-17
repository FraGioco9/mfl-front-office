@media (min-width: 901px) and (max-width: 1444px) {
  .topbar h1 {
    overflow: visible;
    text-overflow: clip;
  }

  .stats div {
    width: 116px;
    min-width: 116px;
    height: 42px;
    padding: 4px 18px;
  }

  .stats > div > span {
    overflow: visible;
    text-overflow: clip;
    line-height: 1;
  }

  .stats label {
    margin-top: 0;
    line-height: 1;
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
