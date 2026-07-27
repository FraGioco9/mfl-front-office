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

  function applyWidths() {
    const page = document.querySelector("#progressionPage");
    if (!page) return false;

    const pageWidth = Math.floor(page.getBoundingClientRect().width);
    if (!pageWidth) return false;

    page.querySelectorAll(".tableShell, .tableScroller").forEach((element) => {
      element.style.setProperty("width", "100%", "important");
      element.style.setProperty("min-width", "100%", "important");
      element.style.setProperty("max-width", "100%", "important");
      element.style.setProperty("box-sizing", "border-box", "important");
      element.style.setProperty("overflow", "visible", "important");
    });

    page.querySelectorAll(".tableScroller table").forEach((table) => {
      const width = `${pageWidth}px`;
      table.style.setProperty("width", width, "important");
      table.style.setProperty("min-width", width, "important");
      table.style.setProperty("max-width", width, "important");
      table.style.setProperty("table-layout", "fixed", "important");
      table.style.setProperty("box-sizing", "border-box", "important");

      const colGroup = table.querySelector("colgroup");
      if (!colGroup) return;

      Array.from(colGroup.children).forEach((column) => {
        const className = Object.keys(WIDTHS).find((name) => column.classList.contains(name));
        if (!className) return;
        const widthInPixels = `${pageWidth * WIDTHS[className] / 100}px`;
        column.style.setProperty("width", widthInPixels, "important");
        column.style.setProperty("min-width", widthInPixels, "important");
        column.style.setProperty("max-width", widthInPixels, "important");
      });
    });

    return true;
  }

  const wrap = (name) => {
    if (typeof window[name] !== "function") return;
    const original = window[name];
    window[name] = function unifiedTableWidthWrapper() {
      const result = original.apply(this, arguments);
      applyWidths();
      return result;
    };
  };

  wrap("buildTableColGroup");
  wrap("buildHeader");
  wrap("renderTable");

  const style = document.createElement("style");
  style.textContent = `
    #progressionPage .tableShell,
    #progressionPage .tableScroller {
      width: 100% !important;
      min-width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      overflow: visible !important;
    }
    #progressionPage .tableScroller table {
      table-layout: fixed !important;
      box-sizing: border-box !important;
    }
  `;
  document.head.appendChild(style);

  applyWidths();
  window.addEventListener("resize", applyWidths, { passive: true });
  document.addEventListener("click", (event) => {
    if (event.target.closest?.(".viewButton")) requestAnimationFrame(applyWidths);
  }, true);
})();
