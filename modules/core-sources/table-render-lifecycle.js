
function compactMobilePlayerName(value) {
  const fullName = String(value || "").trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return fullName;
  const initial = Array.from(parts[0])[0] || "";
  return initial ? `${initial}. ${parts.at(-1)}` : fullName;
}

function compactMobileJoinedAgency(value) {
  return String(value || "").trim().split(/\s+/, 1)[0] || "";
}

function tableCenterCellContents(cell) {
  if (!(cell instanceof HTMLTableCellElement)) return cell;
  const existingHost = cell.childNodes.length === 1
    && cell.firstElementChild instanceof HTMLElement
    && cell.firstElementChild.classList.contains("tableControlCellContent")
    ? cell.firstElementChild
    : null;
  if (existingHost) return cell;

  const contentHost = document.createElement("span");
  contentHost.className = "tableControlCellContent";
  while (cell.firstChild) contentHost.appendChild(cell.firstChild);
  cell.appendChild(contentHost);
  return cell;
}

const tableBodyRenderReuse = createRenderReuseGuard();

function tableBodyRenderSignature(pageRows, renderColumns) {
  const presentationRows = pageRows.map((row) => {
    const playerId = String(getValue(row, "player_id") || "");
    return [
      row,
      state.selectedPlayerIds.has(playerId),
      playerNote(playerId),
    ];
  });
  return JSON.stringify([
    state.columns,
    presentationRows,
    state.currentPage,
    state.view,
    state.page,
    state.pageSize,
    state.sortKey,
    state.sortDirection,
    renderColumns.map(({ column }) => column),
    state.settingsDateFormat,
    state.settingsTimeFormat,
    Boolean(hasWalletOptIn()),
    normalizeWalletAddress(state.linkedWalletAddress).toLowerCase(),
    Boolean(state.walletPermissionAllowed),
    state.trainingAdjustments,
  ]);
}

function currentTableBodyRouteIdentity() {
  return `${state.currentPage}|${state.view}|${window.location.pathname}${window.location.search}`;
}

function tableBodyStructureReusable(pageRows) {
  if (tableBody.getAttribute("data-static-loading") === "true") return false;
  if (tableBody.children.length !== pageRows.length) return false;
  if (!pageRows.length) return true;
  const firstRow = tableBody.firstElementChild;
  const lastRow = tableBody.lastElementChild;
  const firstPlayerId = String(getValue(pageRows[0], "player_id") || "");
  const lastPlayerId = String(getValue(pageRows[pageRows.length - 1], "player_id") || "");
  return firstRow instanceof HTMLTableRowElement
    && lastRow instanceof HTMLTableRowElement
    && String(firstRow.dataset.playerId || "") === firstPlayerId
    && String(lastRow.dataset.playerId || "") === lastPlayerId;
}

