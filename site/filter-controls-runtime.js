(() => {
  "use strict";

  const CONTRACT_COLUMN = "contract_status";
  const AT_MOST_DEFAULT_COLUMNS = new Set(["age", "player_seasons", "player_id"]);
  const STYLE_ID = "mflFilterControlStyles";

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .filtersDialog .filterRule {
        grid-template-columns: 104px minmax(160px, 1fr) minmax(130px, 0.75fr) minmax(180px, 1.2fr) 40px;
      }

      .filtersDialog select {
        border-right-width: 6px;
        border-right-color: var(--surface);
        outline: 1px solid var(--border-strong);
        outline-offset: -1px;
      }

      .filtersDialog select:hover:not(:disabled),
      .filtersDialog select:focus:not(:disabled),
      .filtersDialog select:focus-visible:not(:disabled) {
        border-right-color: var(--row-hover);
        outline: 1px solid var(--primary-hover);
        outline-offset: -1px;
      }

      .filtersDialog select[data-filter-connector],
      .filtersDialog select[data-filter-operator] {
        padding-top: 0;
        padding-bottom: 0;
        line-height: 38px;
      }

      .pageSizeSelectGrid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 6px;
        align-items: center;
        width: var(--page-size-select-width, auto);
        height: 40px;
        overflow: hidden;
        border: 1px solid var(--border-strong);
        border-radius: 6px;
        background: var(--surface);
        color: var(--text);
        font: inherit;
        transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
      }

      .pageSizeSelectGrid:hover,
      .pageSizeSelectGrid:focus-within {
        border-color: var(--primary-hover);
        background: var(--row-hover);
        color: var(--text);
      }

      .pageSizeSelectGrid #pageSizeSelect {
        grid-column: 1;
        align-self: stretch;
        width: 100%;
        height: 38px;
        margin: 0;
        padding: 0 26px 0 13px;
        border: 0;
        border-radius: 5px 0 0 5px;
        outline: 0;
        background: transparent;
        color: inherit;
        box-shadow: none;
        font: inherit;
      }

      .pageSizeSelectGrid #pageSizeSelect:hover:not(:disabled),
      .pageSizeSelectGrid #pageSizeSelect:focus:not(:disabled),
      .pageSizeSelectGrid #pageSizeSelect:focus-visible:not(:disabled) {
        border: 0;
        outline: 0;
        background: transparent;
        color: inherit;
        box-shadow: none;
      }

      @media (max-width: 900px) {
        .field.compact.rowsField .pageSizeSelectGrid {
          width: min(160px, 48vw);
        }
      }

      .filtersDialog .filterRule > .iconButton.popupCloseButton {
        align-self: center;
        justify-self: center;
        width: 36px;
        min-width: 36px;
        max-width: 36px;
        height: 36px;
        min-height: 36px;
        max-height: 36px;
        margin: 0;
        padding: 0;
        font-size: 0;
      }

      .filtersDialog .filterRule > .popupCloseButton::before,
      .filtersDialog .filterRule > .popupCloseButton::after {
        top: 50%;
        left: 50%;
        width: 10px;
        height: 2px;
        border-radius: 999px;
        background: currentColor;
      }
    `;
    document.head.appendChild(style);
  }

  function rebuildPageSizeSelectGrid() {
    const select = document.getElementById("pageSizeSelect");
    if (!(select instanceof HTMLSelectElement)) return false;
    if (select.parentElement?.classList.contains("pageSizeSelectGrid")) return true;

    const originalWidth = select.getBoundingClientRect().width;
    const grid = document.createElement("span");
    grid.className = "pageSizeSelectGrid";
    if (Number.isFinite(originalWidth) && originalWidth > 0) {
      grid.style.setProperty("--page-size-select-width", `${originalWidth}px`);
    }

    select.before(grid);
    grid.appendChild(select);
    return true;
  }

  function syncExistingContractOperators() {
    document.querySelectorAll(`.filterRule[data-filter-column="${CONTRACT_COLUMN}"] select[data-filter-operator]`).forEach((select) => {
      if (!(select instanceof HTMLSelectElement)) return;
      const selected = select.value === "!=" ? "!=" : "=";
      select.hidden = false;
      const alreadyCorrect = select.options.length === 2
        && select.options[0]?.value === "="
        && select.options[0]?.textContent === "is"
        && select.options[1]?.value === "!="
        && select.options[1]?.textContent === "is not";
      if (!alreadyCorrect) {
        select.replaceChildren(
          new Option("is", "="),
          new Option("is not", "!="),
        );
      }
      select.value = selected;
    });
  }

  function installAddFilterDefaults() {
    const addFilterRule = window.addFilterRule;
    if (typeof addFilterRule !== "function" || addFilterRule.__mflFilterDefaults) return false;

    const wrappedAddFilterRule = function(column, options = {}) {
      const nextOptions = { ...options };
      if (AT_MOST_DEFAULT_COLUMNS.has(String(column || "")) && !nextOptions.operator) {
        nextOptions.operator = "<=";
      }
      const result = addFilterRule(column, nextOptions);
      syncExistingContractOperators();
      return result;
    };
    Object.defineProperty(wrappedAddFilterRule, "__mflFilterDefaults", { value: true });
    window.addFilterRule = wrappedAddFilterRule;
    return true;
  }

  function installCoreBridge() {
    try {
      const installed = Boolean(window.eval(`(() => {
        if (typeof buildOperatorSelect !== "function" || typeof ruleMatches !== "function") return false;
        if (typeof contractStatusFilterColumn === "undefined") return false;

        if (!buildOperatorSelect.__mflContractOperators) {
          const originalBuildOperatorSelect = buildOperatorSelect;
          const contractAwareBuildOperatorSelect = function(column) {
            const select = originalBuildOperatorSelect(column);
            if (column === contractStatusFilterColumn) {
              select.hidden = false;
              select.replaceChildren(
                new Option("is", "="),
                new Option("is not", "!="),
              );
            }
            return select;
          };
          Object.defineProperty(contractAwareBuildOperatorSelect, "__mflContractOperators", { value: true });
          buildOperatorSelect = contractAwareBuildOperatorSelect;
        }

        if (!ruleMatches.__mflContractOperators) {
          const originalRuleMatches = ruleMatches;
          const contractAwareRuleMatches = function(row, rule) {
            if (rule?.column === contractStatusFilterColumn && rule.operator === "!=") {
              return !originalRuleMatches(row, { ...rule, operator: "=" });
            }
            return originalRuleMatches(row, rule);
          };
          Object.defineProperty(contractAwareRuleMatches, "__mflContractOperators", { value: true });
          ruleMatches = contractAwareRuleMatches;
        }

        return true;
      })();`));
      if (installed) {
        installAddFilterDefaults();
        syncExistingContractOperators();
      }
      return installed;
    } catch (error) {
      console.warn("Could not initialize filter controls.", error);
      return false;
    }
  }

  function sync() {
    installStyles();
    rebuildPageSizeSelectGrid();
    installAddFilterDefaults();
    installCoreBridge();
    syncExistingContractOperators();
  }

  installStyles();
  sync();

  const headObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLScriptElement)) continue;
        if (!/\/modules\/app-core\.js(?:$|\?)/.test(node.src)) continue;
        node.addEventListener("load", sync, { once: true });
      }
    }
  });
  headObserver.observe(document.head, { childList: true });

  window.addEventListener("mfl:ready", () => {
    sync();
    headObserver.disconnect();
  }, { once: true });

  window.__mflFilterControlsRuntime = Object.freeze({ sync });
})();
