import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const entry = await read("./modules/app-entry.js");
const appConfig = await read("./modules/app-config.js");
const stateRuntime = await read("./database-stats-state-runtime.js");
const statsRuntime = await read("./database-stats-runtime.js");
const styles = await read("./styles.css");
const buildNormalizer = await read("./modules/app-core-build-normalizer.js");

const bridgeBlock = entry.match(/const DATABASE_STATS_BRIDGE_RUNTIME_SCRIPTS = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || "";
const heavyBlock = entry.match(/const DATABASE_STATS_RUNTIME_SCRIPTS = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || "";

includes(bridgeBlock, "/database-stats-state-runtime.js", "Database routes must keep the lightweight Stats persistence bridge available.");
excludes(bridgeBlock, "/database-stats-runtime.js", "Database Stats data/render code must not load on ordinary Database table views.");
includes(heavyBlock, "/database-stats-runtime.js", "The Stats route must load the single Database Stats domain runtime.");
for (const retiredRuntime of [
  "/database-stats-tooltip-portal-runtime.js",
  "/database-stats-reload-bootstrap-runtime.js",
  "/database-stats-custom-filter-runtime.js",
]) {
  excludes(entry, retiredRuntime, `${retiredRuntime} must stay retired from the route runtime graph.`);
}
excludes(heavyBlock, "/database-stats-state-runtime.js", "The Stats persistence bridge must not be duplicated in the heavy runtime group.");

includes(
  entry,
  'return normalizeRoutePageName(pageName) === "database" && routeView(options) === "stats";',
  "Heavy Database Stats runtime loading must require the Stats view explicitly.",
);
includes(
  appConfig,
  'if (pageSegment === "database") return { pageName: "database", options: viewOptionsFromSegments(segments) };',
  "The canonical startup classifier must preserve Database view slugs through the generic view parser.",
);
includes(appConfig, 'stats: "stats"', "The canonical startup view parser must preserve the Database Stats slug.");

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

includes(statsRuntime, "async function showStatsPage() {", "Database Stats domain runtime must retain its data/render owner.");
includes(statsRuntime, 'window.__mflInteractionBusy.begin("databaseStatsData")', "Database Stats data loading must retain its busy state after navigation paints.");
includes(statsRuntime, "function positionCustomPanel() {", "Database Stats domain runtime must own Custom filter positioning directly.");
includes(statsRuntime, 'customPanel()?.querySelector("input")?.focus', "Database Stats domain runtime must own Custom filter opening/focus directly.");
excludes(statsRuntime, 'document.createElement("style")', "Database Stats must not inject deterministic Custom-filter CSS at runtime.");
excludes(statsRuntime, "__mflDatabaseStatsTooltipPortal", "Database Stats must not restore the retired tooltip-portal compatibility owner.");
for (const forbiddenOwner of [
  "history.pushState",
  "history.replaceState",
  'addEventListener("popstate"',
  "openDatabaseView",
  "button.dataset.view === view",
]) {
  excludes(statsRuntime, forbiddenOwner, `Database Stats renderer must not own route/view navigation via ${forbiddenOwner}.`);
}

includes(styles, "#databaseStatsPage #databaseStatsCustomFilter {", "Database Stats Custom panel styling must be static.");
invariant(
  !styles.slice(styles.indexOf("#databaseStatsPage #databaseStatsCustomFilter {")).includes("!important"),
  "Database Stats Custom panel static styling must not depend on !important overrides.",
);

const setPageIndex = buildNormalizer.indexOf("setPage = async function setIncrementalPage(pageName, updateHash = true, options = {}) {");
const transitionIndex = buildNormalizer.indexOf("await runPageTransition(pageName, navigationUpdatesHistory, options)", setPageIndex);
const statsBranchIndex = buildNormalizer.indexOf('if (pageName === "database" && requestedDatabaseView === "stats") {', transitionIndex);
const statsRuntimeIndex = buildNormalizer.indexOf('await window.__mflEnsureRouteRuntime("database", { view: "stats" });', statsBranchIndex);
invariant(
  setPageIndex >= 0 && transitionIndex > setPageIndex && statsBranchIndex > transitionIndex && statsRuntimeIndex > statsBranchIndex,
  "Database Stats runtime loading must occur only after the canonical global page transition.",
);

console.log("Database Stats single-runtime, static-CSS, and global-navigation validation passed.");
