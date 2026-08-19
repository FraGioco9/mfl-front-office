import { readFile, writeFile } from "node:fs/promises";

const databaseStatsPath = new URL("./validate-database-stats-lazy-runtime.mjs", import.meta.url);
let databaseStats = await readFile(databaseStatsPath, "utf8");

const importMarker = 'import { readFile } from "node:fs/promises";\n';
const canonicalImport = `${importMarker}import vm from "node:vm";\n\nimport { browserConfigRuntimeSource } from "./modules/app-config.js";\n`;
if (!databaseStats.includes(importMarker)) throw new Error("Database Stats validator import marker was not found.");
databaseStats = databaseStats.replace(importMarker, canonicalImport);

const legacyBuildRead = 'const buildNormalizer = await read("./modules/app-core-build-normalizer.js");';
const canonicalCoreRead = 'const appCoreSource = await read("./modules/app-core.js");';
if (!databaseStats.includes(legacyBuildRead)) throw new Error("Database Stats validator build-normalizer read was not found.");
databaseStats = databaseStats.replace(legacyBuildRead, canonicalCoreRead);

const legacyRouteChecks = [
  "includes(",
  "  routeCoreLoader,",
  '  \'if (pageSegment === "database") return { pageName: "database", options: viewOptionsFromSegments(segments) };\',',
  '  "The central startup classifier must preserve Database view slugs through the generic view parser.",',
  ");",
  'includes(routeCoreLoader, \'stats: "stats"\', "The central startup view parser must preserve the Database Stats slug.");',
].join("\n");
const canonicalRouteChecks = [
  'includes(routeCoreLoader, "const routeConfig = runtimeWindow.__mflAppConfig?.routes;", "Route-core loading must consume canonical route configuration.");',
  'const configWindow = {};',
  'vm.runInNewContext(browserConfigRuntimeSource({ version: "1.0.0", description: "validation" }), { window: configWindow, location: { pathname: "/database/stats" } });',
  'const databaseStatsRoute = configWindow.__mflAppConfig.routes.initialRequest("/database/stats");',
  'invariant(databaseStatsRoute.pageName === "database", "Canonical startup routing must classify /database/stats as Database.");',
  'invariant(databaseStatsRoute.options?.view === "stats", "Canonical startup routing must preserve the Database Stats view slug.");',
].join("\n");
if (!databaseStats.includes(legacyRouteChecks)) throw new Error("Legacy Database Stats route-parser checks were not found.");
databaseStats = databaseStats.replace(legacyRouteChecks, canonicalRouteChecks);
databaseStats = databaseStats.replaceAll("buildNormalizer.indexOf(", "appCoreSource.indexOf(");
await writeFile(databaseStatsPath, databaseStats, "utf8");

const staticUiPath = new URL("./validate-static-route-ui.mjs", import.meta.url);
let staticUi = await readFile(staticUiPath, "utf8");

const readHelper = 'const read = (path) => readFile(new URL(path, import.meta.url), "utf8");\n';
const readWithExists = `${readHelper}const exists = async (path) => {\n  try {\n    await read(path);\n    return true;\n  } catch (error) {\n    if (error?.code === "ENOENT") return false;\n    throw error;\n  }\n};\n`;
if (!staticUi.includes(readHelper)) throw new Error("Static route UI read helper was not found.");
staticUi = staticUi.replace(readHelper, readWithExists);
staticUi = staticUi.replace("  tableView,\n", "  tableViewRuntimeExists,\n");
staticUi = staticUi.replace('  read("./table-view-runtime.js"),\n', '  exists("./table-view-runtime.js"),\n');
staticUi = staticUi.replace("  buildNormalizer,\n", "  appCoreSource,\n");
staticUi = staticUi.replace('  read("./modules/app-core-build-normalizer.js"),\n', '  read("./modules/app-core.js"),\n');

const legacyTableViewChecks = [
  "for (const forbidden of ['classList.toggle(\"active\"', 'document.createElement(\"style\")', 'addEventListener(\"pointerdown\"']) {",
  "  excludes(tableView, forbidden, `Auxiliary table-view runtime must not own view state via ${forbidden}.`);",
  "}",
].join("\n");
const retiredTableViewCheck = 'invariant(!tableViewRuntimeExists, "Retired table-view-runtime.js must remain absent; passive static UI owns view state.");';
if (!staticUi.includes(legacyTableViewChecks)) throw new Error("Legacy table-view runtime validation block was not found.");
staticUi = staticUi.replace(legacyTableViewChecks, retiredTableViewCheck);
staticUi = staticUi.replaceAll("buildNormalizer", "appCoreSource");
staticUi = staticUi.replace(
  'typeof loader === "function" ? loader(transition)',
  'typeof loader === "function" ? await loader(transition)',
);
staticUi = staticUi.replace(
  '[\'runViewTransition("mfl", "stats"\', \'setPage("mflstats", false\', "MFL Stats"]',
  '[\'runViewTransition("mfl", "stats"\', \'setPage("mfl", false, { view: "stats"\', "MFL Stats"]',
);

