import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);
const matches = (source, pattern, message) => invariant(pattern.test(source), message);

const [coreSource, tableSplitter, routeLoader, routeNormalizer, buildCore, appEntry] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-table-chunk.js"),
  read("./route-core-loader-runtime.js"),
  read("./modules/app-core-route-runtime-normalizer.js"),
  read("./build-app-core.mjs"),
  read("./modules/app-entry.js"),
]);
const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const sharedCore = String(artifacts.core || "");
const tableCore = String(artifacts.routeChunks?.table || "");

invariant(sharedCore.length > 250_000, "The shared application core became unexpectedly small after the Table split.");
invariant(tableCore.length > 20_000, "The Table core chunk is too small to represent the shared table engine.");
new Function(sharedCore);
new Function(tableCore);

includes(tableSplitter, '"Table destination shell"', "The Table splitter must extract the table destination shell.");
includes(tableSplitter, '"Table sorting and header owner"', "The Table splitter must extract sorting and header ownership.");
includes(tableSplitter, '"Table filter controls and matching"', "The Table splitter must extract filter controls and matching.");
includes(tableSplitter, '"Table selection owner"', "The Table splitter must extract selection ownership.");
includes(tableSplitter, '"Table row renderer"', "The Table splitter must extract row rendering.");
includes(tableSplitter, "routeChunks: Object.freeze({ ...routeChunks, table:", "The artifact map must expose the Table chunk.");

includes(sharedCore, "let __mflTableBuildHeaderOwner = null;", "The shared core must keep the stable Table facade bridge.");
includes(sharedCore, "function buildHeader() {", "The shared core must retain the stable buildHeader facade for existing wrappers.");
includes(sharedCore, "function applyFilters() {", "The shared core must retain the stable applyFilters facade for existing wrappers.");
includes(sharedCore, "function renderTable() {", "The shared core must retain the stable renderTable facade for existing wrappers.");
includes(sharedCore, "function setView() {", "The shared core must retain the stable setView facade for existing wrappers.");
includes(sharedCore, "function buildOperatorSelect() {", "The shared core must retain the filter-controls facade.");
includes(sharedCore, "function ruleMatches() {", "The shared core must retain the filter matching facade.");
includes(sharedCore, "function addFilterRule() {", "The shared core must retain the add-filter facade.");
includes(sharedCore, "function restoreSavedTableState() {", "The shared core must retain the table-state restoration facade.");
includes(sharedCore, "let __mflTableOpenSelectedPlayerLinksOwner = null;", "The shared core must keep a stable owner slot for the selected-links action.");
includes(sharedCore, "function openSelectedPlayerLinks() {", "The shared core must retain the selected-links facade used by universal event binding.");
includes(sharedCore, 'openSelectedLinksButton.addEventListener("click", openSelectedPlayerLinks);', "Universal event binding must never reference an extracted Table action directly.");

excludes(sharedCore, "function tableNextOverallPreciseValue(row) {", "Table sorting calculations must not remain in the shared core.");
excludes(sharedCore, "function activeFilterCount() {", "Table filter UI must not remain in the shared core.");
excludes(sharedCore, "function currentPageRows() {", "Table paging and selection must not remain in the shared core.");
excludes(sharedCore, "function showTableBusyState() {", "Table busy-state rendering must not remain in the shared core.");
excludes(sharedCore, "function tableTitleForPage(pageName) {", "Table destination-shell ownership must not remain in the shared core.");

includes(sharedCore, "function formatCellValue(row, column) {", "Cross-route player/search formatting must remain shared.");
includes(sharedCore, "function rowByPlayerId(playerId) {", "Cross-route player lookup must remain shared.");
includes(sharedCore, "function rowHasHiddenMflJoinedAgencyDate(row) {", "MFL Stats shared row visibility logic must remain universal.");
includes(sharedCore, "function renderSearchResultsNow() {", "Global Search rendering must remain universal.");

includes(tableCore, "function tableBuildTableColGroupOwner(", "The Table chunk must own column construction.");
includes(tableCore, "function tableBuildHeaderOwner(", "The Table chunk must own header rendering.");
includes(tableCore, "function tableBuildOperatorSelectOwner(", "The Table chunk must own filter operator construction.");
includes(tableCore, "function tableRuleMatchesOwner(", "The Table chunk must own row filter matching.");
includes(tableCore, "function tableAddFilterRuleOwner(", "The Table chunk must own filter row construction.");
includes(tableCore, "function tableRestoreSavedTableStateOwner(", "The Table chunk must own table-state restoration.");
includes(tableCore, "function tableApplyFiltersOwner(", "The Table chunk must own filtering.");
includes(tableCore, "function tableRenderTableOwner(", "The Table chunk must own row rendering.");
includes(tableCore, "function tableOpenSelectedPlayerLinksOwner(", "The Table chunk must own the selected-links action implementation.");
includes(tableCore, "__mflTableOpenSelectedPlayerLinksOwner = tableOpenSelectedPlayerLinksOwner;", "The Table chunk must activate the selected-links facade when loaded.");
includes(tableCore, "async function tableSetViewOwner(", "The Table chunk must own view switching.");
includes(tableCore, "function currentPageRows() {", "The Table chunk must own page slicing.");
includes(tableCore, "function updateSelectionBar() {", "The Table chunk must own selection presentation.");
excludes(tableCore, "function formatCellValue(row, column) {", "Cross-route cell formatting must not become Table-only.");
excludes(tableCore, "function rowByPlayerId(playerId) {", "Cross-route player lookup must not become Table-only.");
excludes(tableCore, "function rowHasHiddenMflJoinedAgencyDate(row) {", "MFL Stats row visibility logic must not become Table-only.");

