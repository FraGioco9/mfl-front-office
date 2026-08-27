import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [appCore, generatedCore, tableLoading, bootstrap, styles] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-runtime.js"),
  read("./table-loading-runtime.js"),
  read("./bootstrap.js"),
  read("./styles.css"),
]);

const filterReload = 'void reloadIncrementalPage(1, { save: options.save !== false, loadingMode: "blank" });';
const requestForwarding = 'requestIncrementalRoute(route, page, { loadingMode: options.loadingMode });';
for (const source of [appCore, generatedCore]) {
  invariant(source.includes(filterReload), "Filter reloads must opt directly into the canonical blank-row loading mode.");
  invariant(source.includes(requestForwarding), "Incremental reloads must forward their table loading mode to the request owner.");
  invariant(!source.includes('loadingReason: "table-filter-loading"'), "Filter reloads must not depend on the retired interaction-busy loading reason.");
}

invariant(
  tableLoading.includes('const preserveRenderedRows = options.loadingMode !== "blank" && shouldPreserveRenderedRows(currentBody);')
    && tableLoading.includes('if (body && !preserveRenderedRows && !hasCanonicalLoadingRows(body)) primeLoadingRows();'),
  "Blank-mode table requests must replace settled rows through the canonical table-loading runtime.",
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

console.log("Quick Filter and filter reloads use the canonical five blank rows through table-owned blank loading mode.");
