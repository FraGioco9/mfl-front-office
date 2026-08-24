import { readFile, writeFile } from "node:fs/promises";

const paths = {
  loadingStyles: new URL("./loading.css", import.meta.url),
  tableLoading: new URL("./table-loading-runtime.js", import.meta.url),
  appCore: new URL("./modules/app-core.js", import.meta.url),
  loadingValidator: new URL("./validate-loading-ownership.mjs", import.meta.url),
  tableValidator: new URL("./validate-table-loading-state.mjs", import.meta.url),
  backgroundValidator: new URL("./validate-table-background-loading-stability.mjs", import.meta.url),
};

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Could not find ${label}.`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Found more than one ${label}.`);
  }
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

function replaceInSection(source, startMarker, endMarker, before, after, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end <= start) throw new Error(`Could not isolate ${label}.`);
  const section = source.slice(start, end);
  const migrated = replaceOnce(section, before, after, label);
  return `${source.slice(0, start)}${migrated}${source.slice(end)}`;
}

let loadingStyles = await readFile(paths.loadingStyles, "utf8");
const blanketPagerRule = `html.mflNavigationPending #progressionPage nav.pager,\nhtml.mflInteractionBusy #progressionPage nav.pager {\n  display: none;\n}\n\n`;
if (loadingStyles.includes(blanketPagerRule)) {
  loadingStyles = replaceOnce(
    loadingStyles,
    blanketPagerRule,
    "",
    "blanket pager loading CSS",
  );
  await writeFile(paths.loadingStyles, loadingStyles);
}

let tableLoading = await readFile(paths.tableLoading, "utf8");
const tableRuntimeMigrated = tableLoading.includes("let activeRequestPreservesPager = false;")
  && tableLoading.includes("function pagerPreservedDuringLoading(body = elements().body) {")
  && tableLoading.includes("function beginRequest(routeScope, options = {}) {");

if (!tableRuntimeMigrated) {
  tableLoading = replaceOnce(
    tableLoading,
    `  let nextRequestToken = 0;\n  let activeRequestToken = 0;`,
    `  let nextRequestToken = 0;\n  let activeRequestToken = 0;\n  let activeRequestPreservesPager = false;`,
    "table request pager state",
  );
  tableLoading = replaceOnce(
    tableLoading,
    `  function hasRealRows(body) {\n    return Array.from(body.rows).some((row) => !row.classList.contains(BLANK_ROW_CLASS));\n  }`,
    `  function hasRealRows(body) {\n    return Array.from(body.rows).some((row) => !row.classList.contains(BLANK_ROW_CLASS));\n  }\n\n  function pagerPreservedDuringLoading(body = elements().body) {\n    if (requestActive()) return activeRequestPreservesPager;\n    const root = document.documentElement;\n    return body instanceof HTMLTableSectionElement\n      && hasRealRows(body)\n      && root.classList.contains("mflInitialRouteResolved")\n      && root.classList.contains("mflNavigationPending");\n  }`,
    "pager preservation predicate",
  );
  tableLoading = replaceOnce(
    tableLoading,
    `  function prepareLoadingSurface() {\n    ensureCanonicalHeader();\n    neutralizeSelectionHeader();\n    const { body, empty } = elements();\n    if (!body) return null;\n\n    const page = pager();\n    if (page) page.hidden = true;`,
    `  function prepareLoadingSurface(options = {}) {\n    ensureCanonicalHeader();\n    neutralizeSelectionHeader();\n    const { body, empty } = elements();\n    if (!body) return null;\n    const preservePager = options.preservePager === true || pagerPreservedDuringLoading(body);\n\n    const page = pager();\n    if (page && !preservePager) page.hidden = true;`,
    "table loading surface pager ownership",
  );
  tableLoading = replaceOnce(
    tableLoading,
    `  function beginRequest(routeScope) {\n    const scope = String(routeScope || "").toLowerCase();\n    if (destroyed || !TABLE_ROUTE_SCOPES.has(scope)) return 0;\n    const token = ++nextRequestToken;\n    activeRequestToken = token;\n    const currentBody = elements().body;\n    const preserveRenderedRows = shouldPreserveRenderedRows(currentBody);\n    const body = preserveRenderedRows ? currentBody : prepareLoadingSurface();`,
    `  function beginRequest(routeScope, options = {}) {\n    const scope = String(routeScope || "").toLowerCase();\n    if (destroyed || !TABLE_ROUTE_SCOPES.has(scope)) return 0;\n    const token = ++nextRequestToken;\n    activeRequestToken = token;\n    activeRequestPreservesPager = options.preservePager === true;\n    const currentBody = elements().body;\n    const preserveRenderedRows = shouldPreserveRenderedRows(currentBody);\n    const body = preserveRenderedRows\n      ? currentBody\n      : prepareLoadingSurface({ preservePager: activeRequestPreservesPager });`,
    "table request pager option",
  );
  tableLoading = replaceOnce(
    tableLoading,
    `  function show({ replaceExisting = false, forceRoute = false } = {}) {\n    if (destroyed || (!forceRoute && !tableRouteActive())) return false;\n    const body = forceRoute ? elements().body : prepareLoadingSurface();`,
    `  function show({\n    replaceExisting = false,\n    forceRoute = false,\n    preservePager = pagerPreservedDuringLoading(),\n  } = {}) {\n    if (destroyed || (!forceRoute && !tableRouteActive())) return false;\n    const body = forceRoute\n      ? elements().body\n      : prepareLoadingSurface({ preservePager });`,
    "table loading show pager option",
  );
  tableLoading = replaceOnce(
    tableLoading,
    `      const page = pager();\n      if (page) page.hidden = true;`,
    `      const page = pager();\n      if (page && !preservePager) page.hidden = true;`,
    "forced table loading pager visibility",
  );
  tableLoading = replaceOnce(
    tableLoading,
    `    const page = pager();\n    if (page && !loadingSnapshot().dataLoading) page.hidden = false;\n    return true;`,
    `    const snapshot = loadingSnapshot();\n    const page = pager();\n    if (page && !snapshot.dataLoading) page.hidden = false;\n    if (!snapshot.dataLoading) activeRequestPreservesPager = false;\n    return true;`,
    "table loading pager release",
  );
  tableLoading = replaceOnce(
    tableLoading,
    `    if ((snapshot.dataLoading || requestActive()) && shouldPreserveRenderedRows()) return;\n    if (snapshot.dataLoading || requestActive()) show({ replaceExisting: true });`,
    `    if ((snapshot.dataLoading || requestActive()) && shouldPreserveRenderedRows()) return;\n    if (snapshot.dataLoading || requestActive()) {\n      show({\n        replaceExisting: true,\n        preservePager: activeRequestPreservesPager || pagerPreservedDuringLoading(),\n      });\n    }`,
    "table loading pager sync",
  );
  tableLoading = replaceOnce(
    tableLoading,
    `    destroyed = true;\n    activeRequestToken = 0;`,
    `    destroyed = true;\n    activeRequestToken = 0;\n    activeRequestPreservesPager = false;`,
    "table loading pager destroy state",
  );
  await writeFile(paths.tableLoading, tableLoading);
}

