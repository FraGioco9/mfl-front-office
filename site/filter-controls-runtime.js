(() => {
  "use strict";

  const CONTRACT_COLUMN = "contract_status";
  const AT_MOST_DEFAULT_COLUMNS = new Set(["age", "player_seasons", "player_id"]);
  const STATIC_PAGE_VIEWS = Object.freeze({
    database: ["attributes", "contracts", "stats"],
    mfl: ["attributes", "stats"],
    progression: ["current", "all"],
    watchlist: ["attributes", "next", "contracts", "current", "all"],
    myplayers: ["attributes", "next", "contracts", "current", "all"],
  });
  const STATIC_DEFAULT_VIEWS = Object.freeze({
    database: "attributes",
    mfl: "attributes",
    progression: "current",
    watchlist: "current",
    myplayers: "attributes",
  });
  const STATIC_VIEW_SLUGS = Object.freeze({
    attributes: "attributes",
    stats: "stats",
    contracts: "contracts",
    "next-overall": "next",
    "current-season": "current",
    "all-time": "all",
  });

  function syncDropdowns(root = document) {
    try {
      window.__mflDropdowns?.enhanceVisible(root);
    } catch {
      // Dropdown enhancement is presentation-only; never block table startup.
    }
  }

  function staticPageNameFromPath(pathname = window.location.pathname) {
    const first = String(pathname || "/").split("/").filter(Boolean)[0]?.toLowerCase() || "";
    if (first === "my-players") return "myplayers";
    return Object.prototype.hasOwnProperty.call(STATIC_PAGE_VIEWS, first) ? first : "";
  }

  function staticViewFromUrl(urlValue, pageName) {
    const allowedViews = STATIC_PAGE_VIEWS[pageName] || [];
    const fallback = STATIC_DEFAULT_VIEWS[pageName] || allowedViews[0] || "";
    try {
      const url = new URL(String(urlValue || ""), window.location.href);
      const searchView = String(url.searchParams.get("view") || "").toLowerCase();
      const normalizedSearchView = STATIC_VIEW_SLUGS[searchView] || searchView;
      if (allowedViews.includes(normalizedSearchView)) return normalizedSearchView;

      const segments = String(url.pathname || "").split("/").filter(Boolean);
      for (let index = segments.length - 1; index >= 0; index -= 1) {
        const segment = String(segments[index] || "").toLowerCase();
        const view = STATIC_VIEW_SLUGS[segment] || segment;
        if (allowedViews.includes(view)) return view;
      }
    } catch {
      // Fall back to the page default when a link cannot be parsed.
    }
    return fallback;
  }

  function syncStaticViewButtons(pageName, requestedView = "") {
    const allowedViews = STATIC_PAGE_VIEWS[pageName];
    if (!Array.isArray(allowedViews) || !allowedViews.length) return;

    const activeView = allowedViews.includes(requestedView)
      ? requestedView
      : (STATIC_DEFAULT_VIEWS[pageName] || allowedViews[0]);
    const views = document.querySelector("#progressionPage .views");
    if (views instanceof HTMLElement) {
      const switcher = document.getElementById("watchlistSwitcher");
      allowedViews.forEach((viewName) => {
        const button = views.querySelector(`:scope > .viewButton[data-view="${viewName}"]`);
        if (button instanceof HTMLButtonElement) views.insertBefore(button, switcher || null);
      });

      views.querySelectorAll(":scope > .viewButton[data-view]").forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        const viewName = String(button.dataset.view || "");
        button.hidden = !allowedViews.includes(viewName);
        button.classList.toggle("active", viewName === activeView);
      });
    }

    const staticStatsViews = pageName === "database"
      ? document.querySelector("#databaseStatsPage .views")
      : pageName === "mfl"
        ? document.querySelector("#mflStatsPage .views")
        : null;
    if (staticStatsViews instanceof HTMLElement) {
      staticStatsViews.querySelectorAll(":scope > .viewButton[data-view]").forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        button.hidden = !allowedViews.includes(String(button.dataset.view || ""));
        button.classList.toggle("active", String(button.dataset.view || "") === activeView);
      });
    }
  }

  function syncStaticViewButtonsFromLocation() {
    const pageName = staticPageNameFromPath();
    if (!pageName) return;
    syncStaticViewButtons(pageName, staticViewFromUrl(window.location.href, pageName));
  }

  function installStaticViewShell() {
    if (window.__mflStaticViewShellInstalled === true) return true;
    window.__mflStaticViewShellInstalled = true;

    document.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const sidebarButton = target?.closest?.("#sidebar .navButton[data-page]");
      if (!(sidebarButton instanceof HTMLElement)) return;

      const pageName = String(sidebarButton.dataset.page || "");
      if (!STATIC_PAGE_VIEWS[pageName]) return;
      const href = sidebarButton.getAttribute("href") || window.location.href;
      syncStaticViewButtons(pageName, staticViewFromUrl(href, pageName));
    }, true);
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
          // Best-effort opener isolation.
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
    window.__mflDropdowns?.syncSelect(select);
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
      window.__mflDropdowns?.syncSelect(select);
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
      queueMicrotask(() => syncDropdowns(document.getElementById("filtersModal") || document));
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
            queueMicrotask(() => {
              try {
                window.__mflDropdowns?.enhanceVisible(document.getElementById("filtersModal") || document);
              } catch {}
            });
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
        syncDropdowns(document.getElementById("filtersModal") || document);
      }
      return installed;
    } catch (error) {
      console.warn("Could not initialize filter controls.", error);
      return false;
    }
  }

  function sync() {
    installStaticViewShell();
    syncStaticViewButtonsFromLocation();
    installSelectedLinksDirectOpen();
    restorePageSizeSelectInteraction();
    installAddFilterDefaults();
    installCoreBridge();
    syncExistingContractOperators();
    syncDropdowns(document);
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
