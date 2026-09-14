import { invariant } from "./validation/assertions.mjs";
import { readFile } from "node:fs/promises";
import { readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");

const [motion, styles, sharedSource, tableSource, coreRuntime, tableRuntime, filterRuntime, sharedTableUi, controls] = await Promise.all([
  read("./motion.css"),
  read("./filter-controls.css"),
  Promise.resolve(readCanonicalCoreSource("shared")),
  Promise.resolve(readCanonicalCoreSource("table")),
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
  "function updateFilterSummary",
  "const normalizedCount = Number.isFinite(numericCount) ? Math.max(0, Math.trunc(numericCount)) : 0;",
  "const active = normalizedCount >= 1;",
  'filterSummary.textContent = String(normalizedCount);',
  'filterSummary.classList.toggle("hasActiveFilters", active);',
  'openFiltersButton?.classList.toggle("hasActiveFilters", active);',
]) {
  invariant(tableSource.includes(required), `Canonical Table source is missing active Filters behavior: ${required}`);
  invariant(tableRuntime.includes(required), `Generated Table runtime is missing active Filters behavior: ${required}`);
}

for (const required of [
  "const crossPageNavigation = !runtimeReady",
  'String(pageName || "") !== String(state.currentPage || "")',
  'const canonicalFilterSummaryUpdater = Reflect.get(window, "updateFilterSummary");',
  'if (typeof canonicalFilterSummaryUpdater === "function") {',
  "canonicalFilterSummaryUpdater(0);",
]) {
  invariant(sharedSource.includes(required), `Canonical shared source is missing cross-page Filters reset contract: ${required}`);
  invariant(coreRuntime.includes(required), `Generated shared runtime is missing cross-page Filters reset contract: ${required}`);
}

invariant(
  !sharedSource.includes("      updateFilterSummary(0);"),
  "The global route gate must not directly call table-owned updateFilterSummary before the lazy Table runtime exists.",
);

const routeGateStart = coreRuntime.indexOf("async function setPageWithRouteRuntime");
const routeResetGuard = coreRuntime.indexOf("const crossPageNavigation = !runtimeReady", routeGateStart);
const routeUpdaterLookup = coreRuntime.indexOf('const canonicalFilterSummaryUpdater = Reflect.get(window, "updateFilterSummary");', routeResetGuard);
const routeUpdaterGuard = coreRuntime.indexOf('if (typeof canonicalFilterSummaryUpdater === "function") {', routeUpdaterLookup);
const routeResetCall = coreRuntime.indexOf("canonicalFilterSummaryUpdater(0);", routeUpdaterGuard);
const routeSavedState = coreRuntime.indexOf("let previousTableStateSaved = false;", routeGateStart);
const routeTransitionStart = coreRuntime.indexOf('const runTransition = Reflect.get(window, "__mflRunPageTransition");', routeGateStart);
const routeGatePrelude = coreRuntime.slice(routeGateStart, routeSavedState);
invariant(
  routeGateStart >= 0
    && routeResetGuard > routeGateStart
    && routeUpdaterLookup > routeResetGuard
    && routeUpdaterGuard > routeUpdaterLookup
    && routeResetCall > routeUpdaterGuard
    && routeSavedState > routeResetCall
    && routeTransitionStart > routeResetCall
    && coreRuntime.slice(routeResetGuard, routeUpdaterLookup).includes('String(pageName || "") !== String(state.currentPage || "")')
    && !routeGatePrelude.includes("      updateFilterSummary(0);"),
  "Generated route gate must reset Filters through an optional lazy-runtime lookup before saved-state and transition work, without a direct Table-runtime call that can break non-table navigation.",
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

console.log("Active Filters badge, collapsed zero count, centered inactive content, lazy-runtime-safe reset, and canonical highlighted-state ownership validation passed.");
