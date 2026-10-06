function currentPageRows() {
  if (state.incrementalMode) {
    return state.filteredRows;
  }

  const totalPages = Math.max(1, Math.ceil(state.filteredRows.length / state.pageSize));
  const currentPage = Math.min(state.page, totalPages);
  const start = (currentPage - 1) * state.pageSize;
  return state.filteredRows.slice(start, start + state.pageSize);
}

function updateSelectionHeader(pageRows = currentPageRows(), { rendered = false } = {}) {
  const selectVisibleInput = document.querySelector("#selectVisiblePlayersInput");

  if (!selectVisibleInput) {
    return;
  }

  if (document.documentElement.classList.contains("mflDataLoading") && !rendered) {
  selectVisibleInput.checked = false;
  selectVisibleInput.indeterminate = false;
  selectVisibleInput.disabled = true;
  if (document.activeElement === selectVisibleInput) {
    selectVisibleInput.blur();
  }
  return;
}

  const visibleIds = pageRows.map((row) => String(getValue(row, "player_id")));
  const selectedVisibleCount = visibleIds.filter((playerId) => state.selectedPlayerIds.has(playerId)).length;

  selectVisibleInput.disabled = visibleIds.length === 0;
  selectVisibleInput.checked = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  selectVisibleInput.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
}

function updateSelectionBar(pageRows = currentPageRows(), options = {}) {
  const selectedCount = state.selectedPlayerIds.size;
  const optedIn = hasWalletOptIn();
  selectionBar.classList.toggle("visible", selectedCount > 0);
  selectionCount.textContent = `${selectedCount} selected`;
  addToWatchlistButton.hidden = !optedIn;
  addToWatchlistButton.textContent = state.currentPage === "watchlist" ? "Remove from watchlist" : "Add to watchlist";
  if (moveToWatchlistButton) {
    moveToWatchlistButton.hidden = !optedIn || state.currentPage !== "watchlist" || selectedCount <= 0;
  }
  updateSelectionHeader(pageRows, options);
}

function setVisiblePlayersSelected(selected) {
  state.selectionAnchorPlayerId = null;

  currentPageRows().forEach((row) => {
    const playerId = String(getValue(row, "player_id"));

    if (selected) {
      state.selectedPlayerIds.add(playerId);
    } else {
      state.selectedPlayerIds.delete(playerId);
    }
  });

  renderTable();
  saveTableState();
}

function setPlayerSelected(playerId, selected, shiftKey = false) {
  const key = String(playerId);
  const anchorKey = state.selectionAnchorPlayerId;
  const filteredIds = state.filteredRows.map((row) => String(getValue(row, "player_id")));
  const anchorIndex = filteredIds.indexOf(anchorKey);
  const currentIndex = filteredIds.indexOf(key);

  if (shiftKey && anchorKey && anchorIndex >= 0 && currentIndex >= 0) {
    const start = Math.min(anchorIndex, currentIndex);
    const end = Math.max(anchorIndex, currentIndex);

    filteredIds.slice(start, end + 1).forEach((rangePlayerId) => {
      if (selected) {
        state.selectedPlayerIds.add(rangePlayerId);
      } else {
        state.selectedPlayerIds.delete(rangePlayerId);
      }
    });

    renderTable();
    saveTableState();
    return;
  }

  if (selected) {
    state.selectedPlayerIds.add(key);
  } else {
    state.selectedPlayerIds.delete(key);
  }

  state.selectionAnchorPlayerId = key;
  updateSelectionBar();
  saveTableState();
}

function tableClearSelectionOwner() {
  state.selectedPlayerIds.clear();
  state.selectionAnchorPlayerId = null;
  renderTable();
  updateSelectionBar();
  saveTableState();
}

function tableAddSelectedToWatchlistOwner() {
  const selectedCount = state.selectedPlayerIds.size;

  if (!selectedCount) {
    return;
  }

  if (state.currentPage === "watchlist") {
    const removedIds = selectedPlayerIdsArray();
    const removedWatchlist = activeWatchlist();
    removedIds.forEach((playerId) => {
      const key = String(playerId);
      state.watchlistPlayerIds.delete(key);
      trackWatchlistChange(key, false);
    });
    state.selectedPlayerIds.clear();
    state.selectionAnchorPlayerId = null;
    syncActiveWatchlistFromSet();
    renderWatchlistSwitcher();
    saveWatchlistStateAfterAction();
    applyFilters();
    showWatchlistActionToast(removedIds, removedIds.length, "removed from", removedWatchlist?.id);
    return;
  }

  const selectedIds = selectedPlayerIdsArray();
  const watchlists = normalizeWatchlists(state.watchlists, Array.from(state.watchlistPlayerIds));
  state.watchlists = watchlists;

  if (hasWalletOptIn() && watchlists.length > 1) {
    openWatchlistChoiceModal("add", selectedIds);
    return;
  }

  performWatchlistChoiceAction("add", activeWatchlist()?.id || ensureDefaultWatchlist()?.id || "", selectedIds);
}

function tableMoveSelectedToWatchlistOwner() {
  if (state.currentPage !== "watchlist" || !state.selectedPlayerIds.size) {
    return;
  }

  openWatchlistChoiceModal("move", selectedPlayerIdsArray());
}

function tableOpenSelectedPlayerLinksOwner() {
  if (!state.selectedPlayerIds.size) {
    return;
  }

  const playerUrls = Array.from(state.selectedPlayerIds).map((playerId) => {
    const safePlayerId = encodeURIComponent(playerId);
    return `https://app.playmfl.com/players/${safePlayerId}`;
  });
  const reservedTabs = [];

  for (const playerUrl of playerUrls) {
    const reservedTab = window.open("about:blank", "_blank");

    if (!reservedTab) {
      reservedTabs.forEach((tab) => tab.close());
      showToast("Allow pop-ups for this site, then click Open links again.");
      return;
    }

    reservedTabs.push(reservedTab);
  }

  reservedTabs.forEach((tab, index) => {
    tab.opener = null;
    tab.location.href = playerUrls[index];
  });
}
