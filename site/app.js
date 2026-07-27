(() => {
  const CORE_URL = "/app-core.js?v=1.150.7";
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

  function removeLegacyWidthEngines(source) {
    let cleaned = source;

    cleaned = cleaned.replace(
      /  function clearLegacyPixelWidths\(element\) \{[\s\S]*?(?=  function routeViewFromPath\(\))/,
      "  function applyPercentageTableColumnWidths() {}\n\n",
    );

    cleaned = cleaned.replace(
      /\/\* Consolidated from v14974-column-width-fix\.js \*\/[\s\S]*?(?=\/\* Consolidated from )/,
      "",
    );

    return cleaned;
  }

  function setImportant(element, property, value) {
    if (!element) return;
    element.style.setProperty(property, value, "important");
  }

  function fixedPercentageForColumn(column) {
    const widthClass = Object.keys(WIDTHS).find((className) => column.classList.contains(className));
    return widthClass ? WIDTHS[widthClass] : null;
  }

  function applyFixedTableWidths() {
    const colGroup = document.querySelector("#tableColGroup");
    const table = colGroup?.closest("table");
    const columns = colGroup ? Array.from(colGroup.children) : [];
    if (!colGroup || !table || !columns.length) return false;

    const percentages = columns.map(fixedPercentageForColumn);
    if (percentages.some((width) => !Number.isFinite(width) || width <= 0)) return false;

    setImportant(table, "table-layout", "fixed");
    setImportant(table, "width", "100%");
    setImportant(table, "min-width", "100%");
    setImportant(table, "max-width", "100%");

    columns.forEach((column, index) => {
      const width = `${percentages[index]}%`;
      setImportant(column, "width", width);
      setImportant(column, "min-width", width);
      setImportant(column, "max-width", width);
    });

    return true;
  }

  function installSingleWidthEngine() {
    function wrap(functionName) {
      const original = window[functionName];
      if (typeof original !== "function" || original.__singleTableWidthEngine) return;

      function wrappedSingleTableWidthEngine() {
        const result = original.apply(this, arguments);
        applyFixedTableWidths();
        if (result && typeof result.finally === "function") result.finally(applyFixedTableWidths);
        return result;
      }

      wrappedSingleTableWidthEngine.__singleTableWidthEngine = true;
      window[functionName] = wrappedSingleTableWidthEngine;
    }

    [
      "buildTableColGroup",
      "buildHeader",
      "renderTable",
      "applyFilters",
      "restoreSavedTableState",
      "setPage",
    ].forEach(wrap);

    const style = document.createElement("style");
    style.textContent = `
      .tableScroller table,
      .tableScroller col,
      .tableScroller th,
      .tableScroller td {
        transition: none !important;
        animation: none !important;
      }
    `;
    document.head.appendChild(style);

    document.body.classList.remove(
      "contractsGridSwitching",
      "clubViewSwitching",
      "clubWidthHardLock",
      "clubAtomicSwitch",
      "atomicTableViewSwitch"
    );

    applyFixedTableWidths();
  }

  async function loadCore() {
    try {
      const response = await fetch(CORE_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`Core request failed with ${response.status}`);

      const source = removeLegacyWidthEngines(await response.text());
      const blobUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      const coreScript = document.createElement("script");
      coreScript.src = blobUrl;
      coreScript.async = false;

      coreScript.addEventListener("load", () => {
        URL.revokeObjectURL(blobUrl);
        installSingleWidthEngine();
      }, { once: true });

      coreScript.addEventListener("error", () => {
        URL.revokeObjectURL(blobUrl);
        console.error("Could not execute the application core.");
      }, { once: true });

      document.head.appendChild(coreScript);
    } catch (error) {
      console.error("Could not load the application core.", error);
    }
  }

  void loadCore();
})();