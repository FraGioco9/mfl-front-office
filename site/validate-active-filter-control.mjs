import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [motion, styles, ownerSource, buildNormalizer, tableRuntime, filterRuntime] = await Promise.all([
  read("./motion.css"),
  read("./filter-controls.css"),
  read("./modules/app-core-filter-control-state.js"),
  read("./modules/app-core-build-normalizer.js"),
  read("./modules/app-core-table-runtime.js"),
  read("./filter-controls-runtime.js"),
]);

invariant(
  motion.startsWith('@import url("/filter-controls.css");'),
  "Filter control active-state styles must be loaded through the canonical control stylesheet dependency graph.",
);

for (const required of [
  "#openFiltersButton.filtersViewButton.hasActiveFilters",
  "border-color: var(--primary);",
  "background: color-mix(in srgb, var(--primary) 10%, var(--surface));",
  "#filterSummary.filtersViewCount.hasActiveFilters",
  "min-height: 18px;",
  "height: 18px;",
  "border-radius: 999px;",
  "background: color-mix(in srgb, var(--primary) 16%, transparent);",
  "color: var(--primary);",
]) {
  invariant(styles.includes(required), `Active Filters presentation is missing ${required}`);
}

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

for (const retired of [
  "filterSummaryObserver",
  "observeActiveFilterSummary",
  "activeFilterCountFromSummary",
]) {
  invariant(!filterRuntime.includes(retired), `Filter controls runtime must not retain inferred active-state observer: ${retired}`);
}

invariant(!styles.includes("!important"), "Active Filters styles must not use CSS priority overrides.");
invariant(!filterRuntime.includes('document.createElement("style")'), "Filter controls runtime must not inject styles dynamically.");

console.log("Active Filters badge and canonical highlighted-state ownership validation passed.");
