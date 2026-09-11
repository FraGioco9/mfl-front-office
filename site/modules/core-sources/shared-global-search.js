async function openSearch() {
  showModal(searchModal);
  playerSearchInput.value = "";

  const renderAuthoritativeRecentSearches = async () => {
    const renderRecent = window.__mflGlobalSearchRuntime?.recent;
    if (typeof renderRecent !== "function") return false;
    return Boolean(await renderRecent());
  };

  void renderAuthoritativeRecentSearches().then((rendered) => {
    if (!rendered && !playerSearchInput.value.trim()) renderSearchResultsNow();
  });
  window.setTimeout(() => playerSearchInput.focus(), 0);
  await ensureSearchIndexes();
  if (!await renderAuthoritativeRecentSearches()) renderSearchResultsNow();
}

function closeSearch() {
  hideModal(searchModal);
}

function playerSearchResult(row) {
  return { type: "player", row };
}

function clubSearchResult(entry) {
  return { type: "club", entry };
}

function searchMatchScore(query, primaryText, secondaryText = "") {
  if (primaryText === query || secondaryText === query) {
    return 100;
  }

  if (primaryText.startsWith(query)) {
    return 80;
  }

  if (secondaryText.startsWith(query)) {
    return 70;
  }

  if (primaryText.includes(query)) {
    return 50;
  }

  if (secondaryText.includes(query)) {
    return 40;
  }

  return 0;
}

function bestSearchResults(query) {
  if ((!state.searchIndex.length && state.rows.length) || (!state.agentSearchIndex.length && (state.rows.length || state.walletRows.length))) {
    buildSearchIndex();
  }

  const relevanceSort = (a, b) => (
    b.score - a.score
    || b.overall - a.overall
    || String(a.label).localeCompare(String(b.label))
  );

  const playerResults = state.searchIndex
    .map((entry) => ({
      type: "player",
      entry,
      row: entry.row || null,
      score: Math.max(searchMatchScore(query, entry.name, entry.id), searchMatchScore(query, entry.id, entry.name)),
      overall: entry.overall,
      label: entry.nameDisplay,
    }))
    .filter((result) => result.score > 0)
    .sort(relevanceSort);

  const agentPlayerCounts = new Map();
  state.rows.forEach((row) => {
    const walletAddress = normalizeWalletAddress(getValue(row, "wallet_address")).toLowerCase();
    if (!walletAddress) return;
    agentPlayerCounts.set(walletAddress, (agentPlayerCounts.get(walletAddress) || 0) + 1);
  });

  const agentResults = state.agentSearchIndex
    .map((entry) => ({
      ...entry,
      score: Math.max(searchMatchScore(query, entry.nameText, entry.walletText), searchMatchScore(query, entry.walletText, entry.nameText)),
      playerCount: agentPlayerCounts.get(entry.walletAddress) || entry.playerCount || 0,
      overall: -1,
      label: entry.name,
    }))
    .filter((result) => result.score > 0)
    .sort((a, b) => (
      b.score - a.score
      || b.playerCount - a.playerCount
      || String(a.label).localeCompare(String(b.label))
    ));

  const clubResults = state.clubSearchIndex
    .filter((club) => club.searchText.includes(query))
    .sort((a, b) => (
      (a.division ?? Number.POSITIVE_INFINITY) - (b.division ?? Number.POSITIVE_INFINITY)
      || a.name.localeCompare(b.name)
    ))
    .slice(0, 10)
    .map(clubSearchResult);

  // Keep player -> club -> agent priority with one shared ten-result budget.
  return [
    ...playerResults,
    ...clubResults,
    ...agentResults,
  ].slice(0, 10);
}

function agentSearchResultByWallet(walletAddress) {
  if (!state.agentSearchIndex.length && (state.rows.length || state.walletRows.length)) {
    buildSearchIndex();
  }

  const normalizedWalletAddress = normalizeWalletAddress(walletAddress).toLowerCase();
  return state.agentSearchIndex.find((entry) => entry.walletAddress === normalizedWalletAddress) || null;
}

function recentSearchRows() {
  const items = state.recentSearchItems.length
    ? state.recentSearchItems
    : recentSearchItemsFromLegacy(state.recentSearchPlayerIds, state.recentSearchAgentWallets);

  return items.slice(0, 5).map((item) => {
    if (item.startsWith("club:")) {
      const clubId = item.slice(5);
      const entry = state.clubSearchIndex.find((club) => club.clubId === clubId);
      return entry ? clubSearchResult(entry) : null;
    }

    if (item.startsWith("agent:")) {
      return agentSearchResultByWallet(item.slice(6));
    }

    const playerId = item.startsWith("player:") ? item.slice(7) : item;
    const entry = state.searchIndex.find((searchEntry) => String(searchEntry.playerId) === String(playerId));
    if (entry) {
      return { type: "player", entry, row: entry.row || null };
    }
    const row = rowByPlayerId(playerId);
    return row ? playerSearchResult(row) : null;
  }).filter(Boolean);
}

