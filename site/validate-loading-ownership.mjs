import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [styles, loadingStyles, bootstrapCore, appEntry, routeLoader, tableLoading, appCoreSource] = await Promise.all([
  read("./styles.css"),
  read("./loading.css"),
  read("./bootstrap-core.js"),
  read("./modules/app-entry.js"),
  read("./route-core-loader-runtime.js"),
  read("./table-loading-runtime.js"),
  read("./modules/app-core.js"),
]);

invariant(
  styles.includes('@import url("/loading.css");'),
  "styles.css must load the canonical loading stylesheet.",
);
invariant(
  styles.indexOf('@import url("/loading.css");') > styles.indexOf('@import url("/footer.css");'),
  "loading.css must load after component/footer styles so loading state has deterministic ownership.",
);
invariant(
  !styles.includes("html.mflInteractionBusy"),
  "styles.css must not duplicate loading-state presentation owned by loading.css.",
);

for (const required of [
  "html.mflInteractionBusy body::after",
  "html.mflDataLoading #progressionPage #watchlistPlayerCount",
  "html.mflTableScrolling #progressionPage .tableScroller tbody",
]) {
  invariant(loadingStyles.includes(required), `loading.css is missing canonical loading rule: ${required}`);
}
invariant(!loadingStyles.includes("!important"), "loading.css must not introduce !important overrides.");
invariant(
  !loadingStyles.includes("html.mflNavigationPending #progressionPage nav.pager")
    && !loadingStyles.includes("html.mflInteractionBusy #progressionPage nav.pager"),
  "Pager loading visibility must be owned by the table loading runtime, not blanket navigation/busy CSS.",
);

