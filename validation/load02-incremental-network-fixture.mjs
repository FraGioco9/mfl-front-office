import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Isolated execution of the canonical data fetch function, without a network server.
const source = await readFile("modules/core-sources/shared-incremental-routing.js", "utf8");
const begin = source.indexOf("async function requestIncrementalRoute(route, page = 1, options = {}) {");
const end = source.indexOf("async function withInteractionBusy", begin);
assert(begin >= 0 && end > begin, "Cannot locate canonical incremental request implementation");

const committedRows = [{ player_id: 101, name: "Committed player" }];
const state = {
  manifest: { generated_at: "version-A" },
  columns: ["player_id", "name"], rows: committedRows, dataLoaded: true,
  incrementalPayloadCache: new Map(), incrementalRequestPromises: new Map(),
  incrementalLastKey: "", incrementalLastLoadedAt: 0,
};
let nextGeneration = 0;
const actions = { fetches: [], applied: [], begun: [], finished: [] };
let tokenCounter = 0;
const window = {
  setTimeout(fn) { return setTimeout(fn, 45); },
  clearTimeout: clearTimeout,
  __mflTableLoadingRuntime: {
    requestActive: () => false,
    beginRequest(scope) { actions.begun.push(scope); return ++tokenCounter; },
    finishRequest(token) { actions.finished.push(token); },
  },
  __mflDataClient: { fetch: async () => { throw new Error("Fixture not configured"); } },
};
const context = {
  state, window,
  activeIncrementalNetworkRequest: null,
  ROUTE_REQUEST_TIMEOUT_MS: 60_000,
  walletProofHeaders: () => ({ Accept: "application/json" }),
  incrementalRequestDetails: (route, page = 1) => {
    const requestKey = "mode=page&scope=" + route.scope + "&page=" + page;
    return { requestKey, cacheKey: "version-A:" + requestKey };
  },
  beginIncrementalRouteRequest(cacheKey, force) {
    const generation = ++nextGeneration;
    const active = context.activeIncrementalNetworkRequest;
    if (active && (force || active.cacheKey !== cacheKey)) {
      context.activeIncrementalNetworkRequest = null;
      active.controller.abort();
      if (state.incrementalRequestPromises.get(active.cacheKey) === active.promise) {
        state.incrementalRequestPromises.delete(active.cacheKey);
      }
    }
    return generation;
  },
  incrementalRouteRequestIsCurrent: generation => generation === nextGeneration,
  navigationTransitionIsCurrent: token => token.current,
  readIncrementalPayloadCache: key => state.incrementalPayloadCache.get(key) || null,
  rememberIncrementalPayload(key, payload) { state.incrementalPayloadCache.set(key, payload); return payload; },
  adoptIncrementalPayloadDataset: () => null,
  applyIncrementalPayload(route, payload) {
    state.rows = payload.rows;
    state.dataLoaded = true;
    actions.applied.push(route.scope);
  },
};
vm.runInNewContext(source.slice(begin, end) + "\nthis.runRequest = requestIncrementalRoute;", context);
const ok = rows => ({ ok: true, status: 200, async json() {
  return { columns: ["player_id", "name"], rows, page: 1, totalRows: rows.length };
}});
const failure = status => ({ ok: false, status, async json() { return { error: "HTTP " + status + " synthetic failure" }; } });

for (const status of [401, 404, 429, 500]) {
  const route = { scope: "http-" + status };
  const before = state.rows;
  window.__mflDataClient.fetch = async (_, init) => {
    assert.equal(init.signal.aborted, false);
    actions.fetches.push(status);
    return failure(status);
  };
  await assert.rejects(context.runRequest(route), new RegExp("HTTP " + status));
  assert.equal(state.rows, before, "HTTP " + status + " error discarded committed rows");
  assert.equal(state.dataLoaded, true, "HTTP " + status + " turned successful page into unavailable");
  assert.equal(state.incrementalRequestPromises.size, 0, "HTTP " + status + " kept failed promise in flight");
  const rows = [{ player_id: status, name: "Recovered " + status }];
  window.__mflDataClient.fetch = async () => ok(rows);
  const recovered = await context.runRequest(route);
  assert.equal(recovered.rows[0].name, "Recovered " + status);
  assert.equal(state.rows[0].player_id, status);
  const cached = await context.runRequest(route);
  assert.equal(cached, recovered, "Recovered page was not retained for cached SPA return");
  assert.equal(state.incrementalRequestPromises.size, 0);
}

const timeoutRoute = { scope: "timeout" };
window.__mflDataClient.fetch = async (_url, options) => new Promise((resolve, reject) => {
  const abort = () => { const error = new Error("Aborted synthetic GET"); error.name = "AbortError"; reject(error); };
  options.signal.addEventListener("abort", abort, { once: true });
});
const beforeTimeout = state.rows;
await assert.rejects(context.runRequest(timeoutRoute), /Could not load this page/);
assert.equal(state.rows, beforeTimeout, "Timeout lost committed rows");
assert.equal(state.incrementalRequestPromises.size, 0, "Timeout left failed promise in flight");

const externalAbort = { scope: "external-abort" };
window.__mflDataClient.fetch = async (_url, options) => new Promise((resolve, reject) => {
  const abort = () => { const error = new Error("Navigation cancelled"); error.name = "AbortError"; reject(error); };
  options.signal.addEventListener("abort", abort, { once: true });
});
const stale = context.runRequest(externalAbort, 1, { __mflNavigationTransition: { current: false } });
const winningRoute = { scope: "winner" };
const winningRows = [{ player_id: 999, name: "Winning destination" }];
window.__mflDataClient.fetch = async () => ok(winningRows);
assert.equal((await context.runRequest(winningRoute)).rows[0].name, "Winning destination");
assert.equal(await stale, null, "Aborted navigation must not apply obsolete data");
assert.equal(state.rows[0].name, "Winning destination", "Old navigation stole the current route");
assert.equal(state.incrementalRequestPromises.size, 0);
assert.equal(actions.begun.length, actions.finished.length, "Loading ownership tokens leaked");

console.log("LOAD02_NETWORK_PASS " + JSON.stringify({
  statuses: [401, 404, 429, 500],
  retries: 4, cachedSPAResponses: 4, timeoutPreservedRows: true,
  staleAbortIgnored: true, winningRoutePreserved: true,
  begun: actions.begun.length, finished: actions.finished.length,
  runtimeSource: "canonical shared-incremental-routing.js",
  synthetic: true,
}));
