import { invariant } from "./validation/assertions.mjs";
import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");

const [loadingRuntime, bootstrap, sharedCore, tableSource, tableRuntime, sharedTableUi, projectionSource] = await Promise.all([
  read("./table-loading-runtime.js"),
  read("./bootstrap.js"),
  read("./modules/core-sources/shared.js"),
  read("./modules/core-sources/table.js"),
  read("./modules/app-core-table-runtime.js"),
  read("./shared-table-ui-runtime.js"),
  read("./sync-release-projections.mjs"),
]);
const canonical = `${sharedCore}\n${tableSource}`;

const neutralizeStart = loadingRuntime.indexOf("function neutralizeSelectionHeader() {");
const neutralizeEnd = loadingRuntime.indexOf("function primeLoadingRows()", neutralizeStart);
const neutralizeSource = loadingRuntime.slice(neutralizeStart, neutralizeEnd);
invariant(
  neutralizeStart >= 0
    && neutralizeEnd > neutralizeStart
    && neutralizeSource.includes("input.checked = false;")
    && neutralizeSource.includes("input.indeterminate = false;")
    && neutralizeSource.includes("input.disabled = true;"),
  "The table-loading owner must keep the header selection checkbox neutral and disabled while loading.",
);

const beginStart = loadingRuntime.indexOf("function beginRequest(routeScope, options = {}) {");
const beginEnd = loadingRuntime.indexOf("function hydrateInitialClubHeader()", beginStart);
const beginSource = loadingRuntime.slice(beginStart, beginEnd);
invariant(
  beginStart >= 0
    && beginEnd > beginStart
    && beginSource.includes("hidePager();\n    neutralizeSelectionHeader();")
    && beginSource.indexOf("neutralizeSelectionHeader();") < beginSource.indexOf("const preserveRenderedRows ="),
  "Every explicit table request must disable header selection before deciding whether rendered rows can be preserved.",
);

const syncStart = loadingRuntime.indexOf("function sync(snapshot = loadingSnapshot()) {");
const syncEnd = loadingRuntime.indexOf("function installCoreBridge()", syncStart);
const syncSource = loadingRuntime.slice(syncStart, syncEnd);
invariant(
  syncStart >= 0
    && syncEnd > syncStart
    && syncSource.includes("const renderedRowsPresent = syncRenderedRows();")
    && syncSource.includes("neutralizeSelectionHeader();")
    && syncSource.includes("if (renderedRowsPresent) {\n        hidePlayerCount();\n        return;\n      }")
    && syncSource.includes("hidePager();")
    && syncSource.indexOf("neutralizeSelectionHeader();") < syncSource.indexOf("if (renderedRowsPresent)")
    && syncSource.indexOf("if (renderedRowsPresent)") < syncSource.indexOf("shouldPreserveRenderedRows()"),
  "Controller-driven table loading must keep header selection neutral while stopping the loading surface immediately when real rows render.",
);

const restoreStart = loadingRuntime.indexOf("function restoreSelectionHeader() {");
const restoreEnd = loadingRuntime.indexOf("function primeLoadingRows()", restoreStart);
const restoreSource = loadingRuntime.slice(restoreStart, restoreEnd);
invariant(
  restoreStart >= 0
    && restoreEnd > restoreStart
    && restoreSource.includes("coreContracts()?.syncTableSelectionHeader")
    && restoreSource.includes("syncSelectionHeader();"),
  "Loading completion must restore header selection through the canonical Table selection owner.",
);

const finishStart = loadingRuntime.indexOf("function finishRequest(token) {");
const finishEnd = loadingRuntime.indexOf("function show(", finishStart);
const finishSource = loadingRuntime.slice(finishStart, finishEnd);
invariant(
  finishStart >= 0
    && finishEnd > finishStart
    && finishSource.includes("activeRequestToken = 0;\n    hydrateInitialClubHeader();\n    sync();"),
  "Finishing the last explicit table request must immediately resynchronize loading/header state even when no later controller snapshot fires.",
);

