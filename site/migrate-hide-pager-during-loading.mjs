import { readFile, writeFile } from "node:fs/promises";

const paths = {
  appCore: new URL("./modules/app-core.js", import.meta.url),
  tableLoading: new URL("./table-loading-runtime.js", import.meta.url),
  loadingCss: new URL("./loading.css", import.meta.url),
  generatedViewValidator: new URL("./validate-generated-view-transition.mjs", import.meta.url),
  loadingValidator: new URL("./validate-loading-ownership.mjs", import.meta.url),
  staticRouteValidator: new URL("./validate-static-route-ui.mjs", import.meta.url),
  backgroundValidator: new URL("./validate-table-background-loading-stability.mjs", import.meta.url),
  tableLoadingValidator: new URL("./validate-table-loading-state.mjs", import.meta.url),
  loadingContract: new URL("./LOADING_CONTRACT.md", import.meta.url),
};

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Could not find ${label}.`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Found duplicate ${label}.`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

function removeRange(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Could not find start of ${label}.`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Could not find end of ${label}.`);
  return source.slice(0, start) + source.slice(end);
}

let appCore = await readFile(paths.appCore, "utf8");
appCore = replaceOnce(
  appCore,
  `  const tableLoadingRequestToken = window.__mflTableLoadingRuntime?.beginRequest?.(route.scope, {\n    preservePager: options.preservePager === true,\n  }) || 0;`,
  `  const tableLoadingRequestToken = window.__mflTableLoadingRuntime?.beginRequest?.(route.scope) || 0;`,
  "Table loading request boundary pager option",
);
appCore = replaceOnce(
  appCore,
  "requestIncrementalRoute(route, 1, { preservePager: true })",
  "requestIncrementalRoute(route, 1)",
  "incremental view pager preservation option",
);
await writeFile(paths.appCore, appCore);

let runtime = await readFile(paths.tableLoading, "utf8");
runtime = replaceOnce(runtime, "  let activeRequestPreservesPager = false;\n", "", "pager preservation state");
runtime = replaceOnce(
  runtime,
  `  function pager() {\n    const element = document.querySelector("#progressionPage nav.pager");\n    return element instanceof HTMLElement ? element : null;\n  }`,
  `  function pager() {\n    const element = document.querySelector("#progressionPage nav.pager");\n    return element instanceof HTMLElement ? element : null;\n  }\n\n  function hidePager() {\n    const page = pager();\n    if (page) page.hidden = true;\n  }`,
  "pager helper",
);
runtime = removeRange(
  runtime,
  "  function pagerPreservedDuringLoading(body = elements().body) {",
  "  function shouldPreserveRenderedRows(body = elements().body) {",
  "pager preservation function",
);
runtime = replaceOnce(runtime, "  function prepareLoadingSurface(options = {}) {", "  function prepareLoadingSurface() {", "loading surface signature");
runtime = replaceOnce(runtime, "    const preservePager = options.preservePager === true || pagerPreservedDuringLoading(body);\n\n    const page = pager();\n    if (page && !preservePager) page.hidden = true;", "    hidePager();", "loading surface pager preservation");
runtime = replaceOnce(runtime, "  function beginRequest(routeScope, options = {}) {", "  function beginRequest(routeScope) {", "table request signature");
runtime = replaceOnce(runtime, "    activeRequestToken = token;\n    activeRequestPreservesPager = options.preservePager === true;", "    activeRequestToken = token;\n    hidePager();", "table request pager state");
runtime = replaceOnce(
  runtime,
  `    const body = preserveRenderedRows\n      ? currentBody\n      : prepareLoadingSurface({ preservePager: activeRequestPreservesPager });`,
  "    const body = preserveRenderedRows ? currentBody : prepareLoadingSurface();",
  "table request loading surface",
);
runtime = replaceOnce(
  runtime,
  `  function show({\n    replaceExisting = false,\n    forceRoute = false,\n    preservePager = pagerPreservedDuringLoading(),\n  } = {}) {\n    if (destroyed || (!forceRoute && !tableRouteActive())) return false;\n    const body = forceRoute\n      ? elements().body\n      : prepareLoadingSurface();`,
  `  function show({ replaceExisting = false, forceRoute = false } = {}) {\n    if (destroyed || (!forceRoute && !tableRouteActive())) return false;\n    const body = forceRoute ? elements().body : prepareLoadingSurface();`,
  "table loading show signature",
);
runtime = replaceOnce(runtime, "      const page = pager();\n      if (page && !preservePager) page.hidden = true;", "      hidePager();", "force-route pager preservation");
runtime = replaceOnce(runtime, "    if (!snapshot.dataLoading) activeRequestPreservesPager = false;\n", "", "pager preservation release state");
runtime = replaceOnce(
  runtime,
  `    if ((snapshot.dataLoading || requestActive()) && shouldPreserveRenderedRows()) return;\n    if (snapshot.dataLoading || requestActive()) {\n      show({\n        replaceExisting: true,\n        preservePager: activeRequestPreservesPager || pagerPreservedDuringLoading(),\n      });\n    }\n    else release();`,
  `    if (snapshot.dataLoading || requestActive()) {\n      hidePager();\n      if (shouldPreserveRenderedRows()) return;\n      show({ replaceExisting: true });\n    } else release();`,
  "table loading sync pager preservation",
);
runtime = replaceOnce(runtime, "    activeRequestPreservesPager = false;\n", "", "pager preservation destroy state");
if (runtime.includes("preservePager") || runtime.includes("pagerPreservedDuringLoading") || runtime.includes("activeRequestPreservesPager")) {
  throw new Error("table-loading-runtime.js still contains pager preservation ownership.");
}
await writeFile(paths.tableLoading, runtime);

