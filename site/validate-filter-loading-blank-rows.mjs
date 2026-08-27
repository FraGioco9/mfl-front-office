import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [appCore, generatedCore, tableLoading, bootstrap, styles, stylesBase] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-runtime.js"),
  read("./table-loading-runtime.js"),
  read("./bootstrap.js"),
  read("./styles.css"),
  read("./styles-base.css"),
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
invariant(
  stylesBase.includes(".pager[hidden] {\n  display: none;\n}"),
  "Pager author styles must honor the runtime hidden attribute while table loading owns the pager.",
);

for (const source of [appCore, generatedCore]) {
  invariant(
    source.includes('const tableLoadingActive = Boolean(window.__mflTableLoadingRuntime?.requestActive?.());')
      && source.includes('const visible = tablePages.has(state.currentPage) && !tableLoadingActive;')
      && !source.includes('const tableLoadingActive = Boolean(window.__mflTableLoadingRuntime?.requestActive?.())\n    || document.documentElement.classList.contains("mflDataLoading");'),
    "Player-count metadata must stay hidden only while the table-loading owner has an active request, then appear with rendered data.",
  );
  invariant(
    source.includes('const cachedPayloadSupersedesActiveRequest = Boolean(cachedPayload && window.__mflTableLoadingRuntime?.requestActive?.());')
      && source.includes('|| (!cachedPayload || cachedPayloadSupersedesActiveRequest')
      && source.includes('window.__mflTableLoadingRuntime?.finishRequest?.(tableLoadingRequestToken);'),
    "A newer cached incremental result must supersede an older active table-loading token before rendering.",
  );
}
invariant(
  tableLoading.includes('const count = document.getElementById("watchlistPlayerCount");')
    && tableLoading.includes('if (count instanceof HTMLElement) count.hidden = true;'),
  "The canonical table-loading owner must hide both pager navigation and the Showing x/y players summary.",
);

console.log("Quick Filter loading keeps five blank rows and all pager metadata under the latest table-loading request owner.");