function tableRenderTableOwner() {
  if (window.__mflTableLoadingRuntime?.requestActive?.() && !state.incrementalApplying) return;
  if (tableBody.dataset.staticLoading === "true" && !state.dataLoaded) return;
  const recordRouteStage = Reflect.get(window, "__mflRecordRoutePerformanceStage");
  if (typeof recordRouteStage === "function") recordRouteStage("route-loader-table-render-start", { page: state.currentPage });
  const totalRows = state.incrementalMode ? state.incrementalTotalRows : state.filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  if (state.currentPage === "agents" && tablePageTitle) {
    renderAgentPageTitle(state.currentAgentWalletAddress || agentWalletAddressFromUrl());
  }

  const pageRows = currentPageRows();
  const currentPage = state.currentPage;
  const agentLinksEnabled = currentPage !== "myplayers" && currentPage !== "agents" && currentPage !== "mfl";
  const clubLinksEnabled = currentPage !== "club";
  const statColumnSet = new Set(statColumns);
  const renderColumns = currentViewColumns().map((column) => ({
    column,
    className: tableColumnClass(column),
  }));
  const renderSignature = tableBodyRenderSignature(pageRows, renderColumns);
  const reusableTableBody = tableBodyRenderReuse.matches(
    renderSignature,
    tableBodyStructureReusable(pageRows),
  );
  let preservedPlayerTableActionRenderSignature = "";

  if (!reusableTableBody) {
    preservedPlayerTableActionRenderSignature = playerTableActionMenu?.dataset.open === "true"
      && playerTableActionRenderSignature
      && playerTableActionRenderSignature === currentPlayerTableActionRenderSignature()
      ? playerTableActionRenderSignature
      : "";
    if (!preservedPlayerTableActionRenderSignature) closePlayerTableActionMenu();

    const fragment = document.createDocumentFragment();

    for (const row of pageRows) {
    const tableRow = document.createElement("tr");
    const selectionCell = document.createElement("td");
    const selectionInput = document.createElement("input");
    const playerId = getValue(row, "player_id");
    const playerIdText = String(playerId);
    const playerName = formatCellValue(row, "name");
    tableRow.dataset.playerId = playerIdText;
    if (state.hoveredTablePlayerId && playerIdText === state.hoveredTablePlayerId) {
      tableRow.classList.add("tableRowHovered");
    }

    selectionCell.className = "selectionCell";
    selectionInput.type = "checkbox";
    selectionInput.checked = state.selectedPlayerIds.has(playerIdText);
    selectionInput.setAttribute("aria-label", `Select ${playerName || `player ${playerId}`}`);
    selectionInput.dataset.playerId = playerIdText;
    const selectionContent = document.createElement("span");
    selectionContent.className = "tableControlCellContent tableControlCellContentCentered";
    selectionContent.appendChild(selectionInput);
    selectionCell.appendChild(selectionContent);
    tableRow.appendChild(tableCenterCellContents(selectionCell));

    const actionsCell = document.createElement("td");
    actionsCell.className = "rowActionsCell";
    const actionsContent = document.createElement("span");
    actionsContent.className = "tableControlCellContent tableControlCellContentCentered";
    actionsContent.appendChild(createPlayerTableActionsButton(playerId));
    actionsCell.appendChild(actionsContent);
    tableRow.appendChild(tableCenterCellContents(actionsCell));

    for (const { column, className } of renderColumns) {
      const cell = document.createElement("td");
      if (className) cell.className = className;

      if (column === "name") {
        cell.classList.add("nameCell");
        const nameWrap = document.createElement("div");
        const nameLink = document.createElement("a");
        nameWrap.className = "playerNameCell";
        nameLink.href = playerRoute(playerId);
        nameLink.className = "playerNameLink";
        markTableInteractiveHover(nameLink, "name", playerId);
        const fullPlayerName = playerName;
        const fullNameValue = document.createElement("span");
        fullNameValue.className = "playerNameFullValue";
        fullNameValue.textContent = fullPlayerName;
        const compactNameValue = document.createElement("span");
        compactNameValue.className = "playerNameCompactValue";
        compactNameValue.textContent = compactMobilePlayerName(fullPlayerName);
        nameLink.replaceChildren(fullNameValue, compactNameValue);
        if (fullPlayerName) nameLink.setAttribute("aria-label", fullPlayerName);
        nameLink.dataset.playerId = playerIdText;
        nameWrap.appendChild(nameLink);
        const markerWrap = document.createElement("span");
        markerWrap.className = "playerNameMarkers";
        if (playerHasNote(playerId)) {
          const noteIcon = document.createElement("span");
          noteIcon.className = "playerNoteIcon";
          noteIcon.dataset.noteTooltip = playerNote(playerId);
          noteIcon.setAttribute("aria-label", "Player note");
          noteIcon.textContent = "\u{1F4DD}";

          markerWrap.appendChild(noteIcon);
        }
        if (markerWrap.childElementCount) {
          nameWrap.appendChild(markerWrap);
        }
        cell.appendChild(nameWrap);
      } else if (column === flagColumn) {
        cell.classList.add("flagCell");
        cell.innerHTML = countryFlagHtml(getValue(row, "nationality"));
        const flagContent = document.createElement("span");
        flagContent.className = "tableControlCellContent tableControlCellContentCentered";
        while (cell.firstChild) flagContent.appendChild(cell.firstChild);
        cell.appendChild(flagContent);
      } else if (column === "player_id") {
        const idContent = document.createElement("span");
        idContent.className = "tableControlCellContent";
        idContent.appendChild(createCopyPlayerIdButton(playerId, formatCellValue(row, column)));
        cell.appendChild(idContent);
      } else if (column === "listing_price") {
        const listingBadge = listingPriceBadgeHtml(row);
        if (listingBadge) {
          const host = document.createElement("span");
          host.className = "listingCellTableHost";
          host.innerHTML = listingBadge;
          cell.appendChild(host);
        } else {
          cell.setAttribute("aria-label", "Not For Sale");
        }
      } else if (column === "age") {
        const ageContent = document.createElement("span");
        ageContent.className = "tableControlCellContent";
        const ageValue = document.createElement("span");
        ageValue.className = "playerAgeValue";
        ageValue.textContent = formatCellValue(row, column);
        ageContent.appendChild(ageValue);
        const retirement = retirementMarker(row);
        appendNameMarker(
          ageContent,
          retirement || newMintMarker(row),
          retirement ? "retirementMarker" : "newMintMarker",
        );
        cell.appendChild(ageContent);
      } else if (column === joinedAgencyColumn) {
        const joinedAgencyValue = formatCellValue(row, column);
        const fullValue = document.createElement("span");
        fullValue.className = "joinedAgencyFullValue";
        fullValue.textContent = joinedAgencyValue;
        const compactValue = document.createElement("span");
        compactValue.className = "joinedAgencyCompactValue";
        compactValue.textContent = compactMobileJoinedAgency(joinedAgencyValue);
        cell.replaceChildren(fullValue, compactValue);
      } else if (column === "active_contract_club_division") {
        const division = rowHasActiveContract(row) ? contractDivisionInfo(getValue(row, column)) : null;
        if (division) {
          const divisionLabel = document.createElement("span");
          divisionLabel.className = "contractDivisionLabel";
          divisionLabel.style.color = division.color;
          divisionLabel.textContent = division.name;
          cell.appendChild(divisionLabel);
        } else {
          cell.textContent = "";
        }
      } else if (column === agentColumn) {
        if (agentLinksEnabled) {
          const walletAddress = getValue(row, "wallet_address");
          const agentLabel = formatCellValue(row, column);
          const link = document.createElement("a");
          link.href = agentRoute(walletAddress);
          link.className = "agentTableLink";
          markTableInteractiveHover(link, "agent", walletAddress);
          link.textContent = agentLabel;
          const tooltip = joinedAgencyTooltip(row);
          link.dataset.walletAddress = String(walletAddress || "");
          link.dataset.agentName = String(agentLabel || "");
          if (tooltip) {
            link.dataset.tooltip = tooltip;
          }
          cell.appendChild(link);
        }
      } else if (column === "active_contract_club_name") {
        const clubId = String(getValue(row, "active_contract_club_id") || "").trim();
        const clubName = formatContractClubName(row);
        if (clubLinksEnabled && clubId && rowHasActiveContract(row)) {
          const clubLink = document.createElement("a");
          clubLink.href = `/clubs/${encodeURIComponent(clubId)}/squad`;
          clubLink.className = "agentTableLink";
          markTableInteractiveHover(clubLink, "club", clubId);
          clubLink.textContent = clubName;
          clubLink.dataset.clubId = clubId;
          cell.appendChild(clubLink);
        } else {
          cell.textContent = clubName;
        }
      } else if (column === linkColumn) {
        const link = document.createElement("a");
        link.href = formatCellValue(row, column);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Link";
        cell.appendChild(link);
      } else if (statColumnSet.has(column)) {
        appendStatValue(cell, row, column);
      } else {
        cell.textContent = formatCellValue(row, column);
      }

      tableRow.appendChild(tableCenterCellContents(cell));
    }

      fragment.appendChild(tableRow);
    }

    if (typeof recordRouteStage === "function") recordRouteStage("route-loader-table-build-complete", { page: state.currentPage, reused: false });
    tableBody.replaceChildren(fragment);
    tableBodyRenderReuse.commit(renderSignature);
    if (typeof recordRouteStage === "function") recordRouteStage("route-loader-table-dom-commit-complete", { page: state.currentPage, reused: false });
  } else {
    if (typeof recordRouteStage === "function") recordRouteStage("route-loader-table-build-complete", { page: state.currentPage, reused: true });
    if (typeof recordRouteStage === "function") recordRouteStage("route-loader-table-dom-commit-complete", { page: state.currentPage, reused: true });
  }
  tableBody.setAttribute("data-mfl-rendered-route-identity", currentTableBodyRouteIdentity());
  emptyState.textContent = tableEmptyStateMessage();
  emptyState.hidden = pageRows.length > 0;
  updateTablePlayerCount({ authoritative: true });
  const tableLoadingRuntime = Reflect.get(window, "__mflTableLoadingRuntime");
  if (tableLoadingRuntime && typeof tableLoadingRuntime.sync === "function") tableLoadingRuntime.sync();
  if (preservedPlayerTableActionRenderSignature) {
    restorePlayerTableActionMenuAfterRender(preservedPlayerTableActionRenderSignature);
  }
  syncPagerCurrentPage(state.page, totalPages);
  prevButton.disabled = state.page <= 1;
  nextButton.disabled = state.page >= totalPages;
  updateSelectionBar(pageRows, { rendered: true });
  if (typeof recordRouteStage === "function") recordRouteStage("route-loader-table-render-complete", { page: state.currentPage });
}

