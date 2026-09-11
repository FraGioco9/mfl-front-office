function clubRouteTargetFromPath() {
  const route = window.__mflAppConfig?.routes?.clubRoute?.(window.location.pathname);
  return route
    ? { scope: "club", clubId: route.clubId, view: route.view }
    : null;
}

function incrementalWatchlistPlayerIds(options = {}) {
  const watchlistId = String(options.watchlistId || watchlistIdFromUrl() || state.currentWatchlistId || "");
  const watchlist = normalizeWatchlists(state.watchlists, Array.from(state.watchlistPlayerIds))
    .find((candidate) => candidate.id === watchlistId);
  return normalizeWatchlistIdList(watchlist?.playerIds || Array.from(state.watchlistPlayerIds));
}

function incrementalRouteTarget(pageName, options = {}) {
  const clubTarget = options.ignoreCurrentClubRoute ? null : clubRouteTargetFromPath();
  if (pageName === "club") {
    const requestedClubId = String(options.clubId || clubTarget?.clubId || "").trim();
    if (!requestedClubId) return null;
    const requestedClubView = String(options.view || clubTarget?.view || "attributes").toLowerCase();
    const clubView = ["attributes", "contracts", "current", "all"].includes(requestedClubView)
      ? requestedClubView
      : "attributes";
    return {
      pageName: "club",
      scope: "club",
      clubId: requestedClubId,
      view: clubView,
      access: "public",
    };
  }

  const view = normalizeViewForPage(options.view || state.view || defaultViewForPage(pageName), pageName);
  const base = {
    pageName,
    view,
    access: currentDataAccess(pageName),
  };

  if (pageName === "database") return { ...base, scope: "database" };
  if (pageName === "progression") return { ...base, scope: "progression" };
  if (pageName === "mfl") return { ...base, scope: view === "stats" ? "mflstats" : "mfl" };
  if (pageName === "agents") {
    return {
      ...base,
      scope: "agent",
      walletAddress: normalizeWalletAddress(options.walletAddress || state.currentAgentWalletAddress || agentWalletAddressFromUrl()).toLowerCase(),
    };
  }
  if (pageName === "watchlist" && hasWalletOptIn()) {
    return {
      ...base,
      scope: "watchlist",
      watchlistId: options.watchlistId || watchlistIdFromUrl() || state.currentWatchlistId || "",
      playerIds: incrementalWatchlistPlayerIds(options),
    };
  }
  if (pageName === "myplayers" && hasWalletOptIn()) return { ...base, scope: "myplayers" };
  if (pageName === "player") {
    return {
      ...base,
      scope: "player",
      playerId: String(options.playerId || playerIdFromUrl() || ""),
      view: "attributes",
    };
  }
  if (pageName === "evaluation") {
    const playerId = String(options.playerId || state.evaluationPlayerId || evaluationPlayerIdFromUrl() || "");
    return playerId
      ? { ...base, scope: "evaluation", playerId, view: "attributes" }
      : { ...base, scope: "empty", view: "attributes" };
  }
  return null;
}

function incrementalDataQuery(route, page = 1) {
  const query = new URLSearchParams({
    mode: "page",
    scope: route.scope,
    view: route.view || "attributes",
    page: String(page),
    pageSize: String(["player", "evaluation"].includes(route.scope)
      ? 1
      : ["club", "mflstats"].includes(route.scope)
        ? 5000
        : state.pageSize),
    sortKey: route.scope === "club" ? "positions" : state.sortKey,
    sortDirection: route.scope === "club" ? "asc" : state.sortDirection,
  });

  if (route.access === "owned") query.set("access", "owned-progression");
  else if (route.access === "full") query.set("access", "full-progression");
  else query.set("access", "public-database");

  if (["current", "all"].includes(route.view)) query.set("includeProgression", "1");
  if (route.playerId) query.set("playerId", route.playerId);
  if (route.clubId) query.set("clubId", route.clubId);
  if (route.walletAddress) query.set("walletAddress", route.walletAddress);
  if (route.playerIds?.length) query.set("playerIds", route.playerIds.join(","));

  const tableRoute = ["database", "progression", "mfl", "agent", "watchlist", "myplayers"].includes(route.scope);
  if (tableRoute) {
    const tableFilters = route.tableFilters && typeof route.tableFilters === "object"
      ? route.tableFilters
      : null;
    if (tableFilters ? tableFilters.hideRetired : hideRetiredInput.checked) query.set("hideRetired", "1");
    if (tableFilters ? tableFilters.hideRetiring : hideRetiringInput.checked) query.set("hideRetiring", "1");
    if (tableFilters ? tableFilters.hideMflPlayers : hideMflPlayersInput?.checked) query.set("hideMfl", "1");
    if (tableFilters ? tableFilters.mflPackable : packablePlayersInput?.checked) query.set("packableOnly", "1");
    if (tableFilters ? tableFilters.newMints : newMintsInput.checked) query.set("newMintsOnly", "1");
    const rules = Array.isArray(route.filterRules) ? route.filterRules : readFilterRules();
    if (rules.length) query.set("filters", JSON.stringify(serializeFilterRulesForRequest(rules)));
  }

  return query;
}

