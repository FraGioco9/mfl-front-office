(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "1.123.10");
  const STATS_PATH = /^\/database\/stats\/?$/i;
  const RUNTIME_KEY = "__mflDatabaseStatsStateRuntime";

  window[RUNTIME_KEY]?.destroy?.();

  let originalSetPage = null;
  let lastPersistedStatsRoute = false;

  function isStatsPath() {
    return STATS_PATH.test(location.pathname);
  }

  function installStyles() {
    if (document.getElementById("databaseStatsStateStyles")) return;
    const style = document.createElement("style");
    style.id = "databaseStatsStateStyles";
    style.textContent = `
      #databaseStatsPage .mflStatsHistogramBar,
      #databaseStatsPage .mflStatsHistogramBar::after {
        animation: none !important;
        transition: none !important;
      }
      #databaseStatsPage .mflStatsHistogram[data-database-stats-apply-transition="true"] .mflStatsHistogramBar::after {
        animation: mflStatsBarRise 220ms ease-out !important;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureStatsAllowedInSavedDatabaseView() {
    try {
      if (typeof pageViewOptions === "object"
          && Array.isArray(pageViewOptions.database)
          && !pageViewOptions.database.includes("stats")) {
        pageViewOptions.database.push("stats");
      }
    } catch {
      // The legacy table runtime may change its internal storage in a later build.
    }
  }

  function savedDatabaseView() {
    try {
      return String(state?.tablePageStates?.database?.view || "");
    } catch {
      return "";
    }
  }

  function currentDatabaseView() {
    try {
      if (state?.currentPage === "database" && state?.view) return String(state.view);
    } catch {
      // Fall through to the stored page state.
    }
    return savedDatabaseView();
  }

  function rememberStatsView() {
    if (!isStatsPath()) {
      lastPersistedStatsRoute = false;
      return;
    }
    if (lastPersistedStatsRoute) return;

    try {
      ensureStatsAllowedInSavedDatabaseView();
      if (typeof state !== "object") return;
      state.currentPage = "database";
      state.view = "stats";
      const existing = state.tablePageStates?.database && typeof state.tablePageStates.database === "object"
        ? state.tablePageStates.database
        : {};
      state.tablePageStates = state.tablePageStates || {};
      state.tablePageStates.database = { ...existing, view: "stats" };
      if (typeof saveTableState === "function") saveTableState();
      lastPersistedStatsRoute = true;
    } catch {
      // Stats still works for guests even when preferences cannot be persisted.
    }
  }

  function installSetPageBridge() {
    ensureStatsAllowedInSavedDatabaseView();
    if (originalSetPage || typeof setPage !== "function") return;
    originalSetPage = setPage;

    setPage = async function setPageWithDatabaseStats(pageName, updateHash = true, options = {}) {
      if (pageName === "database") {
        ensureStatsAllowedInSavedDatabaseView();
        const explicitView = String(options?.view || "");
        const targetView = explicitView || currentDatabaseView() || "attributes";
        if (targetView === "stats" && typeof window.renderDatabaseStatsPage === "function") {
          await window.renderDatabaseStatsPage(Boolean(updateHash));
          rememberStatsView();
          return;
        }
      }
      return originalSetPage.call(this, pageName, updateHash, options);
    };
  }

  function clearBarTransition() {
    document.querySelectorAll("#databaseStatsPage .mflStatsHistogram").forEach((histogram) => {
      if (!(histogram instanceof HTMLElement)) return;
      histogram.classList.remove("databaseStatsAnimate");
      histogram.removeAttribute("data-database-stats-apply-transition");
    });
  }

  function syncRouteState() {
    installStyles();
    installSetPageBridge();
    if (isStatsPath()) {
      rememberStatsView();
    } else {
      lastPersistedStatsRoute = false;
      clearBarTransition();
    }
  }

  function onNavigationPointerDown(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest("#databaseStatsCustomTooltipPortal")) return;
    if (target.closest("a[href], .navButton, [data-page], [data-view]")) {
      clearBarTransition();
    }
  }

  function onDraftInput(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest("#databaseStatsCustomTooltipPortal input")) return;
    clearBarTransition();
  }

  function onStatsShown() {
    rememberStatsView();
  }

  installStyles();
  installSetPageBridge();
  document.addEventListener("pointerdown", onNavigationPointerDown, true);
  document.addEventListener("input", onDraftInput, true);
  window.addEventListener("popstate", syncRouteState);
  window.addEventListener("mfl:database-stats-shown", onStatsShown);
  syncRouteState();

  function destroy() {
    window.removeEventListener("popstate", syncRouteState);
    window.removeEventListener("mfl:database-stats-shown", onStatsShown);
    document.removeEventListener("pointerdown", onNavigationPointerDown, true);
    document.removeEventListener("input", onDraftInput, true);
    clearBarTransition();
    document.getElementById("databaseStatsStateStyles")?.remove();
    if (originalSetPage && typeof setPage === "function") setPage = originalSetPage;
  }

  window[RUNTIME_KEY] = {
    version: VERSION,
    sync: syncRouteState,
    destroy,
  };
})();