function rememberSearchResult(playerId) {
  const key = String(playerId);
  state.recentSearchPlayerIds = mergeRecentIdLists([key], state.recentSearchPlayerIds);
  state.recentSearchItems = mergeRecentIdLists([recentPlayerKey(key)], state.recentSearchItems);
  persistRecentSearchStates();
  saveTableState();
}

function rememberAgentSearchResult(walletAddress) {
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress).toLowerCase();
  if (!normalizedWalletAddress) {
    return;
  }

  state.recentSearchAgentWallets = mergeRecentIdLists([normalizedWalletAddress], state.recentSearchAgentWallets);
  state.recentSearchItems = mergeRecentIdLists([recentAgentKey(normalizedWalletAddress)], state.recentSearchItems);
  const result = agentSearchResultByWallet(normalizedWalletAddress);
  if (result?.name) saveAgentDisplayName(normalizedWalletAddress, result.name);
  persistRecentSearchStates();
  saveTableState();
}

function navigateFromSearch(callback) {
  closeSearch();
  window.requestAnimationFrame(() => callback());
}

function syncPlayerSearchClearButton() {
  playerSearchClearButton.hidden = !playerSearchInput.value.trim();
}

function clearPlayerSearch() {
  playerSearchInput.value = "";
  renderSearchResultsNow();
  playerSearchInput.focus();
}

function renderSearchResultsNow() {
  syncPlayerSearchClearButton();
  const query = normalizeSearchText(playerSearchInput.value.trim());
  const results = query ? bestSearchResults(query) : recentSearchRows();
  playerSearchResults.classList.add("filledSearchResults");

  if (!results.length) {
    if (query) return;
    playerSearchResults.classList.remove("filledSearchResults");
    playerSearchResults.innerHTML = '<div class="searchHint">Recent searches will appear here.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  results.forEach((result) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "searchResult";

    if (result.type === "club") {
      const entry = result.entry;
      const division = contractDivisionInfo(entry.division);
      const divisionHtml = division
        ? ` &middot; <span class="clubSearchDivision" style="color:${escapeHtml(division.color)}">${escapeHtml(division.name)}</span>`
        : "";
      button.classList.add("clubSearchResult");
      button.dataset.clubId = entry.clubId;
      button.dataset.searchKey = recentClubKey(entry.clubId);
      button.innerHTML = `<strong>${escapeHtml(entry.name)}</strong><span>Club &middot; #${escapeHtml(entry.clubId)}${divisionHtml}</span>`;
      button.addEventListener("click", () => {
        closeSearch();
        if (typeof window.mflOpenClubPage === "function") {
          void window.mflOpenClubPage(entry.clubId, "attributes");
        }
      });
      fragment.appendChild(button);
      return;
    }

    if (result.type === "agent") {
      button.dataset.searchKey = recentAgentKey(result.walletAddress);
      button.innerHTML = `<strong>${escapeHtml(result.name)}</strong><span>${escapeHtml(result.walletAddress)}</span>`;
      button.addEventListener("click", () => {
        rememberAgentSearchResult(result.walletAddress);
        navigateFromSearch(() => openAgentPage(result.walletAddress, result.name));
      });
      fragment.appendChild(button);
      return;
    }

    const row = result.row;
    const entry = result.entry || (row ? buildPlayerSearchEntryFromRow(row) : null);
    if (!entry) {
      return;
    }
    const id = String(entry.playerId);
    button.dataset.searchKey = recentPlayerKey(id);
    button.innerHTML = `<strong>${escapeHtml(entry.nameDisplay)}</strong><span>${playerSearchMetadataHtml(entry, id)}</span>`;
    button.addEventListener("click", () => {
      rememberSearchResult(id);
      navigateFromSearch(() => openPlayerPage(id));
    });
    fragment.appendChild(button);
  });
  playerSearchResults.replaceChildren(fragment);
}

function renderSearchResults() {
  syncPlayerSearchClearButton();
  const query = String(playerSearchInput.value || "").trim();
  renderSearchResultsNow();
  void (async () => {
    try {
      if (await requestDatabaseSearch(query, "all", { force: Boolean(query) })) renderSearchResultsNow();
    } catch (error) {
      console.error(error?.message || "Could not search the database.");
      renderSearchResultsNow();
    }
  })();
}