function showTableBusyState() {
  tableBodyRenderReuse.invalidate();
  if (window.__mflTableLoadingRuntime?.show?.()) return;
  emptyState.hidden = true;
  emptyState.textContent = "";
  tableBody.replaceChildren();
}

async function tableSetViewOwner(viewName) {
  if (!allowedViewsForPage().includes(viewName)) {
    return;
  }

  const clubPage = state.currentPage === "club";
  const pageKey = tablePageKey();
  if (pageKey && !clubPage) {
    const existingPageState = state.tablePageStates[pageKey] || currentTablePageState();
    state.tablePageStates[pageKey] = {
      ...existingPageState,
      viewSortStates: {
        ...(existingPageState.viewSortStates || {}),
        [state.view]: {
          sortKey: state.sortKey,
          sortDirection: state.sortDirection,
        },
      },
    };
  }

  state.view = viewName;
  if (state.currentPage === "watchlist" && state.currentWatchlistId) {
    state.watchlistViews[state.currentWatchlistId] = viewName;
  }
  state.page = 1;
  if (pageKey) {
    updatePageUrl(pageKey, { updateUrl: true, view: viewName });
  }

  const targetSortState = tableSortStateForView(
  viewName,
  pageKey || state.currentPage,
  { sortKey: state.sortKey, sortDirection: state.sortDirection },
);
state.sortKey = targetSortState.sortKey;
state.sortDirection = targetSortState.sortDirection;

  if (!clubPage) {
    removeUnavailableFilterRules();
    populateAddFilterSelect();
    refreshRuleColumnSelects();
  }

  updateViewButtons();
  buildHeader();

  if (clubPage) {
    applyFilters({ save: false, localOnly: true });
  } else {
    applyFilters();
  }
  if (state.currentPage === "watchlist") saveTableState();
}
