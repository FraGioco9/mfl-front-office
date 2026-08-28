import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [index, bootstrap, controls, sharedTableUi, staticUi, dropdownRuntime, buildNormalizer, appCore, tableSplitter, coreRuntime, tableRuntime] = await Promise.all([
  read("./index.html"),
  read("./bootstrap.js"),
  read("./controls.css"),
  read("./shared-table-ui-runtime.js"),
  read("./static-ui-runtime.js"),
  read("./dropdowns-runtime.js"),
  read("./modules/app-core-build-normalizer.js"),
  read("./modules/app-core.js"),
  read("./modules/app-core-table-chunk.js"),
  read("./modules/app-core-runtime.js"),
  read("./modules/app-core-table-runtime.js"),
]);

for (const required of [
  ".filtersDialog [data-filter-value],\n.filtersDialog select,",
  ".filtersDialog [data-filter-value]:not(:disabled),\n.filtersDialog select:not(:disabled) {\n  cursor: pointer;",
  ".filtersDialog select:hover:not(:disabled)",
  ".filtersDialog select:focus:not(:disabled)",
]) {
  invariant(controls.includes(required), `Filter popup controls are missing canonical hover ownership through ${required}`);
}

for (const required of [
  'id="openSearchButton" class="searchButton"',
  '<svg class="searchIcon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="M15.5 15.5 20 20"></path></svg>',
  'id="openFiltersButton" class="filtersViewButton"',
  '<svg class="filtersViewIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"></path></svg>',
  '<span class="filtersViewLabel">Filters</span>',
  '<span id="filterSummary" class="filtersViewCount">0</span>',
  'id="viewControlsSeparator" class="viewControlsSeparator"',
]) {
  invariant(index.includes(required), `Search and Filters must exist in final structural first-paint markup through ${required}`);
}

for (const removedLegacyMarkup of [
  'id="openFiltersButton" class="compactButton"',
  'id="filterSummary">0 active',
]) {
  invariant(!index.includes(removedLegacyMarkup), `Legacy Filters markup must be removed completely: ${removedLegacyMarkup}`);
}

invariant(
  bootstrap.includes('if (filterSummary instanceof HTMLElement) filterSummary.textContent = "0";')
    && !bootstrap.includes('filterSummary.textContent = "0 active"'),
  "Bootstrap must render the count-only Filters summary directly, without an intermediate legacy label.",
);

for (const required of [
  ".searchButton .searchIcon",
  ".filtersViewButton",
  "width: 116px;",
  "height: 40px;",
  "font-weight: 700;",
  ".filtersViewIcon",
  ".filtersViewLabel",
  "#filterSummary.filtersViewCount",
  "flex: 0 0 18px;",
  "width: 18px;",
  "min-width: 18px;",
  "max-width: 18px;",
  "overflow: hidden;",
  "body.filtersOpen .filtersViewButton",
  ".viewControlsSeparator",
  "#progressionPage .views > #openFiltersButton",
  'body[data-page="club"] #progressionPage .filtersViewButton',
]) {
  invariant(controls.includes(required), `Search and structural Filters chrome is missing canonical ownership through ${required}`);
}

for (const removedFallback of [
  "#openFiltersButton:not(.filtersViewButton)",
  "#filterSummary:not(.filtersViewCount)",
  "anchor-name: --mfl-table-views",
  "position-anchor: --mfl-table-views",
  ":has(#openFiltersButton:not(.filtersViewButton))",
  "width: 140px;",
]) {
  invariant(!controls.includes(removedFallback), `Legacy first-paint Filters fallback or oversized control must be removed: ${removedFallback}`);
}

