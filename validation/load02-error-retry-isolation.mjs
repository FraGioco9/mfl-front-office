import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

// LOAD-02: evaluate production closure slices with isolated fake promises/DOM.
// No real server, wallet, Supabase, SQLite, browser cookies, secrets or deployment.
const navigation = await readFile(resolve("modules/core-sources/shared-incremental-navigation.js"), "utf8");
const incremental = await readFile(resolve("modules/core-sources/shared-incremental-routing.js"), "utf8");

function sliceExactly(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert(start !== -1, "Missing source anchor " + startMarker);
  const end = source.indexOf(endMarker, start);
  assert(end > start, "Missing end anchor " + endMarker);
  return source.slice(start, end);
}

const setPage = sliceExactly(navigation,
  "const setIncrementalPage = async function setIncrementalPage(",
  "const loadIncrementalRoutePage = async function loadIncrementalRoutePage");
const loaderStart = setPage.lastIndexOf("const loadAndRender = async () => {");
const loaderEnd = setPage.indexOf('if (route.scope === "empty" || incrementalRouteIsCached(route, 1))', loaderStart);
assert(loaderStart !== -1 && loaderEnd > loaderStart, "Cannot find canonical route-owner error boundary");
const routeLoader = setPage.slice(loaderStart, loaderEnd);
assert.match(routeLoader, /renderLoadedIncrementalRoute\.call\(this, pageName, updateHash/);
assert.match(routeLoader, /catch \(error\)/);

const reloadSource = sliceExactly(incremental,
  "async function reloadIncrementalPage(page = state.page, options = {}) {",
  "// DATA-01C3: event-scoped SQLite identity revalidation.");

function makeRouteBoundary() {
  const seen = { toasts: [], finished: [], resetScroll: 0, current: true, outcome: null };
  let complete, reject;
  const loadPromise = new Promise((ok, fail) => { complete = ok; reject = fail; });
  const token = { id: "old-route" };
  const ctx = {
    route: { scope: "database" },
    navigationOptions: { __mflNavigationTransition: token },
    previousPage: "database",
    pageName: "database",
    updateHash: false,
    progressionLoadingRequestToken: 17,
    renderLoadedIncrementalRoute() { return loadPromise; },
    pageNavigationIsCurrent() { return seen.current; },
    incrementalLoadingPageName() { return "database"; },
    resetPageScroll() { seen.resetScroll++; },
    showToast(message) { seen.toasts.push(message); },
    window: { __mflTableLoadingRuntime: { finishRequest(v) { seen.finished.push(v); } },
      __mflStaticUiRuntime: { showLoadError() { seen.toasts.push("Player load error"); } } },
  };
  const loader = vm.runInNewContext("(() => { " + routeLoader + "return loadAndRender; })()", ctx);
  return { seen, loader, complete, reject };
}

const messages = [
  ["401", "Not authenticated."],
  ["404", "Requested page missing."],
  ["429", "Too many requests."],
  ["500", "The service is unavailable."],
  ["timeout", "Could not load this page."],
  ["abort", "AbortError"],
];
let currentErrors = 0;
let staleErrors = 0;
for (const [label, text] of messages) {
  const current = makeRouteBoundary();
  const pending = current.loader();
  current.reject(new Error(text));
  await pending;
  assert.deepEqual(current.seen.toasts, [text], "Current " + label + " failure needs actionable feedback");
  assert.deepEqual(current.seen.finished, [17], "Current " + label + " loading token leaked");
  currentErrors++;
  const stale = makeRouteBoundary();
  const obsolete = stale.loader();
  stale.seen.current = false; // New destination won before the old request failed.
  stale.reject(new Error(text));
  await obsolete;
  assert.deepEqual(stale.seen.finished, [17], "Stale " + label + " loading token leaked");
  assert.equal(stale.seen.toasts.length, 0,
    "Obsolete request must never display a toast after newer navigation: " + label);
  staleErrors++;
}
const retry = makeRouteBoundary();
const first = retry.loader();
retry.reject(new Error("Too many requests."));
await first;
const second = makeRouteBoundary();
const successful = second.loader();
second.complete(true);
assert.equal(await successful, true, "A successful retry must settle the canonical route");
assert.equal(second.seen.toasts.length, 0, "Successful retry must not show a stale error");
assert.deepEqual(second.seen.finished, [17]);

async function runReload(errorMessage) {
  const preserved = [{ player_id: 9001, name: "Previously loaded" }];
  const state = {
    currentPage: "database", currentAgentWalletAddress: "", currentWatchlistId: "",
    view: "attributes", incrementalRoute: { scope: "database" }, page: 1,
    rows: preserved, dataLoaded: true, incrementalApplying: false,
  };
  const seen = { toasts: [], finished: [], begun: [], headerRebuilt: 0, filtersReapplied: 0 };
  const ctx = {
    state,
    incrementalRouteTarget() { return { scope: "database" }; },
    incrementalRouteIsCached() { return false; },
    window: { __mflTableLoadingRuntime: {
      beginRequest(scope) { seen.begun.push(scope); return 41; },
      finishRequest(token) { seen.finished.push(token); },
    }},
    requestIncrementalRoute() { return Promise.reject(new Error(errorMessage)); },
    buildHeader() { seen.headerRebuilt++; },
    applyFilters() { seen.filtersReapplied++; },
    withInteractionBusy(callback) { return callback(); },
    showToast(message) { seen.toasts.push(message); },
  };
  const reload = vm.runInNewContext(reloadSource + "\nreloadIncrementalPage", ctx);
  assert.equal(await reload(1, {}), false, "Failed refresh should report false");
  assert.equal(state.rows, preserved, "Failed refresh discarded previously loaded rows");
  assert.equal(state.dataLoaded, true, "Failed refresh hid the committed dataset");
  assert.deepEqual(seen.finished, [41], "Failed refresh must release the owned loading token");
  assert.deepEqual(seen.toasts, [errorMessage]);
  assert.equal(seen.headerRebuilt, 0);
  assert.equal(seen.filtersReapplied, 0);
  return true;
}
let preserved = 0;
for (const [, message] of messages) {
  await runReload(message);
  preserved++;
}
console.log("LOAD02_DIAGNOSTIC " + JSON.stringify({
  currentErrorFeedback: currentErrors,
  obsoleteErrorsSuppressed: staleErrors,
  obsoleteToastRegressionPrevented: staleErrors === messages.length,
  manualRetrySuccess: true,
  failedRefreshPreservesCommittedRows: preserved,
  synthetic: true,
  applicationFilesChanged: 0,
}));
