function clubRouteTargetFromPath() {
  const route = window.__mflAppConfig?.routes?.clubRoute?.(window.location.pathname);
  return route
    ? { scope: "club", clubId: route.clubId, view: route.view }
    : null;
}

/** @param {MflRouteOptions} [options] @returns {string[]} */
function incrementalWatchlistPlayerIds(options = {}) {
  const watchlistId = String(options.watchlistId || watchlistIdFromUrl() || state.currentWatchlistId || "");
  const watchlist = normalizeWatchlists(state.watchlists, Array.from(state.watchlistPlayerIds))
    .find((candidate) => candidate.id === watchlistId);
  return normalizeWatchlistIdList(watchlist?.playerIds || Array.from(state.watchlistPlayerIds));
}

/**
 * @param {string} pageName
 * @param {MflRouteOptions} [options]
 * @returns {MflIncrementalRoute | null}
 */
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

/** @param {MflIncrementalRoute} route @param {number} [page] @returns {URLSearchParams} */
function incrementalDataQuery(route, page = 1) {
  if (route.scope === "mflstats") {
    return new URLSearchParams({ mode: "mfl-stats-summary" });
  }

  const entityRoute = ["player", "evaluation"].includes(route.scope);
  const query = new URLSearchParams({
    mode: "page",
    scope: route.scope,
    view: route.view || "attributes",
    page: String(page),
    pageSize: String(entityRoute
      ? 1
      : route.scope === "club"
        ? 5000
        : state.pageSize),
    sortKey: route.scope === "club" ? "positions" : entityRoute ? "overall" : state.sortKey,
    sortDirection: route.scope === "club" ? "asc" : entityRoute ? "desc" : state.sortDirection,
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

function syncIncrementalCacheNamespace() {
  const datasetKey = String(state.manifest?.generated_at || "unversioned").trim() || "unversioned";
  const walletKey = normalizeWalletAddress(state.linkedWalletAddress).toLowerCase() || "guest";
  const namespace = `${datasetKey}:${walletKey}`;
  if (state.incrementalCacheNamespace && state.incrementalCacheNamespace !== namespace) {
    state.incrementalPayloadCache.clear();
  }
  state.incrementalCacheNamespace = namespace;
  return { datasetKey, walletKey, namespace };
}

/** @param {MflIncrementalPayload | null | undefined} payload @returns {boolean} */
function incrementalPayloadGenerationIsOlder(payload) {
  const incoming = Date.parse(String(payload?.generatedAt || ""));
  const current = Date.parse(String(state.manifest?.generated_at || ""));
  return Number.isFinite(incoming) && Number.isFinite(current) && incoming < current;
}

/** @param {MflIncrementalPayload | null | undefined} payload */
function adoptIncrementalPayloadDataset(payload) {
  const generatedAt = String(payload?.generatedAt || "").trim();
  if (generatedAt && String(state.manifest?.generated_at || "").trim() !== generatedAt) {
    state.manifest = {
      ...(state.manifest || {}),
      generated_at: generatedAt,
    };
    Reflect.get(window, "__mflHomeSummaryCache")?.invalidate?.();
  }
  return syncIncrementalCacheNamespace();
}

/** @param {MflIncrementalRoute} route @param {number} [page] */
function incrementalRequestDetails(route, page = 1) {
  const query = incrementalDataQuery(route, page);
  const requestKey = query.toString();
  const { namespace } = syncIncrementalCacheNamespace();
  return {
    query,
    requestKey,
    cacheKey: `${namespace}:${requestKey}`,
  };
}

// Marketplace changes independently of the bundled SQLite generatedAt. Server-side
// listing-price sort/filter is authoritative, so a completed page must not
// survive a second visit under only the SQLite/wallet cache namespace.
function incrementalQueryEmbedsMarketplace(query) {
  if (String(query.get("sortKey") || "").toLowerCase() === "listing_price") return true;
  try {
    const filters = JSON.parse(query.get("filters") || "[]");
    return Array.isArray(filters)
      && filters.some((rule) => String(rule?.column || "").toLowerCase() === "listing_price");
  } catch {
    return false;
  }
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

/** @param {string} cacheKey @param {MflIncrementalPayload | null | undefined} payload @returns {MflIncrementalPayload | null} */
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

/** @param {MflIncrementalRoute | null | undefined} route @param {number} [page] @returns {MflIncrementalPayload | null} */
function cachedIncrementalPayload(route, page = 1) {
  if (!route || route.scope === "empty") {
    return null;
  }
  const { query, cacheKey } = incrementalRequestDetails(route, page);
  return incrementalQueryEmbedsMarketplace(query) ? null : readIncrementalPayloadCache(cacheKey);
}

/** @param {MflIncrementalRoute | null | undefined} route @param {number} [page] @returns {boolean} */
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

/** @param {string} pageName @param {MflRouteOptions} [options] @returns {boolean} */
function routeDataCacheReady(pageName, options = {}) {
  const page = String(pageName || "home");
  const routeOptions = /** @type {Record<string, unknown> & { view?: string }} */ (
    options && typeof options === "object" && !Array.isArray(options) ? options : {}
  );

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
  const payloadTotalRows = route.scope === "mflstats"
    ? Number(payload.totalPlayers || 0)
    : Number(payload.totalRows || 0);
  state.incrementalTotalRows = payloadTotalRows;
  state.incrementalSourceRows = route.scope === "mflstats"
    ? payloadTotalRows
    : Number(payload.sourceRows || 0);
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

  const { query, requestKey, cacheKey } = incrementalRequestDetails(route, page);
  const cacheable = !incrementalQueryEmbedsMarketplace(query);
  const generation = beginIncrementalRouteRequest(cacheKey, force);
  if (force) state.incrementalPayloadCache.delete(cacheKey);

  const cachedPayload = !force && cacheable ? readIncrementalPayloadCache(cacheKey) : null;
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
        if (controller.signal.aborted || incrementalPayloadGenerationIsOlder(payload)) return null;
        adoptIncrementalPayloadDataset(payload);
        const responseCacheKey = incrementalRequestDetails(route, page).cacheKey;
        if (cacheable) rememberIncrementalPayload(responseCacheKey, payload);
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

async function withInteractionBusy(callback, _reason = "") {
  return callback();
}

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



// DATA-01C3: event-scoped SQLite identity revalidation. This intentionally
// does not poll, touch Planner drafts/localStorage, or treat the separately
// generated Marketplace overlay as part of the SQLite identity.
const RESUME_IDENTITY_MIN_INTERVAL_MS = 30_000;
const RESUME_IDENTITY_RETRY_MS = 5_000;
const RESUME_IDENTITY_TIMEOUT_MS = 7_000;
let resumeIdentityLastCheckAt = 0;
let resumeIdentityLastFailed = false;
let resumeIdentityEtag = "";
let resumeIdentityWasHidden = Boolean(document.hidden);
let resumeIdentitySequence = 0;
let resumeIdentityActive = null;

function stopResumeIdentityCheck() {
  resumeIdentitySequence += 1;
  const active = resumeIdentityActive;
  resumeIdentityActive = null;
  if (active) {
    resumeIdentityLastFailed = true;
    resumeIdentityLastCheckAt = 0;
    active.abort();
  }
}

function watchlistResumeSnapshot() {
  if (state.currentPage !== "watchlist" || state.incrementalRoute?.scope !== "watchlist"
    || !state.incrementalMode) return null;
  return {
    route: window.location.pathname + window.location.search,
    wallet: String(state.linkedWalletAddress || ""),
    watchlist: String(state.currentWatchlistId || ""),
    view: String(state.view || ""),
    page: state.page,
  };
}

function watchlistResumeSnapshotMatches(snapshot) {
  return Boolean(snapshot
    && document.visibilityState === "visible"
    && state.currentPage === "watchlist"
    && state.incrementalRoute?.scope === "watchlist"
    && state.incrementalMode
    && window.location.pathname + window.location.search === snapshot.route
    && String(state.linkedWalletAddress || "") === snapshot.wallet
    && String(state.currentWatchlistId || "") === snapshot.watchlist
    && String(state.view || "") === snapshot.view
    && state.page === snapshot.page
    && state.incrementalRequestPromises.size === 0
    && typeof window.mflReloadIncrementalPage === "function");
}

async function revalidateSQLiteIdentityOnResume() {
  if (document.visibilityState !== "visible" || !state.manifest?.generated_at) return false;
  if (resumeIdentityActive) return resumeIdentityActive.promise;

  const now = Date.now();
  const minInterval = resumeIdentityLastFailed
    ? RESUME_IDENTITY_RETRY_MS
    : RESUME_IDENTITY_MIN_INTERVAL_MS;
  if (resumeIdentityLastCheckAt && now - resumeIdentityLastCheckAt < minInterval) return false;
  resumeIdentityLastCheckAt = now;
  const controller = new AbortController();
  const sequence = ++resumeIdentitySequence;
  const watchlistSnapshot = watchlistResumeSnapshot();
  let timeout = 0;
  const request = (async () => {
    try {
      timeout = window.setTimeout(() => controller.abort(), RESUME_IDENTITY_TIMEOUT_MS);
      const headers = new Headers({ Accept: "application/json" });
      if (resumeIdentityEtag) headers.set("If-None-Match", resumeIdentityEtag);
      const response = await window.__mflDataClient.fetch("/api/identity", {
        cache: "no-store",
        headers,
        signal: controller.signal,
      });
      if (controller.signal.aborted || sequence !== resumeIdentitySequence
        || document.visibilityState !== "visible") return false;
      if (response.status === 304) {
        resumeIdentityLastFailed = false;
        return false;
      }
      if (!response.ok) throw new Error("SQLite identity unavailable.");
      const identity = await response.json();
      if (controller.signal.aborted || sequence !== resumeIdentitySequence
        || document.visibilityState !== "visible") return false;
      const incoming = String(identity?.database?.generatedAt || "").trim();
      const observed = String(state.manifest?.generated_at || "").trim();
      const incomingTime = Date.parse(incoming);
      const observedTime = Date.parse(observed);
      if (!Number.isFinite(incomingTime) || !Number.isFinite(observedTime)) {
        throw new Error("SQLite identity malformed.");
      }
      resumeIdentityLastFailed = false;
      // A late/old deployment response must not replace the newer generation
      // already observed by a concurrent route or Home bootstrap request.
      if (incomingTime < observedTime) return false;
      resumeIdentityEtag = response.headers?.get?.("ETag") || "";
      if (incomingTime === observedTime) return false;
      adoptIncrementalPayloadDataset({ generatedAt: incoming });
      // Refresh only an unchanged, idle Watchlist route. Planner and its
      // unsaved formations never receive automatic page/roster mutations.
      if (watchlistResumeSnapshotMatches(watchlistSnapshot)) {
        void window.mflReloadIncrementalPage(watchlistSnapshot.page, {
          save: false, loadingMode: "preserve",
        });
      }
      return true;
    } catch {
      if (sequence === resumeIdentitySequence) resumeIdentityLastFailed = true;
      return false;
    } finally {
      if (timeout) window.clearTimeout(timeout);
    }
  })();
  const record = {
    abort: () => controller.abort(),
    promise: request.finally(() => {
      if (resumeIdentityActive === record) resumeIdentityActive = null;
    }),
  };
  resumeIdentityActive = record;
  return record.promise;
}

function installSQLiteIdentityResumeListener() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      resumeIdentityWasHidden = true;
      stopResumeIdentityCheck();
      return;
    }
    if (!resumeIdentityWasHidden) return;
    resumeIdentityWasHidden = false;
    void revalidateSQLiteIdentityOnResume();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && document.visibilityState === "visible") {
      resumeIdentityWasHidden = false;
      void revalidateSQLiteIdentityOnResume();
    }
  });
}
installSQLiteIdentityResumeListener();
window.mflReloadIncrementalPage = reloadIncrementalPage;
