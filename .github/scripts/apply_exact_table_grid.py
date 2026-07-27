from pathlib import Path

app_path = Path("site/app.js")
source = app_path.read_text(encoding="utf-8")
marker = "/* Single exact player-table width engine */"
if marker not in source:
    raise SystemExit("Exact table width engine marker not found")

engine = r'''/* Single exact player-table width engine */
(() => {
  const WIDTHS = {
    "col-select": 3,
    "col-id": 3,
    "col-flag": 3,
    "col-name": 13,
    "col-nationality": 7,
    "col-age": 4,
    "col-positions": 8,
    "col-seasons": 5,
    "col-stat": 6,
    "col-contract-revenue": 8,
    "col-contract-club": 19,
    "col-contract-division": 9,
    "col-agent": 9,
    "col-joined-agency": 9,
    "col-owned-since": 9,
    "col-link": 3,
  };

  const FILLER_CLASS = "col-exact-width-filler";
  const EPSILON = 0.001;

  function restoreSingleTable() {
    document.querySelectorAll(".tableBodyScroller").forEach((bodyScroller) => {
      const bodyTable = bodyScroller.querySelector("table");
      const headerScroller = bodyScroller.previousElementSibling?.classList.contains("tableHeaderScroller")
        ? bodyScroller.previousElementSibling
        : null;
      const headerTable = headerScroller?.querySelector("table");
      const tableHead = headerTable?.querySelector("thead");

      if (bodyTable && tableHead && !bodyTable.querySelector("thead")) {
        const colGroup = bodyTable.querySelector("colgroup");
        if (colGroup?.nextSibling) bodyTable.insertBefore(tableHead, colGroup.nextSibling);
        else bodyTable.prepend(tableHead);
      }

      headerScroller?.remove();
      bodyScroller.classList.remove("tableBodyScroller");
    });
  }

  function widthForColumn(column) {
    const className = Object.keys(WIDTHS).find((name) => column.classList.contains(name));
    return className ? WIDTHS[className] : null;
  }

  function removeFiller(table, colGroup) {
    colGroup.querySelectorAll(`.${FILLER_CLASS}`).forEach((element) => element.remove());
    table.querySelectorAll(`th.${FILLER_CLASS}, td.${FILLER_CLASS}`).forEach((element) => element.remove());
  }

  function appendFillerCells(table, fillerWidth) {
    const width = `${fillerWidth}%`;
    const fillerColumn = document.createElement("col");
    fillerColumn.className = FILLER_CLASS;
    fillerColumn.style.setProperty("width", width, "important");
    fillerColumn.style.setProperty("min-width", width, "important");
    fillerColumn.style.setProperty("max-width", width, "important");
    table.querySelector("colgroup")?.appendChild(fillerColumn);

    table.querySelectorAll("thead tr, tbody tr").forEach((row) => {
      const cell = document.createElement(row.closest("thead") ? "th" : "td");
      cell.className = FILLER_CLASS;
      cell.setAttribute("aria-hidden", "true");
      cell.style.setProperty("width", width, "important");
      cell.style.setProperty("min-width", width, "important");
      cell.style.setProperty("max-width", width, "important");
      row.appendChild(cell);
    });
  }

  function applyExactTableWidths() {
    restoreSingleTable();

    document.querySelectorAll(".appShell .tableScroller table").forEach((table) => {
      const colGroup = table.querySelector("colgroup");
      if (!colGroup) return;

      removeFiller(table, colGroup);
      const columns = Array.from(colGroup.children);
      const widths = columns.map(widthForColumn);
      if (!widths.length || widths.some((width) => !Number.isFinite(width))) return;

      const total = widths.reduce((sum, width) => sum + width, 0);
      if (total > 100 + EPSILON) return;

      table.style.setProperty("table-layout", "fixed", "important");
      table.style.setProperty("width", "100%", "important");
      table.style.setProperty("min-width", "100%", "important");
      table.style.setProperty("max-width", "100%", "important");

      columns.forEach((column, index) => {
        const width = `${widths[index]}%`;
        column.style.setProperty("width", width, "important");
        column.style.setProperty("min-width", width, "important");
        column.style.setProperty("max-width", width, "important");
        column.style.setProperty("transition", "none", "important");
      });

      const remainder = 100 - total;
      if (remainder > EPSILON) appendFillerCells(table, remainder);
    });
  }

  if (typeof buildTableColGroup === "function") {
    const originalBuildTableColGroup = buildTableColGroup;
    buildTableColGroup = function buildTableColGroupWithExactGrid() {
      const result = originalBuildTableColGroup.apply(this, arguments);
      applyExactTableWidths();
      return result;
    };
  }

  if (typeof buildHeader === "function") {
    const originalBuildHeader = buildHeader;
    buildHeader = function buildHeaderWithExactGrid() {
      const result = originalBuildHeader.apply(this, arguments);
      applyExactTableWidths();
      return result;
    };
  }

  if (typeof renderTable === "function") {
    const originalRenderTable = renderTable;
    renderTable = function renderTableWithExactGrid() {
      const result = originalRenderTable.apply(this, arguments);
      applyExactTableWidths();
      return result;
    };
  }

  const style = document.createElement("style");
  style.textContent = `
    .appShell .tableScroller,
    .appShell .tableScroller table {
      width: 100% !important;
      min-width: 100% !important;
      max-width: 100% !important;
    }

    .appShell .tableScroller {
      overflow: visible !important;
      max-height: none !important;
      scrollbar-gutter: auto !important;
    }

    .appShell .tableScroller table {
      table-layout: fixed !important;
    }

    .appShell .tableScroller .${FILLER_CLASS} {
      padding: 0 !important;
      border-left: 0 !important;
      border-right: 0 !important;
      background: inherit !important;
      pointer-events: none !important;
    }

    .appShell .tableScroller table,
    .appShell .tableScroller col,
    .appShell .tableScroller th,
    .appShell .tableScroller td,
    .appShell .tableScroller tr:hover,
    .appShell .tableScroller tr:hover > th,
    .appShell .tableScroller tr:hover > td {
      transition: none !important;
      animation: none !important;
    }
  `;
  document.head.appendChild(style);

  applyExactTableWidths();
})();
'''

app_path.write_text(source.split(marker, 1)[0].rstrip() + "\n\n" + engine, encoding="utf-8")

Path(".github/scripts/apply_exact_table_grid.py").unlink(missing_ok=True)
Path(".github/workflows/one-time-exact-table-grid.yml").unlink(missing_ok=True)
