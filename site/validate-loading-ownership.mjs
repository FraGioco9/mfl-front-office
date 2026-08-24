import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [styles, loadingStyles, bootstrapCore, appEntry, routeLoader, loadingUi, tableLoading, appCoreSource] = await Promise.all([
  read("./styles.css"),
  read("./loading.css"),
  read("./bootstrap-core.js"),
  read("./modules/app-entry.js"),
  read("./route-core-loader-runtime.js"),
  read("./loading-toast-runtime.js"),
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
  "html.mflNavigationPending #progressionPage nav.pager",
  "html.mflDataLoading #progressionPage #watchlistPlayerCount",
  "html.mflTableScrolling #progressionPage .tableScroller tbody",
  ".siteFooter.mflLoadingLocked",
  "#mflLoadingToast",
]) {
  invariant(loadingStyles.includes(required), `loading.css is missing canonical loading rule: ${required}`);
}
invariant(!loadingStyles.includes("!important"), "loading.css must not introduce !important overrides.");

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
  bootstrapCore.includes('const wrappedWithInteractionBusy = (callback, reason = "interaction-loading") => {')
    && bootstrapCore.includes("const normalizedReason = loadingReason(reason);")
    && bootstrapCore.includes("if (normalizedReason === ROUTE_LOADING_REASON && routeLoadingActive()) return callback();")
    && bootstrapCore.includes("return run(callback, normalizedReason);"),
  "The shared interaction-busy bridge must preserve explicit reasons while reusing an active canonical route-loading lifecycle.",
);

for (const [name, source] of [
  ["loading-toast-runtime.js", loadingUi],
  ["table-loading-runtime.js", tableLoading],
]) {
  invariant(
    source.includes("controller.subscribe(sync)"),
    `${name} must subscribe directly to the canonical loading controller.`,
  );
  invariant(
    !source.includes("new MutationObserver"),
    `${name} must not infer loading state through MutationObserver.`,
  );
  invariant(
    !source.includes('document.createElement("style")'),
    `${name} must not inject deterministic loading CSS at runtime.`,
  );
}

invariant(
  loadingUi.includes("const TOAST_COORDINATION_REASONS = new Set(["),
  "Loading toast must keep non-route coordination reasons separate from real loading reasons.",
);
invariant(
  !loadingUi.includes('"setPage"')
    && !loadingUi.includes('"setView"')
    && !loadingUi.includes('"switchWatchlist"')
    && !loadingUi.includes('"route-runtime"')
    && !loadingUi.includes('"requestIncrementalRoute"'),
  "Loading toast must not classify route transitions by obsolete per-function reasons.",
);
invariant(
  !loadingUi.includes('const ROUTE_LOADING_REASON = "route-loading";')
    && loadingUi.includes('const routeLoadingReason = String(controller?.reason || "");'),
  "Loading toast must consume the controller-owned route-loading identity instead of defining a duplicate reason string.",
);
invariant(
  loadingUi.includes("function snapshotNeedsToast(snapshot) {")
    && loadingUi.includes("reasons.some((reason) => !TOAST_COORDINATION_REASONS.has(String(reason || \"\")))"),
  "Loading toast must require at least one non-coordination busy reason before becoming visible.",
);
invariant(
  loadingUi.includes("function savedEvaluationRouteActive() {")
    && loadingUi.includes('window.location.pathname !== "/evaluation"')
    && loadingUi.includes('new URLSearchParams(window.location.search).get("saved")')
    && loadingUi.includes("function snapshotHasReason(snapshot, targetReason) {")
    && loadingUi.includes('snapshotHasReason(snapshot, "evaluation-load")')
    && loadingUi.match(/toastSuppressed\(snapshot\)/g)?.length >= 3,
  "Saved Evaluation loading must suppress the global Loading toast for direct routes and mixed evaluation-load plus route-loading operations.",
);
invariant(
  loadingUi.includes("const TOAST_ENTER_DURATION_MS = 180;")
    && loadingUi.includes("function animateLoadingToastIn(toast) {")
    && loadingUi.includes("{ opacity: 0 },")
    && loadingUi.includes("{ opacity: 1 },")
    && loadingUi.includes("animateLoadingToastIn(toast);"),
  "Loading toast must use the canonical 180ms one-shot opacity entrance without changing its anchored position.",
);
invariant(
  loadingUi.includes("const initialRouteResolved = document.documentElement.classList.contains(\"mflInitialRouteResolved\");"),
  "Footer readiness must follow the visible route instead of application-wide background warm-up.",
);
invariant(
  !loadingUi.includes('document.documentElement.dataset.mflReady !== "true"'),
  "Footer interaction must not remain locked for background application warm-up.",
);

invariant(
  !loadingUi.includes("syncToastHosts"),
  "Loading UI must not maintain toast layering through DOM-reparent observers.",
);
invariant(
  !loadingUi.includes("STYLE_ID"),
  "Loading UI must not retain a runtime stylesheet owner.",
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

console.log("Unified route loading ownership, controller-owned route reason, mixed saved-Evaluation toast suppression, loading-toast entrance, route-ready startup, background warm-up separation, shared paint boundary, static presentation, and direct subscriber validation passed.");