function incrementalRequestDetails(route, page = 1) {
  const query = incrementalDataQuery(route, page);
  const requestKey = query.toString();
  const walletKey = normalizeWalletAddress(state.linkedWalletAddress).toLowerCase() || "guest";
  return {
    query,
    requestKey,
    cacheKey: `${walletKey}:${requestKey}`,
  };
}

const INCREMENTAL_PAYLOAD_CACHE_MAX_ENTRIES = 64;

function readIncrementalPayloadCache(cacheKey) {
  const key = String(cacheKey || "");
  if (!key) return null;
  const payload = state.incrementalPayloadCache.get(key) || null;
  if (!payload) return null;
  state.incrementalPayloadCache.delete(key);
  state.incrementalPayloadCache.set(key, payload);
  return payload;
}

function rememberIncrementalPayload(cacheKey, payload) {
  const key = String(cacheKey || "");
  if (!key || !payload) return payload || null;
  state.incrementalPayloadCache.delete(key);
  state.incrementalPayloadCache.set(key, payload);
  while (state.incrementalPayloadCache.size > INCREMENTAL_PAYLOAD_CACHE_MAX_ENTRIES) {
    const oldestKey = state.incrementalPayloadCache.keys().next().value;
    if (oldestKey === undefined) break;
    state.incrementalPayloadCache.delete(oldestKey);
  }
  return payload;
}

function cachedIncrementalPayload(route, page = 1) {
  if (!route || route.scope === "empty") {
    return null;
  }
  return readIncrementalPayloadCache(incrementalRequestDetails(route, page).cacheKey);
}

function incrementalRouteIsCached(route, page = 1) {
  return Boolean(cachedIncrementalPayload(route, page));
}

function databaseStatsDataCacheReady() {
  const total = document.getElementById("databaseStatsTotalPlayers");
  if (!(total instanceof HTMLElement)) return false;
  const value = String(total.textContent || "").trim();
  return Boolean(value) && value !== "-";
}

function settingsDataCacheReady() {
  return false;
}

function routeDataCacheReady(pageName, options = {}) {
  const page = String(pageName || "home");
  const routeOptions = options && typeof options === "object" && !Array.isArray(options) ? options : {};

  if (page === "home") return homeSummaryCacheReady();
  if (page === "notfound" || page === "changelog") return true;
  if (page === "settings") return settingsDataCacheReady();
  if (page === "database" && normalizeViewForPage(routeOptions.view, "database") === "stats") {
    return databaseStatsDataCacheReady();
  }

  const route = incrementalRouteTarget(page, routeOptions);
  if (!route) return false;
  return route.scope === "empty" || incrementalRouteIsCached(route, 1);
}

function currentRouteDataCacheReady() {
  if (!document.documentElement.classList.contains("mflInitialRouteResolved")) return false;
  const target = pageTargetFromPath(window.location.pathname + window.location.search);
  if (!target?.pageName) return false;
  return routeDataCacheReady(target.pageName, target.options || {});
}

Reflect.set(globalThis, "__mflRouteDataCache", Object.freeze({
  isReady: routeDataCacheReady,
  isCurrentRouteReady: currentRouteDataCacheReady,
}));