await writeFile(staticUiPath, staticUi, "utf8");

const mflStatsFirstPaintPath = new URL("./validate-mfl-stats-first-paint.mjs", import.meta.url);
let mflStatsFirstPaint = await readFile(mflStatsFirstPaintPath, "utf8");
const broadFilterCount = '(filterHtml.match(/class="mflStatsFilterButton/g) || []).length === expectedFilters.length';
const exactFilterCount = '(filterHtml.match(/<button class="mflStatsFilterButton(?: active)?"/g) || []).length === expectedFilters.length';
if (!mflStatsFirstPaint.includes(broadFilterCount)) throw new Error("Broad MFL Stats filter count assertion was not found.");
mflStatsFirstPaint = mflStatsFirstPaint.replace(broadFilterCount, exactFilterCount);
await writeFile(mflStatsFirstPaintPath, mflStatsFirstPaint, "utf8");

const mflStatsDataScopePath = new URL("./validate-mfl-stats-data-scope.mjs", import.meta.url);
let mflStatsDataScope = await readFile(mflStatsDataScopePath, "utf8");
const oldSources = 'const [dataPage, dataQuery, styles, stylesBase, responsive, dropdowns, scrollbars, controlInteractions, filterControls] = await Promise.all([';
const newSources = 'const [dataPage, dataQuery, styles, stylesBase, controls, responsive, dropdowns, scrollbars, controlInteractions, filterControls] = await Promise.all([';
if (!mflStatsDataScope.includes(oldSources)) throw new Error("MFL Stats data-scope source list was not found.");
mflStatsDataScope = mflStatsDataScope.replace(oldSources, newSources);
const stylesBaseRead = '  readFile(new URL("./styles-base.css", import.meta.url), "utf8"),\n';
if (!mflStatsDataScope.includes(stylesBaseRead)) throw new Error("MFL Stats data-scope styles-base read was not found.");
mflStatsDataScope = mflStatsDataScope.replace(stylesBaseRead, `${stylesBaseRead}  readFile(new URL("./controls.css", import.meta.url), "utf8"),\n`);

const oldCursorChecks = [
  'const sharedControlSelector = ":is(.navButton, .viewButton:not([hidden]), .mflStatsFilterButton, .mflStatsDistributionModeButton)";',
  "invariant(",
  '  styles.includes(`${sharedControlSelector}:not(.active) {\\n  cursor: pointer;\\n}`),',
  '  "Every non-active page, view, and Stats filter button must use the pointer cursor.",',
  ");",
  "invariant(",
  '  styles.includes(`${sharedControlSelector}.active {\\n  cursor: default;\\n}`),',
  '  "Every active page, view, and Stats filter button must use the default cursor.",',
  ");",
  "invariant(",
  '  styles.includes(`${sharedControlSelector}:not(.active):hover:not(:disabled) {`),',
  '  "Only non-active page, view, and Stats filter buttons may receive the shared hover highlight.",',
  ");",
  "invariant(",
  '  styles.includes(`${sharedControlSelector}.active:hover {`),',
  '  "Active page, view, and Stats filter buttons must retain their active paint while hovered.",',
  ");",
].join("\n");
const newCursorChecks = [
  'for (const selector of [".navButton", ".viewButton:not([hidden])", ".mflStatsFilterButton", ".mflStatsDistributionModeButton"]) {',
  '  invariant(controls.includes(selector), `controls.css must include ${selector} in the shared control owner.`);',
  "}",
  'invariant(controls.includes("):not(.active) {\\n  cursor: pointer;\\n}"), "Every non-active shared page/view/Stats control must use the pointer cursor.");',
  'invariant(controls.includes(").active {\\n  cursor: default;\\n}"), "Every active shared page/view/Stats control must use the default cursor.");',
  'invariant(controls.includes("):not(.active):hover:not(:disabled) {"), "Only non-active shared controls may receive the hover highlight.");',
  'invariant(controls.includes(").active:hover {"), "Active shared controls must retain active paint while hovered.");',
].join("\n");
if (!mflStatsDataScope.includes(oldCursorChecks)) throw new Error("Legacy shared-control cursor validation block was not found.");
mflStatsDataScope = mflStatsDataScope.replace(oldCursorChecks, newCursorChecks);
await writeFile(mflStatsDataScopePath, mflStatsDataScope, "utf8");
