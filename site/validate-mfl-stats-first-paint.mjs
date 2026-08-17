import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [indexHtml, bootstrap, routeChunks, styles, stylesBase, responsive] = await Promise.all([
  read("./index.html"),
  read("./bootstrap.js"),
  read("./modules/app-core-route-chunks.js"),
  read("./styles.css"),
  read("./styles-base.css"),
  read("./responsive.css"),
]);

const filterStart = indexHtml.indexOf('<div id="mflStatsOverallFilters" class="mflStatsFilterButtons">');
const filterEnd = filterStart >= 0 ? indexHtml.indexOf("</div>", filterStart) : -1;
invariant(filterStart >= 0 && filterEnd > filterStart, "MFL Stats Overall Filters must exist in the base HTML.");
const filterHtml = indexHtml.slice(filterStart, filterEnd);
const expectedFilters = [
  ["all", "All"],
  ["90-94", "90-94"],
  ["legendary", "Legendary"],
  ["85-89", "85-89"],
  ["80-84", "80-84"],
  ["rare", "Rare"],
  ["75-79", "75-79"],
  ["70-74", "70-74"],
  ["uncommon", "Uncommon"],
  ["65-69", "65-69"],
  ["60-64", "60-64"],
  ["limited", "Limited"],
  ["55-59", "55-59"],
  ["50-54", "50-54"],
  ["common", "Common"],
];
let previousIndex = -1;
for (const [value, label] of expectedFilters) {
  const marker = `data-static-value="${value}">${label}</button>`;
  const index = filterHtml.indexOf(marker);
  invariant(index > previousIndex, `Static MFL Stats filter ${label} must exist in canonical order.`);
  previousIndex = index;
}
invariant(
  (filterHtml.match(/class="mflStatsFilterButton/g) || []).length === expectedFilters.length,
  "The base HTML must contain exactly the canonical 15 MFL Stats filter buttons.",
);

includes(
  bootstrap,
  'primeStaticButtonGroup("mflStatsOverallFilters", MFL_STATS_FILTER_LABELS, "mflStatsFilterButton", "all");',
  "Bootstrap must reuse the static MFL Stats filter controls instead of creating a different first-paint layout.",
);
includes(
  bootstrap,
  "button.dataset.staticValue === value",
  "Bootstrap static-control matching must identify the HTML MFL Stats buttons by their canonical values.",
);

const hydrationStart = routeChunks.indexOf("function normalizeMflStatsStaticFilters(source) {");
const hydrationEnd = hydrationStart >= 0 ? routeChunks.indexOf("\n\nconst EVALUATION_SAVED_MODAL_FACADE", hydrationStart) : -1;
invariant(hydrationStart >= 0 && hydrationEnd > hydrationStart, "MFL Stats generated-runtime hydration normalization must exist.");
const hydration = routeChunks.slice(hydrationStart, hydrationEnd);
includes(
  hydration,
  'mflStatsOverallFilters.querySelectorAll(":scope > .mflStatsFilterButton")',
  "The loaded MFL Stats runtime must reuse the controls already painted by HTML.",
);
includes(
  hydration,
  'button.dataset.mflStatsBound !== "true"',
  "Existing static MFL Stats buttons must be hydrated with interaction only once.",
);
excludes(
  hydration,
  "replaceChildren",
  "The loaded MFL Stats runtime must not destroy and recreate first-paint filter controls.",
);

includes(
  stylesBase,
  ".mflStatsFilterButton {\n  width: 86px;\n  height: 26px;",
  "Desktop first paint must use the canonical loaded MFL Stats filter dimensions.",
);
includes(
  responsive,
  ".mflStatsFilterButton {\n    width: 100%;\n    min-width: 0;\n    height: 34px;",
  "Responsive first paint must use the canonical loaded MFL Stats filter dimensions.",
);
excludes(
  styles,
  "#mflStatsOverallFilters {\n  min-height:",
  "MFL Stats first paint must not approximate loaded filter geometry with reserved min-height rules.",
);
excludes(
  styles,
  "#mflStatsPage .mflStatsFilters {\n  container-type: inline-size;",
  "MFL Stats first paint must not depend on a container-query sizing patch.",
);

console.log("MFL Stats Overall Filters are real static controls at first paint and are hydrated in place after loading.");