const releaseStart = loadingRuntime.indexOf("function release() {");
const releaseEnd = loadingRuntime.indexOf("function sync(snapshot", releaseStart);
const releaseSource = loadingRuntime.slice(releaseStart, releaseEnd);
invariant(
  releaseStart >= 0
    && releaseEnd > releaseStart
    && releaseSource.includes("if (!snapshot.dataLoading) {")
    && releaseSource.includes("restoreSelectionHeader();")
    && releaseSource.indexOf("restoreSelectionHeader();") < releaseSource.indexOf("page.hidden = !pagerRouteActive()"),
  "Loaded table release must recompute header selection state before exposing settled table chrome.",
);

invariant(
  sharedCore.includes("let __mflTableUpdateSelectionHeaderOwner = null;")
    && sharedCore.includes("function syncTableSelectionHeader() {")
    && sharedCore.includes("__mflTableUpdateSelectionHeaderOwner.apply(this, arguments)")
    && sharedCore.includes("ensureCanonicalTableHeader,\n    syncTableSelectionHeader,"),
  "Shared core must expose selection-header synchronization only through the lazy Table owner bridge.",
);
invariant(
  tableSource.includes("__mflTableUpdateSelectionHeaderOwner = updateSelectionHeader;")
    && tableRuntime.includes("__mflTableUpdateSelectionHeaderOwner = updateSelectionHeader;"),
  "Canonical and generated Table runtimes must bind header restoration to updateSelectionHeader.",
);

invariant(
  bootstrap.includes("function neutralizeFirstPaintSelectionHeader(head) {")
    && bootstrap.includes("input.disabled = true;")
    && bootstrap.includes('selectionInput.id = "selectVisiblePlayersInput";')
    && bootstrap.includes("selectionInput.disabled = true;"),
  "First-paint table headers must expose the selection checkbox as disabled before runtime loading ownership begins.",
);

invariant(
  tableSource.includes('selectVisibleInput.type = "checkbox";\n  selectVisibleInput.disabled = true;')
    && tableRuntime.includes('selectVisibleInput.type = "checkbox";\n  selectVisibleInput.disabled = true;'),
  "Every hydrated table-header rebuild must begin with the selection checkbox disabled so it cannot flash selectable before data readiness.",
);

invariant(
  sharedTableUi.includes("#progressionPage #tableHead .selectionCell input:disabled {")
    && sharedTableUi.includes("opacity: 0.45;")
    && projectionSource.includes("#tableHead .selectionCell input:disabled { opacity: 0.45; }"),
  "First paint and hydration must give the disabled header checkbox the same visibly inactive appearance.",
);

for (const source of [canonical, tableRuntime]) {
  invariant(
    source.includes("function updateSelectionHeader(pageRows = currentPageRows(), { rendered = false } = {}) {")
      && source.includes('if (document.documentElement.classList.contains("mflDataLoading") && !rendered) {')
      && source.includes("selectVisibleInput.disabled = true;")
      && source.includes("selectVisibleInput.disabled = visibleIds.length === 0;")
      && source.includes("function updateSelectionBar(pageRows = currentPageRows(), options = {}) {")
      && source.includes("updateSelectionHeader(pageRows, options);")
      && source.includes("updateSelectionBar(pageRows, { rendered: true });")
      && source.indexOf("tableBody.replaceChildren(fragment);") < source.indexOf("updateSelectionBar(pageRows, { rendered: true });"),
    "Canonical table selection state must stay disabled for preserved loading rows and restore immediately when current rows are committed.",
  );
}

const tableBanner = "// Generated Table core from modules/core-sources/table.js. Do not edit directly.\n";
invariant(tableRuntime.startsWith(tableBanner), "Generated Table runtime must retain its canonical banner.");
invariant(
  tableRuntime.slice(tableBanner.length).replace(/\s*$/, "") === tableSource.replace(/\s*$/, ""),
  "Generated Table runtime must exactly match canonical table.js.",
);

console.log("Source-owned header selection loading lifecycle validation passed with pager visibility tied to real rendered rows.");
