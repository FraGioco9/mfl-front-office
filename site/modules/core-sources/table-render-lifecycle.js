
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

function tableRenderTableOwner() {
  if (window.__mflTableLoadingRuntime?.requestActive?.() && !state.incrementalApplying) return;
  if (tableBody.dataset.staticLoading === "true" && !state.dataLoaded) return;
  const preservedPlayerTableActionRenderSignature = playerTableActionMenu?.dataset.open === "true"
    && playerTableActionRenderSignature
    && playerTableActionRenderSignature === currentPlayerTableActionRenderSignature()
    ? playerTableActionRenderSignature
    : "";
  if (!preservedPlayerTableActionRenderSignature) closePlayerTableActionMenu();
  const totalRows = state.incrementalMode ? state.incrementalTotalRows : state.filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  if (state.currentPage === "agents" && tablePageTitle) {
    renderAgentPageTitle(state.currentAgentWalletAddress || agentWalletAddressFromUrl());
  }

  const pageRows = currentPageRows();
  const fragment = document.createDocumentFragment();

  pageRows.forEach((row) => {
    const tableRow = document.createElement("tr");
    const selectionCell = document.createElement("td");
    const selectionInput = document.createElement("input");
    const playerId = getValue(row, "player_id");
    tableRow.dataset.playerId = String(playerId);
    if (state.hoveredTablePlayerId && String(playerId) === state.hoveredTablePlayerId) {
      tableRow.classList.add("tableRowHovered");
    }

    selectionCell.className = "selectionCell";
    selectionInput.type = "checkbox";
    selectionInput.checked = state.selectedPlayerIds.has(String(playerId));
    selectionInput.setAttribute("aria-label", `Select ${formatCellValue(row, "name") || `player ${playerId}`}`);
    selectionInput.dataset.playerId = String(playerId);
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

    currentViewColumns().forEach((column) => {
      const cell = document.createElement("td");
      const columnClass = tableColumnClass(column);
      if (columnClass) {
        cell.classList.add(...columnClass.split(" "));
      }

      if (column === "name") {
        cell.classList.add("nameCell");
        const nameWrap = document.createElement("div");
        const nameLink = document.createElement("a");
        nameWrap.className = "playerNameCell";
        nameLink.href = playerRoute(playerId);
        nameLink.className = "playerNameLink";
        markTableInteractiveHover(nameLink, "name", playerId);
        const fullPlayerName = formatCellValue(row, column);
        nameLink.textContent = window.matchMedia("(max-width: 900px)").matches
          ? compactMobilePlayerName(fullPlayerName)
          : fullPlayerName;
        if (fullPlayerName) nameLink.setAttribute("aria-label", fullPlayerName);
        nameLink.dataset.playerId = String(playerId);
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
          if (!window.matchMedia("(max-width: 900px)").matches) {
            cell.innerHTML = `<span class="listingCellTableHost">${listingBadge}</span>`;
          } else {
            const template = document.createElement("template");
            template.innerHTML = listingBadge.trim();
            const badge = template.content.firstElementChild;
            const price = badge instanceof HTMLElement ? badge.querySelector(".listingCellPrice") : null;
            const priceText = String(price?.textContent || "").trim();
            if (badge instanceof HTMLElement) {
              price?.remove();
              if (priceText) {
                badge.dataset.tooltip = priceText;
                badge.setAttribute("aria-label", priceText);
                badge.tabIndex = 0;
              }
              const host = document.createElement("span");
              host.className = "listingCellTableHost";
              host.appendChild(badge);
              cell.appendChild(host);
            }
          }
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
        cell.textContent = window.matchMedia("(max-width: 520px)").matches
          ? compactMobileJoinedAgency(joinedAgencyValue)
          : joinedAgencyValue;
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
        if (!["myplayers", "agents", "mfl"].includes(state.currentPage)) {
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
        if (state.currentPage !== "club" && clubId && rowHasActiveContract(row)) {
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
      } else if (statColumns.includes(column)) {
        appendStatValue(cell, row, column);
      } else {
        cell.textContent = formatCellValue(row, column);
      }

      tableRow.appendChild(tableCenterCellContents(cell));
    });

    fragment.appendChild(tableRow);
  });

  tableBody.replaceChildren(fragment);
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
}

function showTableBusyState() {
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
