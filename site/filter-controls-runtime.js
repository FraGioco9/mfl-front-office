(() => {
  "use strict";

  let coreObserver = null;
  let destroyed = false;

  function syncDropdowns(root = document) {
    try {
      window.__mflDropdowns?.enhanceVisible(root);
    } catch {
      // Dropdown enhancement is presentation-only; never block table startup.
    }
  }

  function currentStatsPageName() {
    const segments = String(window.location.pathname || "/").split("/").filter(Boolean);
    const pageName = String(segments[0] || "").toLowerCase();
    const viewName = String(segments[1] || "").toLowerCase();
    return viewName === "stats" && (pageName === "database" || pageName === "mfl") ? pageName : "";
  }

  function consumeActiveStatsControlEvent(event) {
    if (event.type === "pointerdown" && (event.isPrimary === false || event.button !== 0)) return;
    const target = event.target instanceof Element ? event.target : null;
    const activeControl = target?.closest?.(
      ".mflStatsFilterButton.active, .mflStatsDistributionModeButton.active",
    );
    if (activeControl instanceof HTMLButtonElement && !activeControl.disabled && !activeControl.hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const button = target?.closest?.('.viewButton[data-view="stats"]');
    if (!(button instanceof HTMLButtonElement) || button.disabled || button.hidden) return;

    const currentPage = currentStatsPageName();
    if (!currentPage) return;
    const ownerPage = String(button.dataset.page || "")
      || (button.closest("#databaseStatsPage") ? "database" : "")
      || (button.closest("#mflStatsPage") ? "mfl" : "");
    if (ownerPage !== currentPage) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function installActiveStatsViewNoop() {
    if (window.__mflActiveStatsViewNoopInstalled === true) return;
    window.__mflActiveStatsViewNoopInstalled = true;
    document.addEventListener("pointerdown", consumeActiveStatsControlEvent, true);
    document.addEventListener("click", consumeActiveStatsControlEvent, true);
  }

  function installSelectedLinksDirectOpen() {
    if (window.__mflSelectedLinksCaptureInstalled === true) return;
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
        const playerWindow = window.open(`https://app.playmfl.com/players/${encodeURIComponent(playerId)}`, "_blank");
        if (!playerWindow) return;
        openedCount += 1;
        try { playerWindow.opener = null; } catch {}
      });

      if (openedCount < playerIds.length) {
        try { showToast("Allow pop-ups for this site, then click Open links again."); } catch {}
      }
      try {
        clearSelection();
      } catch {
        document.getElementById("clearSelectionButton")?.click?.();
      }
    }, true);
  }

  function restorePageSizeSelectInteraction() {
    if (document.documentElement.dataset.mflReady !== "true") return;
    const select = document.getElementById("pageSizeSelect");
    if (!(select instanceof HTMLSelectElement)) return;
    select.disabled = false;
    select.inert = false;
    select.removeAttribute("aria-disabled");
    window.__mflDropdowns?.syncSelect(select);
  }

  function installCoreBridge() {
    if (destroyed) return false;
    try {
      const installed = Boolean(window.eval(`(() => {
        if (typeof buildOperatorSelect !== "function"
          || typeof ruleMatches !== "function"
          || typeof addFilterRule !== "function"
          || typeof contractStatusFilterColumn === "undefined") return false;

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

        if (!addFilterRule.__mflFilterDefaults) {
          const originalAddFilterRule = addFilterRule;
          const atMostDefaults = new Set(["age", "player_seasons", "player_id"]);
          const filterDefaultAddFilterRule = function(column, options = {}) {
            const nextOptions = { ...options };
            if (atMostDefaults.has(String(column || "")) && !nextOptions.operator) nextOptions.operator = "<=";
            const result = originalAddFilterRule(column, nextOptions);
            queueMicrotask(() => window.__mflDropdowns?.enhanceVisible(document.getElementById("filtersModal") || document));
            return result;
          };
          Object.defineProperty(filterDefaultAddFilterRule, "__mflFilterDefaults", { value: true });
          addFilterRule = filterDefaultAddFilterRule;
          window.addFilterRule = filterDefaultAddFilterRule;
        }

        return true;
      })()`));
      if (installed) syncDropdowns(document.getElementById("filtersModal") || document);
      return installed;
    } catch (error) {
      console.warn("Could not initialize filter controls.", error);
      return false;
    }
  }

  function sync() {
    installActiveStatsViewNoop();
    installSelectedLinksDirectOpen();
    restorePageSizeSelectInteraction();
    installCoreBridge();
    syncDropdowns(document);
  }

  function installCoreBridgeWhenAvailable() {
    if (installCoreBridge()) return;
    coreObserver = new MutationObserver((records, observer) => {
      const coreInserted = records.some((record) => Array.from(record.addedNodes).some((node) => (
        node instanceof HTMLScriptElement && node.dataset.mflRuntime === "/modules/app-core.js"
      )));
      if (!coreInserted) return;
      observer.disconnect();
      coreObserver = null;
      installCoreBridge();
    });
    coreObserver.observe(document.head, { childList: true });
  }

  installActiveStatsViewNoop();
  installSelectedLinksDirectOpen();
  installCoreBridgeWhenAvailable();
  window.addEventListener("mfl:ready", sync, { once: true });

  function destroy() {
    destroyed = true;
    coreObserver?.disconnect();
    coreObserver = null;
    document.removeEventListener("pointerdown", consumeActiveStatsControlEvent, true);
    document.removeEventListener("click", consumeActiveStatsControlEvent, true);
    window.removeEventListener("mfl:ready", sync);
  }

  window.__mflFilterControlsRuntime = Object.freeze({ sync, destroy });
})();