let appCore = await readFile(paths.appCore, "utf8");
const appCoreMigrated = appCore.includes("preservePager: options.preservePager === true,")
  && appCore.includes("requestIncrementalRoute(route, 1, { preservePager: true })");
if (!appCoreMigrated) {
  appCore = replaceOnce(
    appCore,
    `  const tableLoadingRequestToken = window.__mflTableLoadingRuntime?.beginRequest?.(route.scope) || 0;`,
    `  const tableLoadingRequestToken = window.__mflTableLoadingRuntime?.beginRequest?.(route.scope, {\n    preservePager: options.preservePager === true,\n  }) || 0;`,
    "canonical table request pager option",
  );
  appCore = replaceInSection(
    appCore,
    `  setView = async function setIncrementalView(viewName) {`,
    `  setPage = async function setIncrementalPage(pageName, updateHash = true, options = {}) {`,
    `        const payload = await requestIncrementalRoute(route, 1);`,
    `        const payload = await requestIncrementalRoute(route, 1, { preservePager: true });`,
    "incremental view pager preservation",
  );
  await writeFile(paths.appCore, appCore);
}

let loadingValidator = await readFile(paths.loadingValidator, "utf8");
if (!loadingValidator.includes("Pager loading visibility must be owned by the table loading runtime")) {
  loadingValidator = replaceOnce(
    loadingValidator,
    `  "html.mflNavigationPending #progressionPage nav.pager",\n`,
    "",
    "obsolete blanket pager CSS validation",
  );
  loadingValidator = replaceOnce(
    loadingValidator,
    `invariant(!loadingStyles.includes("!important"), "loading.css must not introduce !important overrides.");`,
    `invariant(!loadingStyles.includes("!important"), "loading.css must not introduce !important overrides.");\ninvariant(\n  !loadingStyles.includes("html.mflNavigationPending #progressionPage nav.pager")\n    && !loadingStyles.includes("html.mflInteractionBusy #progressionPage nav.pager"),\n  "Pager loading visibility must be owned by the table loading runtime, not blanket navigation/busy CSS.",\n);`,
    "single pager loading owner validation",
  );
  await writeFile(paths.loadingValidator, loadingValidator);
}

