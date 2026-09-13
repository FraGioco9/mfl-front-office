import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";
import { readCanonicalCoreSource } from "./validate-core-sources.mjs";

const [bootstrapCore, appEntry, sharedCore, tableCore, baselineHarness] = await Promise.all([
  readValidationText("./bootstrap-core.js", import.meta.url),
  readValidationText("./modules/app-entry.js", import.meta.url),
  Promise.resolve(readCanonicalCoreSource("shared")),
  Promise.resolve(readCanonicalCoreSource("table")),
  readValidationText("./validation/performance-baseline.mjs", import.meta.url),
]);

for (const token of [
  "function createClientPerformanceTimeline() {",
  "window.__mflClientPerformance = clientPerformance;",
  'clientPerformance.record("bootstrap-start"',
  'performance.mark(`mfl:${entry.phase}`, { detail: entry });',
  "function recordInternal(phase, detail = {}) {",
  "recordInternal,",
  'window.dispatchEvent(new CustomEvent("mfl:client-timing", { detail: entry }));',
  "const CLIENT_TIMING_ENTRY_LIMIT = 200;",
  'clientPerformance.record("route-transition-start"',
  'clientPerformance.record("content-commit"',
  'clientPerformance.record("route-transition-complete"',
  'clientPerformance.recordInternal("route-settle-frame-one"',
  'clientPerformance.record("route-visually-settled"',
]) {
  invariant(bootstrapCore.includes(token), `Canonical bootstrap client timing ownership is missing: ${token}`);
}


const internalRecordStart = bootstrapCore.indexOf("function recordInternal(phase, detail = {}) {");
const internalRecordEnd = bootstrapCore.indexOf("\n    return Object.freeze({", internalRecordStart);
const internalRecordSource = bootstrapCore.slice(internalRecordStart, internalRecordEnd);
invariant(
  internalRecordStart >= 0
    && internalRecordSource.includes("return makeEntry(phase, detail);")
    && !internalRecordSource.includes("performance.mark")
    && !internalRecordSource.includes("dispatchEvent"),
  "Fine-grained internal performance stages must use passive in-memory timestamps without PerformanceMark or event-dispatch overhead.",
);

for (const token of [
  "function recordPageTransitionStage(phase, detail = {}) {",
  'Reflect.get(window, "__mflClientPerformance")',
  'Reflect.get(owner, "recordInternal")',
  'recordPageTransitionStage("route-shell-sync-start"',
  'recordPageTransitionStage("route-shell-sync-complete"',
  'recordPageTransitionStage("route-preloader-paint-complete"',
  'recordPageTransitionStage("route-loader-complete"',
  'recordPageTransitionStage("route-postloader-paint-complete"',
  'Reflect.set(window, "__mflRecordRoutePerformanceStage", recordPageTransitionStage);',
  '"route-loader-request-start"',
  '"route-loader-request-complete"',
  '"route-loader-outer-restore-start"',
  '"route-loader-outer-restore-complete"',
  '"route-loader-render-page-start"',
  '"route-loader-render-page-complete"',
  '"route-loader-page-chrome-start"',
  '"route-loader-page-chrome-complete"',
  '"route-loader-table-controls-start"',
  '"route-loader-table-controls-complete"',
  '"route-loader-quick-filters-start"',
  '"route-loader-quick-filters-complete"',
  '"route-loader-apply-filters-start"',
  '"route-loader-apply-filters-complete"',
  '"route-loader-tail-loading-start"',
  '"route-loader-tail-loading-complete"',
  '"route-loader-tail-navigation-complete"',
  '"route-loader-tail-scroll-complete"',
  '"route-loader-tail-home-sync-complete"',
  'traceId: String(Reflect.get(window, "__mflRoutePerformanceTraceId") || "")',
]) {
  invariant(sharedCore.includes(token), `SPA route-stage timing is missing: ${token}`);
}

for (const token of [
  '"route-loader-filter-prep-start"',
  '"route-loader-filter-source-complete"',
  '"route-loader-filter-rows-complete"',
  '"route-loader-filter-ui-complete"',
  '"route-loader-table-render-start"',
  '"route-loader-table-build-complete"',
  '"route-loader-table-dom-commit-complete"',
  '"route-loader-table-render-complete"',
]) {
  invariant(tableCore.includes(token), `Table loader-stage timing is missing: ${token}`);
}

const pageTransitionStart = sharedCore.indexOf("async function runPageTransition(pageName, updateHash = true, options = {}, loader = null) {");
const pageTransitionEnd = sharedCore.indexOf("\nasync function runViewTransition", pageTransitionStart);
const pageTransitionSource = sharedCore.slice(pageTransitionStart, pageTransitionEnd);
const preloaderStage = pageTransitionSource.indexOf('recordPageTransitionStage("route-preloader-paint-complete"');
const loaderStage = pageTransitionSource.indexOf('recordPageTransitionStage("route-loader-complete"');
const postloaderStage = pageTransitionSource.indexOf('recordPageTransitionStage("route-postloader-paint-complete"');
const preservedTableFastPath = pageTransitionSource.indexOf("preservedTableTransitionIdentity(transition)");
const conditionalPreloaderPaint = pageTransitionSource.indexOf("if (!preservedTableIdentity) {");
invariant(
  pageTransitionStart >= 0
    && preservedTableFastPath >= 0
    && conditionalPreloaderPaint > preservedTableFastPath
    && preloaderStage > pageTransitionSource.indexOf("await waitForViewTransitionPaint();", conditionalPreloaderPaint)
    && loaderStage > pageTransitionSource.indexOf('typeof loader === "function" ? await loader(transition) : transition')
    && postloaderStage > loaderStage
    && pageTransitionSource.includes("skipped: Boolean(preservedTableIdentity),"),
  "SPA stage timing must record whether the exact cached-Table preloader paint wait was skipped while retaining loader/postloader boundaries.",
);

