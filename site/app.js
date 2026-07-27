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

    function columnWidthClass(column) {
      return Object.keys(WIDTHS).find((className) => column.classList.contains(className)) || "";
    }

    function expectedColumnClasses() {
      if (typeof window.currentViewColumns !== "function" || typeof window.tableColumnClass !== "function") {
        return [];
      }

      return [
        "col-select",
        ...window.currentViewColumns().map((column) => {
          const classes = String(window.tableColumnClass(column) || "").split(/\s+/).filter(Boolean);
          return classes.find((className) => Object.hasOwn(WIDTHS, className)) || "";
        }),
      ];
    }

    function currentColumnClasses() {
      const colGroup = document.querySelector("#tableColGroup");
      return colGroup ? Array.from(colGroup.children).map(columnWidthClass) : [];
    }

    function hasExpectedColumns() {
      const expected = expectedColumnClasses();
      const current = currentColumnClasses();
      return expected.length > 0
        && expected.length === current.length
        && expected.every((className, index) => className === current[index]);
    }

    function applyStableWidths() {
      const colGroup = document.querySelector("#tableColGroup");
      const table = colGroup?.closest("table");
      if (!colGroup || !table) return false;

      table.style.setProperty("table-layout", "fixed", "important");
      table.style.setProperty("width", "100%", "important");
      table.style.removeProperty("min-width");
      table.style.removeProperty("max-width");

      let matched = 0;
      Array.from(colGroup.children).forEach((column) => {
        const className = columnWidthClass(column);
        if (!className) return;
        const width = `${WIDTHS[className]}%`;
        matched += 1;
        column.style.setProperty("width", width, "important");
        column.style.setProperty("min-width", width, "important");
        column.style.setProperty("max-width", width, "important");
        column.style.setProperty("transition", "none", "important");
      });

      return matched === colGroup.children.length && matched > 0;
    }

    if (typeof window.buildTableColGroup === "function") {
      const originalBuildTableColGroup = window.buildTableColGroup;
      window.buildTableColGroup = function buildTableColGroupWithoutReplacementFlicker() {
        if (hasExpectedColumns()) {
          applyStableWidths();
          return undefined;
        }

        const result = originalBuildTableColGroup.apply(this, arguments);
        applyStableWidths();
        return result;
      };
    }

    function finishVisibleSwitch() {
      let attempts = 0;
      let previousSignature = "";
      let stableFrames = 0;

      const check = () => {
        attempts += 1;
        applyStableWidths();
        const signature = currentColumnClasses().join("|");

        if (hasExpectedColumns() && signature && signature === previousSignature) stableFrames += 1;
        else stableFrames = 0;
        previousSignature = signature;

        if (stableFrames >= 1 || attempts >= 12) {
          document.body.classList.remove("clubViewSwitching", "clubWidthHardLock", "clubAtomicSwitch");
          return;
        }

        requestAnimationFrame(check);
      };

      requestAnimationFrame(check);
    }

    document.addEventListener("pointerdown", (event) => {
      const button = event.target.closest?.("#progressionPage .viewButton[data-view]");
      if (!button || button.classList.contains("active")) return;
      document.body.classList.add("contractsGridSwitching");
      document.body.classList.remove("clubWidthHardLock", "clubAtomicSwitch");
    }, true);

    document.addEventListener("click", (event) => {
      const button = event.target.closest?.("#progressionPage .viewButton[data-view]");
      if (!button) return;
      applyStableWidths();
      finishVisibleSwitch();
      requestAnimationFrame(() => document.body.classList.remove("contractsGridSwitching"));
    }, true);

    const style = document.createElement("style");
    style.textContent = `
      body.contractsGridSwitching #progressionPage .tableShell {
        visibility: hidden !important;
        opacity: 0 !important;
      }
      #progressionPage .tableScroller table,
      #progressionPage .tableScroller col {
        transition: none !important;
      }
    `;
    document.head.appendChild(style);

    applyStableWidths();
  }, { once: true });

  coreScript.addEventListener("error", () => {
    console.error("Could not load the application core.");
  }, { once: true });

  document.head.appendChild(coreScript);
})();
