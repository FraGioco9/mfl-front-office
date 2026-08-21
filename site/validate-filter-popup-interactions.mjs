import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [controls, sharedTableUi, dropdownRuntime, tableSplitter, coreRuntime, tableRuntime] = await Promise.all([
  read("./controls.css"),
  read("./shared-table-ui-runtime.js"),
  read("./dropdowns-runtime.js"),
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
  ".searchButton .searchEmoji",
  "#progressionPage > .views {\n  anchor-name: --mfl-table-views;",
  "#progressionPage:has(#openFiltersButton:not(.filtersViewButton)) > .views::before",
  "flex: 0 0 153px;",
  "margin-right: 4px;",
  "#openFiltersButton:not(.filtersViewButton)",
  "position-anchor: --mfl-table-views;",
  "#filterSummary:not(.filtersViewCount)",
  ".filtersViewButton",
  ".filtersViewIcon",
  "#filterSummary.filtersViewCount",
  "body.filtersOpen .filtersViewButton",
  ".viewControlsSeparator",
  "#quickClearFiltersButton",
  "#progressionPage .views > #openFiltersButton",
  'body[data-page="club"] #progressionPage .filtersViewButton',
]) {
  invariant(controls.includes(required), `Search and Filters chrome is missing canonical shared-control ownership through ${required}`);
}

invariant(
  controls.includes("#filterSummary:not(.filtersViewCount) {\n  position: absolute;")
    && controls.includes("height: 40px;\n  padding: 0;\n  border-radius: 0;\n  background: transparent;"),
  "First-paint active-filter text must be vertically centered without badge chrome.",
);
invariant(
  controls.includes("#filterSummary.filtersViewCount {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  align-self: stretch;")
    && controls.includes("margin-left: auto;\n  padding: 0;\n  border-radius: 0;\n  background: transparent;"),
  "Loaded active-filter text must remain vertically centered and unboxed inside Filters.",
);
invariant(
  !controls.includes("body.filtersOpen #filterSummary.filtersViewCount"),
  "Opening Filters must highlight only the button, not the active-filter text.",
);

for (const required of [
  'button.classList.add("filtersViewButton");',
  'svg.classList.add("filtersViewIcon");',
  'svg.setAttribute("viewBox", "0 0 24 24");',
  'path.setAttribute("d", "M4 6h16M7 12h10M10 18h4");',
  'summary.classList.add("filtersViewCount");',
  "button.append(summary);",
  "quickClear.hidden = true;",
  'separator.className = "viewControlsSeparator";',
  'views.insertBefore(button, firstViewButton);',
  'views.insertBefore(separator, firstViewButton);',
  "function activeFilterCountFromDialog() {",
  "function syncFilterSummaryNow() {",
  'summary.textContent = `${activeFilterCountFromDialog()} active`; ',
  "function syncFilterSummaryAfterClose() {",
  'target?.closest("#applyFiltersButton")',
  "syncFilterSummaryNow();",
  "filtersModalIsOpen()",
]) {
  invariant(sharedTableUi.includes(required.trimEnd()), `Shared table UI must preserve immediate Filters chrome through ${required}`);
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
invariant(!sharedTableUi.includes('document.createElement("style")'), "Filters view placement must not inject runtime styles.");
invariant(!dropdownRuntime.includes('document.createElement("style")'), "Filter dropdown behavior must not inject runtime styles.");

console.log("Search, first-paint Filters alignment, flat active count, immediate close sync, popup highlight, close-state blur, and canonical neutral ESC focus validation passed.");
