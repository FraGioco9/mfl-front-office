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
const statsRuntime = await read("./database-stats-runtime.js");
const buildNormalizer = await read("./modules/app-core-build-normalizer.js");

const bridgeBlock = entry.match(/const DATABASE_STATS_BRIDGE_RUNTIME_SCRIPTS = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || "";
const heavyBlock = entry.match(/const DATABASE_STATS_RUNTIME_SCRIPTS = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || "";

includes(bridgeBlock, "/database-stats-state-runtime.js", "Database routes must keep the lightweight Stats persistence bridge available.");
for (const heavyOwner of [
  "/database-stats-tooltip-portal-runtime.js",
  "/database-stats-reload-bootstrap-runtime.js",
  "/database-stats-runtime.js",
  "/database-stats-custom-filter-runtime.js",
]) {
  excludes(bridgeBlock, heavyOwner, `${heavyOwner} must not load on ordinary Database table views.`);
  includes(heavyBlock, heavyOwner, `${heavyOwner} must remain owned by the Stats route.`);
}
excludes(heavyBlock, "/database-stats-state-runtime.js", "The Stats persistence bridge must not be duplicated in the heavy runtime group.");

includes(
  entry,
  'return normalizeRoutePageName(pageName) === "database" && routeView(options) === "stats";',
  "Heavy Database Stats runtimes must require the Stats view explicitly.",
);
includes(
  routeCoreLoader,
  'if (pageSegment === "database") return { pageName: "database", options: viewOptionsFromSegments(segments) };',
  "The central startup classifier must preserve Database view slugs through the generic view parser.",
);
includes(routeCoreLoader, 'stats: "stats"', "The central startup view parser must preserve the Database Stats slug.");

includes(stateRuntime, "async function renderStatsRoute() {", "Database Stats persistence bridge must expose passive rendering after navigation.");
includes(stateRuntime, "await window.renderDatabaseStatsPage(false);", "Database Stats persistence bridge must delegate final rendering to the heavy renderer.");
for (const forbiddenOwner of [
  "commitStatsTransition",
  "__mflCommitViewTransition",
  "__mflWaitForViewTransitionPaint",
  "setPage =",
  "setView =",
  "showHomeShell =",
  "history.pushState",
  "history.replaceState",
  'addEventListener("popstate"',
]) {
  excludes(stateRuntime, forbiddenOwner, `Database Stats state bridge must not own navigation via ${forbiddenOwner}.`);
}

includes(statsRuntime, "async function showStatsPage() {", "Database Stats heavy runtime must retain its data/render owner.");
includes(statsRuntime, 'window.__mflInteractionBusy.begin("databaseStatsData")', "Database Stats data loading must retain its busy state after navigation paints.");
for (const forbiddenOwner of [
  "history.pushState",
  "history.replaceState",
  'addEventListener("popstate"',
  "openDatabaseView",
  "button.dataset.view === view",
]) {
  excludes(statsRuntime, forbiddenOwner, `Database Stats renderer must not own route/view navigation via ${forbiddenOwner}.`);
}

const setPageIndex = buildNormalizer.indexOf("setPage = async function setIncrementalPage(pageName, updateHash = true, options = {}) {");
const transitionIndex = buildNormalizer.indexOf("await runPageTransition(pageName, navigationUpdatesHistory, options)", setPageIndex);
const statsBranchIndex = buildNormalizer.indexOf('if (pageName === "database" && requestedDatabaseView === "stats") {', transitionIndex);
const statsRuntimeIndex = buildNormalizer.indexOf('await window.__mflEnsureRouteRuntime("database", { view: "stats" });', statsBranchIndex);
invariant(
  setPageIndex >= 0 && transitionIndex > setPageIndex && statsBranchIndex > transitionIndex && statsRuntimeIndex > statsBranchIndex,
  "Database Stats runtime loading must occur only after the canonical global page transition.",
);

console.log("Database Stats passive lazy-runtime and global-navigation validation passed.");
