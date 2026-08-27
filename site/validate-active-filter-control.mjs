import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [motion, styles, ownerSource, buildNormalizer, tableRuntime, filterRuntime, sharedTableUi] = await Promise.all([
  read("./motion.css"),
  read("./filter-controls.css"),
  read("./modules/app-core-filter-control-state.js"),
  read("./modules/app-core-build-normalizer.js"),
  read("./modules/app-core-table-runtime.js"),
  read("./filter-controls-runtime.js"),
  read("./shared-table-ui-runtime.js"),
]);

invariant(
  motion.startsWith('@import url("/filter-controls.css");'),
  "Filter control active-state styles must be loaded through the canonical control stylesheet dependency graph.",
);

for (const required of [
  "#filterSummary.filtersViewCount {",
  "visibility: hidden;",
  "#openFiltersButton.filtersViewButton.hasActiveFilters",
  "border-color: var(--primary);",
  "background: color-mix(in srgb, var(--primary) 10%, var(--surface));",
  "#filterSummary.filtersViewCount.hasActiveFilters",
  "visibility: visible;",
  "min-height: 18px;",
  "height: 18px;",
  "border-radius: 999px;",
  "background: color-mix(in srgb, var(--primary) 16%, transparent);",
  "color: var(--primary);",
]) {
  invariant(styles.includes(required), `Active Filters presentation is missing ${required}`);
}

invariant(
  styles.indexOf("visibility: hidden;") < styles.indexOf("#filterSummary.filtersViewCount.hasActiveFilters")
    && styles.indexOf("#filterSummary.filtersViewCount.hasActiveFilters") < styles.indexOf("visibility: visible;"),
  "Inactive Filters count must stay hidden while its fixed layout slot remains reserved, then become visible only when active.",
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

console.log("Active Filters badge, hidden zero count, reserved slot, and canonical highlighted-state ownership validation passed.");
