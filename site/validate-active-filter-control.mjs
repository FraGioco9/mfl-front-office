import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [motion, styles, runtime] = await Promise.all([
  read("./motion.css"),
  read("./filter-controls.css"),
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
  "function activeFilterCountFromSummary() {",
  'document.getElementById("filterSummary")',
  "function syncActiveFilterHighlight() {",
  'const active = activeFilterCountFromSummary() >= 1;',
  'summary.classList.toggle("hasActiveFilters", active);',
  'button.classList.toggle("hasActiveFilters", active);',
  "function observeActiveFilterSummary() {",
  "new MutationObserver(syncActiveFilterHighlight)",
  'filterSummaryObserver.observe(summary, { childList: true });',
  "syncActiveFilterHighlight();\n    observeActiveFilterSummary();",
]) {
  invariant(runtime.includes(required), `Active Filters runtime is missing ${required}`);
}

invariant(!runtime.includes("subtree: true"), "Active Filters must observe only the count element itself, never a rendered-control subtree.");
invariant(!styles.includes("!important"), "Active Filters styles must not use CSS priority overrides.");
invariant(!runtime.includes('document.createElement("style")'), "Active Filters runtime must not inject styles dynamically.");

console.log("Active Filters badge and persistent highlighted-state validation passed.");
