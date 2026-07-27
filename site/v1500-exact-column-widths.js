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

  function applyExactColumnWidths() {
    const colGroup = document.querySelector("#tableColGroup");
    if (!colGroup) return;

    Array.from(colGroup.children).forEach((col) => {
      const matchedClass = Object.keys(WIDTHS).find((className) => col.classList.contains(className));
      if (!matchedClass) return;
      const width = `${WIDTHS[matchedClass]}%`;
      col.style.setProperty("width", width, "important");
      col.style.setProperty("min-width", "0", "important");
      col.style.setProperty("max-width", "none", "important");
    });
  }

  if (typeof buildTableColGroup === "function") {
    const originalBuildTableColGroup = buildTableColGroup;
    buildTableColGroup = function buildTableColGroupWithExactPercentages() {
      const result = originalBuildTableColGroup.apply(this, arguments);
      applyExactColumnWidths();
      return result;
    };
  }

  if (typeof buildHeader === "function") {
    const originalBuildHeader = buildHeader;
    buildHeader = function buildHeaderWithExactPercentages() {
      const result = originalBuildHeader.apply(this, arguments);
      applyExactColumnWidths();
      return result;
    };
  }

  const observer = new MutationObserver(() => applyExactColumnWidths());

  function initialize() {
    applyExactColumnWidths();
    const colGroup = document.querySelector("#tableColGroup");
    if (colGroup) observer.observe(colGroup, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
  }

  const style = document.createElement("style");
  style.textContent = `
    .appShell .tableScroller table {
      width: 100% !important;
      table-layout: fixed !important;
    }
    .appShell .tableScroller col.col-select { width: 3% !important; min-width: 0 !important; max-width: none !important; }
    .appShell .tableScroller col.col-id { width: 3% !important; min-width: 0 !important; max-width: none !important; }
    .appShell .tableScroller col.col-flag { width: 3% !important; min-width: 0 !important; max-width: none !important; }
    .appShell .tableScroller col.col-name { width: 13% !important; min-width: 0 !important; max-width: none !important; }
    .appShell .tableScroller col.col-nationality { width: 7% !important; min-width: 0 !important; max-width: none !important; }
    .appShell .tableScroller col.col-age { width: 4% !important; min-width: 0 !important; max-width: none !important; }
    .appShell .tableScroller col.col-positions { width: 8% !important; min-width: 0 !important; max-width: none !important; }
    .appShell .tableScroller col.col-seasons { width: 5% !important; min-width: 0 !important; max-width: none !important; }
    .appShell .tableScroller col.col-stat { width: 6% !important; min-width: 0 !important; max-width: none !important; }
    .appShell .tableScroller col.col-contract-revenue { width: 8% !important; min-width: 0 !important; max-width: none !important; }
    .appShell .tableScroller col.col-contract-club { width: 19% !important; min-width: 0 !important; max-width: none !important; }
    .appShell .tableScroller col.col-contract-division { width: 9% !important; min-width: 0 !important; max-width: none !important; }
    .appShell .tableScroller col.col-agent,
    .appShell .tableScroller col.col-joined-agency,
    .appShell .tableScroller col.col-owned-since { width: 9% !important; min-width: 0 !important; max-width: none !important; }
    .appShell .tableScroller col.col-link { width: 3% !important; min-width: 0 !important; max-width: none !important; }
    .appShell .tableScroller .selectionCell { width: auto !important; min-width: 0 !important; }
  `;
  document.head.appendChild(style);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