invariant(
  controls.includes(".filtersViewLabel {\n  display: inline-flex;\n  align-items: center;\n  align-self: center;\n  height: 40px;")
    && controls.includes("#filterSummary.filtersViewCount {\n  display: inline-grid;\n  flex: 0 0 18px;\n  place-items: center;\n  align-self: stretch;")
    && controls.includes("min-height: 0;\n  height: auto;\n  margin-left: auto;"),
  "Filters icon, label, and count must remain vertically centered in the 40px control while the count stretches to the control height.",
);
invariant(
  !controls.includes("body.filtersOpen #filterSummary.filtersViewCount"),
  "Opening Filters must highlight only the button, not the active-filter count.",
);

for (const required of [
  'const FILTERED_TABLE_PAGES = new Set(["database", "mfl", "progression", "watchlist", "agents", "myplayers"]);',
  "function markInitialTableFiltersForReset() {",
  "document.documentElement.dataset.mflResetTableFilters = page;",
  "function activeFilterCountFromDialog() {",
  "function syncFilterSummaryNow() {",
  "const count = activeFilterCountFromDialog();",
  'const canonicalUpdater = Reflect.get(window, "updateFilterSummary");',
  'if (typeof canonicalUpdater === "function") {',
  "canonicalUpdater(count);",
  "summary instanceof HTMLElement) summary.textContent = String(count);",
  "function syncFilterSummaryAfterClose() {",
  'target?.closest("#applyFiltersButton")',
  "filtersModalIsOpen()",
]) {
  invariant(sharedTableUi.includes(required), `Shared table UI must preserve Filters reset/count ownership through ${required}`);
}

for (const removedMigrationOrRepair of [
  "createFiltersIcon",
  "syncFiltersViewControl",
  'button.classList.add("filtersViewButton")',
  "views.insertBefore(button",
  "views.insertBefore(separator",
  "SVG_NAMESPACE",
  "installPrimeTableChromeBridge",
  "primeTableChromeWithCountOnlySummary",
  "wrappedPrimeTableChrome",
  "originalPrimeTableChrome",
]) {
  invariant(!sharedTableUi.includes(removedMigrationOrRepair), `Filters runtime migration/repair must be removed completely: ${removedMigrationOrRepair}`);
}

for (const required of [
  "const resetFilters = pageChanged && FILTERED_TABLE_PAGES.has(state.page);",
  "document.documentElement.dataset.mflResetTableFilters = state.page;",
]) {
  invariant(staticUi.includes(required), `Page transitions must discard table filters through ${required}`);
}

for (const required of [
  'const storedPageState = pageName !== "club" && !clubTarget && tablePages.has(pageName)',
  "const resetFilters = document.documentElement.dataset.mflResetTableFilters === pageName;",
  "? tableStateWithoutPageFilters(pageName, storedPageState)",
  "if (resetFilters && savedPageState) state.tablePageStates[pageName] = savedPageState;",
  "if (pageName === activePageName && tablePages.has(pageName)) {",
  "saveTableStateLocally(currentTableState());",
]) {
  invariant(appCore.includes(required), `Canonical source must preserve direct Filters transition ownership through ${required}`);
}

for (const required of [
  'function updateFilterSummary(count = activeFilterCount()) {\n  filterSummary.textContent = String(count);\n}',
  'state.filterDraftRules = null;\n  document.body.classList.remove("filtersOpen");\n  hideModal(filtersModal, () => {\n    openFiltersButton.focus();',
]) {
  invariant(appCore.includes(required), `Canonical source must preserve Filters summary/close ownership through ${required}`);
}
const clearFiltersHandler = 'clearFiltersButton.addEventListener("click", () => {\n  clearAdvancedFilters(false);\n  applyAdvancedFilters();\n});';
invariant(
  appCore.includes(clearFiltersHandler),
  "Clear Filters must apply the cleared draft and close the popup through the canonical Apply owner.",
);
invariant(
  coreRuntime.includes(clearFiltersHandler),
  "Generated application core must preserve Clear Filters apply-and-close behavior.",
);

