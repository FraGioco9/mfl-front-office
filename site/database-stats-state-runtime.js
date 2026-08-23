(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "");
  const STATS_PATH = /^\/database\/stats\/?$/i;
  const RUNTIME_KEY = "__mflDatabaseStatsStateRuntime";

  window[RUNTIME_KEY]?.destroy?.();

  let lastPersistedStatsRoute = false;
  let pendingCloudPersist = 0;

  function isStatsPath(pathname = location.pathname) {
    return STATS_PATH.test(String(pathname || ""));
  }

  function rememberStatsView(forceSave = false) {
    if (!isStatsPath()) {
      lastPersistedStatsRoute = false;
      return;
    }

    try {
      if (typeof state !== "object") return;
      const existing = state.tablePageStates?.database && typeof state.tablePageStates.database === "object"
        ? state.tablePageStates.database
        : {};
      const alreadyStats = existing.view === "stats";
      state.tablePageStates = state.tablePageStates || {};
      state.tablePageStates.database = { ...existing, view: "stats" };
      if ((forceSave || !lastPersistedStatsRoute || !alreadyStats) && typeof saveTableState === "function") {
        saveTableState();
      }
      lastPersistedStatsRoute = true;
    } catch {
      // Stats remains usable when preferences cannot be persisted.
    }
  }

  function queueStatsCloudPersist() {
    if (pendingCloudPersist) window.clearTimeout(pendingCloudPersist);
    pendingCloudPersist = window.setTimeout(() => {
      pendingCloudPersist = 0;
      if (isStatsPath()) rememberStatsView(true);
    }, 0);
  }

  async function renderStatsRoute() {
    if (!isStatsPath()) return false;

    // database-stats-runtime.js owns data loading and rendering. Its startup
    // sync already begins the route render when the runtime is loaded, so this
    // state owner must not invoke renderDatabaseStatsPage a second time.
    window.setDatabaseStatsPageVisibility?.(true);
    rememberStatsView(false);
    return true;
  }

  function syncRouteState() {
    if (isStatsPath()) {
      rememberStatsView(false);
      queueStatsCloudPersist();
    } else {
      lastPersistedStatsRoute = false;
    }
  }

  syncRouteState();

  function destroy() {
    if (pendingCloudPersist) window.clearTimeout(pendingCloudPersist);
  }

  window[RUNTIME_KEY] = Object.freeze({
    version: VERSION,
    sync: syncRouteState,
    persist: () => rememberStatsView(true),
    render: renderStatsRoute,
    destroy,
  });
})();