function applyIncrementalPayload(route, payload) {
  const tableRoute = ["database", "progression", "mfl", "agent", "watchlist", "myplayers", "club"].includes(route.scope);
  state.columns = Array.isArray(payload.columns) ? payload.columns : [];
  rebuildColumnIndexMap();
  state.rows = Array.isArray(payload.rows) ? payload.rows : [];
  state.filteredRows = [...state.rows];
  if (route.scope === "club") {
    state.clubProfile = payload.club && typeof payload.club === "object"
      ? { ...payload.club }
      : null;
  }
  state.page = Number(payload.page || 1);
  if (tableRoute && !["club"].includes(route.scope)) {
    state.pageSize = Number(payload.pageSize || state.pageSize);
    pageSizeSelect.value = String(state.pageSize);
  }
  state.incrementalMode = tableRoute;
  state.incrementalRoute = { ...route };
  state.incrementalTotalRows = Number(payload.totalRows || 0);
  state.incrementalSourceRows = Number(payload.sourceRows || 0);
  state.tableSourceRowsCount = state.incrementalSourceRows;
  state.dataAccess = route.access;
  state.dataLoaded = true;
  window.__mflPlayerFirstPaintRuntime?.markDetailPayloadReady?.(route, payload);
  clearRowSortCache();
  if (payload.generatedAt) {
    updateStatusDate(payload.generatedAt);
  }
}

const ROUTE_REQUEST_TIMEOUT_MS = 60_000;
let incrementalRouteRequestGeneration = 0;
let activeIncrementalNetworkRequest = null;

function stopActiveIncrementalNetworkRequest() {
  const active = activeIncrementalNetworkRequest;
  if (!active) return;
  activeIncrementalNetworkRequest = null;
  if (!active.controller.signal.aborted) active.controller.abort();
  if (state.incrementalRequestPromises.get(active.cacheKey) === active.promise) {
    state.incrementalRequestPromises.delete(active.cacheKey);
  }
}

function invalidateIncrementalRouteRequest() {
  incrementalRouteRequestGeneration += 1;
  stopActiveIncrementalNetworkRequest();
  return incrementalRouteRequestGeneration;
}

function beginIncrementalRouteRequest(cacheKey, force = false) {
  const generation = ++incrementalRouteRequestGeneration;
  const active = activeIncrementalNetworkRequest;
  if (active && (force || active.cacheKey !== cacheKey)) {
    stopActiveIncrementalNetworkRequest();
  }
  return generation;
}

function incrementalRouteRequestIsCurrent(generation) {
  return generation === incrementalRouteRequestGeneration;
}

window.__mflCancelIncrementalRouteRequest = invalidateIncrementalRouteRequest;