for (const required of [
  'const preserveOpenFilterDraft = document.body.classList.contains("filtersOpen") && !filtersModal.hidden;',
  "if (!preserveOpenFilterDraft) {\n    const allowedColumns = new Set(availableFilterColumns(pageName));\n    filterRules.replaceChildren();",
]) {
  invariant(appCore.includes(required), `Canonical Filters restore must preserve an open popup draft through ${required}`);
  invariant(tableRuntime.includes(required), `Built Table runtime must preserve an open popup draft through ${required}`);
}

invariant(
  appCore.includes('if (filterSummary) filterSummary.textContent = "0";')
    && !appCore.includes('if (filterSummary) filterSummary.textContent = "0 active";'),
  "Canonical Club filter-free rendering must emit the count-only zero summary directly.",
);
for (const required of [
  "return watchlistArtifacts;",
]) {
  invariant(buildNormalizer.includes(required), `Build normalization must preserve independent stats/Table composition through ${required}`);
}
invariant(
  !buildNormalizer.includes("normalizeClubStartupLifecycle")
    && !buildNormalizer.includes("clubStartupArtifacts")
    && !buildNormalizer.includes("normalizeEvaluationSavedValuationCache")
    && !buildNormalizer.includes("normalizeEvaluationLoadLifecycle")
    && !buildNormalizer.includes("evaluationLoadArtifacts")
    && !buildNormalizer.includes("normalizeEvaluationRecentReadiness")
    && !buildNormalizer.includes("evaluationRecentArtifacts")
    && !buildNormalizer.includes("normalizeFilterSummaryLifecycle")
    && !buildNormalizer.includes("filterSummaryArtifacts")
    && !buildNormalizer.includes("normalizePageFilterResetBeforeRequest")
    && !buildNormalizer.includes("normalizeViewFilterStateBeforeTransition")
    && !buildNormalizer.includes("pageFilterResetArtifacts")
    && !buildNormalizer.includes("viewFilterStateArtifacts")
    && !buildNormalizer.includes("normalizePagerCurrentPageLifecycle")
    && !buildNormalizer.includes("pagerCurrentPageArtifacts")
    && !buildNormalizer.includes("normalizeTableControlCellAlignment")
    && !buildNormalizer.includes("tableControlCellArtifacts")
    && !buildNormalizer.includes("normalizeHomeSummaryLifecycle")
    && !buildNormalizer.includes("homeSummaryArtifacts")
    && !buildNormalizer.includes("normalizeGlobalSearchOpenLifecycle")
    && !buildNormalizer.includes("globalSearchArtifacts"),
  "Build normalization must not reintroduce Evaluation recent-readiness, Filters summary/close, page/view transition, editable-pager, or Table control-cell rewrites.",
);

for (const required of [
  'const FILTER_CONTROL_SELECTOR = "input, select, textarea, button, [tabindex]";',
  "function filterControlForTarget(target) {",
  "active.matches(FILTER_CONTROL_SELECTOR)",
  "function filterSelectForTarget(target) {",
  "function blurFilterSelectWhenClosed(target) {",
  "!select.isConnected || isSelectOpen(select)",
  "!isSelectOpen(select) && document.activeElement === select",
  "function handleFilterControlEscape(event) {",
  'document.querySelector(".siteDatePicker")',
  "control.blur();",
  'window.__mflControlInteractionsRuntime?.registerEscapeHandler?.(',
  '"filter-controls",',
  "handleFilterControlEscape,",
  "{ priority: 300 },",
  'document.addEventListener("pointerup", (event) => {',
  'document.addEventListener("change", (event) => {\n    blurFilterSelectWhenClosed(event.target);\n  });',
  '["Enter", "Escape", "Tab"].includes(event.key)',
  'document.addEventListener("click", (event) => {\n    const target = event.target instanceof Element ? event.target : null;\n    if (!target) return;\n\n    blurFilterSelectWhenClosed(target);',
]) {
  invariant(dropdownRuntime.includes(required), `Filter controls are missing capture-phase Escape ownership through ${required}`);
}
invariant(
  !dropdownRuntime.includes("function handleDropdownEscape()")
    && !dropdownRuntime.includes('document.addEventListener("keyup", (event) => {\\n    if (event.key !== "Escape") return;'),
  "Filters Escape must use the global capture owner, not native select :open detection or keyup fallback.",
);

