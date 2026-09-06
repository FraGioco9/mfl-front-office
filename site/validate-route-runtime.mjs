import { includes, excludes } from "./validation/assertions.mjs";
import { readFile } from "node:fs/promises";

import { readCanonicalCoreArtifacts } from "./validate-core-sources.mjs";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");

const [bootstrap, entry, appConfig, routeCoreLoader, filterControls, coreSource] = await Promise.all([
  read("./bootstrap.js"),
  read("./modules/app-entry.js"),
  read("./modules/app-config.js"),
  read("./route-core-loader-runtime.js"),
  read("./filter-controls-runtime.js"),
  Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
]);

const artifacts = readCanonicalCoreArtifacts(coreSource);
const sharedCore = String(artifacts.core || "");
const evaluationCore = String(artifacts.routeChunks?.evaluation || "");
const mflStatsCore = String(artifacts.routeChunks?.mflstats || "");
const tableCore = String(artifacts.routeChunks?.table || "");

const bootstrapExecution = bootstrap.replace(/\/\/[^\n]*/g, "");
excludes(bootstrapExecution, 'loadRuntime("/table-width-runtime.js")', "Bootstrap must not execute the static Uniform Width owner as a route runtime.");
excludes(bootstrapExecution, 'loadRuntime("/filter-controls-runtime.js")', "Bootstrap must not execute route-scoped filter controls universally.");
includes(bootstrapExecution, 'loadRuntime("/route-core-loader-runtime.js")', "The route-core loader must start before the application core.");
includes(bootstrapExecution, 'loadRuntime("/dropdowns-runtime.js")', "Dropdown ownership must remain universal.");
includes(bootstrapExecution, 'loadRuntime("/bootstrap-core.js")', "bootstrap-core must remain universal.");

includes(entry, "const UNIVERSAL_RUNTIME_SCRIPTS", "app-entry must retain an explicit universal runtime group.");
includes(appConfig, "export const ROUTE_RUNTIME_SCRIPTS = Object.freeze({", "Canonical app config must own route-specific runtime groups.");
includes(appConfig, "function routeDependencyPlan(pageName, options = {})", "Canonical app config must own route dependency planning.");
includes(entry, "return routeConfig().routeDependencyPlan(pageName, options);", "app-entry must consume the canonical dependency plan.");
includes(entry, "runtimeWindow.__mflEnsureRouteRuntime = ensureRouteRuntime", "SPA navigation must expose the route-runtime gate.");
includes(entry, "runtimeWindow.__mflIsRouteRuntimeReady = routeRuntimeReady", "SPA navigation must expose settled route-runtime readiness.");
includes(entry, "const routeRuntimeReadyKeys = new Set();", "Route-runtime readiness must be explicit and cacheable.");
includes(entry, "global-search-runtime.js", "Global Search must remain early/universal.");
for (const retiredLocalOwner of [
  "TABLE_PRE_CORE_RUNTIME_SCRIPTS",
  "TABLE_POST_CORE_RUNTIME_SCRIPTS",
  "WATCHLIST_MYPLAYERS_POST_CORE_RUNTIME_SCRIPTS",
  "EVALUATION_PRE_CORE_RUNTIME_SCRIPTS",
  "EVALUATION_POST_CORE_RUNTIME_SCRIPTS",
  "DATABASE_STATS_RUNTIME_SCRIPTS",
  "CHANGELOG_RUNTIME_SCRIPTS",
  "const CORE_RUNTIME_SCRIPTS =",
  "const SPECIALIZED_RUNTIME_SCRIPTS =",
  "const LATE_RUNTIME_SCRIPTS =",
]) {
  excludes(entry, retiredLocalOwner, `app-entry must not restore duplicate dependency ownership: ${retiredLocalOwner}`);
}

includes(sharedCore, "setPageWithRouteRuntime", "Canonical shared core must gate setPage through route readiness.");
includes(sharedCore, "window.__mflCancelIncrementalRouteRequest?.();", "Page/view transitions must invalidate obsolete incremental requests.");
includes(sharedCore, "window.__mflEnsureRouteCore", "Canonical shared core must await route-owned code before destination rendering.");
includes(sharedCore, "routeCorePromise", "Route core and runtime loading must overlap.");
includes(sharedCore, "navigationTransitionIsCurrent(transition)", "Stale route completions must be rejected before rendering.");
includes(sharedCore, "activeIncrementalNetworkRequest", "Canonical shared core must own one active abortable route request.");
includes(sharedCore, "incrementalRouteRequestGeneration", "Canonical shared core must reject stale asynchronous route completions by generation.");
includes(sharedCore, "signal: controller.signal", "Incremental data requests must be abortable.");
includes(sharedCore, "ROUTE_REQUEST_TIMEOUT_MS = 60_000", "Route requests must retain the bounded timeout.");

includes(routeCoreLoader, "const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;", "Route-core loading must consume the canonical dependency plan.");
includes(routeCoreLoader, "runtimeWindow.__mflEnsureRouteCore = ensure", "Route-core loader must expose one route gate API.");
includes(routeCoreLoader, "runtimeWindow.__mflIsRouteCoreReady = isReady", "Route-core loader must expose settled dependency readiness.");
includes(routeCoreLoader, "const loadedRouteCorePages = new Set();", "Route-core readiness must track successfully loaded owners.");
excludes(routeCoreLoader, "normalizeBuiltApplicationCoreArtifacts", "Route-core loading must not rebuild source in the browser.");
excludes(routeCoreLoader, '/modules/app-core.js', "Route-core loading must not fetch the retired raw monolith.");
excludes(routeCoreLoader, "app-core-build-normalizer.js", "Route-core loading must not import retired build normalizers.");
excludes(routeCoreLoader, "setInterval", "Route-core loading must remain event/promise driven.");

excludes(sharedCore, "const advancedPlayerTableTsv = `", "Large Evaluation-only valuation data must stay outside the shared core.");
includes(evaluationCore, "const advancedPlayerTableTsv = `", "Evaluation core must own advanced valuation data.");
excludes(sharedCore, "const mflStatsOverallFilterOptions = [", "MFL Stats renderer/filter ownership must stay outside the shared core.");
includes(mflStatsCore, "function renderMflStatsPage()", "MFL Stats core must own its renderer.");
includes(tableCore, "function updateFilterSummary", "Table core must own table-specific filter presentation.");

includes(filterControls, "Object.freeze({ sync, destroy })", "Filter controls must expose an explicit late-load sync hook.");

for (const source of [sharedCore, evaluationCore, mflStatsCore, tableCore]) new Function(source);

console.log("Canonical route runtime validation passed: one dependency plan, explicit readiness, abortable stale-request ownership, and route-owned core payloads without legacy build transforms.");
