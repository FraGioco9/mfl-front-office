from pathlib import Path

path = Path("site/app.js")
source = path.read_text(encoding="utf-8")

marker = "/* Consolidated from v1500-exact-column-widths.js */"
if marker not in source:
    raise SystemExit("Legacy table width marker not found")

source = source.split(marker, 1)[0].rstrip()

engine = r'''
/* Single exact player-table width engine */
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

  function applyExactTableWidths() {
    restoreSingleTable();

    document.querySelectorAll(".tableScroller table").forEach((table) => {
      table.style.setProperty("table-layout", "fixed", "important");
      table.style.setProperty("width", "100%", "important");
      table.style.setProperty("min-width", "100%", "important");
      table.style.setProperty("max-width", "100%", "important");

      const colGroup = table.querySelector("colgroup");
      if (!colGroup) return;

      Array.from(colGroup.children).forEach((column) => {
        const widthClass = Object.keys(WIDTHS).find((name) => column.classList.contains(name));
        if (!widthClass) return;
        const width = `${WIDTHS[widthClass]}%`;
        column.style.setProperty("width", width, "important");
        column.style.setProperty("min-width", width, "important");
        column.style.setProperty("max-width", width, "important");
        column.style.setProperty("transition", "none", "important");
      });
    });
  }

  if (typeof buildTableColGroup === "function") {
    const originalBuildTableColGroup = buildTableColGroup;
    buildTableColGroup = function buildTableColGroupWithExactWidths() {
      const result = originalBuildTableColGroup.apply(this, arguments);
      applyExactTableWidths();
      return result;
    };
  }

  if (typeof buildHeader === "function") {
    const originalBuildHeader = buildHeader;
    buildHeader = function buildHeaderWithExactWidths() {
      const result = originalBuildHeader.apply(this, arguments);
      applyExactTableWidths();
      return result;
    };
  }

  if (typeof renderTable === "function") {
    const originalRenderTable = renderTable;
    renderTable = function renderTableWithExactWidths() {
      const result = originalRenderTable.apply(this, arguments);
      applyExactTableWidths();
      return result;
    };
  }

  const style = document.createElement("style");
  style.textContent = `
    .appShell .tableScroller {
      width: 100% !important;
      max-width: 100% !important;
      overflow: visible !important;
      overflow-x: visible !important;
      overflow-y: visible !important;
      max-height: none !important;
      scrollbar-gutter: auto !important;
    }

    .appShell .tableScroller table {
      width: 100% !important;
      min-width: 100% !important;
      max-width: 100% !important;
      table-layout: fixed !important;
    }

    .appShell .tableScroller col.col-select { width: 3% !important; min-width: 3% !important; max-width: 3% !important; }
    .appShell .tableScroller col.col-id { width: 3% !important; min-width: 3% !important; max-width: 3% !important; }
    .appShell .tableScroller col.col-flag { width: 3% !important; min-width: 3% !important; max-width: 3% !important; }
    .appShell .tableScroller col.col-name { width: 13% !important; min-width: 13% !important; max-width: 13% !important; }
    .appShell .tableScroller col.col-nationality { width: 7% !important; min-width: 7% !important; max-width: 7% !important; }
    .appShell .tableScroller col.col-age { width: 4% !important; min-width: 4% !important; max-width: 4% !important; }
    .appShell .tableScroller col.col-positions { width: 8% !important; min-width: 8% !important; max-width: 8% !important; }
    .appShell .tableScroller col.col-seasons { width: 5% !important; min-width: 5% !important; max-width: 5% !important; }
    .appShell .tableScroller col.col-stat { width: 6% !important; min-width: 6% !important; max-width: 6% !important; }
    .appShell .tableScroller col.col-contract-revenue { width: 8% !important; min-width: 8% !important; max-width: 8% !important; }
    .appShell .tableScroller col.col-contract-club { width: 19% !important; min-width: 19% !important; max-width: 19% !important; }
    .appShell .tableScroller col.col-contract-division { width: 9% !important; min-width: 9% !important; max-width: 9% !important; }
    .appShell .tableScroller col.col-agent,
    .appShell .tableScroller col.col-joined-agency,
    .appShell .tableScroller col.col-owned-since { width: 9% !important; min-width: 9% !important; max-width: 9% !important; }
    .appShell .tableScroller col.col-link { width: 3% !important; min-width: 3% !important; max-width: 3% !important; }

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

source += "\n\n" + engine.strip() + "\n"
path.write_text(source, encoding="utf-8")

for temporary_path in (
    Path(".github/workflows/one-time-exact-table-widths.yml"),
    Path(".github/scripts/exact_table_widths.py"),
):
    if temporary_path.exists():
        temporary_path.unlink()
