function copyDelegatedPlayerId(button, event) {
  const playerId = String(button.dataset.playerId || "").trim();
  if (!playerId) return;
  event.preventDefault();
  event.stopPropagation();
  state.tooltipSuppressedUntil = Date.now() + 350;
  button.blur();
  copyPlayerId(playerId);
}

tableBody?.addEventListener("pointerdown", (event) => {
  if (event.isPrimary === false || event.button !== 0 || !(event.target instanceof Element)) return;
  const button = event.target.closest(".copyPlayerIdButton[data-player-id]");
  if (!(button instanceof HTMLButtonElement) || !tableBody.contains(button)) return;
  copyDelegatedPlayerId(button, event);
});

tableBody?.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;

  const copyButton = event.target.closest(".copyPlayerIdButton[data-player-id]");
  if (copyButton instanceof HTMLButtonElement && tableBody.contains(copyButton)) {
    if (Date.now() < state.tooltipSuppressedUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    copyDelegatedPlayerId(copyButton, event);
    return;
  }

  const selectionInput = event.target.closest('.selectionCell input[type="checkbox"][data-player-id]');
  if (selectionInput instanceof HTMLInputElement && tableBody.contains(selectionInput)) {
    setPlayerSelected(selectionInput.dataset.playerId || "", selectionInput.checked, event.shiftKey);
    return;
  }

  const playerLink = event.target.closest(".playerNameLink[data-player-id]");
  if (playerLink instanceof HTMLAnchorElement && tableBody.contains(playerLink)) {
    event.preventDefault();
    openPlayerPage(playerLink.dataset.playerId || "");
    return;
  }

  const agentLink = event.target.closest(".agentTableLink[data-wallet-address]");
  if (agentLink instanceof HTMLAnchorElement && tableBody.contains(agentLink)) {
    event.preventDefault();
    openAgentPage(agentLink.dataset.walletAddress || "", agentLink.dataset.agentName || agentLink.textContent || "");
    return;
  }

  const clubLink = event.target.closest(".agentTableLink[data-club-id]");
  if (clubLink instanceof HTMLAnchorElement && tableBody.contains(clubLink) && typeof window.mflOpenClubPage === "function") {
    event.preventDefault();
    window.mflOpenClubPage(clubLink.dataset.clubId || "", "attributes");
  }
});

tableBody?.addEventListener("pointermove", (event) => {
  const row = event.target?.closest?.("#tableBody tr");
  const nextId = String(row?.dataset?.playerId || "").trim();
  const interactive = event.target?.closest?.("[data-table-interactive-key]");
  const interactiveKey = String(interactive?.dataset?.tableInteractiveKey || "");

  if (row && nextId && state.hoveredTablePlayerId !== nextId) {
    state.hoveredTablePlayerId = nextId;
    tableBody.querySelectorAll("tr.tableRowHovered").forEach((tableRow) => tableRow.classList.remove("tableRowHovered"));
    row.classList.add("tableRowHovered");
  }

  if (state.hoveredTableInteractiveKey !== interactiveKey) {
    state.hoveredTableInteractiveKey = interactiveKey;
    tableBody.querySelectorAll(".tableInteractiveHovered").forEach((element) => element.classList.remove("tableInteractiveHovered"));
    if (interactive) {
      interactive.classList.add("tableInteractiveHovered");
    }
  }
});

tableBody?.addEventListener("pointerleave", () => {
  state.hoveredTablePlayerId = "";
  state.hoveredTableInteractiveKey = "";
  tableBody.querySelectorAll("tr.tableRowHovered").forEach((tableRow) => tableRow.classList.remove("tableRowHovered"));
  tableBody.querySelectorAll(".tableInteractiveHovered").forEach((element) => element.classList.remove("tableInteractiveHovered"));
});

