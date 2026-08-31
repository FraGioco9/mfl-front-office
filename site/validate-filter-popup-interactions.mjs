import { readFile } from "node:fs/promises";

import { readCanonicalCoreArtifacts } from "./validate-core-sources.mjs";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [index, bootstrap, controls, sharedTableUi, staticUi, dropdownRuntime, coreSource, coreRuntime, tableRuntime] = await Promise.all([
  read("./index.html"),
  read("./bootstrap.js"),
  read("./controls.css"),
  read("./shared-table-ui-runtime.js"),
  read("./static-ui-runtime.js"),
  read("./dropdowns-runtime.js"),
  Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./modules/app-core-runtime.js"),
  read("./modules/app-core-table-runtime.js"),
]);
const artifacts = readCanonicalCoreArtifacts(coreSource);
const sharedCore = String(artifacts.core || "");
const tableCore = String(artifacts.routeChunks?.table || "");
const canonicalRuntime = [sharedCore, ...Object.values(artifacts.routeChunks || {}).map(String)].join("\n");

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
  'id="openFiltersButton" class="filtersViewButton"',
  '<span class="filtersViewLabel">Filters</span>',
  '<span id="filterSummary" class="filtersViewCount">0</span>',
  'id="viewControlsSeparator" class="viewControlsSeparator"',
]) {
  invariant(index.includes(required), `Search and Filters must exist in structural first-paint markup through ${required}`);
}
invariant(!index.includes('id="openFiltersButton" class="compactButton"'), "Legacy compact Filters markup must stay removed.");
invariant(!index.includes('id="filterSummary">0 active'), "Legacy Filters active-count markup must stay removed.");
invariant(
  bootstrap.includes('if (filterSummary instanceof HTMLElement) filterSummary.textContent = "0";')
    && !bootstrap.includes('filterSummary.textContent = "0 active"'),
  "Bootstrap must render the count-only Filters summary directly.",
);

for (const required of [
  ".filtersViewButton",
  "width: 116px;",
  "height: 40px;",
  ".filtersViewIcon",
  ".filtersViewLabel",
  "#filterSummary.filtersViewCount",
  "body.filtersOpen .filtersViewButton",
  ".viewControlsSeparator",
  "#progressionPage .views > #openFiltersButton",
]) {
  invariant(controls.includes(required), `Structural Filters chrome is missing canonical CSS ownership through ${required}`);
}
for (const removedFallback of [
  "#openFiltersButton:not(.filtersViewButton)",
  "#filterSummary:not(.filtersViewCount)",
  "anchor-name: --mfl-table-views",
  "position-anchor: --mfl-table-views",
  "width: 140px;",
]) {
  invariant(!controls.includes(removedFallback), `Legacy Filters fallback must stay removed: ${removedFallback}`);
}

for (const required of [
  'const FILTERED_TABLE_PAGES = new Set(["database", "mfl", "progression", "watchlist", "agents", "myplayers"]);',
  "function markInitialTableFiltersForReset() {",
  "document.documentElement.dataset.mflResetTableFilters = page;",
  "function activeFilterCountFromDialog() {",
  "function syncFilterSummaryNow() {",
  "const count = activeFilterCountFromDialog();",
  'const canonicalUpdater = Reflect.get(window, "updateFilterSummary");',
  "canonicalUpdater(count);",
  "function syncFilterSummaryAfterClose() {",
  'target?.closest("#applyFiltersButton")',
]) {
  invariant(sharedTableUi.includes(required), `Shared table UI must preserve Filters reset/count ownership through ${required}`);
}
for (const removedMigration of [
  "createFiltersIcon",
  "syncFiltersViewControl",
  'button.classList.add("filtersViewButton")',
  "installPrimeTableChromeBridge",
  "primeTableChromeWithCountOnlySummary",
]) {
  invariant(!sharedTableUi.includes(removedMigration), `Filters DOM migration/repair must stay removed: ${removedMigration}`);
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
]) {
  invariant(canonicalRuntime.includes(required), `Canonical source must preserve Filters transition ownership through ${required}`);
}

