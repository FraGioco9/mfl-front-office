import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [runtime, bootstrap, stylesBase, appCoreSource, buildNormalizer, generatedCore, tableRuntime] = await Promise.all([
  read("./table-loading-runtime.js"),
  read("./bootstrap.js"),
  read("./styles-base.css"),
  read("./modules/app-core.js"),
  read("./modules/app-core-build-normalizer.js"),
  read("./modules/app-core-runtime.js"),
  read("./modules/app-core-table-runtime.js"),
]);

for (const required of [
  'input.checked = false;',
  'input.indeterminate = false;',
  'input.disabled = false;',
  'if (document.activeElement === input) input.blur();',
  'neutralizeSelectionHeader();',
]) {
  invariant(runtime.includes(required), `Loading header selection must stay neutral through ${required}`);
}
invariant(
  !runtime.includes("input.disabled = true;"),
  "Loading must not use the browser disabled-checkbox appearance for the header selector.",
);

invariant(
  bootstrap.includes('function neutralizeFirstPaintSelectionHeader(head) {')
    && bootstrap.includes('neutralizeFirstPaintSelectionHeader(head);')
    && bootstrap.includes('selectionInput.checked = false;')
    && bootstrap.includes('selectionInput.indeterminate = false;')
    && bootstrap.includes('selectionInput.disabled = false;'),
  "The first-paint header selector must be neutral before the table is revealed, including when static header DOM is reused.",
);

const loadingGuardMarkers = [
  'if (document.documentElement.classList.contains("mflDataLoading")) {',
  'selectVisibleInput.checked = false;',
  'selectVisibleInput.indeterminate = false;',
  'selectVisibleInput.disabled = false;',
];
for (const marker of loadingGuardMarkers) {
  invariant(appCoreSource.includes(marker), `Canonical selection-header loading guard is missing ${marker}`);
  invariant(tableRuntime.includes(marker), `Generated table runtime selection-header loading guard is missing ${marker}`);
}

for (const required of [
  'const TABLE_ROUTE_SCOPES = new Set(["database", "progression", "mfl", "agent", "watchlist", "myplayers", "club"]);',
  "let nextRequestToken = 0;",
  "let activeRequestToken = 0;",
  "function requestActive() {",
  "function beginRequest(routeScope) {",
  'const scope = String(routeScope || "").toLowerCase();',
  "!TABLE_ROUTE_SCOPES.has(scope)",
  "activeRequestToken = token;",
  "function finishRequest(token) {",
  "requestToken !== activeRequestToken",
  "activeRequestToken = 0;",
  "if (requestActive()) return false;",
  "if (snapshot.dataLoading || requestActive()) show({ replaceExisting: true });",
  "finishRequest,",
  "requestActive,",
  'if (body.dataset.staticLoading === "true" && realRowsPresent) return false;',
]) {
  invariant(runtime.includes(required), `Request-bound table loading ownership is missing ${required}`);
}
const beginRequestSource = runtime.slice(
  runtime.indexOf("function beginRequest(routeScope) {"),
  runtime.indexOf("function finishRequest(", runtime.indexOf("function beginRequest(routeScope) {")),
);
invariant(
  beginRequestSource
    && !beginRequestSource.includes("tableRouteActive()")
    && !beginRequestSource.includes("loadingSnapshot().dataLoading"),
  "An explicit table request must not depend on the previous DOM route or global data-loading flag before resetting stale rows.",
);

const requestBoundaryMarker = 'const tableLoadingRequestToken = window.__mflTableLoadingRuntime?.beginRequest?.(route.scope) || 0;';
const requestFinishMarker = 'window.__mflTableLoadingRuntime?.finishRequest?.(tableLoadingRequestToken);';
invariant(
  buildNormalizer.includes("function normalizeTableRequestLoadingBoundary(artifacts) {")
    && buildNormalizer.includes(requestBoundaryMarker)
    && buildNormalizer.includes(requestFinishMarker)
    && buildNormalizer.includes('if (window.__mflTableLoadingRuntime?.requestActive?.()) return;')
    && buildNormalizer.includes("const tableRequestLoadingArtifacts = normalizeTableRequestLoadingBoundary(viewFilterStateArtifacts);")
    && buildNormalizer.includes("const filterSummaryArtifacts = normalizeFilterSummaryLifecycle(tableRequestLoadingArtifacts);"),
  "The build must keep loading ownership active from uncached request start through payload application.",
);

const generatedBoundaryIndex = generatedCore.indexOf(requestBoundaryMarker);
const generatedPromiseIndex = generatedCore.indexOf("let requestPromise = force ? null : state.incrementalRequestPromises.get(cacheKey);");
const generatedApplyIndex = generatedCore.indexOf("applyIncrementalPayload(route, payload);", generatedBoundaryIndex);
const generatedFinishAfterApplyIndex = generatedCore.indexOf(requestFinishMarker, generatedApplyIndex);
invariant(
  generatedBoundaryIndex >= 0
    && generatedPromiseIndex > generatedBoundaryIndex
    && generatedApplyIndex > generatedPromiseIndex
    && generatedFinishAfterApplyIndex > generatedApplyIndex,
  "Generated shared core must hold the table request token from request acquisition through fresh payload application.",
);

invariant(
  tableRuntime.includes("function tableRenderTableOwner() {\n  if (window.__mflTableLoadingRuntime?.requestActive?.()) return;"),
  "The Table renderer must preserve canonical loading rows while stale state can still be rendered during an active request.",
);
invariant(
  !tableRuntime.includes('document.documentElement.classList.contains("mflDataLoading") && !state.incrementalApplying')
    && !tableRuntime.includes("commitFinalRender"),
  "Table render isolation must be request-token based, not tied to broad global loading or final-render commit flags.",
);

invariant(
  bootstrap.includes('const renderedColumns = Array.from(colGroup?.children || []);')
    && bootstrap.includes('const nameColumnIndex = renderedColumns.findIndex((column) => column.classList.contains("col-name"));')
    && bootstrap.includes('if (columnIndex === nameColumnIndex) {')
    && bootstrap.includes('nameCell.className = "playerNameCell";')
    && bootstrap.includes('cell.appendChild(nameCell);'),
  "The synchronous bootstrap must render all blank loading rows with final loaded-row player-name geometry before first paint.",
);

invariant(
  !runtime.includes("normalizeLoadingRowGeometry")
    && !runtime.includes("loadingNameColumnIndex"),
  "The loading runtime must not repair row geometry after first paint; bootstrap owns it synchronously.",
);

invariant(
  bootstrap.includes("const opacities = [0.82, 0.62, 0.44, 0.27, 0.13];")
    && bootstrap.includes('row.className = "mflTableLoadingRow";'),
  "Table loading must continue rendering exactly five blank rows.",
);

invariant(
  stylesBase.includes("#tableBody .playerNameCell {\n  min-height: 38px;\n  align-items: center;\n}"),
  "Loaded rows and first-paint blank rows must share the same player-name geometry.",
);

console.log("All table-backed routes keep canonical loading rows through the active request and release normal rendering only after fresh payload state is applied.");
