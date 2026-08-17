import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const routeNormalizer = await read("./modules/app-core-route-runtime-normalizer.js");
const routeNormalizerExecution = routeNormalizer.replace(/\/\/[^\n]*/g, "");
const routeCoreLoader = await read("./route-core-loader-runtime.js");

includes(
  routeNormalizerExecution,
  'const initialRouteTarget = pageTargetFromPath(window.location.pathname);',
  "Initial route-core startup must use the canonical core route parser.",
);
includes(
  routeNormalizerExecution,
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
  excludes(routeNormalizerExecution, duplicateOwner, `Startup route-core ownership must not be duplicated through ${duplicateOwner}.`);
}

includes(routeCoreLoader, "function routeCoreDependencies(pageName, options = {})", "The route-core loader must remain the central dependency owner.");
includes(routeCoreLoader, 'if (page === "database" && view === "stats") return [];', "Database Stats must continue to skip table core startup.");
includes(routeCoreLoader, 'if (page === "mflstats") return ["table", "mflstats"];', "Direct MFL Stats entry must resolve Table before its dedicated Stats core.");
includes(routeCoreLoader, 'if (page === "mfl" && view === "stats") return ["table", "mflstats"];', "MFL Stats view navigation must resolve Table before its dedicated Stats core.");
includes(routeCoreLoader, 'if (page === "club") return ["table", "club"];', "Club startup must continue to resolve Table before Club core.");
includes(routeCoreLoader, 'if (page === "watchlist") return ["table", "watchlist"];', "Watchlist startup must continue to resolve Table before Watchlist core.");
includes(routeCoreLoader, "function preloadRouteCore(pageName) {", "Route-core startup must support network-only preloading without executing a lazy core.");
includes(routeCoreLoader, 'preloadRouteCore("evaluation");', "Evaluation startup should retain early network priming through a preload.");
excludes(routeCoreLoader, 'void ensure("evaluation")', "Evaluation core must not execute before the shared application core has initialized its facade bindings.");

console.log("Initial route-core dependency ownership validation passed; MFL Stats now shares the normal Table-first loading path.");
