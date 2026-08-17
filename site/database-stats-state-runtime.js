(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "1.123.12");
  const STATS_PATH = /^\/database\/stats\/?$/i;
  const RUNTIME_KEY = "__mflDatabaseStatsStateRuntime";
  const initialPage = String(document.documentElement.dataset.initialPage || "").replace(/^\//, "");
  const initialStatsIntent = initialPage === "database/stats"
    || document.documentElement.dataset.staticPage === "databasestats";

  window[RUNTIME_KEY]?.destroy?.();

  let originalSetPage = null;
  let originalSetView = null;
  let originalShowHomeShell = null;
  let originalApplyWalletTableState = null;
  let originalPageTargetFromPath = null;
  let lastPersistedStatsRoute = false;
  let initialStatsHandled = false;
  let pendingRouteSync = 0;
  let pendingCloudPersist = 0;

  function isStatsPath(pathname = location.pathname) {
    return STATS_PATH.test(String(pathname || ""));
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

  function ensureStatsAllowedInDatabaseView() {
    try {
      if (typeof pageViewOptions !== "object" || !Array.isArray(pageViewOptions.database)) return;
      const addedStatsView = !pageViewOptions.database.includes("stats");
      if (addedStatsView) pageViewOptions.database.push("stats");
      if (addedStatsView && typeof updateViewButtons === "function" && state?.currentPage === "database") {
        updateViewButtons();
      }
    } catch {
      // The Database view still renders even if a future core changes its view registry.
    }
  }

  function refreshDatabaseNavigation() {
    try {
      if (typeof updateNavigationLinks === "function") updateNavigationLinks();
    } catch {
      // The current route remains valid even if a future core changes sidebar navigation.
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

  function saveCurrentTableBeforeStats() {
    try {
      if (typeof state !== "object" || state.currentPage !== "database" || state.view === "stats") return;
      if (typeof currentTablePageState !== "function") return;
      state.tablePageStates = state.tablePageStates || {};
      state.tablePageStates.database = currentTablePageState();
      if (typeof saveTableState === "function") saveTableState();
    } catch {
      // Preserving the route is more important than optional table-state persistence.
    }
  }

  function commitStatsTransition(updateUrl = false) {
    const commit = Reflect.get(window, "__mflCommitViewTransition");
    if (typeof commit !== "function") return false;
    commit("database", "stats", {
      statePageName: "database",
      path: "/database/stats",
      replace: !updateUrl,
    });
    return true;
  }

  async function waitForStatsTransitionPaint() {
    const wait = Reflect.get(window, "__mflWaitForViewTransitionPaint");
    if (typeof wait === "function") await wait();
  }

  function rememberStatsView(forceSave = false) {
    if (!isStatsPath()) {
      lastPersistedStatsRoute = false;
      return;
    }

    try {
      ensureStatsAllowedInDatabaseView();
      if (typeof state !== "object") return;
      const existing = state.tablePageStates?.database && typeof state.tablePageStates.database === "object"
        ? state.tablePageStates.database
        : {};
      const alreadyStats = state.tablePageStates?.database?.view === "stats";
      state.tablePageStates = state.tablePageStates || {};
      state.tablePageStates.database = { ...existing, view: "stats" };
      refreshDatabaseNavigation();
      if ((forceSave || !lastPersistedStatsRoute || !alreadyStats) && typeof saveTableState === "function") {
        saveTableState();
      }
      lastPersistedStatsRoute = true;
    } catch {
      // Stats remains available for guests when preferences cannot be persisted.
    }
  }

  function queueStatsCloudPersist() {
    if (pendingCloudPersist) window.clearTimeout(pendingCloudPersist);
    pendingCloudPersist = window.setTimeout(() => {
      pendingCloudPersist = 0;
      if (isStatsPath()) rememberStatsView(true);
    }, 0);
  }

  async function renderStatsRoute(updateUrl = false) {
    ensureStatsAllowedInDatabaseView();
    saveCurrentTableBeforeStats();
    commitStatsTransition(updateUrl);
    rememberStatsView(true);
    await waitForStatsTransitionPaint();

    const runtimeToken = window.__mflInteractionBusy?.begin?.("route-runtime") || "";
    try {
      if (typeof window.__mflEnsureRouteRuntime === "function") {
        await window.__mflEnsureRouteRuntime("database", { view: "stats" });
      }
      if (typeof window.renderDatabaseStatsPage === "function") {
        await window.renderDatabaseStatsPage(false);
      } else {
        window.setDatabaseStatsPageVisibility?.(true);
      }
      rememberStatsView(false);
    } finally {
      if (runtimeToken) window.__mflInteractionBusy?.end?.(runtimeToken);
    }
  }

  function cloudDatabaseView(savedState) {
    try {
      return String(savedState?.pages?.database?.view || "");
    } catch {
      return "";
    }
  }

  function installPageTargetBridge() {
    ensureStatsAllowedInDatabaseView();
    if (originalPageTargetFromPath || typeof pageTargetFromPath !== "function") return;
    originalPageTargetFromPath = pageTargetFromPath;

    pageTargetFromPath = function pageTargetFromPathWithDatabaseStats(path) {
      const cleanPath = String(path || "").split("?")[0];
      if (isStatsPath(cleanPath)) {
        return { pageName: "database", options: { view: "stats" } };
      }
      return originalPageTargetFromPath.call(this, path);
    };
  }

  function installWalletTableStateBridge() {
    ensureStatsAllowedInDatabaseView();
    if (originalApplyWalletTableState || typeof applyWalletTableState !== "function") return;
    originalApplyWalletTableState = applyWalletTableState;

    applyWalletTableState = function applyWalletTableStateWithDatabaseStats(savedState) {
      ensureStatsAllowedInDatabaseView();
      const savedStatsView = cloudDatabaseView(savedState) === "stats";
      const explicitStatsRoute = isStatsPath();
      const result = originalApplyWalletTableState.call(this, savedState);
      ensureStatsAllowedInDatabaseView();

      if ((savedStatsView || explicitStatsRoute) && typeof state === "object") {
        const existing = state.tablePageStates?.database && typeof state.tablePageStates.database === "object"
          ? state.tablePageStates.database
          : {};
        state.tablePageStates = state.tablePageStates || {};
        state.tablePageStates.database = { ...existing, view: "stats" };
        refreshDatabaseNavigation();
      }

      if (explicitStatsRoute) {
        commitStatsTransition(false);
        rememberStatsView(true);
        queueStatsCloudPersist();
      }
      return result;
    };
  }

  function installSetPageBridge() {
    ensureStatsAllowedInDatabaseView();
    if (originalSetPage || typeof setPage !== "function") return;
    originalSetPage = setPage;

    setPage = async function setPageWithDatabaseStats(pageName, updateHash = true, options = {}) {
      if (pageName === "database") {
        ensureStatsAllowedInDatabaseView();
        const explicitView = String(options?.view || "");
        const targetView = explicitView || currentDatabaseView() || "attributes";
        if (targetView === "stats") {
          await renderStatsRoute(Boolean(updateHash));
          return;
        }
      }
      return originalSetPage.call(this, pageName, updateHash, options);
    };
  }

  function installSetViewBridge() {
    ensureStatsAllowedInDatabaseView();
    if (originalSetView || typeof setView !== "function") return;
    originalSetView = setView;

    setView = function setViewWithDatabaseStats(viewName) {
      if (state?.currentPage === "database" && String(viewName || "") === "stats") {
        void renderStatsRoute(true);
        return;
      }
      return originalSetView.apply(this, arguments);
    };
  }

  function installInitialShellBridge() {
    if (originalShowHomeShell || typeof showHomeShell !== "function") return;
    originalShowHomeShell = showHomeShell;

    showHomeShell = async function showHomeShellWithDatabaseStats(pageName = "home", updateUrl = true, options = {}) {
      if (initialStatsIntent && !initialStatsHandled) {
        initialStatsHandled = true;
        ensureStatsAllowedInDatabaseView();
        if (typeof syncHomeLoginButton === "function") syncHomeLoginButton();
        if (typeof updateAccountState === "function") updateAccountState();
        await renderStatsRoute(false);
        if (typeof syncHomeLoginButton === "function") syncHomeLoginButton();
        if (typeof updateMenuVisibility === "function") updateMenuVisibility();
        queueStatsCloudPersist();
        return;
      }

      if (pageName === "database" && String(options?.view || "") === "stats") {
        await renderStatsRoute(Boolean(updateUrl));
        return;
      }

      return originalShowHomeShell.call(this, pageName, updateUrl, options);
    };
  }

  function clearBarTransition() {
    document.querySelectorAll("#databaseStatsPage .mflStatsHistogram").forEach((histogram) => {
      if (!(histogram instanceof HTMLElement)) return;
      histogram.classList.remove("databaseStatsAnimate");
      histogram.removeAttribute("data-database-stats-apply-transition");
    });
  }

  function keepDraftOnStats(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest("#databaseStatsCustomTooltipPortal")) return;
    clearBarTransition();
    commitStatsTransition(false);
    window.setDatabaseStatsPageVisibility?.(true);
    rememberStatsView(false);
  }

  function syncRouteState() {
    pendingRouteSync = 0;
    installStyles();
    ensureStatsAllowedInDatabaseView();
    installPageTargetBridge();
    installWalletTableStateBridge();
    installSetPageBridge();
    installSetViewBridge();
    installInitialShellBridge();
    if (isStatsPath()) {
      commitStatsTransition(false);
      rememberStatsView(false);
      window.setDatabaseStatsPageVisibility?.(true);
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

  installStyles();
  ensureStatsAllowedInDatabaseView();
  installPageTargetBridge();
  installWalletTableStateBridge();
  installSetPageBridge();
  installSetViewBridge();
  installInitialShellBridge();
  document.addEventListener("pointerdown", onNavigationPointerDown, true);
  document.addEventListener("focusin", keepDraftOnStats, true);
  document.addEventListener("beforeinput", keepDraftOnStats, true);
  document.addEventListener("input", keepDraftOnStats, true);
  document.addEventListener("change", keepDraftOnStats, true);
  window.addEventListener("popstate", syncRouteState);
  syncRouteState();

  function destroy() {
    if (pendingRouteSync) window.clearTimeout(pendingRouteSync);
    if (pendingCloudPersist) window.clearTimeout(pendingCloudPersist);
    window.removeEventListener("popstate", syncRouteState);
    document.removeEventListener("pointerdown", onNavigationPointerDown, true);
    document.removeEventListener("focusin", keepDraftOnStats, true);
    document.removeEventListener("beforeinput", keepDraftOnStats, true);
    document.removeEventListener("input", keepDraftOnStats, true);
    document.removeEventListener("change", keepDraftOnStats, true);
    clearBarTransition();
    document.getElementById("databaseStatsStateStyles")?.remove();
    if (originalSetPage && typeof setPage === "function") setPage = originalSetPage;
    if (originalSetView && typeof setView === "function") setView = originalSetView;
    if (originalShowHomeShell && typeof showHomeShell === "function") showHomeShell = originalShowHomeShell;
    if (originalApplyWalletTableState && typeof applyWalletTableState === "function") {
      applyWalletTableState = originalApplyWalletTableState;
    }
    if (originalPageTargetFromPath && typeof pageTargetFromPath === "function") {
      pageTargetFromPath = originalPageTargetFromPath;
    }
  }

  window[RUNTIME_KEY] = {
    version: VERSION,
    sync: syncRouteState,
    persist: () => rememberStatsView(true),
    render: renderStatsRoute,
    destroy,
  };
})();