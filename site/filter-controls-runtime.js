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

      .controlsBar > .field.compact.rowsField {
        position: relative;
        z-index: 1;
        justify-self: end;
      }

      .watchlistSwitcher > select.watchlistButtonNativeChevron {
        position: absolute;
        top: 50%;
        right: 8px;
        z-index: 2;
        width: 38px;
        min-width: 38px;
        max-width: 38px;
        height: 38px;
        margin: 0;
        padding: 0;
        border: 0;
        outline: 0;
        background-color: transparent;
        color: #ffffff;
        -webkit-text-fill-color: #ffffff;
        opacity: 1;
        -webkit-appearance: menulist;
        appearance: auto;
        pointer-events: none;
        transform: translateY(-50%);
      }

      .field.rowsField .pageSizeSelectGrid {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 6px;
        align-items: center;
        width: var(--page-size-select-width, auto);
        min-width: 0;
        height: 40px;
        overflow: hidden;
        border: 1px solid var(--border-strong);
        border-radius: 6px;
        background: var(--surface);
        color: #ffffff;
        font: inherit;
        cursor: pointer;
        pointer-events: auto;
        transition: background 120ms ease, border-color 120ms ease;
      }

      .field.rowsField .pageSizeSelectGrid:hover,
      .field.rowsField .pageSizeSelectGrid:focus-within {
        border-color: var(--primary-hover);
        background: var(--row-hover);
        color: #ffffff;
      }

      .field.rowsField .pageSizeSelectGrid #pageSizeSelect {
        position: relative;
        z-index: 2;
        grid-column: 1;
        align-self: stretch;
        display: block;
        width: 100%;
        min-width: 0;
        height: 38px;
        margin: 0;
        padding: 0 26px 0 13px;
        border: 0;
        border-radius: 5px 0 0 5px;
        outline: 0;
        background: var(--surface);
        color: #ffffff;
        -webkit-text-fill-color: #ffffff;
        opacity: 1;
        box-shadow: none;
        font: inherit;
        cursor: pointer;
        pointer-events: auto;
        transition: background 120ms ease, color 120ms ease;
      }

      .field.rowsField .pageSizeSelectGrid:hover #pageSizeSelect:not(:disabled),
      .field.rowsField .pageSizeSelectGrid:focus-within #pageSizeSelect:not(:disabled),
      .field.rowsField .pageSizeSelectGrid #pageSizeSelect:hover:not(:disabled),
      .field.rowsField .pageSizeSelectGrid #pageSizeSelect:focus:not(:disabled),
      .field.rowsField .pageSizeSelectGrid #pageSizeSelect:focus-visible:not(:disabled) {
        border: 0;
        outline: 0;
        background: var(--row-hover);
        color: #ffffff;
        -webkit-text-fill-color: #ffffff;
        opacity: 1;
        box-shadow: none;
      }

      .field.rowsField .pageSizeSelectGrid #pageSizeSelect:disabled {
        border: 0;
        outline: 0;
        background: var(--surface);
        color: #ffffff;
        -webkit-text-fill-color: #ffffff;
        opacity: 1;
        box-shadow: none;
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

  function installNativeWatchlistChevron() {
    const switcher = document.getElementById("watchlistSwitcher");
    const button = document.getElementById("watchlistButton");
    if (!(switcher instanceof HTMLElement) || !(button instanceof HTMLButtonElement)) return false;

    button.querySelector(":scope > .watchlistButtonChevron")?.remove();

    let nativeChevron = switcher.querySelector(":scope > .watchlistButtonNativeChevron");
    if (!(nativeChevron instanceof HTMLSelectElement)) {
      nativeChevron = document.createElement("select");
      nativeChevron.className = "watchlistButtonNativeChevron";
      nativeChevron.tabIndex = -1;
      nativeChevron.setAttribute("aria-hidden", "true");
      nativeChevron.appendChild(new Option("", ""));
      switcher.appendChild(nativeChevron);
    }
    return true;
  }

  function installSelectedLinksDirectOpen() {
    const button = document.getElementById("openSelectedLinksButton");
    if (!(button instanceof HTMLButtonElement)) return false;
    if (window.__mflSelectedLinksCaptureInstalled === true) return true;

    window.__mflSelectedLinksCaptureInstalled = true;
    window.addEventListener("click", (event) => {
      const target = event.target instanceof Element
        ? event.target.closest("#openSelectedLinksButton")
        : null;
      if (!(target instanceof HTMLButtonElement)) return;

      let playerIds = [];
      try {
        playerIds = Array.from(state?.selectedPlayerIds || [])
          .map((playerId) => String(playerId || "").trim())
          .filter(Boolean);
      } catch {
        return;
      }
      if (!playerIds.length) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      let openedCount = 0;
      playerIds.forEach((playerId) => {
        const playerUrl = `https://app.playmfl.com/players/${encodeURIComponent(playerId)}`;
        const playerWindow = window.open(playerUrl, "_blank");
        if (!playerWindow) return;
        openedCount += 1;
        try {
          playerWindow.opener = null;
        } catch {
          // The link is already open; opener isolation is best-effort across browsers.
        }
      });

      if (openedCount < playerIds.length) {
        try {
          showToast("Allow pop-ups for this site, then click Open links again.");
        } catch {
          // Keep any successfully opened tabs even if the toast owner is unavailable.
        }
      }

      try {
        clearSelection();
      } catch {
        const clearButton = document.getElementById("clearSelectionButton");
        if (clearButton instanceof HTMLButtonElement) clearButton.click();
      }
    }, true);
    return true;
  }

  function restorePageSizeSelectInteraction() {
    if (document.documentElement.dataset.mflReady !== "true") return;
    const select = document.getElementById("pageSizeSelect");
    if (!(select instanceof HTMLSelectElement)) return;
    select.disabled = false;
    select.inert = false;
    select.removeAttribute("aria-disabled");
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
    installNativeWatchlistChevron();
    installSelectedLinksDirectOpen();
    restorePageSizeSelectInteraction();
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