for (const required of [
  "function updateFilterSummary(count = activeFilterCount()) {",
  "const normalizedCount = Number.isFinite(numericCount) ? Math.max(0, Math.trunc(numericCount)) : 0;",
  'filterSummary.textContent = String(normalizedCount);',
  "function closeFilters(commitChanges = false, restoreTriggerFocus = true) {",
  "if (restoreTriggerFocus) openFiltersButton.focus();",
]) {
  invariant(tableCore.includes(required), `Canonical Table source must own Filters behavior through ${required}`);
}

const clearFiltersHandler = 'clearFiltersButton.addEventListener("click", () => {\n  clearAdvancedFilters(false);\n  applyAdvancedFilters();\n});';
invariant(tableCore.includes(clearFiltersHandler), "Clear Filters must apply the cleared draft through the canonical Table owner.");
invariant(tableRuntime.includes(clearFiltersHandler), "Generated Table runtime must preserve Clear Filters apply behavior.");

for (const required of [
  'const preserveOpenFilterDraft = document.body.classList.contains("filtersOpen") && !filtersModal.hidden;',
  "if (!preserveOpenFilterDraft) {\n    const allowedColumns = new Set(availableFilterColumns(pageName));\n    filterRules.replaceChildren();",
]) {
  invariant(canonicalRuntime.includes(required), `Canonical Filters restore must preserve an open popup draft through ${required}`);
  invariant(tableRuntime.includes(required), `Generated Table runtime must preserve an open popup draft through ${required}`);
}

for (const required of [
  'const FILTER_CONTROL_SELECTOR = "input, select, textarea, button, [tabindex]";',
  "function filterControlForTarget(target) {",
  "function filterSelectForTarget(target) {",
  "function blurFilterSelectWhenClosed(target) {",
  "function handleFilterControlEscape(event) {",
  'window.__mflControlInteractionsRuntime?.registerEscapeHandler?.(',
  '"filter-controls",',
  "{ priority: 300 },",
  'document.addEventListener("pointerup", (event) => {',
  '["Enter", "Escape", "Tab"].includes(event.key)',
]) {
  invariant(dropdownRuntime.includes(required), `Filter controls are missing canonical Escape/focus ownership through ${required}`);
}
invariant(!dropdownRuntime.includes("function handleDropdownEscape()"), "Filters Escape must use the global capture owner.");

invariant(
  coreRuntime.includes('event.key === "Escape" && !filtersModal.hidden) {\n    event.preventDefault();\n    if (document.activeElement instanceof HTMLElement && filtersModal.contains(document.activeElement)) document.activeElement.blur();'),
  "Generated shared core must keep Filters open on Escape and blur the active control.",
);
invariant(
  tableRuntime.includes("function tableCloseFiltersOwner(commitChanges = false, restoreTriggerFocus = true)"),
  "Generated Table runtime must expose explicit trigger-focus ownership on filter close.",
);
invariant(
  tableRuntime.includes("function updateFilterSummary(count = activeFilterCount()) {")
    && tableRuntime.includes('filterSummary.textContent = String(normalizedCount);')
    && !tableRuntime.includes('filterSummary.textContent = `${count} active`;')
    && !tableRuntime.includes('filterSummary.textContent = "0 active";'),
  "Generated Table runtime must keep the Filters summary numeric-only.",
);

for (const retiredImplementation of [
  "app-core-build-normalizer",
  "app-core-table-chunk",
  "normalizeFilterSummaryLifecycle",
  "normalizePageFilterResetBeforeRequest",
  "normalizeViewFilterStateBeforeTransition",
]) {
  invariant(!canonicalRuntime.includes(retiredImplementation), `Canonical runtime must not depend on retired Filters build ownership: ${retiredImplementation}`);
}

invariant(!controls.includes("!important"), "Filter popup interactions must not introduce CSS priority overrides.");
invariant(!sharedTableUi.includes('document.createElement("style")'), "Filters behavior must not inject styles dynamically.");
new Function(sharedCore);
new Function(tableCore);

console.log("Source-owned Filters markup, styling, transition reset, popup focus/Escape behavior, draft preservation, and generated Table runtime validation passed.");
