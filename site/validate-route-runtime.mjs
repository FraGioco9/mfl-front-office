import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const bootstrap = await read("./bootstrap.js");
const entry = await read("./modules/app-entry.js");
const buildNormalizer = await read("./modules/app-core-build-normalizer.js");
const requestNormalizer = await read("./modules/app-core-route-request-normalizer.js");
const routeNormalizer = await read("./modules/app-core-route-runtime-normalizer.js");
const routeChunks = await read("./modules/app-core-route-chunks.js");
const routeCoreLoader = await read("./route-core-loader-runtime.js");
const tableStateNormalizer = await read("./modules/app-core-table-state-normalizer.js");
const filterControls = await read("./filter-controls-runtime.js");
const coreSource = await read("./modules/app-core.js");
const normalizedArtifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const normalizedCore = normalizedArtifacts.core;
const evaluationCore = normalizedArtifacts.routeChunks.evaluation;
const mflStatsCore = normalizedArtifacts.routeChunks.mflstats;
const tableCore = normalizedArtifacts.routeChunks.table;

const bootstrapExecution = bootstrap.replace(/\/\/[^\n]*/g, "");
excludes(bootstrapExecution, 'loadRuntime("/table-width-runtime.js")', "Bootstrap must not execute the table-width owner on every route.");
excludes(bootstrapExecution, 'loadRuntime("/filter-controls-runtime.js")', "Bootstrap must not execute filter controls on every route.");
includes(bootstrapExecution, 'loadRuntime("/route-core-loader-runtime.js")', "The tiny route-core loader must start before the application core.");
includes(bootstrapExecution, 'loadRuntime("/dropdowns-runtime.js")', "Dropdown ownership must remain universal.");
includes(bootstrapExecution, 'loadRuntime("/bootstrap-core.js")', "bootstrap-core must remain universal.");

for (const group of [
  "UNIVERSAL_RUNTIME_SCRIPTS",
  "TABLE_PRE_CORE_RUNTIME_SCRIPTS",
  "TABLE_POST_CORE_RUNTIME_SCRIPTS",
  "WATCHLIST_MYPLAYERS_POST_CORE_RUNTIME_SCRIPTS",
  "EVALUATION_PRE_CORE_RUNTIME_SCRIPTS",
  "EVALUATION_POST_CORE_RUNTIME_SCRIPTS",
  "DATABASE_STATS_RUNTIME_SCRIPTS",
  "CHANGELOG_RUNTIME_SCRIPTS",
]) {
  includes(entry, `const ${group}`, `app-entry.js must declare ${group}.`);
}

