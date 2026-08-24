import { readFile } from "node:fs/promises";

import { MFL_STATS_OVERALL_FILTERS } from "./modules/app-config.js";

const read = async (path) => (await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
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

includes(
  indexHtml,
  '<div id="databaseStatsOverallFilters" class="mflStatsFilterButtons">',
  "Database Stats Overall Filters must use the shared Stats filter container.",
);
includes(
  indexHtml,
  '<div id="mflStatsOverallFilters" class="mflStatsFilterButtons">',
  "MFL Stats Overall Filters must use the same shared Stats filter container as Database Stats.",
);

const filterStart = indexHtml.indexOf('<div id="mflStatsOverallFilters" class="mflStatsFilterButtons">');
const filterEnd = filterStart >= 0 ? indexHtml.indexOf("</div>", filterStart) : -1;
invariant(filterStart >= 0 && filterEnd > filterStart, "MFL Stats Overall Filters must exist in the base HTML.");
const filterHtml = indexHtml.slice(filterStart, filterEnd);
const expectedFilters = MFL_STATS_OVERALL_FILTERS.map(({ id, label }) => [id, label]);
let previousIndex = -1;
for (const [value, label] of expectedFilters) {
  const marker = `data-static-value="${value}">${label}</button>`;
  const index = filterHtml.indexOf(marker);
  invariant(index > previousIndex, `Static MFL Stats filter ${label} must exist in canonical order.`);
  previousIndex = index;
}
invariant(
  (filterHtml.match(/<button class="mflStatsFilterButton(?: active)?"/g) || []).length === expectedFilters.length,
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
includes(
  hydration,
  "const currentButton = mflStatsOverallFilters.children[index];",
  "MFL Stats hydration must compare the existing button position before touching the DOM.",
);
includes(
  hydration,
  "if (currentButton !== button)",
  "Correctly ordered first-paint MFL Stats filters must not be moved during hydration.",
);
excludes(
  hydration,
  "mflStatsOverallFilters.appendChild(button);",
  "Hydration must not move every existing MFL Stats filter and trigger intermediate layouts.",
);
excludes(
  hydration,
  "replaceChildren",
  "The loaded MFL Stats runtime must not destroy and recreate first-paint filter controls.",
);

includes(
  stylesBase,
  ".mflStatsFilterButton {\n  width: 86px;\n  height: 26px;",
  "Both Stats pages must inherit one shared intrinsic Overall-filter button size.",
);
includes(
  styles,
  ".mflStatsFilterButton {\n  flex: 1 1 86px;\n  min-width: 86px;\n}",
  "Both Stats pages must use the same label-independent flex basis so filter spacing cannot shift when fonts or runtime bindings settle.",
);
excludes(
  responsive,
  ".mflStatsFilterButton {",
  "Responsive layout must not assign a second Overall-filter button size or replace the shared first-paint button rule.",
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

console.log("Database Stats and MFL Stats share stable full-width Overall-filter geometry from first paint through hydration.");
