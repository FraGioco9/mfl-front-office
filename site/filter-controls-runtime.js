(() => {
  "use strict";

  const CONTRACT_COLUMN = "contract_status";
  const AT_MOST_DEFAULT_COLUMNS = new Set(["age", "player_seasons", "player_id"]);

  function installSelectedLinksDirectOpen() {
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
          // Opener isolation is best-effort across browsers.
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
      window.__mflDropdownRuntime?.sync?.();
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
        window.__mflDropdownRuntime?.sync?.();
      }
      return installed;
    } catch (error) {
      console.warn("Could not initialize filter controls.", error);
      return false;
    }
  }

  function sync() {
    installSelectedLinksDirectOpen();
    restorePageSizeSelectInteraction();
    installAddFilterDefaults();
    installCoreBridge();
    syncExistingContractOperators();
    window.__mflDropdownRuntime?.sync?.();
  }

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
