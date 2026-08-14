(() => {
  "use strict";
  const VERSION = String(window.__mflReleaseVersion || "dev");
  const PAIR = new Set(["watchlist", "myplayers"]);
  window.__mflWatchlistMyPlayersRouteRuntime?.destroy?.();
  let sequence = 0;
  let latestIntent = null;
  let originalSetPage = null;
  let wrappedSetPage = null;
  let originalSwitchWatchlist = null;
  let wrappedSwitchWatchlist = null;
  let originalLoadWalletPreferences = null;
  let wrappedLoadWalletPreferences = null;
  let originalApplyFilters = null;
  let wrappedApplyFilters = null;
  let walletPreferencesLoadPromise = null;
  let watchlistNavigationDepth = 0;
  let deferredWatchlistFilter = null;
  let reconciling = false;
  let destroyed = false;
  function statePage() {
    try { return typeof state === "object" && state ? String(state.currentPage || "") : ""; }
    catch { return ""; }
  }
  function bodyPage() { return String(document.body?.dataset.page || ""); }
  function walletPreferencesLoading() {
    try { return Boolean(typeof state === "object" && state?.walletPreferencesLoading); }
    catch { return false; }
  }
  function walletPreferencesSyncActive() {
    return walletPreferencesLoading() || Boolean(walletPreferencesLoadPromise);
  }
  function waitForWalletPreferencesLoad() {
    if (!walletPreferencesLoading()) return Promise.resolve();
    return new Promise((resolve) => {
      const check = () => {
        if (destroyed || !walletPreferencesLoading()) resolve();
        else window.setTimeout(check, 16);
      };
      check();
    });
  }
  async function waitForWalletPreferencesSettled() {
    const pending = walletPreferencesLoadPromise;
    if (pending) {
      try { await pending; } catch {}
      return;
    }
    await waitForWalletPreferencesLoad();
  }
  function currentView(pageName) {
    try {
      if (typeof normalizeViewForPage === "function") return normalizeViewForPage(state?.view || "attributes", pageName);
      return String(state?.view || "attributes");
    } catch { return "attributes"; }
  }
  function intentOptions(pageName, options = {}) {
    return { ...options, view: String(options?.view || currentView(pageName) || "attributes") };
  }
  async function reconcile(intent) {
    if (destroyed || reconciling || !intent || latestIntent?.sequence !== intent.sequence) return;
    if (statePage() === intent.pageName && bodyPage() === intent.pageName) return;
    reconciling = true;
    try {
      await originalSetPage.call(window, intent.pageName, false, {
        ...intent.options, replaceUrl: "", skipNavigationLoading: true,
      });
    } catch (error) {
      console.error("Could not keep the latest Watchlist/My Players route.", error);
    } finally { reconciling = false; }
  }
  function installWalletPreferencesSingleFlight() {
    let candidate = null;
    try { candidate = loadWalletPreferences; } catch {}
    if (typeof candidate !== "function") return false;
    if (candidate === wrappedLoadWalletPreferences) return true;

    originalLoadWalletPreferences = candidate;
    wrappedLoadWalletPreferences = function loadWalletPreferencesSingleFlight(...args) {
      if (walletPreferencesLoadPromise) return walletPreferencesLoadPromise;

      if (walletPreferencesLoading()) {
        const existing = waitForWalletPreferencesLoad();
        walletPreferencesLoadPromise = existing.finally(() => {
          if (walletPreferencesLoadPromise === existing || !walletPreferencesLoading()) {
            walletPreferencesLoadPromise = null;
          }
        });
        return walletPreferencesLoadPromise;
      }

      let result;
      try {
        result = originalLoadWalletPreferences.apply(this, args);
      } catch (error) {
        throw error;
      }

      const pending = Promise.resolve(result);
      const tracked = pending.finally(() => {
        if (walletPreferencesLoadPromise === tracked) walletPreferencesLoadPromise = null;
      });
      walletPreferencesLoadPromise = tracked;
      return tracked;
    };

    window.__mflSingleFlightLoadWalletPreferences = wrappedLoadWalletPreferences;
    try { window.loadWalletPreferences = wrappedLoadWalletPreferences; } catch {}
    try { window.eval("loadWalletPreferences = window.__mflSingleFlightLoadWalletPreferences"); } catch {}
    return true;
  }
  function installWatchlistFilterGate() {
    let candidate = null;
    try { candidate = applyFilters; } catch {}
    if (typeof candidate !== "function") return false;
    if (candidate === wrappedApplyFilters) return true;

    originalApplyFilters = candidate;
    wrappedApplyFilters = function applyFiltersWithWatchlistSyncGate(...args) {
      if (watchlistNavigationDepth > 0 && statePage() === "watchlist") {
        if (walletPreferencesSyncActive()) {
          deferredWatchlistFilter = { filterThis: this, filterArgs: args };
          return undefined;
        }
        deferredWatchlistFilter = null;
      }
      return originalApplyFilters.apply(this, args);
    };

    window.__mflWatchlistSyncGatedApplyFilters = wrappedApplyFilters;
    try { window.applyFilters = wrappedApplyFilters; } catch {}
    try { window.eval("applyFilters = window.__mflWatchlistSyncGatedApplyFilters"); } catch {}
    return true;
  }
  function flushDeferredWatchlistFilter() {
    if (!deferredWatchlistFilter || typeof originalApplyFilters !== "function") return;
    if (watchlistNavigationDepth > 0 || walletPreferencesSyncActive() || statePage() !== "watchlist") return;
    const { filterThis, filterArgs } = deferredWatchlistFilter;
    deferredWatchlistFilter = null;
    originalApplyFilters.apply(filterThis, filterArgs);
  }
  function installWatchlistSwitchLoadDedupe() {
    let candidate = null;
    try { candidate = switchWatchlist; } catch {}
    if (typeof candidate !== "function") return false;
    if (candidate === wrappedSwitchWatchlist) return true;

    originalSwitchWatchlist = candidate;
    wrappedSwitchWatchlist = function switchWatchlistWithSingleLoad(...args) {
      let filterCandidate = null;
      try { filterCandidate = applyFilters; } catch {}
      if (typeof filterCandidate !== "function") {
        return originalSwitchWatchlist.apply(this, args);
      }

      let filterRequested = false;
      let filterThis = this;
      let filterArgs = [];
      const deferredApplyFilters = function (...nextArgs) {
        filterRequested = true;
        filterThis = this;
        filterArgs = nextArgs;
      };

      window.__mflWatchlistApplyFiltersOriginal = filterCandidate;
      window.__mflWatchlistApplyFiltersDeferred = deferredApplyFilters;
      let deferredInstalled = false;
      try {
        window.eval("applyFilters = window.__mflWatchlistApplyFiltersDeferred");
        deferredInstalled = true;
      } catch {}

      if (!deferredInstalled) {
        delete window.__mflWatchlistApplyFiltersOriginal;
        delete window.__mflWatchlistApplyFiltersDeferred;
        return originalSwitchWatchlist.apply(this, args);
      }

      let result;
      try {
        // app-core's Watchlist view-memory wrapper currently calls applyFilters
        // once inside the base switch, then again after restoring that list's
        // saved view. Defer both synchronous calls and execute only the final
        // one, after the saved view has already been applied.
        result = originalSwitchWatchlist.apply(this, args);
      } finally {
        try { window.eval("applyFilters = window.__mflWatchlistApplyFiltersOriginal"); } catch {}
        delete window.__mflWatchlistApplyFiltersOriginal;
        delete window.__mflWatchlistApplyFiltersDeferred;
      }

      if (filterRequested) filterCandidate.apply(filterThis, filterArgs);
      return result;
    };

    window.__mflSingleLoadSwitchWatchlist = wrappedSwitchWatchlist;
    try { window.switchWatchlist = wrappedSwitchWatchlist; } catch {}
    try { window.eval("switchWatchlist = window.__mflSingleLoadSwitchWatchlist"); } catch {}
    return true;
  }
  function install() {
    installWalletPreferencesSingleFlight();
    installWatchlistFilterGate();

    let candidate = null;
    try { candidate = setPage; } catch {}
    if (typeof candidate !== "function") return false;
    if (candidate === wrappedSetPage) {
      installWatchlistSwitchLoadDedupe();
      return true;
    }
    originalSetPage = candidate;
    wrappedSetPage = async function setPageWithLatestWatchlistMyPlayersIntent(pageName, updateHash = true, options = {}) {
      const normalizedPage = String(pageName || "");
      const pairNavigation = PAIR.has(normalizedPage);
      const watchlistNavigation = normalizedPage === "watchlist";
      const requestSequence = pairNavigation ? ++sequence : 0;
      const nextOptions = pairNavigation ? intentOptions(normalizedPage, options) : options;
      if (pairNavigation) {
        latestIntent = { sequence: requestSequence, pageName: normalizedPage, options: { ...nextOptions } };
      } else {
        latestIntent = null;
        sequence += 1;
      }
      if (watchlistNavigation) watchlistNavigationDepth += 1;
      try {
        const result = await originalSetPage.call(this, pageName, updateHash, nextOptions);
        if (watchlistNavigation && walletPreferencesSyncActive()) await waitForWalletPreferencesSettled();
        if (pairNavigation && latestIntent?.sequence !== requestSequence) await reconcile(latestIntent);
        else if (pairNavigation && latestIntent?.sequence === requestSequence) {
          await Promise.resolve();
          await reconcile(latestIntent);
        }
        return result;
      } finally {
        if (watchlistNavigation) {
          watchlistNavigationDepth = Math.max(0, watchlistNavigationDepth - 1);
          flushDeferredWatchlistFilter();
        }
      }
    };
    window.__mflLatestPairSetPage = wrappedSetPage;
    try { window.setPage = wrappedSetPage; } catch {}
    try { window.eval("setPage = window.__mflLatestPairSetPage"); } catch {}
    installWatchlistSwitchLoadDedupe();
    return true;
  }
  function destroy() {
    destroyed = true;
    latestIntent = null;
    sequence += 1;
    watchlistNavigationDepth = 0;
    deferredWatchlistFilter = null;
    walletPreferencesLoadPromise = null;
    if (wrappedSwitchWatchlist && originalSwitchWatchlist) {
      try { if (window.switchWatchlist === wrappedSwitchWatchlist) window.switchWatchlist = originalSwitchWatchlist; } catch {}
      try {
        window.__mflPairOriginalSwitchWatchlist = originalSwitchWatchlist;
        window.eval("if (switchWatchlist === window.__mflSingleLoadSwitchWatchlist) switchWatchlist = window.__mflPairOriginalSwitchWatchlist");
      } catch {}
      delete window.__mflPairOriginalSwitchWatchlist;
    }
    if (wrappedApplyFilters && originalApplyFilters) {
      try { if (window.applyFilters === wrappedApplyFilters) window.applyFilters = originalApplyFilters; } catch {}
      try {
        window.__mflPairOriginalApplyFilters = originalApplyFilters;
        window.eval("if (applyFilters === window.__mflWatchlistSyncGatedApplyFilters) applyFilters = window.__mflPairOriginalApplyFilters");
      } catch {}
      delete window.__mflPairOriginalApplyFilters;
    }
    if (wrappedLoadWalletPreferences && originalLoadWalletPreferences) {
      try { if (window.loadWalletPreferences === wrappedLoadWalletPreferences) window.loadWalletPreferences = originalLoadWalletPreferences; } catch {}
      try {
        window.__mflPairOriginalLoadWalletPreferences = originalLoadWalletPreferences;
        window.eval("if (loadWalletPreferences === window.__mflSingleFlightLoadWalletPreferences) loadWalletPreferences = window.__mflPairOriginalLoadWalletPreferences");
      } catch {}
      delete window.__mflPairOriginalLoadWalletPreferences;
    }
    if (wrappedSetPage && originalSetPage) {
      try { if (window.setPage === wrappedSetPage) window.setPage = originalSetPage; } catch {}
      try {
        window.__mflPairOriginalSetPage = originalSetPage;
        window.eval("if (setPage === window.__mflLatestPairSetPage) setPage = window.__mflPairOriginalSetPage");
      } catch {}
      delete window.__mflPairOriginalSetPage;
    }
    delete window.__mflSingleLoadSwitchWatchlist;
    delete window.__mflWatchlistSyncGatedApplyFilters;
    delete window.__mflSingleFlightLoadWalletPreferences;
    delete window.__mflLatestPairSetPage;
  }
  if (!install()) requestAnimationFrame(() => { if (!destroyed) install(); });
  window.__mflWatchlistMyPlayersRouteRuntime = Object.freeze({ version: VERSION, install, destroy });
})();