let loadingCss = await readFile(paths.loadingCss, "utf8");
loadingCss = replaceOnce(
  loadingCss,
  "/* Table loading runtime owns ordinary pager loading visibility so view changes can preserve rendered pager chrome. */",
  "/* Table loading runtime owns ordinary pager visibility and hides pager chrome for the full active loading window. */",
  "pager loading ownership comment",
);
await writeFile(paths.loadingCss, loadingCss);

let generatedViewValidator = await readFile(paths.generatedViewValidator, "utf8");
generatedViewValidator = replaceOnce(
  generatedViewValidator,
  'const request = incrementalView.indexOf("requestIncrementalRoute(route, 1, { preservePager: true })", stagedTake);',
  'const request = incrementalView.indexOf("requestIncrementalRoute(route, 1)", stagedTake);',
  "generated view request marker",
);
await writeFile(paths.generatedViewValidator, generatedViewValidator);

let staticRouteValidator = await readFile(paths.staticRouteValidator, "utf8");
staticRouteValidator = replaceOnce(
  staticRouteValidator,
  'includes(tableLoading, "preservePager = pagerPreservedDuringLoading(),", "Post-commit Table loading must own pager-preservation decisions instead of static route chrome.");',
  'includes(tableLoading, "function hidePager() {", "Post-commit Table loading must own pager hiding instead of static route chrome.");',
  "static route pager assertion",
);
await writeFile(paths.staticRouteValidator, staticRouteValidator);

let backgroundValidator = await readFile(paths.backgroundValidator, "utf8");
backgroundValidator = replaceOnce(backgroundValidator, '  ": prepareLoadingSurface({ preservePager: activeRequestPreservesPager });",', '  ": prepareLoadingSurface();",', "background loading surface marker");
backgroundValidator = replaceOnce(backgroundValidator, '  "if ((snapshot.dataLoading || requestActive()) && shouldPreserveRenderedRows()) return;",\n  "preservePager: activeRequestPreservesPager || pagerPreservedDuringLoading(),",', '  "hidePager();",\n  "if (shouldPreserveRenderedRows()) return;",\n  "show({ replaceExisting: true });",', "background pager markers");
backgroundValidator = replaceOnce(backgroundValidator, 'const beginStart = runtime.indexOf("function beginRequest(routeScope, options = {}) {");', 'const beginStart = runtime.indexOf("function beginRequest(routeScope) {");', "background begin signature");
backgroundValidator = replaceOnce(backgroundValidator, 'beginSource.indexOf("shouldPreserveRenderedRows(currentBody)") < beginSource.indexOf("prepareLoadingSurface({ preservePager: activeRequestPreservesPager })")', 'beginSource.indexOf("shouldPreserveRenderedRows(currentBody)") < beginSource.indexOf("prepareLoadingSurface()")', "background begin ordering");
backgroundValidator = replaceOnce(
  backgroundValidator,
  `    && syncSource.indexOf("shouldPreserveRenderedRows()") < syncSource.indexOf("show({"),`,
  `    && syncSource.indexOf("hidePager();") < syncSource.indexOf("shouldPreserveRenderedRows()")\n    && syncSource.indexOf("shouldPreserveRenderedRows()") < syncSource.indexOf("show({ replaceExisting: true })"),`,
  "background sync ordering",
);
backgroundValidator = replaceOnce(
  backgroundValidator,
  `invariant(\n  runtime.includes("function pagerPreservedDuringLoading(body = elements().body) {")\n    && runtime.includes("activeRequestPreservesPager = options.preservePager === true;")\n    && runtime.includes("preservePager: activeRequestPreservesPager || pagerPreservedDuringLoading(),"),\n  "View-transition loading may preserve pager chrome without changing the existing row-preservation contract.",\n);`,
  `invariant(\n  runtime.includes("function hidePager() {")\n    && runtime.includes("if (page) page.hidden = true;")\n    && !runtime.includes("preservePager"),\n  "Every active Table load must hide pager chrome even when settled rows remain rendered.",\n);`,
  "background pager preservation assertion",
);
backgroundValidator = replaceOnce(
  backgroundValidator,
  'console.log("Settled table rows remain visible during background loading, while first-load and navigation loading placeholders retain canonical ownership and view transitions keep pager chrome stable.");',
  'console.log("Settled table rows remain visible during background loading, while every active Table load hides pager chrome until the request settles.");',
  "background completion message",
);
await writeFile(paths.backgroundValidator, backgroundValidator);

