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
  "function beginRequest(routeScope) {",
  'const scope = String(routeScope || "").toLowerCase();',
  "!TABLE_ROUTE_SCOPES.has(scope)",
  "return primeLoadingRows() && body.dataset.staticLoading === \"true\";",
  "Object.freeze({ beginRequest, show, release, sync, installCoreBridge, destroy })",
  'if (body.dataset.staticLoading === "true" && realRowsPresent) return false;',
]) {
  invariant(runtime.includes(required), `Request-bound table loading ownership is missing ${required}`);
}
invariant(
  !runtime.includes("!loadingSnapshot().dataLoading")
    && !runtime.includes("destroyed || !tableRouteActive() || !loadingSnapshot().dataLoading"),
  "An explicit table request must not depend on the previous DOM route or global data-loading flag before resetting stale rows.",
);

const requestBoundaryMarker = 'window.__mflTableLoadingRuntime?.beginRequest?.(route.scope);';
invariant(
  buildNormalizer.includes("function normalizeTableRequestLoadingBoundary(artifacts) {")
    && buildNormalizer.includes(requestBoundaryMarker)
    && !buildNormalizer.includes('window.__mflTableLoadingRuntime?.beginRequest?.();')
    && buildNormalizer.includes("const tableRequestLoadingArtifacts = normalizeTableRequestLoadingBoundary(viewFilterStateArtifacts);")
    && buildNormalizer.includes("const filterSummaryArtifacts = normalizeFilterSummaryLifecycle(tableRequestLoadingArtifacts);"),
  "The build must pass every uncached request scope to the canonical table-loading boundary.",
);

const generatedBoundaryIndex = generatedCore.indexOf(requestBoundaryMarker);
const generatedPromiseIndex = generatedCore.indexOf("let requestPromise = force ? null : state.incrementalRequestPromises.get(cacheKey);");
invariant(
  generatedBoundaryIndex >= 0 && generatedPromiseIndex > generatedBoundaryIndex,
  "Generated shared core must pass the destination route scope before an uncached request is acquired.",
);

invariant(
  !tableRuntime.includes('document.documentElement.classList.contains("mflDataLoading") && !state.incrementalApplying')
    && !tableRuntime.includes("commitFinalRender"),
  "Normal and final table rendering must stay untouched; loading ownership belongs to request start, not render gating.",
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

console.log("All table-backed routes reset stale or empty content at the uncached request boundary without gating final row rendering.");
