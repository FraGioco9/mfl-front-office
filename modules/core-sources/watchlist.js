function watchlistRenderSwitcherOwner() {
  if (!watchlistSwitcher || !watchlistButton || !watchlistButtonText || !watchlistDropdown) {
    updateWatchlistTitle();
    return;
  }

  const visible = state.currentPage === "watchlist" && hasWalletOptIn();
  watchlistSwitcher.hidden = !visible;
  if (!visible) {
    closeWatchlistDropdown();
    updateWatchlistTitle();
    updateTablePlayerCount();
    return;
  }

  const watchlists = normalizeWatchlists(state.watchlists, Array.from(state.watchlistPlayerIds));
  state.watchlists = watchlists;
  if (!watchlists.some((watchlist) => watchlist.id === state.currentWatchlistId)) {
    state.currentWatchlistId = watchlists[0]?.id || "";
    setActiveWatchlistIds(watchlists[0]?.playerIds || []);
  }

  watchlistButtonText.textContent = currentWatchlistName();
  watchlistDropdown.replaceChildren();

  watchlists.forEach((watchlist) => {
    const item = document.createElement("div");
    item.className = "watchlistDropdownItem";
    item.classList.toggle("active", watchlist.id === state.currentWatchlistId);
    item.dataset.watchlistId = watchlist.id;

    const nameButton = document.createElement("button");
    nameButton.type = "button";
    nameButton.className = "watchlistDropdownName";
    const playerCount = normalizeWatchlistIdList(watchlist.playerIds).length;
    nameButton.innerHTML = `<span class="watchlistDropdownNameText">${escapeHtml(watchlist.name)}</span><span class="watchlistDropdownCount">${playerCount} player${playerCount === 1 ? "" : "s"}</span>`;
    nameButton.addEventListener("click", () => {
      closeWatchlistDropdown();
      switchWatchlist(watchlist.id);
    });

    const actions = document.createElement("span");
    actions.className = "watchlistDropdownActions";

    const renameButton = document.createElement("button");
    renameButton.type = "button";
    renameButton.className = "evaluationLoadIconButton watchlistDropdownAction watchlistDropdownRename";
    renameButton.setAttribute("aria-label", "Rename watchlist");
    renameButton.dataset.tooltip = "Rename";
    renameButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path></svg>';
    renameButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openRenameWatchlistModal(watchlist.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "evaluationLoadIconButton evaluationLoadDeleteButton watchlistDropdownAction watchlistDropdownDelete";
    deleteButton.setAttribute("aria-label", "Delete watchlist");
    deleteButton.dataset.tooltip = watchlists.length <= 1 ? "You need at least one watchlist" : "Delete";
    if (watchlists.length <= 1) {
      deleteButton.dataset.tooltipPlacement = "left";
    }
    deleteButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M6 7l1 14h10l1-14"></path><path d="M9 7V4h6v3"></path></svg>';
    deleteButton.disabled = watchlists.length <= 1;
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (deleteButton.disabled) {
        return;
      }
      openDeleteWatchlistModal(watchlist.id);
    });

    actions.append(renameButton, deleteButton);
    item.append(nameButton, actions);
    watchlistDropdown.appendChild(item);
  });

  if (watchlists.length < MAX_WATCHLISTS) {
    const separator = document.createElement("div");
    separator.className = "watchlistDropdownSeparator";
    watchlistDropdown.appendChild(separator);

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "watchlistDropdownItem watchlistDropdownAdd";
    addButton.textContent = "Add Watchlist";
    addButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openAddWatchlistModal();
    });
    watchlistDropdown.appendChild(addButton);
  }

  updateWatchlistTitle();
  updateTablePlayerCount();
}

function openWatchlistDropdown() {
  if (!watchlistDropdown || !watchlistButton || watchlistSwitcher?.hidden) {
    return;
  }

  renderWatchlistSwitcher();
  watchlistDropdown.hidden = false;
  watchlistButton.setAttribute("aria-expanded", "true");
}

function watchlistCloseDropdownOwner() {
  if (!watchlistDropdown || !watchlistButton) {
    return;
  }

  watchlistDropdown.hidden = true;
  watchlistButton.setAttribute("aria-expanded", "false");
}

function watchlistToggleDropdownOwner() {
  if (!watchlistDropdown || watchlistDropdown.hidden) {
    openWatchlistDropdown();
  } else {
    closeWatchlistDropdown();
  }
}

function openRenameWatchlistModal(watchlistId) {
  hideEvaluationLoadActionTooltip();
  const watchlist = state.watchlists.find((item) => item.id === watchlistId);
  if (!watchlist) {
    renderWatchlistSwitcher();
    return;
  }

  state.editingWatchlistId = watchlist.id;
  state.pendingAddWatchlistContext = "rename";
  if (addWatchlistTitle) {
    addWatchlistTitle.textContent = "Rename watchlist";
  }
  if (confirmAddWatchlistButton) {
    confirmAddWatchlistButton.textContent = "Confirm";
  }
  if (addWatchlistNameInput) {
    addWatchlistNameInput.value = watchlist.name;
    addWatchlistNameInput.removeAttribute("aria-invalid");
  }
  if (addWatchlistError) {
    addWatchlistError.hidden = true;
    addWatchlistError.textContent = "";
  }
  showModal(addWatchlistModal);
  window.setTimeout(() => {
    addWatchlistNameInput?.focus();
    addWatchlistNameInput?.select();
  }, 0);
}

function openDeleteWatchlistModal(watchlistId) {
  hideEvaluationLoadActionTooltip();
  const watchlist = state.watchlists.find((item) => item.id === watchlistId);
  if (!watchlist) {
    renderWatchlistSwitcher();
    return;
  }

  if (state.watchlists.length <= 1) {
    renderWatchlistSwitcher();
    showGenericToast("You need at least one watchlist.");
    return;
  }

  state.pendingDeleteWatchlistId = watchlist.id;
  if (deleteWatchlistName) {
    deleteWatchlistName.textContent = watchlist.name;
  }
  showModal(deleteWatchlistModal);
  window.setTimeout(() => cancelDeleteWatchlistButton?.focus(), 0);
}

__mflWatchlistRenderSwitcherOwner = watchlistRenderSwitcherOwner;
__mflWatchlistCloseDropdownOwner = watchlistCloseDropdownOwner;
__mflWatchlistToggleDropdownOwner = watchlistToggleDropdownOwner;
