import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const bootstrap = await read("./bootstrap.js");
const entry = await read("./modules/app-entry.js");
const appConfig = await read("./modules/app-config.js");
const buildNormalizer = await read("./modules/app-core-build-normalizer.js");
const routeChunks = await read("./modules/app-core-route-chunks.js");
const routeCoreLoader = await read("./route-core-loader-runtime.js");
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

includes(entry, "const UNIVERSAL_RUNTIME_SCRIPTS", "app-entry.js must retain the universal runtime group.");
includes(appConfig, "export const ROUTE_RUNTIME_SCRIPTS = Object.freeze({", "Canonical app config must own route-specific runtime groups.");
for (const group of [
  "tablePre:",
  "tablePost:",
  "watchlistMyPlayersPost:",
  "evaluationPre:",
  "evaluationPost:",
  "databaseStats:",
  "changelog:",
]) {
  includes(appConfig, group, `Canonical app config must declare route runtime group ${group}.`);
}
for (const retiredLocalOwner of [
  "TABLE_PRE_CORE_RUNTIME_SCRIPTS",
  "TABLE_POST_CORE_RUNTIME_SCRIPTS",
  "WATCHLIST_MYPLAYERS_POST_CORE_RUNTIME_SCRIPTS",
  "EVALUATION_PRE_CORE_RUNTIME_SCRIPTS",
  "EVALUATION_POST_CORE_RUNTIME_SCRIPTS",
  "DATABASE_STATS_RUNTIME_SCRIPTS",
  "CHANGELOG_RUNTIME_SCRIPTS",
]) {
  excludes(entry, retiredLocalOwner, `app-entry.js must not duplicate canonical route dependency ownership through ${retiredLocalOwner}.`);
}

