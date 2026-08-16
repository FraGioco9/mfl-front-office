import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCore } from "./modules/app-core-build-normalizer.js";

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
const filterControls = await read("./filter-controls-runtime.js");
const coreSource = await read("./modules/app-core.js");
const normalizedCore = normalizeBuiltApplicationCore(coreSource);

const bootstrapExecution = bootstrap.replace(/\/\/[^\n]*/g, "");
excludes(bootstrapExecution, 'loadRuntime("/table-width-runtime.js")', "Bootstrap must not execute the table-width owner on every route.");
excludes(bootstrapExecution, 'loadRuntime("/filter-controls-runtime.js")', "Bootstrap must not execute filter controls on every route.");
includes(bootstrapExecution, 'loadRuntime("/dropdowns-runtime.js")', "Dropdown ownership must remain universal.");
includes(bootstrapExecution, 'loadRuntime("/bootstrap-core.js")', "bootstrap-core must remain universal.");

for (const group of [
  "UNIVERSAL_RUNTIME_SCRIPTS",
  "TABLE_PRE_CORE_RUNTIME_SCRIPTS",
  "TABLE_POST_CORE_RUNTIME_SCRIPTS",
  "WATCHLIST_POST_CORE_RUNTIME_SCRIPTS",
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
includes(routeNormalizer, "window.__mflMarkApplicationCoreLoaded?.();", "The generated core must mark itself loaded before startApp.");

includes(requestNormalizer, "export function normalizeRouteRequestCancellation(source)", "Route request cancellation must be a build-time core transform.");
includes(requestNormalizer, "activeIncrementalNetworkRequest", "The route request transform must own one abortable active network request.");
includes(requestNormalizer, "incrementalRouteRequestGeneration", "The route request transform must reject stale async completions by generation.");
includes(requestNormalizer, "signal: controller.signal", "Incremental route requests must be actually abortable.");
includes(requestNormalizer, "ROUTE_REQUEST_TIMEOUT_MS = 60_000", "Abortable route requests must retain the bounded API timeout.");
includes(requestNormalizer, "let requestPromise = force ? null", "Forced route refreshes must bypass in-flight request reuse.");
includes(requestNormalizer, "if (force) state.incrementalPayloadCache.delete(cacheKey);", "Forced route refreshes must bypass cached payloads.");

includes(buildNormalizer, "normalizeRouteRuntimeGate(startupDataSource)", "The build must apply the route runtime gate after startup-data normalization.");
includes(buildNormalizer, "normalizeRouteRequestCancellation(routeRuntimeSource)", "The build must apply route cancellation after the route runtime gate.");
includes(filterControls, "Object.freeze({ sync, destroy })", "Filter controls must expose an explicit late-load sync hook.");

includes(normalizedCore, "let incrementalRouteRequestGeneration = 0;", "The generated core must track the latest route request intent.");
includes(normalizedCore, "let activeIncrementalNetworkRequest = null;", "The generated core must track the active abortable route request.");
includes(normalizedCore, "window.__mflCancelIncrementalRouteRequest = invalidateIncrementalRouteRequest;", "The generated core must expose route invalidation to the SPA gate.");
includes(normalizedCore, "if (!payload || !incrementalRouteRequestIsCurrent(generation)) return null;", "Stale route responses must never commit application state.");
includes(normalizedCore, "if (error?.name === \"AbortError\" && !timedOut) return null;", "Intentional route aborts must remain silent.");
includes(normalizedCore, "if (result === false) return false;", "Obsolete page renders must stop before scroll or final commit work.");
includes(normalizedCore, "if (!dataPayload) return;", "Obsolete Club payloads must not commit a Club render.");
includes(normalizedCore, "if (!playerPayload) return;", "Obsolete saved-Evaluation hydration must not commit Evaluation state.");
excludes(normalizedCore, "      await requestIncrementalRoute(route, page);\n      state.incrementalApplying = true;", "Pagination must not render after an obsolete request.");
excludes(normalizedCore, "        await requestIncrementalRoute(route, 1);\n        state.incrementalApplying = true;", "View switches must not render after an obsolete request.");

console.log("Route runtime and request cancellation validation passed.");
