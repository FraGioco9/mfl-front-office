import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const entry = await read("./modules/app-entry.js");
const routeCoreLoader = await read("./route-core-loader-runtime.js");
const stateRuntime = await read("./database-stats-state-runtime.js");

const bridgeBlock = entry.match(/const DATABASE_STATS_BRIDGE_RUNTIME_SCRIPTS = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || "";
const heavyBlock = entry.match(/const DATABASE_STATS_RUNTIME_SCRIPTS = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || "";

includes(bridgeBlock, "/database-stats-state-runtime.js", "Database routes must keep the lightweight Stats state bridge available.");
for (const heavyOwner of [
  "/database-stats-tooltip-portal-runtime.js",
  "/database-stats-reload-bootstrap-runtime.js",
  "/database-stats-runtime.js",
  "/database-stats-custom-filter-runtime.js",
]) {
  excludes(bridgeBlock, heavyOwner, `${heavyOwner} must not load on ordinary Database table views.`);
  includes(heavyBlock, heavyOwner, `${heavyOwner} must remain owned by the Stats route.`);
}
excludes(heavyBlock, "/database-stats-state-runtime.js", "The Stats state bridge must not be duplicated in the heavy runtime group.");

includes(
  entry,
  'return normalizeRoutePageName(pageName) === "database" && routeView(options) === "stats";',
  "Heavy Database Stats runtimes must require the Stats view explicitly.",
);
includes(
  entry,
  "if (routeNeedsDatabaseStatsBridge(page)) scripts.push(...DATABASE_STATS_BRIDGE_RUNTIME_SCRIPTS);",
  "Every Database route must load the lightweight Stats bridge.",
);
includes(
  entry,
  "if (routeNeedsDatabaseStats(page, options)) scripts.push(...DATABASE_STATS_RUNTIME_SCRIPTS);",
  "Only the Stats view may request the heavy Stats runtime group.",
);
includes(
  entry,
  'Reflect.get(window, "__mflInitialRouteRuntimeRequest")',
  "Direct Database Stats startup must resolve through the central startup classifier.",
);
includes(
  routeCoreLoader,
  'return { pageName: "database", options: { view: "stats" } };',
  "The central startup classifier must preserve the direct Database Stats request.",
);

const renderStart = stateRuntime.indexOf("async function renderStatsRoute(updateUrl = false) {");
const renderEnd = stateRuntime.indexOf("function cloudDatabaseView(savedState)", renderStart);
invariant(renderStart >= 0 && renderEnd > renderStart, "Could not locate the Database Stats route renderer.");
const renderSection = stateRuntime.slice(renderStart, renderEnd);
includes(
  renderSection,
  'await window.__mflEnsureRouteRuntime("database", { view: "stats" });',
  "Entering Database Stats must await its lazy heavy runtime owners.",
);
includes(
  renderSection,
  'window.__mflInteractionBusy?.begin?.("route-runtime")',
  "Lazy Database Stats runtime loading must keep the interaction wait state active.",
);
includes(
  renderSection,
  "window.__mflInteractionBusy?.end?.(runtimeToken);",
  "Database Stats lazy runtime loading must always release its wait token.",
);

console.log("Database Stats lazy-runtime validation passed.");
