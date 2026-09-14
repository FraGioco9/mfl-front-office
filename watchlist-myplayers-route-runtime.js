(() => {
  "use strict";
  const VERSION = String(window.__mflReleaseVersion || "dev");
  const PAIR = new Set(["watchlist", "myplayers"]);
  const TABLE_PAGES = new Set(["database", "mfl", "agents", "progression", "watchlist", "myplayers"]);
  window.__mflWatchlistMyPlayersRouteRuntime?.destroy?.();
  let sequence = 0;
  let latestIntent = null;
  let setPageFeatureOwner = null;
  let originalSwitchWatchlist = null;
  let wrappedSwitchWatchlist = null;
  let originalLoadWalletPreferences = null;
  let wrappedLoadWalletPreferences = null;
  let originalSaveWalletPreferencesNow = null;
  let wrappedSaveWalletPreferencesNow = null;
  let originalApplyWatchlists = null;
  let wrappedApplyWatchlists = null;
  let originalApplyFilters = null;
  let wrappedApplyFilters = null;
  let walletPreferencesLoadPromise = null;
  let walletPreferencesSaveDepth = 0;
  let skipNextNoopWatchlistSaveFilter = false;
  let watchlistNavigationDepth = 0;
  let deferredWatchlistFilter = null;
  let reconciling = false;
  let destroyed = false;

  function globalFunction(name) {
    const candidate = Reflect.get(window, name);
    return typeof candidate === "function" ? candidate : null;
  }

  function replaceGlobalFunction(name, expected, replacement) {
    if (typeof replacement !== "function") return false;
    const current = globalFunction(name);
    if (expected && current !== expected) return false;
    return Reflect.set(window, name, replacement);
  }

  function interactionBusyChainIncludes(candidate, target) {
    if (typeof candidate !== "function" || typeof target !== "function") return false;
    const seen = new Set();
    let current = candidate;
    while (typeof current === "function" && !seen.has(current)) {
      if (current === target) return true;
      seen.add(current);
      current = current.__mflInteractionBusyOriginal;
    }
    return false;
  }

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

  function preferredIntentView(pageName) {
    try {
      if (typeof preferredViewForPage === "function") {
        const preferred = String(preferredViewForPage(pageName) || "");
        if (preferred) return preferred;
      }
      const savedView = state?.tablePageStates?.[pageName]?.view;
      if (typeof normalizeViewForPage === "function") {
        return String(normalizeViewForPage(savedView, pageName) || "");
      }
      return String(savedView || "");
    } catch {
      return "";
    }
  }

  function intentOptions(pageName, options = {}) {
    const requestedView = String(options?.view || "").trim();
    if (requestedView) return { ...options, view: requestedView };
    const preferredView = preferredIntentView(pageName);
    return preferredView ? { ...options, view: preferredView } : { ...options };
  }

  function resolveWatchlistNavigationOptions(options = {}) {
    const nextOptions = { ...options };
    if (String(nextOptions.watchlistId || "").trim()) return nextOptions;

    let watchlistId = "";
    try {
      watchlistId = String(state?.currentWatchlistId || "").trim();
      if (!watchlistId && typeof watchlistIdFromUrl === "function") {
        watchlistId = String(watchlistIdFromUrl() || "").trim();
      }
      if (!watchlistId && typeof ensureDefaultWatchlist === "function") {
        ensureDefaultWatchlist();
        watchlistId = String(state?.currentWatchlistId || state?.watchlists?.[0]?.id || "").trim();
      }
    } catch {}

    return watchlistId ? { ...nextOptions, watchlistId } : nextOptions;
  }

  function stateView(pageName) {
    try {
      if (typeof normalizeViewForPage === "function") {
        return String(normalizeViewForPage(state?.view, pageName) || "");
      }
      return String(state?.view || "");
    } catch {
      return "";
    }
  }

  function intentPath(intent) {
    try {
      if (typeof pagePath !== "function" || !intent) return "";
      return String(pagePath(intent.pageName, intent.options || {}) || "");
    } catch {
      return "";
    }
  }

  function intentSatisfied(intent) {
    if (!intent || statePage() !== intent.pageName || bodyPage() !== intent.pageName) return false;
    const requestedView = String(intent.options?.view || "").trim();
    if (requestedView) {
      let normalizedRequestedView = requestedView;
      try {
        if (typeof normalizeViewForPage === "function") {
          normalizedRequestedView = String(normalizeViewForPage(requestedView, intent.pageName) || requestedView);
        }
      } catch {}
      if (stateView(intent.pageName) !== normalizedRequestedView) return false;
    }
    const expectedPath = intentPath(intent);
    if (expectedPath && `${window.location.pathname}${window.location.search}` !== expectedPath) return false;
    return true;
  }

  function watchlistSnapshot() {
    try {
      const lists = Array.isArray(state?.watchlists) ? state.watchlists : [];
      return JSON.stringify({
        currentWatchlistId: String(state?.currentWatchlistId || ""),
        watchlists: lists.map((watchlist) => {
          const ids = Array.isArray(watchlist?.playerIds)
            ? watchlist.playerIds.map((playerId) => String(playerId)).sort()
            : [];
          return {
            id: String(watchlist?.id || ""),
            name: String(watchlist?.name || ""),
            playerIds: ids,
          };
        }),
      });
    } catch {
      return "";
    }
  }

  async function reconcile(intent, setPageDelegate = globalFunction("__mflSetPageRouteOwner")) {
    if (destroyed || reconciling || !intent || latestIntent?.sequence !== intent.sequence) return;
    if (intentSatisfied(intent) || typeof setPageDelegate !== "function") return;
    reconciling = true;
    try {
      const expectedPath = intentPath(intent);
      await setPageDelegate.call(window, intent.pageName, false, {
        ...intent.options,
        ...(expectedPath ? { replaceUrl: expectedPath } : {}),
        skipNavigationLoading: true,
      });
    } catch (error) {
      console.error("Could not keep the latest Watchlist/My Players route.", error);
    } finally {
      reconciling = false;
    }
  }

  function installWalletPreferencesSingleFlight() {
    const candidate = globalFunction("loadWalletPreferences");
    if (!candidate) return false;
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

      const result = originalLoadWalletPreferences.apply(this, args);
      const pending = Promise.resolve(result);
      const tracked = pending.finally(() => {
        if (walletPreferencesLoadPromise === tracked) walletPreferencesLoadPromise = null;
      });
      walletPreferencesLoadPromise = tracked;
      return tracked;
    };

    return replaceGlobalFunction("loadWalletPreferences", candidate, wrappedLoadWalletPreferences);
  }

  function installWatchlistSaveResponseDedupe() {
    const watchlistsCandidate = globalFunction("applyWatchlists");
    if (watchlistsCandidate && watchlistsCandidate !== wrappedApplyWatchlists) {
      originalApplyWatchlists = watchlistsCandidate;
      wrappedApplyWatchlists = function applyWatchlistsWithSaveNoopTracking(...args) {
        const trackSaveResponse = walletPreferencesSaveDepth > 0 && statePage() === "watchlist";
        const before = trackSaveResponse ? watchlistSnapshot() : "";
        const result = originalApplyWatchlists.apply(this, args);
        if (trackSaveResponse) {
          const after = watchlistSnapshot();
          skipNextNoopWatchlistSaveFilter = Boolean(before && before === after);
        }
        return result;
      };
      replaceGlobalFunction("applyWatchlists", watchlistsCandidate, wrappedApplyWatchlists);
    }

    const saveCandidate = globalFunction("saveWalletPreferencesNow");
    if (saveCandidate && saveCandidate !== wrappedSaveWalletPreferencesNow) {
      originalSaveWalletPreferencesNow = saveCandidate;
      wrappedSaveWalletPreferencesNow = async function saveWalletPreferencesWithoutNoopWatchlistReload(...args) {
        walletPreferencesSaveDepth += 1;
        try {
          return await originalSaveWalletPreferencesNow.apply(this, args);
        } finally {
          walletPreferencesSaveDepth = Math.max(0, walletPreferencesSaveDepth - 1);
          if (!walletPreferencesSaveDepth) skipNextNoopWatchlistSaveFilter = false;
        }
      };
      replaceGlobalFunction("saveWalletPreferencesNow", saveCandidate, wrappedSaveWalletPreferencesNow);
    }

    return typeof wrappedApplyWatchlists === "function" && typeof wrappedSaveWalletPreferencesNow === "function";
  }

  function installWatchlistFilterGate() {
    const candidate = globalFunction("applyFilters");
    if (!candidate) return false;
    if (candidate === wrappedApplyFilters) return true;

    originalApplyFilters = candidate;
    wrappedApplyFilters = function applyFiltersWithWatchlistSyncGate(...args) {
      if (walletPreferencesSaveDepth > 0 && skipNextNoopWatchlistSaveFilter && statePage() === "watchlist") {
        skipNextNoopWatchlistSaveFilter = false;
        return undefined;
      }
      if (watchlistNavigationDepth > 0 && statePage() === "watchlist") {
        if (walletPreferencesSyncActive()) {
          deferredWatchlistFilter = { filterThis: this, filterArgs: args };
          return undefined;
        }
        deferredWatchlistFilter = null;
      }
      return originalApplyFilters.apply(this, args);
    };

    return replaceGlobalFunction("applyFilters", candidate, wrappedApplyFilters);
  }

  function flushDeferredWatchlistFilter() {
    if (!deferredWatchlistFilter || typeof originalApplyFilters !== "function") return;
    if (watchlistNavigationDepth > 0 || walletPreferencesSyncActive() || statePage() !== "watchlist") return;
    const { filterThis, filterArgs } = deferredWatchlistFilter;
    deferredWatchlistFilter = null;
    originalApplyFilters.apply(filterThis, filterArgs);
  }

  function installWatchlistSwitchLoadDedupe() {
    const candidate = globalFunction("switchWatchlist");
    if (!candidate) return false;
    if (candidate === wrappedSwitchWatchlist || interactionBusyChainIncludes(candidate, wrappedSwitchWatchlist)) return true;

    const delegatedSwitchWatchlist = candidate;
    originalSwitchWatchlist = delegatedSwitchWatchlist;
    wrappedSwitchWatchlist = function switchWatchlistWithSingleLoad(...args) {
      const filterCandidate = globalFunction("applyFilters");
      if (!filterCandidate) return delegatedSwitchWatchlist.apply(this, args);

      let filterRequested = false;
      let filterThis = this;
      let filterArgs = [];
      const deferredApplyFilters = function (...nextArgs) {
        filterRequested = true;
        filterThis = this;
        filterArgs = nextArgs;
      };

      if (!replaceGlobalFunction("applyFilters", filterCandidate, deferredApplyFilters)) {
        return delegatedSwitchWatchlist.apply(this, args);
      }

      let result;
      try {
        result = delegatedSwitchWatchlist.apply(this, args);
      } finally {
        replaceGlobalFunction("applyFilters", deferredApplyFilters, filterCandidate);
      }

      if (filterRequested) filterCandidate.apply(filterThis, filterArgs);
      return result;
    };

    return replaceGlobalFunction("switchWatchlist", candidate, wrappedSwitchWatchlist);
  }

  function install() {
    installWalletPreferencesSingleFlight();
    installWatchlistSaveResponseDedupe();
    installWatchlistFilterGate();

    const delegatedSetPage = globalFunction("__mflSetPageRouteOwner");
    if (!delegatedSetPage) return false;
    const installedFeatureOwner = globalFunction("__mflSetPageFeatureOwner");
    if (installedFeatureOwner === setPageFeatureOwner) {
      installWatchlistSwitchLoadDedupe();
      return true;
    }
    if (installedFeatureOwner) return false;

    setPageFeatureOwner = async function setPageWithLatestWatchlistMyPlayersIntent(pageName, updateHash = true, options = {}) {
      const normalizedPage = String(pageName || "");
      const tableNavigation = TABLE_PAGES.has(normalizedPage);
      const pairNavigation = PAIR.has(normalizedPage);
      const watchlistNavigation = normalizedPage === "watchlist";
      const requestSequence = pairNavigation ? ++sequence : 0;
      const nextOptions = tableNavigation
        ? (watchlistNavigation ? resolveWatchlistNavigationOptions(options) : intentOptions(normalizedPage, options))
        : options;
      if (pairNavigation) {
        latestIntent = { sequence: requestSequence, pageName: normalizedPage, options: { ...nextOptions } };
      } else {
        latestIntent = null;
        sequence += 1;
      }
      if (watchlistNavigation) watchlistNavigationDepth += 1;
      try {
        const result = await delegatedSetPage.call(this, pageName, updateHash, nextOptions);
        if (watchlistNavigation && walletPreferencesSyncActive()) await waitForWalletPreferencesSettled();
        if (pairNavigation && latestIntent?.sequence !== requestSequence) await reconcile(latestIntent, delegatedSetPage);
        else if (pairNavigation && latestIntent?.sequence === requestSequence) {
          await Promise.resolve();
          await reconcile(latestIntent, delegatedSetPage);
        }
        return result;
      } finally {
        if (watchlistNavigation) {
          watchlistNavigationDepth = Math.max(0, watchlistNavigationDepth - 1);
          flushDeferredWatchlistFilter();
        }
      }
    };

    Reflect.set(window, "__mflSetPageFeatureOwner", setPageFeatureOwner);
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
    walletPreferencesSaveDepth = 0;
    skipNextNoopWatchlistSaveFilter = false;

    if (wrappedSwitchWatchlist && originalSwitchWatchlist) {
      replaceGlobalFunction("switchWatchlist", wrappedSwitchWatchlist, originalSwitchWatchlist);
    }
    if (wrappedApplyFilters && originalApplyFilters) {
      replaceGlobalFunction("applyFilters", wrappedApplyFilters, originalApplyFilters);
    }
    if (wrappedApplyWatchlists && originalApplyWatchlists) {
      replaceGlobalFunction("applyWatchlists", wrappedApplyWatchlists, originalApplyWatchlists);
    }
    if (wrappedSaveWalletPreferencesNow && originalSaveWalletPreferencesNow) {
      replaceGlobalFunction("saveWalletPreferencesNow", wrappedSaveWalletPreferencesNow, originalSaveWalletPreferencesNow);
    }
    if (wrappedLoadWalletPreferences && originalLoadWalletPreferences) {
      replaceGlobalFunction("loadWalletPreferences", wrappedLoadWalletPreferences, originalLoadWalletPreferences);
    }
    if (globalFunction("__mflSetPageFeatureOwner") === setPageFeatureOwner) {
      Reflect.set(window, "__mflSetPageFeatureOwner", null);
    }
  }

  if (!install()) requestAnimationFrame(() => { if (!destroyed) install(); });
  window.__mflWatchlistMyPlayersRouteRuntime = Object.freeze({ version: VERSION, install, destroy });
})();