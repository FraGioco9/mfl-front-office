(() => {
  const coreScript = document.createElement("script");
  coreScript.src = "/app-core.js?v=1.150.1";
  coreScript.async = false;

  coreScript.addEventListener("load", () => {
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

    function applyCurrentColumnWidths() {
      const colGroup = document.querySelector("#tableColGroup");
      const table = colGroup?.closest("table");
      if (!colGroup || !table) return;

      table.style.setProperty("table-layout", "fixed", "important");
      table.style.setProperty("width", "100%", "important");
      table.style.removeProperty("min-width");
      table.style.removeProperty("max-width");

      Array.from(colGroup.children).forEach((column) => {
        const widthClass = Object.keys(WIDTHS).find((className) => column.classList.contains(className));
        if (!widthClass) return;

        const width = `${WIDTHS[widthClass]}%`;
        column.style.setProperty("width", width, "important");
        column.style.setProperty("min-width", width, "important");
        column.style.setProperty("max-width", width, "important");
        column.style.setProperty("transition", "none", "important");
      });
    }

    if (typeof window.buildTableColGroup === "function") {
      const originalBuildTableColGroup = window.buildTableColGroup;
      window.buildTableColGroup = function buildTableColGroupWithImmediateWidths() {
        const result = originalBuildTableColGroup.apply(this, arguments);
        applyCurrentColumnWidths();
        return result;
      };
    }

    document.addEventListener("click", (event) => {
      const button = event.target.closest?.("#progressionPage .viewButton[data-view]");
      if (!button) return;
      applyCurrentColumnWidths();
    });

    const style = document.createElement("style");
    style.textContent = `
      #progressionPage .tableScroller table,
      #progressionPage .tableScroller col {
        transition: none !important;
      }
    `;
    document.head.appendChild(style);

    document.body.classList.remove(
      "contractsGridSwitching",
      "clubViewSwitching",
      "clubWidthHardLock",
      "clubAtomicSwitch"
    );
    applyCurrentColumnWidths();
  }, { once: true });

  coreScript.addEventListener("error", () => {
    console.error("Could not load the application core.");
  }, { once: true });

  document.head.appendChild(coreScript);
})();