const universalBlock = entry.match(/const UNIVERSAL_RUNTIME_SCRIPTS = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || "";
for (const forbidden of ["table-width-runtime", "filter-controls-runtime", "watchlist-ui-runtime", "selection-stack-runtime", "database-stats-runtime", "evaluation-layout-runtime", "changelog-history-runtime"]) {
  excludes(universalBlock, forbidden, `${forbidden} must not return to universal startup.`);
}
includes(universalBlock, "global-search-runtime.js", "Global Search must stay universal and early.");

includes(entry, "initialPreCoreRuntimeScripts", "Initial startup must preload only universal plus active-route owners.");
includes(entry, "preCoreScriptsForRoute", "Route-specific pre-core owners must be resolved explicitly.");
includes(entry, "postCoreScriptsForRoute", "Route-specific post-core owners must be resolved explicitly.");
includes(entry, "async function finalizeRouteRuntimeNow(page, options = {})", "Route finalization must be separable from pre-core loading for the already-primed initial route.");
includes(entry, "await loadScriptGroup(preCoreScriptsForRoute(page, options));\n  await finalizeRouteRuntimeNow(page, options);", "Lazy SPA routes must still load their pre-core owners before finalization.");
includes(entry, "finalizeRouteRuntimeNow(initialRouteRuntime.pageName, initialRouteRuntime.options)", "Initial startup must finalize its already-loaded route owners without rerunning pre-core resolution.");
includes(entry, "trackRouteRuntimePromise(", "Initial and lazy route completion must share the same runtime promise cache.");
excludes(entry, "await ensureRouteRuntime(initialRouteRuntime.pageName, initialRouteRuntime.options);", "Initial startup must not rerun the full lazy route runtime path after pre-core owners are already loaded.");
includes(entry, "runtimeWindow.__mflEnsureRouteRuntime = ensureRouteRuntime", "SPA navigation must expose the route runtime gate to app-core.");
includes(entry, "runtimeWindow.__mflMarkApplicationCoreLoaded = markApplicationCoreLoaded", "app-core must be able to close the startup race before startApp runs.");
includes(entry, "installClubRouteRuntimeGate", "Club navigation must use the same route runtime gate.");
includes(entry, "__mflFilterControlsRuntime?.sync?.()", "Late-loaded filter controls must synchronize immediately.");
excludes(entry, "const CORE_RUNTIME_SCRIPTS =", "The old all-route core runtime group must stay removed.");
excludes(entry, "const SPECIALIZED_RUNTIME_SCRIPTS =", "Specialized runtimes must not be globally queued.");
excludes(entry, "const LATE_RUNTIME_SCRIPTS =", "Late runtimes must be route-owned.");
excludes(entry, "const deferredRuntimePromise =", "Inactive specialized runtimes must not start after every initial route.");

includes(routeNormalizer, "export function normalizeRouteRuntimeGate(source)", "The route gate must be a build-time core transform.");
includes(routeNormalizer, "setPageWithRouteRuntime", "The generated core must gate setPage before destination commit.");
includes(routeNormalizer, "ownerBeforeRuntime", "The gate must redispatch when a loaded runtime replaces setPage.");
includes(routeNormalizer, "window.__mflCancelIncrementalRouteRequest?.();", "A new SPA route intent must cancel obsolete route data before lazy runtime loading.");
includes(routeNormalizer, "window.__mflEnsureRouteCore", "The route gate must await route-owned core code before committing its destination.");
includes(routeNormalizer, "routeCorePromise", "Route-core download must overlap route-runtime loading.");
includes(routeNormalizer, "window.__mflMarkApplicationCoreLoaded?.();", "The generated core must mark itself loaded before startApp.");

includes(routeChunks, "export function splitApplicationCoreRuntime(source)", "Application core route splitting must be a build-time transform.");
includes(routeChunks, "Evaluation save and share services", "The first split must move Evaluation services out of the universal core.");
includes(routeChunks, "Evaluation saved-list renderer", "Saved Evaluation list rendering must be route-owned without extracting shared modal helpers.");
includes(routeChunks, "MFL Stats renderer", "MFL Stats rendering must be split from routes that never use it.");
includes(routeChunks, "MFL Stats distribution interaction", "MFL Stats distribution interaction must load with its renderer.");
includes(routeCoreLoader, 'evaluation: "/modules/app-core-evaluation-runtime.js"', "The route-core loader must map Evaluation to its generated chunk.");
includes(routeCoreLoader, 'mflstats: "/modules/app-core-mfl-stats-runtime.js"', "The route-core loader must map MFL Stats to its generated chunk.");
excludes(routeCoreLoader, "normalizeBuiltApplicationCoreArtifacts", "Route-core loading must not rebuild missing chunks from raw source in the browser.");
excludes(routeCoreLoader, 'fetch(assetUrl("/modules/app-core.js")', "Route-core loading must not fetch the raw application core in the browser.");
includes(routeCoreLoader, "runtimeWindow.__mflEnsureRouteCore = ensure", "The route-core loader must expose one route gate API.");
includes(routeCoreLoader, "runtimeWindow.__mflInteractionBusy?.installCoreBridge?.();", "Late route-core functions must receive the same interaction-busy wrappers as startup functions.");
excludes(routeCoreLoader, 'ensure("mflstats")', "MFL Stats must not execute before the shared core has created its permanent DOM references.");
excludes(routeCoreLoader, "setInterval", "Route-core loading must remain event/promise driven.");

includes(tableStateNormalizer, "export function normalizePureTableStateRestoration(source)", "Table-state restoration must be a build-time core transform.");
includes(tableStateNormalizer, "state.pendingTableControlRestore = normalizedSavedTableControlState(pageName, savedState);", "Saved controls must stage in JavaScript state instead of mutating the page during route preparation.");
includes(tableStateNormalizer, "function syncRestoredTableControls(", "The final table renderer must own one explicit restored-control sync.");

includes(requestNormalizer, "export function normalizeRouteRequestCancellation(source)", "Route request cancellation must be a build-time core transform.");
includes(requestNormalizer, "activeIncrementalNetworkRequest", "The route request transform must own one abortable active network request.");
includes(requestNormalizer, "incrementalRouteRequestGeneration", "The route request transform must reject stale async completions by generation.");
includes(requestNormalizer, "signal: controller.signal", "Incremental route requests must be actually abortable.");
includes(requestNormalizer, "ROUTE_REQUEST_TIMEOUT_MS = 60_000", "Abortable route requests must retain the bounded API timeout.");
includes(requestNormalizer, "let requestPromise = force ? null", "Forced route refreshes must bypass in-flight request reuse.");
includes(requestNormalizer, "if (force) state.incrementalPayloadCache.delete(cacheKey);", "Forced route refreshes must bypass cached payloads.");

includes(buildNormalizer, "normalizeRouteRuntimeGate(startupDataSource)", "The build must apply the route runtime gate after startup-data normalization.");
includes(buildNormalizer, "normalizePureTableStateRestoration(routeRuntimeSource)", "The build must make saved table-state restoration pure before route request cancellation is applied.");
includes(buildNormalizer, "normalizeRouteRequestCancellation(tableStateSource)", "The build must apply route cancellation after pure table-state restoration.");
includes(buildNormalizer, "splitApplicationCoreRuntime(normalizeCompleteApplicationCore(source))", "The complete normalized core must be split only after all behavior transforms are applied.");
includes(filterControls, "Object.freeze({ sync, destroy })", "Filter controls must expose an explicit late-load sync hook.");

invariant(normalizedCore.length > 300_000, "The shared application core became unexpectedly small.");
invariant(evaluationCore.length > 12_000, "The Evaluation core chunk is too small to represent a meaningful split.");
invariant(mflStatsCore.length > 4_000, "The MFL Stats core chunk is too small to represent a meaningful split.");
invariant(tableCore.length > 20_000, "The Table core chunk is too small to represent a meaningful split.");
new Function(normalizedCore);
new Function(evaluationCore);
new Function(mflStatsCore);
new Function(tableCore);
excludes(normalizedCore, "const advancedPlayerTableTsv = `", "The large Evaluation valuation table must not remain in the shared core.");
excludes(normalizedCore, "const evaluationContractsTable = (() => {", "Evaluation contract-table construction must not run on unrelated routes.");
excludes(normalizedCore, "function normalizeSharedEvaluationPayload(payload) {", "Evaluation save/share services must not remain in the shared core.");
excludes(normalizedCore, "function renderSavedEvaluationList(rows) {", "Saved Evaluation list rendering must not remain in the shared core.");
includes(normalizedCore, "let evaluationLoadFloatingTooltip = null;", "Cross-route Evaluation/Watchlist tooltip state must stay shared.");
includes(normalizedCore, "function hideEvaluationLoadActionTooltip()", "Cross-route modal tooltip cleanup must stay shared.");
includes(normalizedCore, "async function openSavedEvaluationsModal()", "The shared core must retain the direct saved-evaluation click handler required during universal event binding.");
includes(normalizedCore, 'evaluationLoadButton.addEventListener("click", openSavedEvaluationsModal);', "Universal event binding must never reference an extracted Evaluation function.");
includes(normalizedCore, 'evaluationLoadList.addEventListener("scroll", hideEvaluationLoadActionTooltip', "Universal scroll binding must retain its shared tooltip callback.");
includes(evaluationCore, "const advancedPlayerTableTsv = `", "The Evaluation chunk must own its advanced valuation table.");
includes(evaluationCore, "const evaluationContractsTable = (() => {", "The Evaluation chunk must own contract-table construction.");
includes(evaluationCore, "function normalizeSharedEvaluationPayload(payload) {", "The Evaluation chunk must own save/share payload handling.");
includes(evaluationCore, "function renderSavedEvaluationList(rows) {", "The Evaluation chunk must own saved-evaluation list rendering/data helpers.");
excludes(evaluationCore, "function hideEvaluationLoadActionTooltip()", "Cross-route tooltip helpers must not become Evaluation-only.");
excludes(evaluationCore, "async function openSavedEvaluationsModal()", "The direct universal event handler must stay in the shared core.");

excludes(normalizedCore, "const mflStatsOverallFilterOptions = [", "MFL Stats filter/render ownership must not remain in the shared core.");
excludes(normalizedCore, 'mflStatsDistributionModeButtons?.addEventListener("click", (event) => {', "MFL Stats distribution interaction must not bind on unrelated routes.");
includes(normalizedCore, "function rowHasHiddenMflJoinedAgencyDate(row)", "Shared table filtering must retain its MFL row-visibility helper.");
includes(mflStatsCore, "const mflStatsOverallFilterOptions = [", "The MFL Stats chunk must own its filter definitions.");
includes(mflStatsCore, "function renderMflStatsPage()", "The MFL Stats chunk must own the page renderer.");
includes(mflStatsCore, 'mflStatsDistributionModeButtons?.addEventListener("click", (event) => {', "The MFL Stats chunk must own distribution interaction binding.");
excludes(mflStatsCore, "function rowHasHiddenMflJoinedAgencyDate(row)", "Shared table filtering helpers must not become MFL Stats-only.");

includes(normalizedCore, "let incrementalRouteRequestGeneration = 0;", "The generated core must track the latest route request intent.");
includes(normalizedCore, "let activeIncrementalNetworkRequest = null;", "The generated core must track the active abortable route request.");
includes(normalizedCore, "window.__mflCancelIncrementalRouteRequest = invalidateIncrementalRouteRequest;", "The generated core must expose route invalidation to the SPA gate.");
includes(normalizedCore, "if (!payload || !incrementalRouteRequestIsCurrent(generation)) return null;", "Stale route responses must never commit application state.");
includes(normalizedCore, "if (error?.name === \"AbortError\" && !timedOut) return null;", "Intentional route aborts must remain silent.");
includes(normalizedCore, "if (result === false) return false;", "Obsolete page renders must stop before scroll or final commit work.");
includes(normalizedCore, "if (!dataPayload) return;", "Obsolete Club payloads must not commit a Club render.");
includes(evaluationCore, "if (!playerPayload) return;", "Obsolete saved-Evaluation hydration must not commit Evaluation state.");
excludes(normalizedCore, "      await requestIncrementalRoute(route, page);\n      state.incrementalApplying = true;", "Pagination must not render after an obsolete request.");
excludes(tableCore, "        await requestIncrementalRoute(route, 1);\n        state.incrementalApplying = true;", "View switches must not render after an obsolete request.");

const restoreStart = tableCore.indexOf('function tableRestoreSavedTableStateOwner(pageName = tablePageKey() || "progression", options = {}) {');
const restoreEnd = tableCore.indexOf("function syncRestoredTableControls(", restoreStart);
invariant(restoreStart >= 0 && restoreEnd > restoreStart, "The Table core must contain the pure saved table-state restore and its final sync owner.");
const pureRestoreSection = tableCore.slice(restoreStart, restoreEnd);
includes(pureRestoreSection, "state.pendingTableControlRestore = normalizedSavedTableControlState(pageName, savedState);", "Saved table controls must be staged in state during restore.");
for (const forbidden of [
  "updateViewButtons(",
  "pageSizeSelect",
  "hideRetiredInput",
  "hideRetiringInput",
  "hideMflPlayersInput",
  "packablePlayersInput",
  "newMintsInput",
  "filterRules",
  "addFilterRule(",
  "populateAddFilterSelect(",
  "refreshRuleColumnSelects(",
  "updateFilterSummary(",
]) {
  excludes(pureRestoreSection, forbidden, `Saved table-state restore must not mutate DOM controls through ${forbidden}.`);
}

const prepareStart = normalizedCore.indexOf("function prepareIncrementalRoute(pageName, options = {}) {");
const prepareEnd = normalizedCore.indexOf("function commitIncrementalLocation(", prepareStart);
invariant(prepareStart >= 0 && prepareEnd > prepareStart, "The generated core must contain incremental route preparation.");
excludes(normalizedCore.slice(prepareStart, prepareEnd), "syncRestoredTableControls(", "Pre-request route preparation must never sync restored controls into the DOM.");

includes(normalizedCore, `  if (tablePage) {
    restoreSavedTableState(pageName, { view: options.view });
    syncRestoredTableControls(pageName);
    updateViewButtons();
    buildHeader();
  }`, "The canonical table-page render must consume staged controls synchronously before header/filter rendering.");
includes(normalizedCore, `      if (tablePages.has(pageName)) {
        restoreSavedTableState(pageName, { view: route.view || options.view });
        syncRestoredTableControls(pageName);
      }
      state.incrementalApplying = true;`, "The public incremental table renderer must consume staged controls only after its route data is ready.");

console.log("Route runtime, prebuilt route-core splitting, request cancellation, and pure table-state validation passed.");
