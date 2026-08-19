// @ts-check

function replaceSourceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = start >= 0 ? source.indexOf(endMarker, start + startMarker.length) : -1;
  if (start < 0 || end < 0) {
    throw new Error(`Could not normalize route request section: ${label}.`);
  }
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Could not normalize route request pattern: ${label}.`);
  }
  return source.replace(before, after);
}

function replaceInSection(source, startMarker, endMarker, before, after, label) {
  const start = source.indexOf(startMarker);
  const end = start >= 0 ? source.indexOf(endMarker, start + startMarker.length) : -1;
  if (start < 0 || end < 0) {
    throw new Error(`Could not locate route request caller section: ${label}.`);
  }
  const section = source.slice(start, end);
  if (!section.includes(before)) {
    throw new Error(`Could not normalize route request caller: ${label}.`);
  }
  const nextSection = section.replace(before, after);
  return `${source.slice(0, start)}${nextSection}${source.slice(end)}`;
}

const REQUEST_START = "async function requestIncrementalRoute(route, page = 1, options = {}) {";
const REQUEST_END = "async function withInteractionBusy(callback) { return callback(); }";

const CANCELLABLE_REQUEST = `const ROUTE_REQUEST_TIMEOUT_MS = 60_000;
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
    if (!incrementalRouteRequestIsCurrent(generation)) return null;
    applyIncrementalPayload(route, payload);
    state.incrementalMode = false;
    return payload;
  }

  const { requestKey, cacheKey } = incrementalRequestDetails(route, page);
  const generation = beginIncrementalRouteRequest(cacheKey, force);
  if (force) state.incrementalPayloadCache.delete(cacheKey);

  const dedicatedClubPayload = !force && route.scope === "club" ? cachedClubViewPayload(route) : null;
  if (dedicatedClubPayload) {
    if (!incrementalRouteRequestIsCurrent(generation)) return null;
    applyIncrementalPayload(route, dedicatedClubPayload);
    state.incrementalLastKey = requestKey;
    state.incrementalLastLoadedAt = Date.now();
    return dedicatedClubPayload;
  }

  const cachedPayload = !force ? state.incrementalPayloadCache.get(cacheKey) : null;
  if (cachedPayload) {
    if (!incrementalRouteRequestIsCurrent(generation)) return null;
    applyIncrementalPayload(route, cachedPayload);
    state.incrementalLastKey = requestKey;
    state.incrementalLastLoadedAt = Date.now();
    return cachedPayload;
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
        const response = await fetch("/api/data?" + requestKey, {
          cache: "no-store",
          headers: walletProofHeaders(true),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || "Could not load this page.");
        }
        if (controller.signal.aborted) return null;
        state.incrementalPayloadCache.set(cacheKey, payload);
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
    if (!incrementalRouteRequestIsCurrent(generation)) return null;
    throw error;
  }
  if (!payload || !incrementalRouteRequestIsCurrent(generation)) return null;
  applyIncrementalPayload(route, payload);
  state.incrementalLastKey = requestKey;
  state.incrementalLastLoadedAt = Date.now();
  return payload;
}

`;

export function normalizeRouteRequestCancellation(source) {
  let nextSource = String(source || "");
  if (nextSource.includes("activeIncrementalNetworkRequest")) return nextSource;

  nextSource = replaceSourceSection(
    nextSource,
    REQUEST_START,
    REQUEST_END,
    CANCELLABLE_REQUEST,
    "incremental route request owner",
  );

  nextSource = replaceInSection(
    nextSource,
    "async function reloadIncrementalPage(page = state.page, options = {}) {",
    "window.mflReloadIncrementalPage = reloadIncrementalPage;",
    "      await requestIncrementalRoute(route, page);\n      state.incrementalApplying = true;",
    "      const payload = await requestIncrementalRoute(route, page);\n      if (!payload) return false;\n      state.incrementalApplying = true;",
    "incremental pagination",
  );

  nextSource = replaceRequired(
    nextSource,
    "          await requestIncrementalRoute(route, 1);\n          const row = rowByPlayerId(playerId);",
    "          const payload = await requestIncrementalRoute(route, 1);\n          if (!payload) return false;\n          const row = rowByPlayerId(playerId);",
    "Evaluation player selection",
  );

  nextSource = replaceRequired(
    nextSource,
    `      await requestIncrementalRoute({
        pageName: "evaluation",
        scope: "evaluation",
        view: "attributes",
        access: currentDataAccess("evaluation"),
        playerId: payloadPlayerId,
      }, 1, { force: true });
    }
    state.evaluationSavedId = id;`,
    `      const playerPayload = await requestIncrementalRoute({
        pageName: "evaluation",
        scope: "evaluation",
        view: "attributes",
        access: currentDataAccess("evaluation"),
        playerId: payloadPlayerId,
      }, 1, { force: true });
      if (!playerPayload) return;
    }
    state.evaluationSavedId = id;`,
    "saved Evaluation player hydration",
  );

  nextSource = replaceInSection(
    nextSource,
    "  async function renderLoadedIncrementalRoute(pageName, updateHash, options, route) {",
    "  applyFilters = function applyFiltersWithIncrementalData(options = {}) {",
    "    await requestIncrementalRoute(route, 1);\n    if (tablePages.has(pageName)) {",
    "    const payload = await requestIncrementalRoute(route, 1);\n    if (!payload) return false;\n    if (tablePages.has(pageName)) {",
    "incremental route final render",
  );

  nextSource = replaceInSection(
    nextSource,
    "  setView = async function setIncrementalView(viewName) {",
    "  setPage = async function setIncrementalPage(pageName, updateHash = true, options = {}) {",
    "        await requestIncrementalRoute(route, 1);\n        state.incrementalApplying = true;",
    "        const payload = await requestIncrementalRoute(route, 1);\n        if (!payload) return;\n        state.incrementalApplying = true;",
    "incremental view switch",
  );

  nextSource = replaceInSection(
    nextSource,
    "  setPage = async function setIncrementalPage(pageName, updateHash = true, options = {}) {",
    "  function divisionInfo(divisionValue) {",
    "        const result = await renderLoadedIncrementalRoute.call(this, pageName, updateHash, options, route);\n        if (previousPage !== incrementalLoadingPageName(pageName, route)) {",
    "        const result = await renderLoadedIncrementalRoute.call(this, pageName, updateHash, options, route);\n        if (result === false) return false;\n        if (previousPage !== incrementalLoadingPageName(pageName, route)) {",
    "incremental page stale completion",
  );

  nextSource = replaceRequired(
    nextSource,
    `      if (dataRoute && typeof requestIncrementalRoute === "function") {
        await requestIncrementalRoute(dataRoute, 1);
      }`,
    `      if (dataRoute && typeof requestIncrementalRoute === "function") {
        const dataPayload = await requestIncrementalRoute(dataRoute, 1);
        if (!dataPayload) return;
      }`,
    "Club route data hydration",
  );

  nextSource = replaceRequired(
    nextSource,
    "      await requestIncrementalRoute(route, 1);\n      if (tablePages.has(pageName)) {",
    "      const payload = await requestIncrementalRoute(route, 1);\n      if (!payload) return false;\n      if (tablePages.has(pageName)) {",
    "public incremental route loader",
  );

  return nextSource;
}