const universalBlock = entry.match(/const UNIVERSAL_RUNTIME_SCRIPTS = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || "";
for (const forbidden of ["table-width-runtime", "filter-controls-runtime", "watchlist-ui-runtime", "selection-stack-runtime", "database-stats-runtime", "evaluation-layout-runtime", "changelog-history-runtime"]) {
  excludes(universalBlock, forbidden, `${forbidden} must not return to universal startup.`);
}
includes(universalBlock, "global-search-runtime.js", "Global Search must stay universal and early.");

includes(entry, "initialPreCoreRuntimeScripts", "Initial startup must preload only universal plus active-route owners.");
includes(appConfig, "function routeDependencyPlan(pageName, options = {})", "Canonical app config must resolve route-specific dependencies explicitly.");
includes(entry, "return routeConfig().routeDependencyPlan(pageName, options);", "app-entry.js must consume the canonical route dependency plan.");
excludes(entry, "function preCoreScriptsForRoute", "app-entry.js must not retain a second pre-core dependency resolver.");
excludes(entry, "function postCoreScriptsForRoute", "app-entry.js must not retain a second post-core dependency resolver.");
includes(entry, "async function finalizeRouteRuntimeNow(page, options = {})", "Route finalization must be separable from pre-core loading for the already-primed initial route.");
includes(entry, "await loadScriptGroup(plan.preCore);\n  await finalizeRouteRuntimeNow(plan.pageName, options);", "Lazy SPA routes must load canonical pre-core dependencies before finalization.");
includes(entry, "await loadScriptGroup(plan.postCore);", "Route finalization must load canonical post-core dependencies.");
includes(entry, "return routeDependencyPlan(page, options).runtimeKey;", "Route runtime promise reuse must use the canonical dependency-plan cache key.");
includes(entry, "finalizeRouteRuntimeNow(initialRouteRuntime.pageName, initialRouteRuntime.options)", "Initial startup must finalize its already-loaded route owners without rerunning pre-core resolution.");
includes(entry, "trackRouteRuntimePromise(", "Initial and lazy route completion must share the same runtime promise cache.");
excludes(entry, "await ensureRouteRuntime(initialRouteRuntime.pageName, initialRouteRuntime.options);", "Initial startup must not rerun the full lazy route runtime path after pre-core owners are already loaded.");
includes(entry, "runtimeWindow.__mflEnsureRouteRuntime = ensureRouteRuntime", "SPA navigation must expose the route runtime gate to app-core.");
includes(entry, "runtimeWindow.__mflIsRouteRuntimeReady = routeRuntimeReady", "SPA navigation must expose settled route-runtime readiness.");
includes(entry, "const routeRuntimeReadyKeys = new Set();", "Route runtime readiness must track settled dependency plans explicitly.");
includes(entry, "runtimeWindow.__mflMarkApplicationCoreLoaded = markApplicationCoreLoaded", "app-core must be able to close the startup race before startApp runs.");
includes(entry, "installClubRouteRuntimeGate", "Club navigation must use the same route runtime gate.");
includes(entry, "__mflFilterControlsRuntime?.sync?.()", "Late-loaded filter controls must synchronize immediately.");
excludes(entry, "const CORE_RUNTIME_SCRIPTS =", "The old all-route core runtime group must stay removed.");
excludes(entry, "const SPECIALIZED_RUNTIME_SCRIPTS =", "Specialized runtimes must not be globally queued.");
excludes(entry, "const LATE_RUNTIME_SCRIPTS =", "Late runtimes must be route-owned.");
excludes(entry, "const deferredRuntimePromise =", "Inactive specialized runtimes must not start after every initial route.");

includes(coreSource, "setPageWithRouteRuntime", "Canonical app-core must gate setPage before destination commit.");
includes(coreSource, "ownerBeforeRuntime", "The canonical route gate must redispatch when a loaded runtime replaces setPage.");
includes(coreSource, "window.__mflCancelIncrementalRouteRequest?.();", "Canonical app-core must cancel obsolete route data through the global navigation transition owner.");
invariant(
  coreSource.split("window.__mflCancelIncrementalRouteRequest?.();").length - 1 === 2,
  "Global page/view transitions must own obsolete incremental-request cancellation before destination commit.",
);
includes(coreSource, "window.__mflEnsureRouteCore", "Canonical app-core must await route-owned core code before committing its destination.");
includes(coreSource, "routeCorePromise", "Canonical app-core must overlap route-core download with route-runtime loading.");
includes(coreSource, "loadingController?.routeReady?.(pageName, incomingOptions)", "Canonical setPage gate must consult full destination readiness before acquiring route loading.");
includes(coreSource, "routeLoadingActive", "Canonical setPage gate must avoid duplicate route-loading tokens when an outer transition already owns loading.");
includes(coreSource, "window.__mflMarkApplicationCoreLoaded?.();", "Canonical app-core must mark itself loaded before startApp.");

includes(routeChunks, "export function splitApplicationCoreRuntime(source)", "Application core route splitting must be a build-time transform.");
includes(routeChunks, "Evaluation save and share services", "The first split must move Evaluation services out of the universal core.");
includes(routeChunks, "Evaluation saved-list renderer", "Saved Evaluation list rendering must be route-owned without extracting shared modal helpers.");
includes(routeChunks, "MFL Stats renderer", "MFL Stats rendering must be split from routes that never use it.");
includes(routeChunks, "MFL Stats distribution interaction", "MFL Stats distribution interaction must load with its renderer.");
includes(appConfig, 'evaluation: "/modules/app-core-evaluation-runtime.js"', "Canonical app config must map Evaluation to its generated chunk.");
includes(appConfig, 'mflstats: "/modules/app-core-mfl-stats-runtime.js"', "Canonical app config must map MFL Stats to its generated chunk.");
includes(routeCoreLoader, "const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;", "Route-core loading must consume the canonical dependency plan.");
excludes(routeCoreLoader, "function routeCoreDependencies", "Route-core loading must not retain a duplicate dependency resolver.");
excludes(routeCoreLoader, "normalizeBuiltApplicationCoreArtifacts", "Route-core loading must not rebuild missing chunks from raw source in the browser.");
excludes(routeCoreLoader, 'fetch(assetUrl("/modules/app-core.js")', "Route-core loading must not fetch the raw application core in the browser.");
includes(routeCoreLoader, "runtimeWindow.__mflEnsureRouteCore = ensure", "The route-core loader must expose one route gate API.");
includes(routeCoreLoader, "runtimeWindow.__mflIsRouteCoreReady = isReady", "The route-core loader must expose settled dependency readiness.");
includes(routeCoreLoader, "const loadedRouteCorePages = new Set();", "Route-core readiness must track successfully loaded dependency owners explicitly.");
includes(routeCoreLoader, "runtimeWindow.__mflInteractionBusy?.installCoreBridge?.();", "Late route-core functions must receive the same interaction-busy wrappers as startup functions.");
excludes(routeCoreLoader, 'ensure("mflstats")', "MFL Stats must not execute before the shared core has created its permanent DOM references.");
excludes(routeCoreLoader, "setInterval", "Route-core loading must remain event/promise driven.");

includes(coreSource, "state.pendingTableControlRestore = normalizedSavedTableControlState(pageName, savedState);", "Canonical app-core must stage saved controls in JavaScript state instead of mutating the page during route preparation.");
includes(coreSource, "function syncRestoredTableControls(", "Canonical app-core must own one explicit restored-control sync.");

includes(coreSource, "activeIncrementalNetworkRequest", "Canonical app-core must own one abortable active network request.");
includes(coreSource, "incrementalRouteRequestGeneration", "Canonical app-core must reject stale async completions by generation.");
includes(coreSource, "signal: controller.signal", "Incremental route requests must be actually abortable.");
includes(coreSource, "ROUTE_REQUEST_TIMEOUT_MS = 60_000", "Abortable route requests must retain the bounded API timeout.");
includes(coreSource, "let requestPromise = force ? null", "Forced route refreshes must bypass in-flight request reuse.");
includes(coreSource, "if (force) state.incrementalPayloadCache.delete(cacheKey);", "Forced route refreshes must bypass cached payloads.");

includes(buildNormalizer, "splitApplicationCoreRuntime(canonicalSource)", "The build must split canonical app-core source directly.");
for (const retiredNormalizer of [
  "normalizeRouteRuntimeGate",
  "normalizePureTableStateRestoration",
  "normalizeRouteRequestCancellation",
  "normalizeStartupDataDependencies",
  "normalizeTableEventDelegation",
]) {
  excludes(buildNormalizer, retiredNormalizer, `The build must not restore pre-split patch ownership through ${retiredNormalizer}.`);
}
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
includes(mflStatsCore, "const mflStatsOverallFilterOptions = window.__mflAppConfig?.ui?.mflStatsOverallFilters || [];", "The MFL Stats chunk must consume canonical filter definitions.");
includes(mflStatsCore, "function renderMflStatsPage()", "The MFL Stats chunk must own the page renderer.");
includes(mflStatsCore, 'mflStatsDistributionModeButtons?.addEventListener("click", (event) => {', "The MFL Stats chunk must own distribution interaction binding.");
excludes(mflStatsCore, "function rowHasHiddenMflJoinedAgencyDate(row)", "Shared table filtering helpers must not become MFL Stats-only.");

includes(normalizedCore, "let incrementalRouteRequestGeneration = 0;", "The generated core must track the latest route request intent.");
includes(normalizedCore, "let activeIncrementalNetworkRequest = null;", "The generated core must track the active abortable route request.");
includes(normalizedCore, "window.__mflCancelIncrementalRouteRequest = invalidateIncrementalRouteRequest;", "The generated core must expose route invalidation to the SPA gate.");
includes(normalizedCore, "if (!payload || !incrementalRouteRequestIsCurrent(generation)) return null;", "Stale route responses must never commit application state.");
includes(normalizedCore, "if (error?.name === \"AbortError\" && !timedOut) return null;", "Intentional route aborts must remain silent.");
includes(normalizedCore, "if (result === false) return false;", "Obsolete page renders must stop before scroll or final commit work.");
includes(normalizedArtifacts.routeChunks.club, "if (!dataLoaded) return;", "Obsolete Club loads must not commit a Club render.");
includes(evaluationCore, 'if (!playerPayload) throw new Error("Evaluation player is not available.");', "Unresolvable saved/shared Evaluation players must enter invalid-link recovery.");
excludes(evaluationCore, "if (!playerPayload) return;", "Saved/shared Evaluation hydration must never silently leave a broken route active.");
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
includes(normalizedCore.slice(prepareStart, prepareEnd), 'pageName !== "club" && !clubTarget && tablePages.has(pageName)', "Club route preparation must bypass saved table filter state while retaining Table infrastructure.");

includes(normalizedCore, `  if (tablePage) {
    restoreSavedTableState(pageName, { view: options.view });
    syncRestoredTableControls(pageName);
    updateViewButtons();
    buildHeader();
  }`, "The canonical table-page render must consume staged controls synchronously before header/filter rendering.");
includes(normalizedCore, `      if (tablePages.has(pageName) && !clubPage) {
        restoreSavedTableState(pageName, { view: route.view || options.view });
        syncRestoredTableControls(pageName);
      }
      if (clubPage) {`, "The public incremental table renderer must consume staged controls only after route data is ready, while Club keeps route-owned roster state.");
includes(normalizedCore, "if (!clubPage) originalApplyFilters.call(this, { save: false });", "Only non-Club incremental payloads may enter the generic pre-route filter renderer.");
includes(normalizedCore, 'tablePages.add("club")', "Club must retain generic Table infrastructure ownership so the canonical loading shell and renderer remain active.");
includes(normalizedCore, 'const PUBLIC_TABLE_PAGES = new Set(["watchlist", "club"]);', "Club public progression views must remain available while filter state is bypassed separately.");
includes(tableCore, 'const clubPage = pageName === "club";', "The Table loading shell must distinguish Club from filterable table pages.");
includes(tableCore, 'window.__mflTableLoadingRuntime?.show?.();', "Club must retain the canonical Table loading skeleton.");
includes(tableCore, 'if (state.currentPage === "club") {', "The Table renderer must have an explicit filter-free Club branch.");
includes(tableCore, "state.filteredRows = [...state.rows];", "Club must render its returned roster rows without generic filtering.");

console.log("Route runtime, prebuilt route-core splitting, request cancellation, pure table-state validation, and filter-free Club loading/render handoff passed.");
