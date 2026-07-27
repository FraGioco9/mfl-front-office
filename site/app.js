(() => {
  const coreScript = document.createElement("script");
  coreScript.src = "/app-core.js?v=1.150.4";
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

    let switchingView = false;
    let revealFrame = 0;

    function setImportant(element, property, value) {
      if (!element) return;
      if (
        element.style.getPropertyValue(property) === value
        && element.style.getPropertyPriority(property) === "important"
      ) {
        return;
      }
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
      setImportant(table, "transition", "none");

      columns.forEach((column, index) => {
        const width = `${percentages[index]}%`;
        setImportant(column, "width", width);
        setImportant(column, "min-width", width);
        setImportant(column, "max-width", width);
        setImportant(column, "transition", "none");
      });

      return true;
    }

    function beginAtomicViewSwitch() {
      if (revealFrame) {
        cancelAnimationFrame(revealFrame);
        revealFrame = 0;
      }
      switchingView = true;
      document.body.classList.add("atomicTableViewSwitch");
    }

    function finishAtomicViewSwitch() {
      if (!switchingView) {
        applyFixedTableWidths();
        return;
      }

      if (revealFrame) cancelAnimationFrame(revealFrame);
      revealFrame = requestAnimationFrame(() => {
        applyFixedTableWidths();
        revealFrame = requestAnimationFrame(() => {
          applyFixedTableWidths();
          document.body.classList.remove("atomicTableViewSwitch");
          switchingView = false;
          revealFrame = 0;
        });
      });
    }

    function wrap(functionName, after) {
      const original = window[functionName];
      if (typeof original !== "function" || original.__atomicTableRender) return;

      function wrappedAtomicTableRender() {
        const result = original.apply(this, arguments);
        after();
        if (result && typeof result.finally === "function") result.finally(after);
        return result;
      }

      wrappedAtomicTableRender.__atomicTableRender = true;
      window[functionName] = wrappedAtomicTableRender;
    }

    wrap("buildTableColGroup", applyFixedTableWidths);
    wrap("buildHeader", applyFixedTableWidths);
    wrap("renderTable", finishAtomicViewSwitch);
    wrap("applyFilters", finishAtomicViewSwitch);
    wrap("restoreSavedTableState", finishAtomicViewSwitch);
    wrap("setPage", finishAtomicViewSwitch);

    document.addEventListener("pointerdown", (event) => {
      const viewButton = event.target.closest?.(".viewButton[data-view]");
      if (viewButton && !viewButton.classList.contains("active")) beginAtomicViewSwitch();
    }, true);

    document.addEventListener("click", (event) => {
      const viewButton = event.target.closest?.(".viewButton[data-view]");
      if (viewButton && !viewButton.classList.contains("active")) beginAtomicViewSwitch();
    }, true);

    const style = document.createElement("style");
    style.textContent = `
      .tableScroller table,
      .tableScroller col,
      .tableScroller th,
      .tableScroller td {
        transition: none !important;
        animation: none !important;
      }

      body.atomicTableViewSwitch .tableShell {
        visibility: hidden !important;
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
  }, { once: true });

  coreScript.addEventListener("error", () => {
    console.error("Could not load the application core.");
  }, { once: true });

  document.head.appendChild(coreScript);
})();