for (const required of [
  '"function closeFilters(commitChanges = false, restoreTriggerFocus = true) {"',
  "if (restoreTriggerFocus) openFiltersButton.focus();",
]) {
  invariant(tableSplitter.includes(required), `Canonical table splitting is missing Filters close focus ownership through ${required}`);
}

invariant(
  coreRuntime.includes('event.key === "Escape" && !filtersModal.hidden) {\n    event.preventDefault();\n    if (document.activeElement instanceof HTMLElement && filtersModal.contains(document.activeElement)) document.activeElement.blur();'),
  "Built application core must keep Filters open on Escape and blur the active control.",
);
invariant(
  tableRuntime.includes("function tableCloseFiltersOwner(commitChanges = false, restoreTriggerFocus = true)"),
  "Built Table runtime must expose explicit trigger-focus ownership on filter close.",
);
invariant(
  tableRuntime.includes('state.filterDraftRules = null;\n  document.body.classList.remove("filtersOpen");\n  hideModal(filtersModal, () => {\n    if (restoreTriggerFocus) openFiltersButton.focus();'),
  "Built Table runtime must clear Filters highlight synchronously when popup close starts.",
);
invariant(
  tableRuntime.includes("function updateFilterSummary(count = activeFilterCount()) {")
    && tableRuntime.includes('filterSummary.textContent = String(normalizedCount);'),
  "Built Table runtime must keep the Filters summary numeric-only while allowing active-state presentation to share the canonical count update.",
);
invariant(
  !tableRuntime.includes('filterSummary.textContent = `${count} active`;')
    && !tableRuntime.includes('filterSummary.textContent = "0 active";'),
  "Built Table runtime must not retain the legacy active-count label.",
);
invariant(
  !dropdownRuntime.includes('document.getElementById("openFiltersButton")'),
  "Dropdown runtime must not directly own or repair Filters trigger focus after close.",
);

for (const removedWorkaround of [
  "filtersEscapeClosePending",
  "armFiltersEscapeClose",
  "clearFiltersTriggerFocusAfterEscapeClose",
  "observeFiltersEscapeClose",
  "suppressFiltersButtonFocusAfterEscape",
  "filtersEscapeFocusResetTimer",
]) {
  invariant(!dropdownRuntime.includes(removedWorkaround), `Filters ESC focus must not be patched after close through ${removedWorkaround}`);
}

invariant(
  !dropdownRuntime.includes("function blurFilterSelectAfterCommit(target)"),
  "Filter dropdown focus clearing must not depend only on value-change commits.",
);
invariant(
  !dropdownRuntime.includes("queueMicrotask(() => {\n      if (target.isConnected && document.activeElement === target) target.blur();"),
  "Filter dropdown blur must not run before the native picker close finishes.",
);
invariant(!controls.includes("!important"), "Filter popup interactions must not introduce CSS priority overrides.");
invariant(!sharedTableUi.includes('document.createElement("style")'), "Filters behavior must not inject runtime styles.");
invariant(!dropdownRuntime.includes('document.createElement("style")'), "Filter dropdown behavior must not inject runtime styles.");

console.log("Direct count-only Filters, request-time page reset, view-state preservation, immediate close highlight, view-sized control, and capture-phase all-filter-box ESC focus validation passed.");

invariant(
  !appCore.includes('event.key === "Escape" && !filtersModal.hidden) {\n    closeFilters();')
    && appCore.includes('filtersModal.contains(document.activeElement)) document.activeElement.blur();'),
  "Escape must blur the active Filters control without closing the popup.",
);
