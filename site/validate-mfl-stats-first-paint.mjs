import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);

const [styles, responsive] = await Promise.all([
  read("./styles.css"),
  read("./responsive.css"),
]);

includes(
  styles,
  "#mflStatsPage .mflStatsFilters {\n  container-type: inline-size;\n}",
  "MFL Stats Overall Filters must size from their actual content width before lazy controls load.",
);
includes(styles, "#mflStatsOverallFilters {\n  min-height: 26px;", "Desktop first paint must reserve the loaded 26px filter row.");
includes(styles, "@container (max-width: 1359px)", "Wrapped desktop filters must reserve two loaded rows.");
includes(styles, "min-height: 57px;", "Two desktop filter rows must reserve their exact loaded height.");
includes(styles, "@container (max-width: 722px)", "Narrow desktop filters must reserve three loaded rows.");
includes(styles, "min-height: 88px;", "Three desktop filter rows must reserve their exact loaded height.");
includes(styles, "@media (max-width: 900px)", "Tablet/mobile first-paint filter geometry must follow the responsive layout.");
includes(styles, "min-height: 307px;", "Two-column mobile filters must reserve eight 34px rows plus gaps.");
includes(styles, "@media (max-width: 520px)", "Phone first-paint filter geometry must follow the single-column layout.");
includes(styles, "min-height: 580px;", "Single-column phone filters must reserve fifteen 34px rows plus gaps.");
includes(responsive, ".mflStatsFilterButton {\n    width: 100%;\n    min-width: 0;\n    height: 34px;", "Responsive filter height assumptions must stay aligned with the canonical mobile button size.");

console.log("MFL Stats Overall Filters reserve their final loaded geometry at first paint across desktop and mobile layouts.");
