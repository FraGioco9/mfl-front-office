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
const styles = await read("./styles.css");
const coreSource = await read("./modules/app-core.js");

const statsBlock = entry.match(/const DATABASE_STATS_RUNTIME_SCRIPTS = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || "";

includes(statsBlock, "/database-stats-state-runtime.js", "The Database Stats route must load its lightweight state owner with the domain runtime.");
includes(statsBlock, "/database-stats-runtime.js", "The Database Stats route must load the single Database Stats domain runtime.");
for (const retiredRuntime of [
  "/database-stats-tooltip-portal-runtime.js",
  "/database-stats-reload-bootstrap-runtime.js",
  "/database-stats-custom-filter-runtime.js",
]) {
  excludes(entry, retiredRuntime, `${retiredRuntime} must stay retired from the route runtime graph.`);
}
excludes(entry, "DATABASE_STATS_BRIDGE_RUNTIME_SCRIPTS", "Ordinary Database table routes must not preload a separate Stats bridge.");

includes(
  entry,
  'return normalizeRoutePageName(pageName) === "database" && routeView(options) === "stats";',
  "Database Stats runtime loading must require the Stats view explicitly.",
);
includes(
  routeCoreLoader,
  "const routeView = (options = {}) => routeConfig.normalizeView(options);",
  "Database Stats startup must resolve its view through the canonical route configuration.",
);
includes(
  routeCoreLoader,
  "const initialRouteRuntimeRequest = (pathname = location.pathname) => routeConfig.initialRequest(pathname);",
  "Database startup classification must come from the canonical route configuration.",
);
includes(
  routeCoreLoader,
  'if (page === "database" && view === "stats") return [];',
  "Database Stats route-core dependency classification must preserve the canonical Stats view.",
);

includes(stateRuntime, "async function renderStatsRoute() {", "Database Stats state owner must expose passive rendering after navigation.");
includes(stateRuntime, "await window.renderDatabaseStatsPage(false);", "Database Stats state owner must delegate final rendering to the domain renderer.");
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
  excludes(stateRuntime, forbiddenOwner, `Database Stats state owner must not own navigation via ${forbiddenOwner}.`);
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

const customMenuSelector = "#databaseStatsPage #databaseStatsCustomFilter {";
const customMenuStart = styles.indexOf(customMenuSelector);
const customMenuEnd = styles.indexOf("\n}", customMenuStart);
const customMenuStyles = customMenuStart >= 0 && customMenuEnd > customMenuStart
  ? styles.slice(customMenuStart, customMenuEnd + 2)
  : "";

includes(styles, customMenuSelector, "Database Stats Custom menu styling must be static.");
for (const expectedStyle of [
  "display: grid;",
  "width: 220px;",
  "padding: 5px;",
  "border: 1px solid var(--border-strong);",
  "border-radius: 8px;",
  "box-shadow: var(--mfl-dropdown-shadow);",
]) {
  includes(customMenuStyles, expectedStyle, `Database Stats Custom menu must use the canonical site dropdown style: ${expectedStyle}`);
}
includes(
  styles,
  "#databaseStatsPage #databaseStatsCustomFilter input:hover:not(:disabled),",
  "Database Stats Custom range inputs must use the site's normal hover/focus treatment.",
);
includes(
  styles,
  "#databaseStatsPage #databaseStatsCustomApply {\n  grid-column: 1 / -1;\n  width: 100%;\n  height: 34px;",
  "Database Stats Custom Apply button must align with the compact menu controls.",
);
excludes(styles, "#databaseStatsPage #databaseStatsCustomFilter::before", "Database Stats Custom must not retain the retired tooltip arrow.");
invariant(
  !styles.slice(customMenuStart).includes("!important"),
  "Database Stats Custom menu static styling must not depend on !important overrides.",
);

const setPageIndex = coreSource.indexOf("setPage = async function setIncrementalPage(pageName, updateHash = true, options = {}) {");
const transitionIndex = coreSource.indexOf("await runPageTransition(pageName, navigationUpdatesHistory, options)", setPageIndex);
const statsBranchIndex = coreSource.indexOf('if (pageName === "database" && requestedDatabaseView === "stats") {', transitionIndex);
const statsRuntimeIndex = coreSource.indexOf('await window.__mflEnsureRouteRuntime("database", { view: "stats" });', statsBranchIndex);
invariant(
  setPageIndex >= 0 && transitionIndex > setPageIndex && statsBranchIndex > transitionIndex && statsRuntimeIndex > statsBranchIndex,
  "Database Stats runtime loading must occur only after the canonical global page transition.",
);

console.log("Database Stats single-runtime, site-style Custom menu, static-CSS, and global-navigation validation passed.");