for (const required of [
  'const ROUTE_LOADING_REASON = "route-loading";',
  "const ROUTE_LOADING_ALIASES = new Set([",
  "function loadingReason(reason) {",
  "const subscribers = new Set();",
  "function subscribe(callback, options = {}) {",
  "function waitForRoutePaint() {",
  "snapshot: () => currentSnapshot,",
  'window.dispatchEvent(new CustomEvent("mfl:loading-state", { detail: snapshot }));',
]) {
  invariant(bootstrapCore.includes(required), `bootstrap-core.js is missing loading-state ownership: ${required}`);
}
invariant(
  bootstrapCore.includes("return ROUTE_LOADING_ALIASES.has(normalizedReason) ? ROUTE_LOADING_REASON : normalizedReason;"),
  "Legacy route/data reasons must collapse into the canonical route-loading reason.",
);
const operationBusyStart = bootstrapCore.indexOf("const OPERATION_BUSY_REASONS = new Set([");
const operationBusyEnd = bootstrapCore.indexOf("]);", operationBusyStart);
const operationBusySource = bootstrapCore.slice(operationBusyStart, operationBusyEnd);
invariant(
  operationBusyStart >= 0
    && operationBusyEnd > operationBusyStart
    && operationBusySource.includes('"interaction-loading"')
    && operationBusySource.includes('"createSharedEvaluationFromPayload"')
    && operationBusySource.includes('"createSharedEvaluation"')
    && operationBusySource.includes('"createSavedEvaluation"')
    && operationBusySource.includes('"linkWallet"')
    && !operationBusySource.includes("ROUTE_LOADING_REASON")
    && !operationBusySource.includes('"loadSharedEvaluation"')
    && !operationBusySource.includes('"loadSavedEvaluation"')
    && !operationBusySource.includes('"openSavedEvaluationsModal"'),
  "Only explicit persistent/interaction operations may own the global busy blocker; route and read-only data loading must remain non-blocking.",
);
invariant(
  bootstrapCore.includes("busy: reasons.some((reason) => OPERATION_BUSY_REASONS.has(reason)),")
    && bootstrapCore.includes("dataLoading: reasons.some((reason) => DATA_LOADING_REASONS.has(reason)),"),
  "Loading snapshots must classify exclusive operation busy separately from local data loading.",
);
invariant(
  bootstrapCore.includes("ROUTE_LOADING_REASON,\n      \"interaction-loading\",\n      \"loadSharedEvaluation\",\n      \"loadSavedEvaluation\",\n      \"openSavedEvaluationsModal\",")
    || bootstrapCore.includes('ROUTE_LOADING_REASON,\n      "interaction-loading",\n      "loadSharedEvaluation",\n      "loadSavedEvaluation",\n      "openSavedEvaluationsModal",'),
  "Normal route/data loading must remain observable without entering exclusive operation-busy state.",
);
for (const alias of [
  "setPage",
  "route-runtime",
  "databaseStatsData",
  "mflStatsData",
  "evaluationRouteLoading",
]) {
  invariant(
    bootstrapCore.includes(`"${alias}"`),
    `Canonical loading must normalize the legacy route reason ${alias}.`,
  );
}
invariant(
  bootstrapCore.includes('const initialRouteToken = window.__mflInteractionBusy.begin(ROUTE_LOADING_REASON);'),
  "Refresh startup must enter the same route-loading reason used by SPA navigation.",
);
invariant(
  bootstrapCore.includes('window.addEventListener("mfl:route-ready", finishInitialRoute, { once: true });'),
  "Initial loading must finish from route readiness instead of application-wide readiness.",
);
invariant(
  !bootstrapCore.includes('begin("startup")'),
  "Application startup must not retain a separate user-visible loading reason.",
);
invariant(
  bootstrapCore.includes("if (normalizedReason === ROUTE_LOADING_REASON) await waitForRoutePaint();"),
  "SPA route loading must remain active through the final route paint.",
);
invariant(
  bootstrapCore.includes('"pointerdown", "pointerup", "pointercancel"')
    && bootstrapCore.includes('"mousedown", "mouseup", "touchstart", "touchend", "touchcancel"'),
  "Busy interaction ownership must observe both ends of pointer, mouse, and touch gestures.",
);
invariant(
  bootstrapCore.includes("if (eventTargetsBusyScrollSurface(event)) {\n        beginBlockedInteractionGesture(event);\n        return;\n      }"),
  "Busy interaction ownership must remember gestures that start on permitted scroll surfaces without disabling their scroll gesture.",
);
invariant(
  bootstrapCore.includes("if (blockedInteractionGestureActive()) {\n        deferredEndTokens.add(token);\n        return;\n      }"),
  "A loading token that settles during a blocked gesture must remain active through its terminal click.",
);
invariant(
  bootstrapCore.includes("let blockedGestureReleasePending = false;")
    && bootstrapCore.includes("function scheduleBlockedInteractionGestureRelease() {")
    && bootstrapCore.includes("blockedGestureReleaseTimer = window.setTimeout(() => {")
    && bootstrapCore.includes("blockedGestureReleasePending = false;\n        flushDeferredInteractionEnds();"),
  "Gesture ownership must settle on the next task so the browser's terminal click cannot cross from loading ownership into sidebar navigation.",
);
invariant(
  bootstrapCore.includes('window.addEventListener("blur", clearBlockedInteractionGestures, true);')
    && bootstrapCore.includes('window.removeEventListener("blur", clearBlockedInteractionGestures, true);'),
  "Blocked gesture ownership must clear safely if the window loses focus so loading cannot remain stuck.",
);
invariant(
  !bootstrapCore.includes('document.createElement("style")'),
  "bootstrap-core.js must not inject loading CSS at runtime.",
);
invariant(
  !bootstrapCore.includes("window.__mflTableLoadingRuntime?.sync?.();"),
  "The loading-state owner must notify subscribers instead of directly repairing the table runtime.",
);