includes(routeLoader, 'table: "/modules/app-core-table-runtime.js"', "The route-core loader must map the Table chunk.");
includes(routeLoader, 'const TABLE_INFRASTRUCTURE_PAGES = new Set(["database", "mfl", "agents", "progression", "watchlist", "myplayers", "club"]);', "The loader must centrally own table-capable route membership.");
includes(routeLoader, "function routeUsesTableInfrastructure(pageName) {", "The loader must expose one table-route membership classifier.");
includes(routeLoader, "return TABLE_INFRASTRUCTURE_PAGES.has(normalizeRoutePageName(pageName));", "Table-route membership must use canonical page-name normalization.");
includes(routeLoader, "runtimeWindow.__mflRouteUsesTableInfrastructure = routeUsesTableInfrastructure;", "The loader must expose table-route membership to app-entry.");
includes(routeLoader, "usesTableInfrastructure: routeUsesTableInfrastructure,", "Repeated loader installs must retain table-route membership ownership.");
includes(routeLoader, "runtimeWindow.__mflRouteUsesTableInfrastructure = runtimeWindow.__mflRouteCoreRuntime.usesTableInfrastructure;", "Repeated loader execution must restore the table-route classifier bridge.");
includes(routeLoader, 'if (page === "club") return ["table", "club"];', "Club must load the Table core before the Club core.");
includes(routeLoader, 'if (page === "database" && view === "stats") return [];', "Database Stats must not load the Table core.");
includes(routeLoader, 'if (page === "mfl" && view === "stats") return ["mflstats"];', "MFL Stats must keep its independent core.");
includes(routeLoader, 'if (routeUsesTableInfrastructure(page)) return ["table"];', "Generic Table core loading must reuse the central table-route membership classifier.");
includes(routeLoader, "for (const dependency of dependencies)", "Route-core dependencies must execute in declared order.");

const routeNeedsTableStart = appEntry.indexOf("function routeNeedsTable(pageName, options = {}) {");
const routeNeedsTableEnd = appEntry.indexOf("function routeNeedsWatchlist(pageName)", routeNeedsTableStart);
invariant(routeNeedsTableStart >= 0 && routeNeedsTableEnd > routeNeedsTableStart, "app-entry must retain a stable Table runtime decision facade.");
const routeNeedsTableSection = appEntry.slice(routeNeedsTableStart, routeNeedsTableEnd);
includes(routeNeedsTableSection, 'Reflect.get(window, "__mflRouteUsesTableInfrastructure")', "app-entry must reuse central table-route membership.");
includes(routeNeedsTableSection, 'throw new Error("Table-route classifier is unavailable.");', "app-entry must fail clearly if bootstrap ordering stops providing table-route membership.");
includes(routeNeedsTableSection, "if (!classifier(page)) return false;", "Non-table routes must skip Table runtimes through the central classifier.");
includes(routeNeedsTableSection, 'return page !== "database" || routeView(options) !== "stats";', "Database Stats must remain the only app-entry Table-runtime exclusion.");
excludes(routeNeedsTableSection, '["mfl", "agents", "progression", "watchlist", "myplayers", "club"]', "app-entry must not duplicate the table-capable page list.");

includes(routeNormalizer, "const directTableRoute = (", "Direct startup must classify table routes before startApp.");
includes(routeNormalizer, 'await window.__mflEnsureRouteCore("table");', "Direct table startup must load the Table core before startApp.");
matches(routeNormalizer, /!\/\^.*database.*stats.*test\(initialRoutePath\)/, "Direct Database Stats startup must stay outside the Table core.");
matches(routeNormalizer, /!\/\^.*mfl.*stats.*test\(initialRoutePath\)/, "Direct MFL Stats startup must stay outside the Table core.");

includes(buildCore, 'const tableRuntimePath = resolve(siteRoot, "modules/app-core-table-runtime.js");', "The build must emit a generated Table runtime.");
includes(buildCore, "artifacts.routeChunks?.table", "The build must consume the Table artifact.");

const generatedTable = await read("./modules/app-core-table-runtime.js");
const tableBanner = "// Generated Table core chunk from modules/app-core.js. Do not edit directly.\n";
invariant(generatedTable.startsWith(tableBanner), "Generated Table runtime must carry the build ownership banner.");
invariant(generatedTable.slice(tableBanner.length).replace(/\s*$/, "") === tableCore.replace(/\s*$/, ""), "Generated Table runtime must exactly match the Table build artifact.");

console.log("Table route-core splitting validation passed.");