let tableLoadingValidator = await readFile(paths.tableLoadingValidator, "utf8");
for (const marker of [
  '  "let activeRequestPreservesPager = false;",\n',
  '  "function pagerPreservedDuringLoading(body = elements().body) {",\n',
  '  "activeRequestPreservesPager = options.preservePager === true;",\n',
  '  "prepareLoadingSurface({ preservePager: activeRequestPreservesPager })",\n',
  '  "preservePager: activeRequestPreservesPager || pagerPreservedDuringLoading(),",\n',
]) tableLoadingValidator = replaceOnce(tableLoadingValidator, marker, "", `table loading validator marker ${marker.trim()}`);
tableLoadingValidator = replaceOnce(tableLoadingValidator, '  "function beginRequest(routeScope, options = {}) {",', '  "function beginRequest(routeScope) {",', "table loading begin marker");
tableLoadingValidator = replaceOnce(tableLoadingValidator, '  "activeRequestToken = token;",', '  "activeRequestToken = token;",\n  "function hidePager() {",\n  "if (page) page.hidden = true;",\n  "hidePager();",', "table loading pager markers");
tableLoadingValidator = replaceOnce(tableLoadingValidator, 'const beginRequestStart = runtime.indexOf("function beginRequest(routeScope, options = {}) {");', 'const beginRequestStart = runtime.indexOf("function beginRequest(routeScope) {");', "table loading begin start");
tableLoadingValidator = replaceOnce(tableLoadingValidator, "const requestBoundaryMarker = 'const tableLoadingRequestToken = window.__mflTableLoadingRuntime?.beginRequest?.(route.scope, {';", "const requestBoundaryMarker = 'const tableLoadingRequestToken = window.__mflTableLoadingRuntime?.beginRequest?.(route.scope) || 0;';", "request boundary marker");
tableLoadingValidator = replaceOnce(
  tableLoadingValidator,
  `  appCoreSource.includes(requestBoundaryMarker)\n    && appCoreSource.includes("preservePager: options.preservePager === true,")\n    && appCoreSource.includes(requestFinishMarker)`,
  `  appCoreSource.includes(requestBoundaryMarker)\n    && !appCoreSource.includes("preservePager")\n    && appCoreSource.includes(requestFinishMarker)`,
  "canonical pager request assertion",
);
tableLoadingValidator = replaceOnce(
  tableLoadingValidator,
  `invariant(\n  appCoreSource.includes("requestIncrementalRoute(route, 1, { preservePager: true })"),\n  "View transitions must explicitly preserve the rendered pager while the destination view loads."\n);`,
  `invariant(\n  appCoreSource.includes("requestIncrementalRoute(route, 1)")\n    && !appCoreSource.includes("preservePager"),\n  "View transitions must use the same pager-hidden Table loading contract as every other uncached request."\n);`,
  "view pager preservation assertion",
);
await writeFile(paths.tableLoadingValidator, tableLoadingValidator);

let loadingValidator = await readFile(paths.loadingValidator, "utf8");
loadingValidator = replaceOnce(
  loadingValidator,
  `invariant(\n  tableLoading.includes("controller.subscribe(sync)")`,
  `invariant(\n  tableLoading.includes("function hidePager() {")\n    && tableLoading.includes("if (page) page.hidden = true;")\n    && tableLoading.includes("if (snapshot.dataLoading || requestActive()) {")\n    && tableLoading.includes("hidePager();")\n    && !tableLoading.includes("preservePager"),\n  "Table loading must hide nav.pager for the full active request/loading window, including cached-row preservation."\n);\ninvariant(\n  tableLoading.includes("controller.subscribe(sync)")`,
  "loading ownership pager assertion",
);
await writeFile(paths.loadingValidator, loadingValidator);

let loadingContract = await readFile(paths.loadingContract, "utf8");
loadingContract = replaceOnce(
  loadingContract,
  "- Table headers and static chrome remain destination-owned; loading rows are shown only when the active table request needs placeholders.\n",
  "- Table headers and static chrome remain destination-owned; loading rows are shown only when the active table request needs placeholders, and `nav.pager` stays hidden for the full active Table loading window.\n",
  "loading contract table pager rule",
);
await writeFile(paths.loadingContract, loadingContract);

for (const [label, source] of [
  ["app-core.js", appCore],
  ["table-loading-runtime.js", runtime],
  ["validate-generated-view-transition.mjs", generatedViewValidator],
  ["validate-static-route-ui.mjs", staticRouteValidator],
  ["validate-table-background-loading-stability.mjs", backgroundValidator],
  ["validate-table-loading-state.mjs", tableLoadingValidator],
]) {
  if (source.includes("preservePager")) throw new Error(`${label} still contains preservePager.`);
}

console.log("Removed pager-preservation exceptions and made Table loading hide nav.pager for the full active loading window.");
