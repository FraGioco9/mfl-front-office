import { readFile } from "node:fs/promises";

import { readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => { if (!condition) throw new Error(message); };

const [sharedCore, tableCore, generatedShared, generatedTable, bootstrap, firstPaintSource, generatedHtml] = await Promise.all([
  Promise.resolve(readCanonicalCoreSource("shared")),
  Promise.resolve(readCanonicalCoreSource("table")),
  read("./modules/app-core-runtime.js"),
  read("./modules/app-core-table-runtime.js"),
  read("./bootstrap.js"),
  read("./html-sources/first-paint.html"),
  read("./index.html"),
]);

for (const [source, label] of [[tableCore, "canonical Table source"], [generatedTable, "generated Table runtime"]]) {
  invariant(source.includes("function filterOperatorsForColumn(column) {"), `${label} must expose one canonical filter-operator schema.`);
  invariant(source.includes("function tableUrlStateFromSearch(pageName, viewName, search, fallbackState) {"), `${label} must parse URL-backed table state centrally.`);
  invariant(source.includes("function tableUrlSearchForState(pageName, viewName, tableState) {"), `${label} must serialize URL-backed table state centrally.`);
  invariant(source.includes('const TABLE_URL_QUICK_FILTER_KEYS = Object.freeze(new Set(['), `${label} must keep stable quick-filter URL keys.`);
  invariant(source.includes('const TABLE_URL_SORT_KEYS = Object.freeze(new Set(["sort", "direction"]));'), `${label} must expose stable public sorting URL keys.`);
  invariant(source.includes('"hideRetired"') && source.includes('"hideRetiring"') && source.includes('"hideMfl"')
    && source.includes('"packableOnly"') && source.includes('"newMintsOnly"'), `${label} must cover every shared quick filter.`);
  const urlSerializerStart = source.indexOf("function tableUrlSearchForState(pageName, viewName, tableState) {");
  const urlParserStart = source.indexOf("function tableUrlStateFromSearch(pageName, viewName, search, fallbackState) {", urlSerializerStart);
  const urlSerializer = source.slice(urlSerializerStart, urlParserStart);
  invariant(
    urlSerializer.includes('params.set("hideRetired", "false")')
      && urlSerializer.includes('params.set("hideRetiring", "true")')
      && urlSerializer.includes('params.set("hideMfl", "false")')
      && urlSerializer.includes('params.set("packableOnly", "false")')
      && urlSerializer.includes('params.set("newMintsOnly", "true")')
      && !urlSerializer.includes('params.set("hideRetired", "0")')
      && !urlSerializer.includes('params.set("hideRetiring", "1")'),
    `${label} must serialize public URL booleans as lowercase true/false rather than 1/0.`,
  );
  invariant(
    source.includes('const booleanValue = String(value || "").toLowerCase();')
      && source.includes('const booleanIsValid = booleanValue === "true" || booleanValue === "false";'),
    `${label} must parse boolean URL values case-insensitively and canonicalize them to lowercase true/false.`,
  );
  invariant(
    urlSerializer.includes('const defaultSortState = defaultSortStateForView(viewName, pageName);')
      && urlSerializer.includes('const resolvedSortState = normalizedViewSortState(')
      && urlSerializer.includes('params.set("sort", resolvedSortState.sortKey);')
      && urlSerializer.includes('params.set("direction", resolvedSortState.sortDirection);'),
    `${label} must serialize non-default sorting into readable shareable URL parameters.`,
  );
  invariant(
    source.includes('const requestedSortKey = String(params.get("sort") || "");')
      && source.includes('const requestedSortDirection = String(params.get("direction") || "").toLowerCase();')
      && source.includes('sortKeySupportedByView(requestedSortKey, viewName, pageName)')
      && source.includes('sortKey: parsedSortState?.sortKey || defaultSortState.sortKey')
      && source.includes('sortDirection: parsedSortState?.sortDirection || defaultSortState.sortDirection'),
    `${label} must restore only view-compatible sorting from public links and fall back to the canonical view sort.`,
  );
  invariant(
    source.includes('const key = `${connectorPrefix}${rule.column}.${operatorToken}`;')
      && source.includes('const connectorPrefix = connector === "or" ? "or." : "";')
      && source.includes('params.append(`${key}.from`, String(rule.value));')
      && source.includes('params.append(`${key}.to`, String(rule.valueTo));')
      && source.includes('const match = String(key || "").match(/^(or\\.)?([^.]+)\\.([a-z]+)(?:\\.(from|to))?$/);'),
    `${label} must serialize advanced rules as compact readable keys such as overall.gte=80, with optional or. prefixes and explicit range bounds.`,
  );
  invariant(
    !source.includes('~${rule.value}')
      && !source.includes('`${rule.operator}~')
      && source.includes('">=": "gte"')
      && source.includes('"<=": "lte"')
      && source.includes('"=": "is"'),
    `${label} must keep symbolic operators out of public URL values.`,
  );
  invariant(source.includes("function tableRestoreUrlSearch(options = {}) {")
    && source.includes('const routePath = String(options.path || options.replaceUrl || "");')
    && source.includes("return queryIndex >= 0 ? routePath.slice(queryIndex) : \"\";")
    && source.includes('const requestedView = normalizeViewForPage(options.view || fallbackState.view, pageName);')
    && source.includes("const urlState = tableUrlStateFromSearch(pageName, requestedView, tableRestoreUrlSearch(options), fallbackState);")
    && source.includes("const savedState = urlState.state;"), `${label} must keep the original route query authoritative through direct-refresh hydration instead of relying only on the mutable current URL.`);
  invariant(source.includes("state.tableSortSessionSortState = viewSortState;")
    && source.includes("replaceTableUrlForState(pageName, state.view, {")
    && source.includes("...savedState,")
    && source.includes("...viewSortState,"), `${label} must restore linked sorting into the active sort session before canonicalizing the URL.`);
  invariant(source.includes("return savedState;"), `${label} restore must return the resolved state for first-request ownership.`);
}

for (const [source, label] of [[sharedCore, "canonical Shared source"], [generatedShared, "generated Shared runtime"]]) {
  invariant(source.includes('const tableUrlState = Reflect.get(window, "__mflTableUrlState");')
    && source.includes('typeof tableUrlState.syncFromControls === "function"')
    && source.includes("tableUrlState.syncFromControls();"), `${label} must replace the URL when committed filters or sorting change.`);
  invariant(source.includes("const restoredPageState = savedPageState")
    && source.includes("restoreSavedTableState(pageName, {")
    && source.includes("path: options.path,")
    && source.includes("replaceUrl: options.replaceUrl,")
    && source.includes("deferRules: true,")
    && source.includes("route.filterRules = filterRulesForLoading(pageName, restoredPageState, route.view);")
    && source.includes('Reflect.set(route, "tableFilters", {'), `${label} must carry the original route query into URL-state resolution before constructing the first incremental request.`);
  invariant(source.includes('const tableFilters = route.tableFilters && typeof route.tableFilters === "object"')
    && source.includes("tableFilters ? tableFilters.hideRetired : hideRetiredInput.checked")
    && source.includes("tableFilters ? tableFilters.newMints : newMintsInput.checked"), `${label} first request must consume resolved quick filters rather than stale controls.`);
  invariant(source.includes('typeof tableUrlState?.searchForCurrentControls === "function"')
    && source.includes("tableUrlState.searchForCurrentControls(pageName, nextView)")
    && source.includes("if (compatibleSearch) targetPath += compatibleSearch;"), `${label} must preserve only destination-compatible filters and sorting during view changes.`);
  invariant(source.includes('const requestedSearch = routeQueryIndex >= 0 ? requestedPath.slice(routeQueryIndex) : "";')
    && source.includes("tablePageTarget(pageName, cleanPath, basePath, requestedSearch)"), `${label} route parser must preserve table query state until canonical Table ownership resolves it.`);
  invariant(source.includes('window.addEventListener("popstate", () => {')
    && source.includes('pageTargetFromPath(`${window.location.pathname}${window.location.search}`)')
    && source.includes("preserveScroll: true"), `${label} browser back/forward must restore URL-derived table state without resetting scroll.`);
  invariant(
    source.includes("function tableSortSearchForSessionEntry(options = {}) {")
      && source.includes('const routePath = String(options.path || options.replaceUrl || "");')
      && source.includes("function tableSortStateForSessionEntry(pageName, viewName, options = {}, fallbackSortState = null) {")
      && source.includes('const requestedSortKey = String(params.get("sort") || "");')
      && source.includes("sortKeySupportedByView(requestedSortKey, viewName, pageName)")
      && source.includes("state.tableSortSessionSortState = entrySortState;"),
    `${label} must seed valid linked sorting into a new table session before any hydration-time header rebuild.`,
  );
}

for (const [source, label] of [[firstPaintSource, "canonical parser first paint"], [generatedHtml, "generated parser first paint"]]) {
  invariant(
    source.includes("function initialTableStateFromLocation(pageName, viewName, savedState = {}) {")
      && source.includes("rules: initialTableUrlRules(pageName, viewName, params),")
      && source.includes('if (key === "hideRetired") state.hideRetired = enabled;')
      && source.includes('else if (key === "newMintsOnly") state.newMints = enabled;')
      && source.includes("initialTableStateFromLocation(tablePage, activeView, storedInitialState)"),
    `${label} must resolve linked filters before the Filters button and Quick Filters controls are parsed.`,
  );
  invariant(
    source.includes("function initialTableUrlRules(pageName, viewName, params) {")
      && source.includes("initialTableFilterColumnAllowed(pageName, viewName, column)")
      && source.includes("initialTableUrlRuleIsValid("),
    `${label} must count only destination-compatible valid linked filter rules during parser first paint.`,
  );
}

invariant(
  bootstrap.includes("function firstPaintTableUrlControlState(pageName, viewName, urlLike, savedState = {}) {")
    && bootstrap.includes("rules: firstPaintTableUrlRules(normalizedPage, viewName, params),")
    && bootstrap.includes('if (key === "hideRetired") state.hideRetired = enabled;')
    && bootstrap.includes('else if (key === "newMintsOnly") state.newMints = enabled;')
    && bootstrap.includes('if (normalizedPage === "mfl" && state.newMints) state.mflPackable = false;'),
  "Bootstrap must resolve canonical linked filter state synchronously before the Table chrome becomes visible.",
);
invariant(
  bootstrap.includes("function firstPaintTableUrlRules(pageName, viewName, params) {")
    && bootstrap.includes("firstPaintTableAllowedFilterColumns(pageName, viewName)")
    && bootstrap.includes("firstPaintTableUrlRuleIsValid(")
    && bootstrap.includes('const match = String(key || "").match(/^(or\\.)?([^.]+)\\.([a-z]+)(?:\\.(from|to))?$/);'),
  "Bootstrap must count only compatible valid public filter rules for the first-paint filter badge.",
);
invariant(
  bootstrap.includes("function firstPaintTableSortState(page, view, urlLike = window.location.href) {")
    && bootstrap.includes('const requestedSortKey = String(params.get("sort") || "");')
    && bootstrap.includes('const requestedSortDirection = String(params.get("direction") || "").toLowerCase();')
    && bootstrap.includes("FIRST_PAINT_SORTABLE_COLUMNS.has(requestedSortKey)")
    && bootstrap.includes("visibleColumns.includes(requestedSortKey)"),
  "Bootstrap must resolve only visible sortable URL columns before rendering the first table header.",
);
invariant(
  bootstrap.includes("function primeInitialTableStructure(page, view) {")
    && bootstrap.includes("const sort = firstPaintTableSortState(normalizedPage, normalizedView);")
    && bootstrap.includes('header.setAttribute("aria-sort", sort.sortDirection === "asc" ? "ascending" : "descending");')
    && bootstrap.includes("arrow.className = `sortArrow ${sort.sortDirection}`;"),
  "First-paint table headers must expose the linked sort arrow and aria-sort before hydration.",
);
invariant(
  bootstrap.includes("firstPaintTableUrlControlState(normalizedPage, view, urlLike, savedState)")
    && bootstrap.includes("normalizedBootstrapTableControlState(normalizedPage, view, initialControlState)")
    && bootstrap.includes("filterSummary.textContent = String(activeRuleCount);"),
  "First-paint table chrome must derive its filter badge from URL-authoritative control state.",
);
invariant(
  bootstrap.includes("primeInitialTableStructure(tablePage, view);"),
  "Initial route bootstrap must retain the canonical table-structure owner while linked sorting resolves from the current URL.",
);

const syncIndex = sharedCore.indexOf('tableUrlState.syncFromControls();');
const reloadIndex = sharedCore.indexOf('void reloadIncrementalPage(1, { save: options.save !== false, loadingMode: "blank" });', syncIndex);
invariant(syncIndex >= 0 && reloadIndex > syncIndex, "Filter/sort URL replacement must happen before the incremental request begins.");

const resolveIndex = sharedCore.indexOf("const restoredPageState = savedPageState");
const requestStateIndex = sharedCore.indexOf('Reflect.set(route, "tableFilters", {', resolveIndex);
const routeReturnIndex = sharedCore.indexOf("return route;", requestStateIndex);
invariant(resolveIndex >= 0 && requestStateIndex > resolveIndex && routeReturnIndex > requestStateIndex,
  "Direct refresh must carry resolved URL state into the first route request with no correction fetch.");

console.log("Table filter/sort URL state is canonical, shareable, first-paint accurate, first-request authoritative, and history-safe.");
