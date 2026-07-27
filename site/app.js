(() => {
  const coreScript = document.createElement("script");
  coreScript.src = "/app-core.js?v=1.150.2";
  coreScript.async = false;

  coreScript.addEventListener("load", () => {
    const REFERENCE_WIDTH = 1659;
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

    let applyingWidths = false;

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

    function removeInlineSizing(element) {
      if (!element) return;
      ["width", "min-width", "max-width"].forEach((property) => {
        if (element.style.getPropertyValue(property)) {
          element.style.removeProperty(property);
        }
      });
    }

    function columnReferencePercentage(column) {
      const widthClass = Object.keys(WIDTHS).find((className) => column.classList.contains(className));
      return widthClass ? WIDTHS[widthClass] : null;
    }

    function applyFixedTableWidths() {
      if (applyingWidths) return false;

      const colGroup = document.querySelector("#tableColGroup");
      const table = colGroup?.closest("table");
      const columns = colGroup ? Array.from(colGroup.children) : [];
      if (!colGroup || !table || !columns.length) return false;

      const referencePercentages = columns.map(columnReferencePercentage);
      if (referencePercentages.some((width) => !Number.isFinite(width) || width <= 0)) return false;

      const totalReferencePercentage = referencePercentages.reduce((sum, width) => sum + width, 0);
      if (!Number.isFinite(totalReferencePercentage) || totalReferencePercentage <= 0) return false;

      applyingWidths = true;
      try {
        // 1659px is the 100% reference grid. A view whose visible columns add
        // up to less or more than 100% keeps those exact shares instead of
        // stretching one column to fill the remaining space.
        const tablePercentage = `${totalReferencePercentage}%`;
        setImportant(table, "table-layout", "fixed");
        setImportant(table, "width", tablePercentage);
        setImportant(table, "min-width", tablePercentage);
        setImportant(table, "max-width", tablePercentage);
        setImportant(table, "transition", "none");
        table.dataset.referenceWidth = String(REFERENCE_WIDTH);

        columns.forEach((column, index) => {
          const normalizedWidth = `${(referencePercentages[index] / totalReferencePercentage) * 100}%`;
          setImportant(column, "width", normalizedWidth);
          setImportant(column, "min-width", normalizedWidth);
          setImportant(column, "max-width", normalizedWidth);
          setImportant(column, "transition", "none");
        });

        Array.from(table.rows).forEach((row) => {
          Array.from(row.cells).forEach((cell) => {
            // The colgroup is the only source of column sizing. Older patches
            // write widths directly on cells and can otherwise resize columns
            // after a render or hover-triggered DOM update.
            removeInlineSizing(cell);
            setImportant(cell, "box-sizing", "border-box");
            setImportant(cell, "transition", "none");
          });
        });
      } finally {
        applyingWidths = false;
      }

      return true;
    }

    function wrapWithFixedWidths(functionName) {
      const original = window[functionName];
      if (typeof original !== "function" || original.__fixedTableWidths) return;

      function wrappedWithFixedTableWidths() {
        const result = original.apply(this, arguments);
        applyFixedTableWidths();
        if (result && typeof result.finally === "function") {
          result.finally(applyFixedTableWidths);
        }
        return result;
      }

      wrappedWithFixedTableWidths.__fixedTableWidths = true;
      window[functionName] = wrappedWithFixedTableWidths;
    }

    [
      "restoreSavedTableState",
      "buildTableColGroup",
      "buildHeader",
      "renderTable",
      "applyFilters",
      "setPage",
    ].forEach(wrapWithFixedWidths);

    const style = document.createElement("style");
    style.textContent = `
      .tableScroller table,
      .tableScroller col,
      .tableScroller th,
      .tableScroller td {
        transition: none !important;
        animation: none !important;
      }

      .tableScroller table:hover,
      .tableScroller tr:hover,
      .tableScroller th:hover,
      .tableScroller td:hover {
        transition: none !important;
      }
    `;
    document.head.appendChild(style);

    const table = document.querySelector("#tableColGroup")?.closest("table");
    if (table) {
      const observer = new MutationObserver(() => {
        applyFixedTableWidths();
      });
      observer.observe(table, {
        attributes: true,
        attributeFilter: ["style", "class"],
        childList: true,
        subtree: true,
      });
    }

    document.body.classList.remove(
      "contractsGridSwitching",
      "clubViewSwitching",
      "clubWidthHardLock",
      "clubAtomicSwitch"
    );

    applyFixedTableWidths();
    requestAnimationFrame(applyFixedTableWidths);
  }, { once: true });

  coreScript.addEventListener("error", () => {
    console.error("Could not load the application core.");
  }, { once: true });

  document.head.appendChild(coreScript);
})();
