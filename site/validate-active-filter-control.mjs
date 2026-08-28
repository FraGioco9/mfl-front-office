import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [motion, styles, ownerSource, buildNormalizer, coreRuntime, tableRuntime, filterRuntime, sharedTableUi, controls] = await Promise.all([
  read("./motion.css"),
  read("./filter-controls.css"),
  read("./modules/app-core-filter-control-state.js"),
  read("./modules/app-core-build-normalizer.js"),
  read("./modules/app-core-runtime.js"),
  read("./modules/app-core-table-runtime.js"),
  read("./filter-controls-runtime.js"),
  read("./shared-table-ui-runtime.js"),
  read("./controls.css"),
]);

invariant(
  motion.startsWith('@import url("/filter-controls.css");'),
  "Filter control active-state styles must be loaded through the canonical control stylesheet dependency graph.",
);

for (const required of [
  "#openFiltersButton #filterSummary.filtersViewCount:not(.hasActiveFilters)",
  "display: none;",
  "#openFiltersButton.filtersViewButton.hasActiveFilters",
  "border-color: var(--primary);",
  "background: color-mix(in srgb, var(--primary) 10%, var(--surface));",
  "#openFiltersButton #filterSummary.filtersViewCount.hasActiveFilters",
  "display: inline-grid;",
  "min-height: 18px;",
  "height: 18px;",
  "border-radius: 999px;",
  "background: color-mix(in srgb, var(--primary) 16%, transparent);",
  "color: var(--primary);",
]) {
  invariant(styles.includes(required), `Active Filters presentation is missing ${required}`);
}

invariant(
  controls.includes(".filtersViewButton,")
    && controls.includes("justify-content: center;"),
  "Filters control must keep its remaining icon and label horizontally centered when the inactive count is removed from layout.",
);

invariant(
  !styles.includes("visibility: hidden;") && !styles.includes("visibility: visible;"),
  "Inactive Filters count must collapse instead of reserving layout space.",
);

for (const required of [
  'replaceRequiredFunction(',
  '"updateFilterSummary"',
  "const normalizedCount = Number.isFinite(numericCount) ? Math.max(0, Math.trunc(numericCount)) : 0;",
  "const active = normalizedCount >= 1;",
  'filterSummary.textContent = String(normalizedCount);',
  'filterSummary.classList.toggle("hasActiveFilters", active);',
  'openFiltersButton?.classList.toggle("hasActiveFilters", active);',
]) {
  invariant(ownerSource.includes(required), `Canonical active Filters owner is missing ${required}`);
  invariant(tableRuntime.includes(required.replace('replaceRequiredFunction(', 'function updateFilterSummary(').replace('"updateFilterSummary"', 'function updateFilterSummary(')) || required === 'replaceRequiredFunction(' || required === '"updateFilterSummary"', `Generated table runtime is missing active Filters behavior: ${required}`);
}

invariant(
  buildNormalizer.includes('import { addActiveFilterControlState } from "./app-core-filter-control-state.js";')
    && buildNormalizer.includes("const filterArtifacts = addActiveFilterControlState(playerArtifacts);")
    && buildNormalizer.includes("splitTableApplicationCoreRuntime(filterArtifacts)"),
  "Active Filters state must be applied in the canonical build pipeline before the table split.",
);

for (const required of [
  'import { replaceRequired, replaceRequiredFunction } from "./app-core-splitter-utils.js";',
  "const crossPageNavigation = !runtimeReady",
  'String(pageName || "") !== String(state.currentPage || "")',
  "updateFilterSummary(0);",
  '"cross-page active Filters presentation reset"',
]) {
  invariant(ownerSource.includes(required), `Canonical active Filters owner is missing cross-page reset contract: ${required}`);
}

const routeGateStart = coreRuntime.indexOf("const routeRuntimeSetPage = async function setPageWithRouteRuntime");
const routeResetGuard = coreRuntime.indexOf("const crossPageNavigation = !runtimeReady", routeGateStart);
const routeResetCall = coreRuntime.indexOf("updateFilterSummary(0);", routeResetGuard);
const routeSavedState = coreRuntime.indexOf("let previousTableStateSaved = false;", routeGateStart);
const routeTransitionStart = coreRuntime.indexOf('const runTransition = Reflect.get(window, "__mflRunPageTransition");', routeGateStart);
invariant(
  routeGateStart >= 0
    && routeResetGuard > routeGateStart
    && routeResetCall > routeResetGuard
    && routeSavedState > routeResetCall
    && routeTransitionStart > routeResetCall
    && coreRuntime.slice(routeResetGuard, routeResetCall).includes('String(pageName || "") !== String(state.currentPage || "")'),
  "Generated route gate must reset the Filters button to zero-active presentation synchronously for cross-page navigation before saved-state and transition work.",
);

for (const required of [
  "function syncFilterSummaryNow() {",
  "const count = activeFilterCountFromDialog();",
  'const canonicalUpdater = Reflect.get(window, "updateFilterSummary");',
  'if (typeof canonicalUpdater === "function") {',
  "canonicalUpdater(count);",
  "summary instanceof HTMLElement) summary.textContent = String(count);",
]) {
  invariant(sharedTableUi.includes(required), `Shared table UI must delegate applied count updates through the canonical active-state owner: ${required}`);
}

invariant(
  !sharedTableUi.includes("summary.textContent = String(activeFilterCountFromDialog());"),
  "Shared table UI must not bypass the canonical active-state owner when applying or closing Filters.",
);

for (const retired of [
  "filterSummaryObserver",
  "observeActiveFilterSummary",
  "activeFilterCountFromSummary",
]) {
  invariant(!filterRuntime.includes(retired), `Filter controls runtime must not retain inferred active-state observer: ${retired}`);
}

invariant(!styles.includes("!important"), "Active Filters styles must not use CSS priority overrides.");
invariant(!filterRuntime.includes('document.createElement("style")'), "Filter controls runtime must not inject styles dynamically.");
invariant(!sharedTableUi.includes('document.createElement("style")'), "Shared table UI must not inject active-filter styles dynamically.");

console.log("Active Filters badge, collapsed zero count, centered inactive content, click-time cross-page reset, and canonical highlighted-state ownership validation passed.");