invariant(
  appEntry.includes('document.documentElement.dataset.mflRouteReady = "true";')
    && appEntry.includes('window.dispatchEvent(new CustomEvent("mfl:route-ready", { detail: release }));'),
  "Initial refresh must publish explicit route readiness.",
);
invariant(
  appEntry.indexOf('window.dispatchEvent(new CustomEvent("mfl:route-ready", { detail: release }));')
    < appEntry.indexOf("const globalSearchPreloadPromise = runtimeWindow.__mflGlobalSearchRuntime?.preload?.();"),
  "Background Global Search warm-up must not delay visible route readiness.",
);
invariant(
  appEntry.includes("const loadingController = runtimeWindow.__mflInteractionBusy;")
    && appEntry.includes("loadingController?.begin?.(loadingController.reason)"),
  "Lazy Club navigation must consume the canonical route-loading reason from the loading controller.",
);
invariant(
  !appEntry.includes('begin?.("route-loading")')
    && !appEntry.includes('begin?.("route-runtime")'),
  "Lazy Club navigation must not duplicate route-loading identities outside the controller.",
);
invariant(
  !routeLoader.includes(".begin?.("),
  "The route-core dependency loader must not own interaction loading state after navigation ownership is consolidated in app-entry.",
);
for (const name of ["switchWatchlist", "ensureProgressionData"]) {
  invariant(
    !bootstrapCore.includes(`"${name}"`),
    `${name} must not retain a bootstrap blanket route-loading alias or wrapper.`,
  );
}
invariant(
  appCoreSource.includes("function switchWatchlist(watchlistId) {")
    && appCoreSource.includes("saveTableState();\n  applyFilters();"),
  "Direct Watchlist switching must remain a source-owned local state/filter transition.",
);
invariant(
  appCoreSource.includes("const loaded = await ensureProgressionData();"),
  "The legacy full-data fallback must remain internal to the canonical setPage owner.",
);
invariant(
  !bootstrapCore.includes('"requestIncrementalRoute",'),
  "Incremental requests must not be blanket-wrapped outside their cache-aware request owner.",
);
invariant(
  !bootstrapCore.includes('"setView",'),
  "View transitions must not be blanket-wrapped outside their cache-aware transition owners.",
);
invariant(
  appCoreSource.includes('window.mflLoadIncrementalRoutePage = async function loadIncrementalRoutePage')
    && appCoreSource.includes('return withInteractionBusy(loadAndRender, Reflect.get(window, "__mflInteractionBusy")?.reason);'),
  "The shared incremental route-page loader must acquire canonical route loading only at its uncached request boundary.",
);
invariant(
  bootstrapCore.includes('window.__mflWithInteractionBusy = (callback) => run(callback, "interaction-loading");')
    && bootstrapCore.includes("const wrappedWithInteractionBusy = (callback, reason = ROUTE_LOADING_REASON) => {")
    && bootstrapCore.includes("const normalizedReason = loadingReason(reason);")
    && bootstrapCore.includes("if (normalizedReason === ROUTE_LOADING_REASON && routeLoadingActive()) return callback();")
    && bootstrapCore.includes("return run(callback, normalizedReason);"),
  "Legacy uncached route/data loads must default to non-blocking route loading while the explicit operation-busy helper remains exclusive.",
);

invariant(
  !appEntry.includes('/loading-toast-runtime.js')
    && !loadingStyles.includes('#mflLoadingToast')
    && !loadingStyles.includes('mflLoadingLocked')
    && !loadingStyles.includes('data-mfl-retiring-toast'),
  "Global Loading toast/footer-lock presentation must stay removed from startup and loading CSS.",
);
invariant(
  tableLoading.includes("controller.subscribe(sync)")
    && !tableLoading.includes("new MutationObserver")
    && !tableLoading.includes('document.createElement("style")'),
  "Table loading must remain the direct local subscriber without runtime style injection or DOM-observer loading inference.",
);
invariant(
  !tableLoading.includes("observer.observe"),
  "Table loading must react to controller snapshots, not DOM observation.",
);
invariant(
  !tableLoading.includes('window.addEventListener("popstate", sync)'),
  "Table loading must not use route events as a second loading-state owner.",
);
invariant(
  tableLoading.includes('Reflect.get(window, "__mflPrimeTableRows")')
  && tableLoading.includes("primeRows(true);"),
  "Table loading must delegate skeleton row creation to the bootstrap first-paint owner.",
);
invariant(
  !tableLoading.includes("BLANK_ROW_OPACITIES")
  && !tableLoading.includes("document.createDocumentFragment()")
  && !tableLoading.includes('document.createElement("td")'),
  "Table loading must not retain a second loading-row renderer.",
);

console.log("Non-blocking route/data loading, exclusive operation busy, local table loading, and absence of global Loading-toast/footer-lock ownership validation passed.");