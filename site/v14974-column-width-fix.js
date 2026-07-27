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
    wallet_name: 10,
    owned_since: 10,
    active_contract_revenue_share: 8,
    active_contract_club_name: 19,
    active_contract_club_division: 9,
    player_link: 2,
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
    if (typeof tableColGroup === "undefined" || !tableColGroup || typeof currentViewColumns !== "function") return;

    const table = tableColGroup.closest("table");
    if (!table) return;

    const columnNames = ["selection", ...currentViewColumns()];
    const percentages = viewPercentages(columnNames);
    const colElements = Array.from(tableColGroup.children);
    if (!percentages || colElements.length !== columnNames.length) return;

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
  }

  if (typeof buildTableColGroup === "function") {
    const originalBuildTableColGroup = buildTableColGroup;
    buildTableColGroup = function buildTableColGroupWithSharedGrid() {
      const result = originalBuildTableColGroup.apply(this, arguments);
      applySharedGridWidths();
      return result;
    };
  }

  if (typeof buildHeader === "function") {
    const originalBuildHeader = buildHeader;
    buildHeader = function buildHeaderWithSharedGrid() {
      const result = originalBuildHeader.apply(this, arguments);
      applySharedGridWidths();
      return result;
    };
  }

  if (typeof renderTable === "function") {
    const originalRenderTable = renderTable;
    renderTable = function renderTableWithSharedGrid() {
      const result = originalRenderTable.apply(this, arguments);
      applySharedGridWidths();
      return result;
    };
  }

  requestAnimationFrame(applySharedGridWidths);
  document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(applySharedGridWidths), { once: true });
})();
