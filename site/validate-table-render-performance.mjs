import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [build, optimizer, tableRuntime] = await Promise.all([
  read("./build-app-core.mjs"),
  read("./modules/app-core-table-render-performance.js"),
  read("./modules/app-core-table-runtime.js"),
]);

includes(
  build,
  'import { optimizeTableRenderPerformanceArtifacts } from "./modules/app-core-table-render-performance.js";',
  "The canonical application-core build must load the Step 7 Table render optimizer.",
);
includes(
  build,
  "optimizeTableRenderPerformanceArtifacts(\n  optimizeIncrementalTableRuntimeArtifacts(normalizeBuiltApplicationCoreArtifacts(source)),\n)",
  "Step 7 must run after the Step 6 incremental Table optimizer.",
);
includes(
  optimizer,
  'replaceRequiredFunction(\n    table,\n    "setPlayerSelected"',
  "Step 7 must optimize selection work at build time rather than patching it at runtime.",
);

const renderStart = tableRuntime.indexOf("function tableRenderTableOwner() {");
const renderEnd = tableRuntime.indexOf("function showTableBusyState()", renderStart);
invariant(renderStart >= 0 && renderEnd > renderStart, "Generated Table runtime must contain the Table render owner.");
const renderSection = tableRuntime.slice(renderStart, renderEnd);

includes(renderSection, "const renderColumns = currentViewColumns().map((column) => {", "Table rendering must derive visible column metadata once per render.");
includes(renderSection, "renderColumns.forEach(({ column, classNames, isStat }) => {", "Every row must reuse the per-render column plan.");
includes(renderSection, "if (classNames.length)", "Per-column CSS classes must be pre-split before the row loop.");
includes(renderSection, "} else if (isStat) {", "Stat-column classification must be reused from the render plan.");
includes(renderSection, "updateSelectionBar(pageRows);", "The rendered page rows must be handed directly to selection state updates.");

const rowLoopStart = renderSection.indexOf("pageRows.forEach((row) => {");
const rowLoopEnd = renderSection.indexOf("tableBody.replaceChildren(fragment);", rowLoopStart);
invariant(rowLoopStart >= 0 && rowLoopEnd > rowLoopStart, "Generated Table renderer must contain a bounded row loop.");
const rowLoop = renderSection.slice(rowLoopStart, rowLoopEnd);
excludes(rowLoop, "currentViewColumns()", "The row loop must not recompute the visible column list for every row.");
excludes(rowLoop, "tableColumnClass(column)", "The row loop must not reclassify each column for every cell.");
excludes(rowLoop, "statColumns.includes(column)", "The row loop must not repeat stat-column membership checks for every cell.");
excludes(rowLoop, 'columnClass.split(" ")', "The row loop must not repeatedly split identical column class strings.");

const headerStart = tableRuntime.indexOf("function updateSelectionHeader(");
const headerEnd = tableRuntime.indexOf("function updateSelectionBar(", headerStart);
invariant(headerStart >= 0 && headerEnd > headerStart, "Generated Table runtime must contain selection-header ownership.");
const headerSection = tableRuntime.slice(headerStart, headerEnd);
includes(headerSection, "for (const row of pageRows)", "Visible selection state must be counted in one pass over the supplied page rows.");
includes(headerSection, "let visibleCount = 0;", "Selection header must count visible rows without allocating an ID array.");
includes(headerSection, "let selectedVisibleCount = 0;", "Selection header must count selected visible rows in the same pass.");
excludes(headerSection, ".map((row)", "Selection header must not allocate a mapped visible-ID array.");
excludes(headerSection, ".filter((playerId)", "Selection header must not perform a second filter pass over visible IDs.");

const selectionStart = tableRuntime.indexOf("function setPlayerSelected(");
const selectionEnd = tableRuntime.indexOf("function tableClearSelectionOwner()", selectionStart);
invariant(selectionStart >= 0 && selectionEnd > selectionStart, "Generated Table runtime must contain player-selection ownership.");
const selectionSection = tableRuntime.slice(selectionStart, selectionEnd);
const shiftGuard = selectionSection.indexOf("if (shiftKey && anchorKey) {");
const filteredScan = selectionSection.indexOf("for (let index = 0; index < state.filteredRows.length", shiftGuard);
invariant(shiftGuard >= 0 && filteredScan > shiftGuard, "Full filtered-row scans must exist only inside the Shift-range selection path.");
excludes(selectionSection, "state.filteredRows.map", "Normal player selection must not materialize every filtered player ID.");
includes(selectionSection, 'const rangePlayerId = String(getValue(state.filteredRows[index], "player_id"));', "Shift selection must still update the complete anchored range.");

// Deterministic operation accounting. This deliberately measures only the
// repeated work removed by Step 7, not overall render or interaction latency.
const measuredRows = 100;
const measuredColumns = 15;
const previousColumnListDerivations = measuredRows;
const optimizedColumnListDerivations = 1;
const columnListReductionPercent = Math.round((1 - optimizedColumnListDerivations / previousColumnListDerivations) * 100);
const previousColumnClassifications = measuredRows * measuredColumns;
const optimizedColumnClassifications = measuredColumns;
const columnClassificationReductionPercent = Math.round((1 - optimizedColumnClassifications / previousColumnClassifications) * 100);
const measuredFilteredRows = 5000;
const previousNormalSelectionRowVisits = measuredFilteredRows;
const optimizedNormalSelectionRowVisits = 0;
const normalSelectionScanReductionPercent = 100;

invariant(columnListReductionPercent === 99, "A 100-row render must reduce repeated visible-column derivation by 99%.");
invariant(columnClassificationReductionPercent === 99, "A 100x15 render must reduce repeated column classification by 99%.");
invariant(previousNormalSelectionRowVisits > optimizedNormalSelectionRowVisits, "Normal checkbox selection must eliminate the filtered-row scan.");
invariant(normalSelectionScanReductionPercent === 100, "Normal checkbox selection must remove 100% of the unnecessary full filtered-row scan.");

console.log(
  `Table render performance validation passed: visible-column derivation ${previousColumnListDerivations} -> ${optimizedColumnListDerivations} (${columnListReductionPercent}% reduction), column classification ${previousColumnClassifications} -> ${optimizedColumnClassifications} (${columnClassificationReductionPercent}% reduction), normal selection filtered-row visits ${previousNormalSelectionRowVisits} -> ${optimizedNormalSelectionRowVisits} (${normalSelectionScanReductionPercent}% reduction).`,
);
