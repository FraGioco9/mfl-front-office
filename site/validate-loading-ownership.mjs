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
  "html.mflDataLoading #progressionPage #watchlistPlayerCount",
  "html.mflTableScrolling #progressionPage .tableScroller tbody",
]) {
  invariant(loadingStyles.includes(required), `loading.css is missing canonical loading rule: ${required}`);
}
invariant(!loadingStyles.includes("!important"), "loading.css must not introduce !important overrides.");
invariant(
  loadingStyles.includes("html.mflNavigationPending #progressionPage nav.pager")
    && !loadingStyles.includes("html.mflInteractionBusy #progressionPage nav.pager"),
  "Table view navigation must hide nav.pager immediately while the Table runtime keeps it hidden through active data loading, without restoring global interaction-busy ownership.",
);

for (const required of [
  'const ROUTE_LOADING_REASON = "route-loading";',
  'const INITIAL_ROUTE_BOOTSTRAP_REASON = "initial-route-bootstrap";',
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
invariant(
  !bootstrapCore.includes("OPERATION_BUSY_REASONS")
    && !bootstrapCore.includes('const BUSY_CLASS = "mflInteractionBusy";')
    && !bootstrapCore.includes("bindInteractionBlockers")
    && !bootstrapCore.includes("blockInteraction(event)")
    && !bootstrapCore.includes("blockedInteractionGestureActive")
    && bootstrapCore.includes("busy: false,")
    && bootstrapCore.includes("dataLoading: reasons.some((reason) => DATA_LOADING_REASONS.has(reason)),"),
  "The loading controller must publish route/data readiness without a global operation-busy blocker.",
);
invariant(
  !bootstrapCore.includes('"interaction-loading"')
    && !bootstrapCore.includes('"createSharedEvaluationFromPayload"')
    && !bootstrapCore.includes('"createSharedEvaluation"')
    && !bootstrapCore.includes('"createSavedEvaluation"')
    && !bootstrapCore.includes('"linkWallet"'),
  "Persistent mutations must not be wrapped as global loading/busy reasons.",
);

for (const alias of [
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
  bootstrapCore.includes('const initialRouteToken = window.__mflInteractionBusy.begin(INITIAL_ROUTE_BOOTSTRAP_REASON);')
    && bootstrapCore.includes("INITIAL_ROUTE_BOOTSTRAP_REASON,\n      ROUTE_LOADING_REASON,"),
  "Pre-core refresh presentation must stay data-loading without impersonating the canonical SPA route-loading owner.",
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
  bootstrapCore.includes("function beginRouteTransition(pageName, options = {}) {")
    && bootstrapCore.includes("reason !== ROUTE_LOADING_REASON && reason !== INITIAL_ROUTE_BOOTSTRAP_REASON")
    && bootstrapCore.includes("activeTokens.delete(token);")
    && bootstrapCore.includes("if (!destinationReady) {")
    && bootstrapCore.includes("beginRouteTransition,"),
  "Every canonical route transition must atomically replace stale refresh/route loading ownership before the latest destination loads.",
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
  appEntry.includes('const transitionIsCurrent = Reflect.get(runtimeWindow, "__mflNavigationTransitionIsCurrent");')
    && appEntry.includes('if (transition && typeof transitionIsCurrent === "function" && !transitionIsCurrent(transition)) return null;')
    && !appEntry.includes("loadingController?.begin?.(loadingController.reason)"),
  "Lazy Club navigation must inherit route loading from the global transition and reject stale runtime completion before rendering.",
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
  !bootstrapCore.includes("window.__mflWithInteractionBusy")
    && !bootstrapCore.includes("function routeLoadingOwnerReusable() {")
    && !bootstrapCore.includes("function wrapRoutePageGlobal() {")
    && bootstrapCore.includes('function beginLatest(reason = "navigation") {')
    && bootstrapCore.includes("const wrappedWithInteractionBusy = (callback, reason = ROUTE_LOADING_REASON) => {")
    && bootstrapCore.includes("const normalizedReason = loadingReason(reason);")
    && bootstrapCore.includes("if (normalizedReason === ROUTE_LOADING_REASON && routeLoadingActive()) return callback();")
    && bootstrapCore.includes("return run(callback, normalizedReason);"),
  "Nested route/data work may reuse only the latest transition-owned route token; page/view transitions themselves must replace stale route ownership.",
);
invariant(
  appCoreSource.includes("evaluationSaveButton.disabled = true;")
    && appCoreSource.includes("evaluationSaveButton.disabled = false;")
    && appCoreSource.includes("evaluationShareButton.disabled = true;")
    && appCoreSource.includes("evaluationShareButton.disabled = false;")
    && appCoreSource.includes("state.walletOptInInProgress = true;")
    && appCoreSource.includes("linkWalletButton.disabled = true;")
    && appCoreSource.includes('linkWalletButton.textContent = "Loading...";'),
  "Persistent Evaluation and wallet mutations must retain local duplicate-submit protection and working feedback.",
);

invariant(
  !appEntry.includes('/loading-toast-runtime.js')
    && !loadingStyles.includes('#mflLoadingToast')
    && !loadingStyles.includes('mflLoadingLocked')
    && !loadingStyles.includes('data-mfl-retiring-toast'),
  "Global Loading toast/footer-lock presentation must stay removed from startup and loading CSS.",
);
invariant(
  tableLoading.includes("function hidePager() {")
    && tableLoading.includes("if (page) page.hidden = true;")
    && tableLoading.includes("if (snapshot.dataLoading || requestActive()) {")
    && tableLoading.includes("hidePager();")
    && !tableLoading.includes("preservePager"),
  "Table loading must hide nav.pager for the full active request/loading window, including cached-row preservation."
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

console.log("Non-blocking route/data loading, local mutation feedback, local table loading, and absence of every global Loading-toast/interaction-blocker owner validation passed.");

const routeDestinationReadyStart = bootstrapCore.indexOf("function routeDestinationReady(pageName, options = {}) {");
const routeDestinationReadyEnd = bootstrapCore.indexOf("function routeLoadingActive()", routeDestinationReadyStart);
const routeDestinationReadySection = bootstrapCore.slice(routeDestinationReadyStart, routeDestinationReadyEnd);
const coreReadyProbe = routeDestinationReadySection.indexOf("const coreReady = window.__mflIsRouteCoreReady?.(pageName, normalizedOptions) === true;");
const runtimeReadyProbe = routeDestinationReadySection.indexOf("const runtimeReady = window.__mflIsRouteRuntimeReady?.(pageName, normalizedOptions) === true;");
const dependencyGuard = routeDestinationReadySection.indexOf("if (!coreReady || !runtimeReady) return false;");
const dataReadyProbe = routeDestinationReadySection.indexOf("window.__mflRouteDataCache?.isReady?.(pageName, normalizedOptions) === true");
invariant(
  routeDestinationReadyStart >= 0
    && coreReadyProbe >= 0
    && runtimeReadyProbe > coreReadyProbe
    && dependencyGuard > runtimeReadyProbe
    && dataReadyProbe > dependencyGuard,
  "Destination data readiness must never execute before lazy route core/runtime dependencies are ready.",
);
invariant(
  !routeDestinationReadySection.includes("const dataReady ="),
  "Destination readiness must short-circuit lazy dependencies before evaluating route-data cache state.",
);
