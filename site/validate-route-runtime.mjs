import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const bootstrap = await read("./bootstrap.js");
const entry = await read("./modules/app-entry.js");
const buildNormalizer = await read("./modules/app-core-build-normalizer.js");
const routeNormalizer = await read("./modules/app-core-route-runtime-normalizer.js");
const filterControls = await read("./filter-controls-runtime.js");

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
includes(routeNormalizer, "window.__mflMarkApplicationCoreLoaded?.();", "The generated core must mark itself loaded before startApp.");
includes(buildNormalizer, "normalizeRouteRuntimeGate(startupDataSource)", "The build must apply the route gate after startup-data normalization.");
includes(filterControls, "Object.freeze({ sync, destroy })", "Filter controls must expose an explicit late-load sync hook.");

console.log("Route runtime validation passed.");
