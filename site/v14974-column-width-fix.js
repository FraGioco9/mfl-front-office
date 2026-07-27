(() => {
  const columnPercentages = {
    selection: 3,
    player_id: 3,
    nationality_flag: 3,
    name: 13,
    nationality: 7,
    age: 6,
    positions: 6,
    player_seasons: 5,
    overall: 6,
    pace: 6,
    shooting: 6,
    passing: 6,
    dribbling: 6,
    defense: 6,
    physical: 6,
    goalkeeping: 6,
    wallet_name: 9,
    owned_since: 9,
    active_contract_revenue_share: 8,
    active_contract_club_name: 19,
    active_contract_club_division: 9,
    player_link: 3,
  };

  function flexibleColumnIndex(columnNames) {
    const preferredColumns = [
      "active_contract_club_name",
      "wallet_name",
      "owned_since",
      "name",
    ];

    for (const columnName of preferredColumns) {
      const index = columnNames.indexOf(columnName);
      if (index >= 0) return index;
    }

    return columnNames.length - 1;
  }

  function viewPercentages(columnNames) {
    const percentages = columnNames.map((columnName) => Number(columnPercentages[columnName]));
    if (percentages.some((percentage) => !Number.isFinite(percentage) || percentage <= 0)) return null;

    const total = percentages.reduce((sum, percentage) => sum + percentage, 0);
    const flexibleIndex = flexibleColumnIndex(columnNames);
    percentages[flexibleIndex] += 100 - total;

    return percentages[flexibleIndex] > 0 ? percentages : null;
  }

  function clearLegacySizing(element) {
    if (!element) return;
    element.style.removeProperty("min-width");
    element.style.removeProperty("max-width");
  }

  function applySharedGridWidths() {
    if (typeof tableColGroup === "undefined" || !tableColGroup || typeof currentViewColumns !== "function") return false;

    const table = tableColGroup.closest("table");
    if (!table) return false;

    const columnNames = ["selection", ...currentViewColumns()];
    const percentages = viewPercentages(columnNames);
    const colElements = Array.from(tableColGroup.children);
    if (!percentages || colElements.length !== columnNames.length) return false;

    clearLegacySizing(table);
    table.style.setProperty("table-layout", "fixed", "important");
    table.style.setProperty("width", "100%", "important");

    colElements.forEach((column, index) => {
      const width = `${percentages[index]}%`;
      clearLegacySizing(column);
      column.style.setProperty("width", width, "important");
    });

    Array.from(table.rows).forEach((row) => {
      Array.from(row.cells).forEach((cell, index) => {
        if (index >= percentages.length) return;
        const width = `${percentages[index]}%`;
        clearLegacySizing(cell);
        cell.style.setProperty("box-sizing", "border-box", "important");
        cell.style.setProperty("width", width, "important");
      });
    });

    return true;
  }

  let scheduledFrame = 0;
  function scheduleSharedGridWidths() {
    if (scheduledFrame) cancelAnimationFrame(scheduledFrame);
    scheduledFrame = requestAnimationFrame(() => {
      scheduledFrame = 0;
      applySharedGridWidths();
      requestAnimationFrame(applySharedGridWidths);
    });
  }

  function scheduleInitialWidths() {
    scheduleSharedGridWidths();
    [0, 50, 150, 350, 750].forEach((delay) => setTimeout(scheduleSharedGridWidths, delay));
  }

  function scheduleAfterResult(result) {
    scheduleSharedGridWidths();
    if (result && typeof result.then === "function") {
      result.finally(scheduleInitialWidths);
    } else {
      scheduleInitialWidths();
    }
    return result;
  }

  if (typeof restoreSavedTableState === "function") {
    const originalRestoreSavedTableState = restoreSavedTableState;
    restoreSavedTableState = function restoreSavedTableStateWithSharedGrid() {
      return scheduleAfterResult(originalRestoreSavedTableState.apply(this, arguments));
    };
  }

  if (typeof buildTableColGroup === "function") {
    const originalBuildTableColGroup = buildTableColGroup;
    buildTableColGroup = function buildTableColGroupWithSharedGrid() {
      return scheduleAfterResult(originalBuildTableColGroup.apply(this, arguments));
    };
  }

  if (typeof buildHeader === "function") {
    const originalBuildHeader = buildHeader;
    buildHeader = function buildHeaderWithSharedGrid() {
      return scheduleAfterResult(originalBuildHeader.apply(this, arguments));
    };
  }

  if (typeof renderTable === "function") {
    const originalRenderTable = renderTable;
    renderTable = function renderTableWithSharedGrid() {
      return scheduleAfterResult(originalRenderTable.apply(this, arguments));
    };
  }

  if (typeof setPage === "function") {
    const originalSetPage = setPage;
    setPage = function setPageWithSharedGrid() {
      return scheduleAfterResult(originalSetPage.apply(this, arguments));
    };
  }

  const tableObserver = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === "childList" && (mutation.addedNodes.length || mutation.removedNodes.length))) {
      scheduleSharedGridWidths();
    }
  });

  function observeTableRendering() {
    const target = typeof tableColGroup !== "undefined" && tableColGroup
      ? tableColGroup.closest("table")?.parentElement || tableColGroup.closest("table")
      : document.body;
    if (target) tableObserver.observe(target, { childList: true, subtree: true });
  }

  scheduleInitialWidths();
  observeTableRendering();
  document.addEventListener("DOMContentLoaded", () => {
    observeTableRendering();
    scheduleInitialWidths();
  }, { once: true });
  window.addEventListener("load", scheduleInitialWidths, { once: true });
  window.addEventListener("pageshow", scheduleInitialWidths);
})();