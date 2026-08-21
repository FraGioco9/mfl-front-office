import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [index, controls, sharedTableUi, staticUi, dropdownRuntime, buildNormalizer, tableSplitter, coreRuntime, tableRuntime] = await Promise.all([
  read("./index.html"),
  read("./controls.css"),
  read("./shared-table-ui-runtime.js"),
  read("./static-ui-runtime.js"),
  read("./dropdowns-runtime.js"),
  read("./modules/app-core-build-normalizer.js"),
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
  'id="openFiltersButton" class="filtersViewButton"',
  '<svg class="filtersViewIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"></path></svg>',
  '<span class="filtersViewLabel">Filters</span>',
  '<span id="filterSummary" class="filtersViewCount">0</span>',
  'id="viewControlsSeparator" class="viewControlsSeparator"',
]) {
  invariant(index.includes(required), `Filters must exist in final structural first-paint markup through ${required}`);
}

for (const removedLegacyMarkup of [
  'id="openFiltersButton" class="compactButton"',
  '&#128269; Filters',
  'id="filterSummary">0 active',
]) {
  invariant(!index.includes(removedLegacyMarkup), `Legacy Filters markup must be removed completely: ${removedLegacyMarkup}`);
}

for (const required of [
  ".searchButton .searchEmoji",
  ".filtersViewButton",
  ".filtersViewIcon",
  ".filtersViewLabel,\n#filterSummary.filtersViewCount",
  "align-items: center;",
  "align-self: center;",
  "height: 100%;",
  "#filterSummary.filtersViewCount",
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
]) {
  invariant(!controls.includes(removedFallback), `Legacy first-paint Filters fallback must be removed: ${removedFallback}`);
}

invariant(
  controls.includes("#filterSummary.filtersViewCount {\n  justify-content: center;\n  min-width: 24px;")
    && controls.includes(".filtersViewLabel,\n#filterSummary.filtersViewCount {\n  display: inline-flex;\n  align-items: center;\n  align-self: center;\n  height: 100%;"),
  "Filters icon, label, and count must remain vertically centered in the control.",
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
  "summary.textContent = String(activeFilterCountFromDialog());",
  "function syncFilterSummaryAfterClose() {",
  'target?.closest("#applyFiltersButton")',
  "filtersModalIsOpen()",
]) {
  invariant(sharedTableUi.includes(required), `Shared table UI must preserve Filters reset/count ownership through ${required}`);
}

for (const removedMigration of [
  "createFiltersIcon",
  "syncFiltersViewControl",
  'button.classList.add("filtersViewButton")',
  "views.insertBefore(button",
  "views.insertBefore(separator",
  "SVG_NAMESPACE",
]) {
  invariant(!sharedTableUi.includes(removedMigration), `Filters runtime migration must be removed completely: ${removedMigration}`);
}

for (const required of [
  "const resetFilters = pageChanged && FILTERED_TABLE_PAGES.has(state.page);",
  "document.documentElement.dataset.mflResetTableFilters = state.page;",
]) {
  invariant(staticUi.includes(required), `Page transitions must discard table filters through ${required}`);
}

for (const required of [
  "function normalizeFilterSummaryLifecycle(artifacts) {",
  'filterSummary.textContent = String(count);',
  'if (filterSummary) filterSummary.textContent = "0";',
  "const filterSummaryArtifacts = normalizeFilterSummaryLifecycle(tableArtifacts);",
]) {
  invariant(buildNormalizer.includes(required), `Build normalization must preserve count-only Filters summaries through ${required}`);
}

for (const required of [
  "function filterSelectForTarget(target) {",
  "document.activeElement instanceof HTMLSelectElement",
  "function blurFilterSelectWhenClosed(target) {",
  "!select.isConnected || isSelectOpen(select)",
  "!isSelectOpen(select) && document.activeElement === select",
  'document.addEventListener("pointerup", (event) => {',
  'document.addEventListener("change", (event) => {\n    blurFilterSelectWhenClosed(event.target);\n  });',
  '["Enter", "Escape", "Tab"].includes(event.key)',
  'document.addEventListener("click", (event) => {\n    const target = event.target instanceof Element ? event.target : null;\n    if (!target) return;\n\n    blurFilterSelectWhenClosed(target);',
]) {
  invariant(dropdownRuntime.includes(required), `Filter dropdowns are missing close-state blur ownership through ${required}`);
}

for (const required of [
  '"function closeFilters(commitChanges = false, restoreTriggerFocus = true) {"',
  "if (restoreTriggerFocus) openFiltersButton.focus();",
  "closeFilters(false, false);",
]) {
  invariant(tableSplitter.includes(required), `Canonical table splitting is missing Filters ESC focus ownership through ${required}`);
}

invariant(
  coreRuntime.includes('event.key === "Escape" && !filtersModal.hidden) {\n    closeFilters(false, false);'),
  "Built application core must close Filters on Escape without restoring trigger focus.",
);
invariant(
  tableRuntime.includes("function tableCloseFiltersOwner(commitChanges = false, restoreTriggerFocus = true)"),
  "Built Table runtime must expose explicit trigger-focus ownership on filter close.",
);
invariant(
  tableRuntime.includes("if (restoreTriggerFocus) openFiltersButton.focus();"),
  "Built Table runtime must only focus the Filters trigger when explicitly requested.",
);
invariant(
  tableRuntime.includes("function updateFilterSummary(count = activeFilterCount()) {\n  filterSummary.textContent = String(count);\n}"),
  "Built Table runtime must render only the active-filter count.",
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

console.log("Structural first-paint Filters, count-only summary, refresh/page reset, vertical centering, popup highlight, and neutral ESC focus validation passed.");