__mflTableTitleForPageOwner = tableTitleForPageOwner;
__mflTableEnsureAgentPageTitleNameOwner = tableEnsureAgentPageTitleNameOwner;
__mflTableBuildTableColGroupOwner = tableBuildTableColGroupOwner;
__mflTableBuildHeaderOwner = tableBuildHeaderOwner;
__mflTableUpdateSelectionHeaderOwner = updateSelectionHeader;
__mflTableBuildOperatorSelectOwner = tableBuildOperatorSelectOwner;
__mflTableRuleMatchesOwner = tableRuleMatchesOwner;
__mflTableAddFilterRuleOwner = tableAddFilterRuleOwner;
__mflTableRestoreSavedTableStateOwner = tableRestoreSavedTableStateOwner;
__mflTableApplyFiltersOwner = tableApplyFiltersOwner;
__mflTableRenderTableOwner = tableRenderTableOwner;
__mflTableOpenFiltersOwner = tableOpenFiltersOwner;
__mflTableClearAdvancedFiltersOwner = tableClearAdvancedFiltersOwner;
__mflTableCloseFiltersOwner = tableCloseFiltersOwner;
__mflTableApplyAdvancedFiltersOwner = tableApplyAdvancedFiltersOwner;
__mflTableClearSelectionOwner = tableClearSelectionOwner;
__mflTableAddSelectedToWatchlistOwner = tableAddSelectedToWatchlistOwner;
__mflTableMoveSelectedToWatchlistOwner = tableMoveSelectedToWatchlistOwner;
__mflTableOpenSelectedPlayerLinksOwner = tableOpenSelectedPlayerLinksOwner;
__mflTableSetViewOwner = tableSetViewOwner;

openFiltersButton.addEventListener("click", openFilters);
quickClearFiltersButton.addEventListener("click", clearAdvancedFilters);
closeFiltersButton.addEventListener("click", closeFilters);
applyFiltersButton.addEventListener("click", applyAdvancedFilters);
clearSelectionButton.addEventListener("click", clearSelection);
addToWatchlistButton.addEventListener("click", addSelectedToWatchlist);
moveToWatchlistButton?.addEventListener("click", moveSelectedToWatchlist);
openSelectedLinksButton.addEventListener("click", openSelectedPlayerLinks);

pageSizeSelect.addEventListener("change", () => {
  state.pageSize = Number(pageSizeSelect.value);
  state.page = 1;
  if (state.incrementalMode) {
    void reloadIncrementalPage(1);
    return;
  }
  renderTable();
});

hideRetiredInput.addEventListener("change", () => {
  state.page = 1;
  applyFilters();
});

hideRetiringInput.addEventListener("change", () => {
  state.page = 1;
  applyFilters();
});


hideMflPlayersInput?.addEventListener("change", () => {
  state.page = 1;
  applyFilters();
});
packablePlayersInput?.addEventListener("change", () => {
  if (state.currentPage === "mfl" && packablePlayersInput.checked) {
    newMintsInput.checked = false;
  }
  state.page = 1;
  applyFilters();
});

newMintsInput.addEventListener("change", () => {
  if (state.currentPage === "mfl" && newMintsInput.checked && packablePlayersInput) {
    packablePlayersInput.checked = false;
  }
  state.page = 1;
  applyFilters();
});


showAddFilterButton.addEventListener("click", () => {
  addFilterSelect.hidden = !addFilterSelect.hidden;

  if (!addFilterSelect.hidden) {
    addFilterSelect.focus();
  }
});

addFilterSelect.addEventListener("change", () => {
  if (!addFilterSelect.value) {
    return;
  }

  addFilterRule(addFilterSelect.value);
  addFilterSelect.value = "";
  addFilterSelect.hidden = true;
});

setupBackdropClickClose(filtersModal, () => closeFilters());

clearFiltersButton.addEventListener("click", () => {
  clearAdvancedFilters(false);
  applyAdvancedFilters();
});

prevButton.addEventListener("click", () => {
  if (state.incrementalMode) {
    void reloadIncrementalPage(Math.max(1, state.page - 1), { loadingMode: "blank" });
    return;
  }
  state.page -= 1;
  renderTable();
});

nextButton.addEventListener("click", () => {
  if (state.incrementalMode) {
    void reloadIncrementalPage(state.page + 1, { loadingMode: "blank" });
    return;
  }
  state.page += 1;
  renderTable();
});