async function requestIncrementalRoute(route, page = 1, options = {}) {
  const force = Boolean(options.force);
  const navigationTransition = options.__mflNavigationTransition || null;
  const navigationRequestIsCurrent = () => !navigationTransition || navigationTransitionIsCurrent(navigationTransition);

  if (route.scope === "empty") {
    const generation = beginIncrementalRouteRequest("empty", force);
    const payload = {
      columns: state.manifest?.files?.public?.columns || state.columns || [],
      rows: [],
      page: 1,
      pageSize: 1,
      totalRows: 0,
      sourceRows: 0,
      generatedAt: state.manifest?.generated_at || null,
    };
    if (!incrementalRouteRequestIsCurrent(generation) || !navigationRequestIsCurrent()) return null;
    applyIncrementalPayload(route, payload);
    state.incrementalMode = false;
    return payload;
  }

  const { requestKey, cacheKey } = incrementalRequestDetails(route, page);
  const generation = beginIncrementalRouteRequest(cacheKey, force);
  if (force) state.incrementalPayloadCache.delete(cacheKey);

  const cachedPayload = !force ? readIncrementalPayloadCache(cacheKey) : null;
  const inheritedTableLoadingRequestToken = Number(options.tableLoadingRequestToken || 0);
  const cachedPayloadSupersedesActiveRequest = Boolean(cachedPayload && window.__mflTableLoadingRuntime?.requestActive?.());
  const tableLoadingRequestToken = inheritedTableLoadingRequestToken
    || (!cachedPayload || cachedPayloadSupersedesActiveRequest
      ? window.__mflTableLoadingRuntime?.beginRequest?.(route.scope, { loadingMode: options.loadingMode })
      : 0)
    || 0;

  if (cachedPayload) {
    if (!incrementalRouteRequestIsCurrent(generation) || !navigationRequestIsCurrent()) {
      finishOwnedTableLoadingRequest();
      return null;
    }
    try {
      applyIncrementalPayload(route, cachedPayload);
      state.incrementalLastKey = requestKey;
      state.incrementalLastLoadedAt = Date.now();
      return cachedPayload;
    } finally {
      finishOwnedTableLoadingRequest();
    }
  }

  let requestPromise = force ? null : state.incrementalRequestPromises.get(cacheKey);
  if (!requestPromise) {
    const controller = new AbortController();
    let timedOut = false;
    let timeout = 0;
    let requestRecord = null;
    const networkPromise = (async () => {
      timeout = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, ROUTE_REQUEST_TIMEOUT_MS);
      try {
        const response = await window.__mflDataClient.fetch("/api/data?" + requestKey, {
          cache: "no-store",
          headers: walletProofHeaders(true),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Could not load this page.");
        }
        if (controller.signal.aborted) return null;
        rememberIncrementalPayload(cacheKey, payload);
        return payload;
      } catch (error) {
        if (error?.name === "AbortError" && !timedOut) return null;
        if (timedOut) throw new Error("Could not load this page.");
        throw error;
      } finally {
        if (timeout) window.clearTimeout(timeout);
      }
    })();

    requestPromise = networkPromise.finally(() => {
      if (state.incrementalRequestPromises.get(cacheKey) === requestPromise) {
        state.incrementalRequestPromises.delete(cacheKey);
      }
      if (activeIncrementalNetworkRequest === requestRecord) {
        activeIncrementalNetworkRequest = null;
      }
    });
    requestRecord = { cacheKey, controller, promise: requestPromise };
    activeIncrementalNetworkRequest = requestRecord;
    state.incrementalRequestPromises.set(cacheKey, requestPromise);
  }

  let payload;
  try {
    payload = await requestPromise;
  } catch (error) {
    finishOwnedTableLoadingRequest();
    if (!incrementalRouteRequestIsCurrent(generation)) return null;
    throw error;
  }
  if (!payload || !incrementalRouteRequestIsCurrent(generation) || !navigationRequestIsCurrent()) {
    finishOwnedTableLoadingRequest();
  }
  if (!payload || !incrementalRouteRequestIsCurrent(generation) || !navigationRequestIsCurrent()) return null;
  try {
    applyIncrementalPayload(route, payload);
    state.incrementalLastKey = requestKey;
    state.incrementalLastLoadedAt = Date.now();
    return payload;
  } finally {
    finishOwnedTableLoadingRequest();
  }

function finishOwnedTableLoadingRequest() {
  if (inheritedTableLoadingRequestToken === 0 && tableLoadingRequestToken !== 0) {
    window.__mflTableLoadingRuntime?.finishRequest?.(tableLoadingRequestToken);
  }
}
}

async function withInteractionBusy(callback) { return callback(); }

async function reloadIncrementalPage(page = state.page, options = {}) {
  const route = incrementalRouteTarget(state.currentPage, {
    view: state.view,
    walletAddress: state.currentAgentWalletAddress,
    watchlistId: state.currentWatchlistId,
  }) || state.incrementalRoute;
  if (!route) {
    return false;
  }

  state.page = page;
  const reloadLoadingRequestToken = (!incrementalRouteIsCached(route, page) || window.__mflTableLoadingRuntime?.requestActive?.())
    ? window.__mflTableLoadingRuntime?.beginRequest?.(route.scope, { loadingMode: options.loadingMode }) || 0
    : 0;

  const loadAndRender = async () => {
    try {
      const payload = await requestIncrementalRoute(route, page, {
        loadingMode: options.loadingMode,
        tableLoadingRequestToken: reloadLoadingRequestToken,
      });
      if (!payload) return false;
      state.incrementalApplying = true;
      try {
        buildHeader();
        applyFilters({ save: options.save !== false });
      } finally {
        state.incrementalApplying = false;
      }
      return true;
    } catch (error) {
      showToast(error?.message || "Could not load this page.");
      return false;
    } finally {
      window.__mflTableLoadingRuntime?.finishRequest?.(reloadLoadingRequestToken);
    }
  };

  if (incrementalRouteIsCached(route, page)) {
    return loadAndRender();
  }

  return withInteractionBusy(loadAndRender, options.loadingReason);
}
window.mflReloadIncrementalPage = reloadIncrementalPage;