let tableValidator = await readFile(paths.tableValidator, "utf8");
if (!tableValidator.includes("View transitions must explicitly preserve the rendered pager")) {
  tableValidator = tableValidator.replace(
    `  "let activeRequestToken = 0;",`,
    `  "let activeRequestToken = 0;",\n  "let activeRequestPreservesPager = false;",\n  "function pagerPreservedDuringLoading(body = elements().body) {",`,
  );
  tableValidator = tableValidator.replace(
    `  "function beginRequest(routeScope) {",`,
    `  "function beginRequest(routeScope, options = {}) {",\n  "activeRequestPreservesPager = options.preservePager === true;",\n  "prepareLoadingSurface({ preservePager: activeRequestPreservesPager })",`,
  );
  tableValidator = tableValidator.replace(
    `  "if (snapshot.dataLoading || requestActive()) show({ replaceExisting: true });",`,
    `  "preservePager: activeRequestPreservesPager || pagerPreservedDuringLoading(),",`,
  );
  tableValidator = tableValidator.replace(
    `const beginRequestStart = runtime.indexOf("function beginRequest(routeScope) {");`,
    `const beginRequestStart = runtime.indexOf("function beginRequest(routeScope, options = {}) {");`,
  );
  tableValidator = tableValidator.replace(
    `const requestBoundaryMarker = 'const tableLoadingRequestToken = window.__mflTableLoadingRuntime?.beginRequest?.(route.scope) || 0;';`,
    `const requestBoundaryMarker = 'const tableLoadingRequestToken = window.__mflTableLoadingRuntime?.beginRequest?.(route.scope, {';`,
  );
  tableValidator = replaceOnce(
    tableValidator,
    `invariant(\n  appCoreSource.includes(requestBoundaryMarker)\n    && appCoreSource.includes(requestFinishMarker)\n    && appCoreSource.includes('function renderTable() {\\n  if (window.__mflTableLoadingRuntime?.requestActive?.()) return;'),\n  "Canonical application source must directly own the Table request loading boundary and active-request render guard.",\n);`,
    `invariant(\n  appCoreSource.includes(requestBoundaryMarker)\n    && appCoreSource.includes("preservePager: options.preservePager === true,")\n    && appCoreSource.includes(requestFinishMarker)\n    && appCoreSource.includes('function renderTable() {\\n  if (window.__mflTableLoadingRuntime?.requestActive?.()) return;'),\n  "Canonical application source must directly own the Table request loading boundary and active-request render guard.",\n);\ninvariant(\n  appCoreSource.includes("requestIncrementalRoute(route, 1, { preservePager: true })"),\n  "View transitions must explicitly preserve the rendered pager while the destination view loads.",\n);`,
    "canonical pager preservation validation",
  );
  await writeFile(paths.tableValidator, tableValidator);
}

let backgroundValidator = await readFile(paths.backgroundValidator, "utf8");
if (!backgroundValidator.includes("View-transition loading may preserve pager chrome")) {
  backgroundValidator = backgroundValidator.replace(
    `  "const body = preserveRenderedRows ? currentBody : prepareLoadingSurface();",`,
    `  "const body = preserveRenderedRows",\n  ": prepareLoadingSurface({ preservePager: activeRequestPreservesPager });",`,
  );
  backgroundValidator = backgroundValidator.replace(
    `  "if (snapshot.dataLoading || requestActive()) show({ replaceExisting: true });",`,
    `  "preservePager: activeRequestPreservesPager || pagerPreservedDuringLoading(),",`,
  );
  backgroundValidator = backgroundValidator.replace(
    `const beginStart = runtime.indexOf("function beginRequest(routeScope) {");`,
    `const beginStart = runtime.indexOf("function beginRequest(routeScope, options = {}) {");`,
  );
  backgroundValidator = backgroundValidator.replace(
    `&& beginSource.indexOf("shouldPreserveRenderedRows(currentBody)") < beginSource.indexOf("prepareLoadingSurface()")`,
    `&& beginSource.indexOf("shouldPreserveRenderedRows(currentBody)") < beginSource.indexOf("prepareLoadingSurface({ preservePager: activeRequestPreservesPager })")`,
  );
  backgroundValidator = backgroundValidator.replace(
    `&& syncSource.indexOf("shouldPreserveRenderedRows()") < syncSource.indexOf("show({ replaceExisting: true })"),`,
    `&& syncSource.indexOf("shouldPreserveRenderedRows()") < syncSource.indexOf("show({"),`,
  );
  backgroundValidator = replaceOnce(
    backgroundValidator,
    `console.log("Settled table rows remain visible during background loading, while first-load and navigation loading placeholders retain canonical ownership.");`,
    `invariant(\n  runtime.includes("function pagerPreservedDuringLoading(body = elements().body) {")\n    && runtime.includes("activeRequestPreservesPager = options.preservePager === true;")\n    && runtime.includes("preservePager: activeRequestPreservesPager || pagerPreservedDuringLoading(),"),\n  "View-transition loading may preserve pager chrome without changing the existing row-preservation contract.",\n);\n\nconsole.log("Settled table rows remain visible during background loading, while first-load and navigation loading placeholders retain canonical ownership and view transitions keep pager chrome stable.");`,
    "background pager stability validation",
  );
  await writeFile(paths.backgroundValidator, backgroundValidator);
}

console.log("Migrated pager view-transition loading ownership.");
