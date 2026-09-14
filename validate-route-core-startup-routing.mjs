import { includes, excludes } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";
import { readCombinedCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const appCoreSource = readCombinedCanonicalCoreSource();
const appCoreExecution = appCoreSource.replace(/\/\/[^\n]*/g, "");
const routeCoreLoader = await read("./route-core-loader-runtime.js");
const appConfig = await read("./modules/app-config.js");

includes(
  appCoreExecution,
  'const initialRouteTarget = pageTargetFromPath(window.location.pathname);',
  "Initial route-core startup must use the canonical core route parser.",
);
includes(
  appCoreExecution,
  'await window.__mflEnsureRouteCore(initialRouteTarget.pageName, initialRouteTarget.options || {});',
  "Initial route-core startup must delegate dependencies to the route-core loader.",
);
for (const duplicateOwner of [
  "directTableRoute",
  "directWatchlistRoute",
  'window.__mflEnsureRouteCore("table")',
  'window.__mflEnsureRouteCore("watchlist")',
  'window.__mflEnsureRouteCore("club")',
  'window.__mflEnsureRouteCore("settings")',
  'window.__mflEnsureRouteCore("player")',
]) {
  excludes(appCoreExecution, duplicateOwner, `Startup route-core ownership must not be duplicated through ${duplicateOwner}.`);
}

includes(appConfig, "function routeDependencyPlan(pageName, options = {})", "Canonical app config must remain the central dependency owner.");
includes(appConfig, 'const table = tablePageSet.has(page) && !(page === "database" && view === "stats");', "Database Stats must continue to skip Table core/runtime infrastructure.");
includes(appConfig, 'if (page === "mflstats" || (page === "mfl" && view === "stats")) {', "MFL Stats routes must share one canonical dependency branch.");
includes(appConfig, 'core.push("table", "mflstats");', "MFL Stats must resolve Table before its dedicated Stats core.");
includes(appConfig, 'core.push("table", "club");', "Club startup must preserve ordered Table and Club route-core dependencies.");
includes(appConfig, 'core.push("table", "watchlist");', "Watchlist startup must preserve ordered Table and Watchlist route-core dependencies.");
includes(routeCoreLoader, "const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;", "The route-core loader must consume canonical core dependencies.");
includes(routeCoreLoader, "dependencies.forEach(preloadRouteCore);", "Every route-core dependency must begin network acquisition before ordered core execution starts.");
includes(routeCoreLoader, "for (const dependency of dependencies) await ensureSingle(dependency);", "Route-core execution must preserve canonical dependency order after network preloading.");
excludes(routeCoreLoader, "function routeCoreDependencies", "The route-core loader must not retain a second dependency owner.");
includes(routeCoreLoader, "function preloadRouteCore(pageName) {", "Route-core startup must support network-only preloading without executing a lazy core.");
includes(routeCoreLoader, 'preloadRouteCore("evaluation");', "Evaluation startup should retain early network priming through a preload.");
excludes(routeCoreLoader, 'void ensure("evaluation")', "Evaluation core must not execute before the shared application core has initialized its facade bindings.");

console.log("Initial route-core dependency ownership validation passed; route dependencies preload in parallel while execution stays ordered.");