for (const token of [
  "const BASELINE_SCHEMA_VERSION = 10;",
  'firstStageAt("route-shell-sync-start")',
  'firstStageAt("route-shell-sync-complete")',
  'timeline.find((entry) => entry?.phase === "route-preloader-paint-complete")',
  'firstStageAt("route-loader-complete")',
  'firstStageAt("route-postloader-paint-complete")',
  "commitPrepMs:",
  "shellSyncMs:",
  "shellStages:",
  "horizontalCuesMs:",
  "horizontalWatchlistMs:",
  "horizontalEnsureViewsMs:",
  "horizontalViewSyncMs:",
  "horizontalPlayerSyncMs:",
  "horizontalMeasuredTotalMs:",
  "staticTotalMs:",
  "revealPaintMs:",
  "preloaderPaintSkipped:",
  "loaderMs:",
  "postloaderPaintMs:",
  "releaseMs:",
  "settlePaintMs:",
  "settleFirstFrameMs:",
  "settleSecondFrameMs:",
  "settlementLongTaskMs:",
  "settlePlayerImmediateMs:",
  "settleViewFrameMs:",
  "settlePlayerFrameMs:",
  "Cached settlement breakdown (median / observed slowest)",
  "Cached SPA stage breakdown (median / observed slowest)",
  "Preloader wait skipped",
  "Cached shell sync breakdown (median / observed slowest)",
  "Cached horizontal cue breakdown (median / observed slowest)",
  "Cached loader overview (median / observed slowest)",
  "Cached filter/render breakdown (median / observed slowest)",
  'loaderStageAt("route-loader-request-start")',
  'loaderStageAt("route-loader-render-page-start")',
  'loaderStageAt("route-loader-table-render-start")',
  "requestMs:",
  "tableControlsMs:",
  "applyFiltersTotalMs:",
  "tableBuildMs:",
  "tableDomCommitMs:",
  "tailLoadingMs:",
  "tailContinuationMs:",
  "Cached renderPage tail breakdown (median / observed slowest)",
  "const loaderTraceId = String(loaderTraceEntry?.detail?.traceId || \"\");",
  "renderPageDirectMs:",
]) {
  invariant(baselineHarness.includes(token), `Performance baseline route-stage reporting is missing: ${token}`);
}

for (const token of [
  'recordClientTiming("data-request"',
  'recordClientTiming("data-response"',
  'source: "memory-cache"',
  'source: "in-flight"',
  'source: "network"',
  'recordClientTiming("core-ready"',
  'recordClientTiming("route-runtime-ready"',
  'recordClientTiming("content-commit"',
  'recordClientTiming("route-visually-settled"',
  'window.dispatchEvent(new CustomEvent("mfl:data-client-timing"',
]) {
  invariant(appEntry.includes(token), `Client startup/data timing is missing: ${token}`);
}

const contentCommit = appEntry.indexOf('recordClientTiming("content-commit"');
const routePaint = appEntry.indexOf("await runtimeWindow.__mflInteractionBusy?.waitForRoutePaint?.();", contentCommit);
const visuallySettled = appEntry.indexOf('recordClientTiming("route-visually-settled"', routePaint);
invariant(
  contentCommit >= 0 && routePaint > contentCommit && visuallySettled > routePaint,
  "Initial content commit must be recorded before the existing paint boundary, with visually-settled timing only after that boundary.",
);

const transitionEndStart = bootstrapCore.indexOf("function trackTransitionEnd(token) {");
const transitionEndStop = bootstrapCore.indexOf("\n    function begin(", transitionEndStart);
const transitionEnd = bootstrapCore.slice(transitionEndStart, transitionEndStop);
const spaContentCommit = transitionEnd.indexOf('clientPerformance.record("content-commit"');
const spaComplete = transitionEnd.indexOf('clientPerformance.record("route-transition-complete"', spaContentCommit);
const spaSettled = transitionEnd.indexOf('clientPerformance.record("route-visually-settled"', spaComplete);
invariant(
  transitionEndStart >= 0 && spaContentCommit >= 0 && spaComplete > spaContentCommit && spaSettled > spaComplete,
  "SPA route transitions must publish canonical content commit before transition completion and visual settlement.",
);
invariant(
  transitionEnd.includes('source: "navigation-release"'),
  "SPA content commit must identify canonical navigation release as its source.",
);

const networkResponse = appEntry.indexOf('source: "network"');
const legacyDataTiming = appEntry.indexOf('window.dispatchEvent(new CustomEvent("mfl:data-client-timing"', networkResponse);
invariant(
  networkResponse >= 0 && legacyDataTiming > networkResponse,
  "The new client performance stream must preserve the existing network data-client timing event for current consumers.",
);

invariant(
  !bootstrapCore.includes("MutationObserver")
    || bootstrapCore.indexOf('clientPerformance.record("route-visually-settled"')
      < bootstrapCore.indexOf("startupStateObserver = new MutationObserver"),
  "Route performance timing must be emitted from canonical navigation ownership rather than inferred from DOM mutation state.",
);

console.log("Canonical client performance timing covers bootstrap, core/runtime readiness, data transport, SPA reveal and cached-loader internals without changing loading ownership.");