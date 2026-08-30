import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [loadingRuntime, bootstrap, coreSource, tableRuntime, mobileTableSource, sharedTableUi, projectionSource] = await Promise.all([
  read("./table-loading-runtime.js"),
  read("./bootstrap.js"),
  read("./modules/app-core.js"),
  read("./modules/app-core-table-runtime.js"),
  read("./modules/app-core-mobile-table.js"),
  read("./shared-table-ui-runtime.js"),
  read("./sync-release-projections.mjs"),
]);

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
    && syncSource.includes("hidePager();\n      neutralizeSelectionHeader();")
    && syncSource.indexOf("neutralizeSelectionHeader();") < syncSource.indexOf("shouldPreserveRenderedRows()"),
  "Controller-driven table loading must disable header selection even when existing rows remain rendered.",
);

invariant(
  bootstrap.includes("function neutralizeFirstPaintSelectionHeader(head) {")
    && bootstrap.includes("input.disabled = true;")
    && bootstrap.includes('selectionInput.id = "selectVisiblePlayersInput";')
    && bootstrap.includes("selectionInput.disabled = true;"),
  "First-paint table headers must expose the selection checkbox as disabled before runtime loading ownership begins.",
);

invariant(
  mobileTableSource.includes('selectVisibleInput.type = "checkbox";\n  selectVisibleInput.disabled = true;')
    && tableRuntime.includes('selectVisibleInput.type = "checkbox";\n  selectVisibleInput.disabled = true;'),
  "Every hydrated table-header rebuild must begin with the selection checkbox disabled so it cannot flash selectable before data readiness.",
);

invariant(
  sharedTableUi.includes("#progressionPage #tableHead .selectionCell input:disabled {")
    && sharedTableUi.includes("opacity: 0.45;")
    && projectionSource.includes("#tableHead .selectionCell input:disabled { opacity: 0.45; }"),
  "First paint and hydration must give the disabled header checkbox the same visibly inactive appearance.",
);

for (const source of [coreSource, tableRuntime]) {
  invariant(
    source.includes('if (document.documentElement.classList.contains("mflDataLoading")) {')
      && source.includes("selectVisibleInput.disabled = true;")
      && source.includes("selectVisibleInput.disabled = visibleIds.length === 0;"),
    "Canonical table selection state must disable the header checkbox during loading and restore normal availability after loaded rows render.",
  );
}

console.log("Header selection loading lifecycle validation passed.");
