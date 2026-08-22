import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [runtime, bootstrap, stylesBase, appCoreSource, buildNormalizer, tableRuntime] = await Promise.all([
  read("./table-loading-runtime.js"),
  read("./bootstrap.js"),
  read("./styles-base.css"),
  read("./modules/app-core.js"),
  read("./modules/app-core-build-normalizer.js"),
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
  "let dataLoadingActive = false;",
  "let finalRenderCommitted = false;",
  'if (finalRenderCommitted && loadingSnapshot().dataLoading) return false;',
  'if (body.dataset.staticLoading === "true" && realRowsPresent) {\n      if (!replaceExisting) return false;\n    }',
  'if ((body.dataset.staticLoading !== "true" || realRowsPresent) && !primeLoadingRows()) return false;',
  "function commitFinalRender() {",
  "const loadingStarted = snapshot.dataLoading && !dataLoadingActive;",
  "if (loadingStarted) finalRenderCommitted = false;",
  "if (!finalRenderCommitted) show({ replaceExisting: true });",
  "Object.freeze({ show, commitFinalRender, release, sync, installCoreBridge, destroy })",
]) {
  invariant(runtime.includes(required), `Table loading fresh-payload ownership is missing ${required}`);
}

const prePayloadRenderGate = 'if (document.documentElement.classList.contains("mflDataLoading") && !state.incrementalApplying) {';
for (const required of [
  "function normalizeTableLoadingRenderLifecycle(artifacts) {",
  prePayloadRenderGate,
  'window.__mflTableLoadingRuntime?.show?.({ replaceExisting: true });',
  'window.__mflTableLoadingRuntime?.commitFinalRender?.();',
  "const tableLoadingArtifacts = normalizeTableLoadingRenderLifecycle(filterSummaryArtifacts);",
  "const homeSummaryArtifacts = normalizeHomeSummaryLifecycle(tableLoadingArtifacts);",
]) {
  invariant(buildNormalizer.includes(required), `Build-time table loading lifecycle is missing ${required}`);
}

invariant(
  tableRuntime.includes(prePayloadRenderGate)
    && tableRuntime.includes('window.__mflTableLoadingRuntime?.show?.({ replaceExisting: true });\n    return;')
    && tableRuntime.includes('emptyState.hidden = pageRows.length > 0;\n  window.__mflTableLoadingRuntime?.commitFinalRender?.();'),
  "Generated table rendering must keep stale rows and premature empty state behind loading rows until the fresh payload render commits.",
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

console.log("Table loading keeps stale rows and premature empty state hidden until a fresh incremental payload render commits.");
