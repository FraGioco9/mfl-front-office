import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [appCore, generatedCore, bootstrapCore, tableLoading, bootstrap, styles] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-runtime.js"),
  read("./bootstrap-core.js"),
  read("./table-loading-runtime.js"),
  read("./bootstrap.js"),
  read("./styles.css"),
]);

const filterReload = 'void reloadIncrementalPage(1, { save: options.save !== false, loadingReason: "table-filter-loading" });';
const busyForwarding = 'return withInteractionBusy(loadAndRender, options.loadingReason);';
for (const source of [appCore, generatedCore]) {
  invariant(source.includes(filterReload), "Filter reloads must carry the dedicated table-filter-loading reason.");
  invariant(source.includes(busyForwarding), "Incremental reloads must forward their optional loading reason.");
  invariant((source.match(/loadingReason: "table-filter-loading"/g) || []).length === 1, "Only filter reloads may opt into forced blank loading rows.");
}

invariant(bootstrapCore.includes('"table-filter-loading",'), "Filter reloads must count as data loading.");
invariant(tableLoading.includes('const FILTER_LOADING_REASON = "table-filter-loading";'), "Table loading must recognize the filter-specific loading reason.");
invariant(
  tableLoading.includes('if (shouldPreserveRenderedRows() && !snapshot.reasons.includes(FILTER_LOADING_REASON)) return;'),
  "Same-page rows may be preserved for other reloads, but filter reloads must replace them with blank rows.",
);
invariant(
  bootstrap.includes("const opacities = [0.82, 0.62, 0.44, 0.27, 0.13];")
    && bootstrap.includes('row.className = "mflTableLoadingRow";'),
  "Filter loading must reuse the existing five-row table loading skeleton.",
);
invariant(
  styles.includes("--mfl-table-row-outer-height: 39px;")
    && styles.includes("#progressionPage .playerTableScroller tbody > tr {\n  height: var(--mfl-table-row-outer-height);\n}")
    && !styles.includes("#tableBody > .mflTableLoadingRow > td {\n  height:"),
  "The five filter-loading rows must inherit the same 39px rendered outer height as populated rows.",
);

console.log("Filter reloads use five blank rows with the same 39px rendered height as populated rows while preserving compact 34px cell content.");
