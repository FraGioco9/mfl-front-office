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
const controlInteractions = await read("./control-interactions-runtime.js");
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
includes(statsRuntime, "let customPanelOpen = false;", "Database Stats Custom menu must track open state separately from the applied filter.");
includes(statsRuntime, "custom.hidden = !customPanelOpen;", "Database Stats Custom menu visibility must follow its dedicated open state.");
includes(statsRuntime, "function syncCustomInputs() {", "Database Stats Custom inputs must have a canonical applied-value restore helper.");
includes(
  statsRuntime,
  "customPanelOpen = false;\n    syncCustomInputs();\n    const panel = customPanel();",
  "Closing the Database Stats Custom menu without Apply must discard draft input changes.",
);
includes(
  statsRuntime,
  "customPanelOpen = false;\n        syncCustomInputs();\n        activeFilter = filter[0];",
  "Choosing another Overall filter while Custom is open must discard the Custom input draft.",
);
includes(
  statsRuntime,
  'const nextFilter = minimum === 0 && maximum === 99 ? "all" : "custom";',
  "Applying the full 0-99 Custom range must normalize back to All.",
);
includes(
  statsRuntime,
  "const effectiveFilterChanged = nextFilter !== previousFilter",
  "Database Stats Custom Apply must compare the next effective filter with the already-applied filter.",
);
includes(
  statsRuntime,
  "if (effectiveFilterChanged) renderStats();",
  "Database Stats Custom Apply must skip the histogram rebuild when the effective filter did not change.",
);
includes(
  controlInteractions,
  "control.matches('#databaseStatsOverallFilters .mflStatsFilterButton.active[data-filter=\"custom\"]')",
  "The shared interaction owner must allow the active Database Stats Custom button to reopen its menu.",
);
const customOpenIndex = statsRuntime.indexOf('if (filter[0] === "custom") {');
const customOpenReturnIndex = statsRuntime.indexOf("return;", customOpenIndex);
const nextStatsRenderIndex = statsRuntime.indexOf("renderStats();", customOpenIndex);
invariant(
  customOpenIndex >= 0 && customOpenReturnIndex > customOpenIndex && nextStatsRenderIndex > customOpenReturnIndex,
  "Opening Database Stats Custom must return before rendering stats so the histogram does not transition before Apply.",
);
const customApplyStart = statsRuntime.indexOf("function applyCustomFilter() {");
const customApplyEnd = statsRuntime.indexOf("\n  function retirementYears", customApplyStart);
const customApplyBlock = customApplyStart >= 0 && customApplyEnd > customApplyStart
  ? statsRuntime.slice(customApplyStart, customApplyEnd)
  : "";
includes(customApplyBlock, "if (effectiveFilterChanged) renderStats();", "Custom Apply must render only after an effective filter change.");
excludes(customApplyBlock, "\n    renderStats();", "Custom Apply must not unconditionally rebuild the histogram.");
excludes(statsRuntime, 'document.createElement("style")', "Database Stats must not inject deterministic Custom-filter CSS at runtime.");
excludes(statsRuntime, "__mflDatabaseStatsTooltipPortal", "Database Stats must not restore the retired tooltip-portal compatibility owner.");
excludes(statsRuntime, "databaseStatsTooltipAbove", "Database Stats Custom positioning must not retain tooltip-specific state naming.");
excludes(statsRuntime, "--database-stats-arrow-left", "Database Stats Custom menu caret must stay centered without legacy tooltip offset state.");
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
  "#databaseStatsPage #databaseStatsCustomFilter::before {",
  "Database Stats Custom menu must show a centered caret linking it visually to the Custom button.",
);
includes(
  styles,
  "left: 50%;",
  "Database Stats Custom menu caret must stay centered on the menu.",
);
includes(
  styles,
  "#databaseStatsPage #databaseStatsCustomFilter.databaseStatsMenuAbove::before {",
  "Database Stats Custom menu caret must flip when the menu has to open above its button.",
);
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

console.log("Database Stats Custom draft discard, no-op Apply, reopen, All normalization, site-style menu, and global-navigation validation passed.");
