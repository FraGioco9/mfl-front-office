function removePlayerIdFromAllWatchlists(playerId) {
  const key = String(playerId);
  const removedFrom = [];

  state.watchlists.forEach((watchlist) => {
    const ids = normalizeWatchlistIdList(watchlist.playerIds);
    if (!ids.includes(key)) {
      return;
    }
    watchlist.playerIds = ids.filter((item) => String(item) !== key);
    removedFrom.push(watchlist);
  });

  if (removedFrom.some((watchlist) => watchlist.id === state.currentWatchlistId)) {
    state.watchlistPlayerIds.delete(key);
    syncActiveWatchlistFromSet();
  }

  return removedFrom;
}

function toggleWatchlistPlayer(playerId, rerender = false) {
  const key = String(playerId);
  const playerName = rowByPlayerId(key) ? formatCellValue(rowByPlayerId(key), "name") : `Player ${key}`;
  const inAnyWatchlist = playerIsInAnyWatchlist(key);

  if (inAnyWatchlist) {
    const removedFrom = removePlayerIdFromAllWatchlists(key);
    state.watchlistPlayerIdsAdded.delete(key);
    state.watchlistPlayerIdsRemoved.add(key);
    saveTableState();
    if (removedFrom.length === 1) {
      showWatchlistToast(`${playerName} removed from`, removedFrom[0].id, removedFrom[0].name);
    } else if (removedFrom.length > 1) {
      showGenericToast(`${playerName} removed from ${removedFrom.length} watchlists.`);
    }
  } else {
    const watchlists = normalizeWatchlists(state.watchlists, Array.from(state.watchlistPlayerIds));
    state.watchlists = watchlists;
    if (hasWalletOptIn() && watchlists.length > 1) {
      openWatchlistChoiceModal("add", [key]);
      return;
    }
    const target = activeWatchlist() || ensureDefaultWatchlist();
    const result = addPlayerIdsToWatchlist(target?.id || "", [key]);
    if (result.addedCount) {
      state.watchlistPlayerIdsAdded.add(key);
      state.watchlistPlayerIdsRemoved.delete(key);
      saveTableState();
      showWatchlistToast(`${playerName} added to`, target.id, target.name);
    }
    if (result.skippedCount) {
      showWatchlistFullToast();
      return;
    }
  }

  syncActiveWatchlistFromSet();

  if (state.currentPage === "watchlist") {
    applyFilters();
  } else if (rerender && tablePageKey()) {
    renderTable();
  }

  if (state.currentPage === "player") {
    renderPlayerPage(key);
  }
}
