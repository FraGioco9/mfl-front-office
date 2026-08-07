(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "1.123.11");
  const STATS_PATH = /^\/database\/stats\/?$/i;
  const RUNTIME_KEY = "__mflDatabaseStatsStateRuntime";

  window[RUNTIME_KEY]?.destroy?.();

  let originalSetPage = null;
  let originalApplyWalletTableState = null;
  let lastPersistedStatsRoute = false;
  let pendingRouteSync = 0;

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
      if (typeof pageViewOptions !== "object" || !Array.isArray(pageViewOptions.database)) return;
      if (!pageViewOptions.database.includes("stats")) pageViewOptions.database.push("stats");
      if (typeof updateViewButtons === "function" && state?.currentPage === "database") updateViewButtons();
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

  function rememberStatsView(forceSave = false) {
    if (!isStatsPath()) {
      lastPersistedStatsRoute = false;
      return;
    }

    try {
      ensureStatsAllowedInSavedDatabaseView();
      if (typeof state !== "object") return;
      const alreadyStats = state.currentPage === "database"
        && state.view === "stats"
        && state.tablePageStates?.database?.view === "stats";
      state.currentPage = "database";
      state.view = "stats";
      const existing = state.tablePageStates?.database && typeof state.tablePageStates.database === "object"
        ? state.tablePageStates.database
        : {};
      state.tablePageStates = state.tablePageStates || {};
      state.tablePageStates.database = { ...existing, view: "stats" };
      if ((forceSave || !lastPersistedStatsRoute || !alreadyStats) && typeof saveTableState === "function") {
        saveTableState();
      }
      lastPersistedStatsRoute = true;
    } catch {
      // Stats still works for guests even when preferences cannot be persisted.
    }
  }

  function cloudDatabaseView(savedState) {
    try {
      return String(savedState?.pages?.database?.view || "");
    } catch {
      return "";
    }
  }

  function installWalletTableStateBridge() {
    ensureStatsAllowedInSavedDatabaseView();
    if (originalApplyWalletTableState || typeof applyWalletTableState !== "function") return;
    originalApplyWalletTableState = applyWalletTableState;

    applyWalletTableState = function applyWalletTableStateWithDatabaseStats(savedState) {
      ensureStatsAllowedInSavedDatabaseView();
      const savedStatsView = cloudDatabaseView(savedState) === "stats";
      const result = originalApplyWalletTableState.call(this, savedState);
      ensureStatsAllowedInSavedDatabaseView();

      if (savedStatsView && typeof state === "object") {
        const existing = state.tablePageStates?.database && typeof state.tablePageStates.database === "object"
          ? state.tablePageStates.database
          : {};
        state.tablePageStates = state.tablePageStates || {};
        state.tablePageStates.database = { ...existing, view: "stats" };
      }

      if (isStatsPath()) rememberStatsView(true);
      return result;
    };
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
          rememberStatsView(true);
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
    pendingRouteSync = 0;
    installStyles();
    installWalletTableStateBridge();
    installSetPageBridge();
    if (isStatsPath()) {
      rememberStatsView();
    } else {
      lastPersistedStatsRoute = false;
      clearBarTransition();
    }
  }

  function scheduleRouteSync() {
    if (pendingRouteSync) return;
    pendingRouteSync = window.setTimeout(syncRouteState, 0);
  }

  function onNavigationPointerDown(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest("#databaseStatsCustomTooltipPortal")) return;
    if (!target.closest("a[href], .navButton, [data-page], [data-view]")) return;

    clearBarTransition();
    if (target.closest('#progressionPage .viewButton[data-view="stats"]')) {
      scheduleRouteSync();
    }
  }

  function onDraftInput(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest("#databaseStatsCustomTooltipPortal input")) return;
    clearBarTransition();
    window.setDatabaseStatsPageVisibility?.(true);
  }

  installStyles();
  installWalletTableStateBridge();
  installSetPageBridge();
  document.addEventListener("pointerdown", onNavigationPointerDown, true);
  document.addEventListener("input", onDraftInput, true);
  window.addEventListener("popstate", syncRouteState);
  syncRouteState();

  function destroy() {
    if (pendingRouteSync) window.clearTimeout(pendingRouteSync);
    window.removeEventListener("popstate", syncRouteState);
    document.removeEventListener("pointerdown", onNavigationPointerDown, true);
    document.removeEventListener("input", onDraftInput, true);
    clearBarTransition();
    document.getElementById("databaseStatsStateStyles")?.remove();
    if (originalSetPage && typeof setPage === "function") setPage = originalSetPage;
    if (originalApplyWalletTableState && typeof applyWalletTableState === "function") {
      applyWalletTableState = originalApplyWalletTableState;
    }
  }

  window[RUNTIME_KEY] = {
    version: VERSION,
    sync: syncRouteState,
    persist: () => rememberStatsView(true),
    destroy,
  };
})();
