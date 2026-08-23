// @ts-check

import { replaceRequired, replaceRequiredFunction } from "./app-core-splitter-utils.js";

const OPTIMIZED_SELECTION_HEADER = `function updateSelectionHeader(pageRows = currentPageRows()) {
  const selectVisibleInput = document.querySelector("#selectVisiblePlayersInput");

  if (!selectVisibleInput) {
    return;
  }

  if (document.documentElement.classList.contains("mflDataLoading")) {
    selectVisibleInput.checked = false;
    selectVisibleInput.indeterminate = false;
    selectVisibleInput.disabled = false;
    if (document.activeElement === selectVisibleInput) {
      selectVisibleInput.blur();
    }
    return;
  }

  let visibleCount = 0;
  let selectedVisibleCount = 0;
  for (const row of pageRows) {
    visibleCount += 1;
    if (state.selectedPlayerIds.has(String(getValue(row, "player_id")))) {
      selectedVisibleCount += 1;
    }
  }

  selectVisibleInput.disabled = visibleCount === 0;
  selectVisibleInput.checked = visibleCount > 0 && selectedVisibleCount === visibleCount;
  selectVisibleInput.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleCount;
}`;

const OPTIMIZED_SELECTION_BAR = `function updateSelectionBar(pageRows = null) {
  const selectedCount = state.selectedPlayerIds.size;
  const optedIn = hasWalletOptIn();
  selectionBar.classList.toggle("visible", selectedCount > 0);
  selectionCount.textContent = \`${"${selectedCount}"} selected\`;
  addToWatchlistButton.hidden = !optedIn;
  addToWatchlistButton.textContent = state.currentPage === "watchlist" ? "Remove from watchlist" : "Add to watchlist";
  if (moveToWatchlistButton) {
    moveToWatchlistButton.hidden = !optedIn || state.currentPage !== "watchlist" || selectedCount <= 0;
  }
  updateSelectionHeader(pageRows || currentPageRows());
}`;

const OPTIMIZED_PLAYER_SELECTION = `function setPlayerSelected(playerId, selected, shiftKey = false) {
  const key = String(playerId);
  const anchorKey = state.selectionAnchorPlayerId;

  if (shiftKey && anchorKey) {
    let anchorIndex = -1;
    let currentIndex = -1;
    for (let index = 0; index < state.filteredRows.length && (anchorIndex < 0 || currentIndex < 0); index += 1) {
      const candidateId = String(getValue(state.filteredRows[index], "player_id"));
      if (candidateId === anchorKey) anchorIndex = index;
      if (candidateId === key) currentIndex = index;
    }

    if (anchorIndex >= 0 && currentIndex >= 0) {
      const start = Math.min(anchorIndex, currentIndex);
      const end = Math.max(anchorIndex, currentIndex);
      for (let index = start; index <= end; index += 1) {
        const rangePlayerId = String(getValue(state.filteredRows[index], "player_id"));
        if (selected) {
          state.selectedPlayerIds.add(rangePlayerId);
        } else {
          state.selectedPlayerIds.delete(rangePlayerId);
        }
      }

      renderTable();
      saveTableState();
      return;
    }
  }

  if (selected) {
    state.selectedPlayerIds.add(key);
  } else {
    state.selectedPlayerIds.delete(key);
  }

  state.selectionAnchorPlayerId = key;
  updateSelectionBar();
  saveTableState();
}`;

const RENDER_PLAN_BEFORE = `  const pageRows = currentPageRows();
  const fragment = document.createDocumentFragment();

  pageRows.forEach((row) => {`;

const RENDER_PLAN_AFTER = `  const pageRows = currentPageRows();
  const renderColumns = currentViewColumns().map((column) => {
    const columnClass = tableColumnClass(column);
    return {
      column,
      classNames: columnClass ? columnClass.split(" ") : [],
      isStat: statColumns.includes(column),
    };
  });
  const fragment = document.createDocumentFragment();

  pageRows.forEach((row) => {`;

const ROW_COLUMN_LOOP_BEFORE = `    currentViewColumns().forEach((column) => {
      const cell = document.createElement("td");
      const columnClass = tableColumnClass(column);
      if (columnClass) {
        cell.classList.add(...columnClass.split(" "));
      }`;

const ROW_COLUMN_LOOP_AFTER = `    renderColumns.forEach(({ column, classNames, isStat }) => {
      const cell = document.createElement("td");
      if (classNames.length) {
        cell.classList.add(...classNames);
      }`;

const STAT_BRANCH_BEFORE = `      } else if (column === linkColumn) {
        const link = document.createElement("a");
        link.href = formatCellValue(row, column);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Link";
        cell.appendChild(link);
      } else if (statColumns.includes(column)) {
        appendStatValue(cell, row, column);`;

const STAT_BRANCH_AFTER = `      } else if (column === linkColumn) {
        const link = document.createElement("a");
        link.href = formatCellValue(row, column);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Link";
        cell.appendChild(link);
      } else if (isStat) {
        appendStatValue(cell, row, column);`;

const RENDER_SELECTION_BEFORE = `  prevButton.disabled = state.page <= 1;
  nextButton.disabled = state.page >= totalPages;
  updateSelectionBar();
}`;

const RENDER_SELECTION_AFTER = `  prevButton.disabled = state.page <= 1;
  nextButton.disabled = state.page >= totalPages;
  updateSelectionBar(pageRows);
}`;

export function optimizeTableRenderPerformanceArtifacts(artifacts) {
  const input = artifacts && typeof artifacts === "object" ? artifacts : {};
  const routeChunks = { ...(input.routeChunks || {}) };
  let table = String(routeChunks.table || "");
  if (!table) throw new Error("Cannot optimize Table render work without the Table route chunk.");

  table = replaceRequiredFunction(
    table,
    "updateSelectionHeader",
    OPTIMIZED_SELECTION_HEADER,
    "single-pass visible selection header",
  );
  table = replaceRequiredFunction(
    table,
    "updateSelectionBar",
    OPTIMIZED_SELECTION_BAR,
    "selection bar page-row handoff",
  );
  table = replaceRequiredFunction(
    table,
    "setPlayerSelected",
    OPTIMIZED_PLAYER_SELECTION,
    "selection scan only for Shift range selection",
  );
  table = replaceRequired(table, RENDER_PLAN_BEFORE, RENDER_PLAN_AFTER, "per-render Table column plan");
  table = replaceRequired(table, ROW_COLUMN_LOOP_BEFORE, ROW_COLUMN_LOOP_AFTER, "reuse Table column plan for every row");
  table = replaceRequired(table, STAT_BRANCH_BEFORE, STAT_BRANCH_AFTER, "reuse preclassified stat-column metadata");
  table = replaceRequired(table, RENDER_SELECTION_BEFORE, RENDER_SELECTION_AFTER, "reuse rendered page rows for selection header");

  routeChunks.table = table;
  return Object.freeze({
    ...input,
    routeChunks: Object.freeze(routeChunks),
  });
}
