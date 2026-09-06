import { invariant } from "./validation/assertions.mjs";
import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");

const [appCore, generatedCore, tableLoading, bootstrap, styles, stylesBase, loading, scrollbars] = await Promise.all([
  Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./modules/app-core-runtime.js"),
  read("./table-loading-runtime.js"),
  read("./bootstrap.js"),
  read("./styles.css"),
  read("./styles-base.css"),
  read("./loading.css"),
  read("./scrollbars.css"),
]);

const filterReload = 'void reloadIncrementalPage(1, { save: options.save !== false, loadingMode: "blank" });';
const requestForwarding = /requestIncrementalRoute\(route, page, \{\s*loadingMode: options\.loadingMode,\s*tableLoadingRequestToken: reloadLoadingRequestToken,\s*\}\);/u;
for (const source of [appCore, generatedCore]) {
  invariant(source.includes(filterReload), "Filter reloads must opt directly into the canonical blank-row loading mode.");
  invariant(requestForwarding.test(source), "Incremental reloads must forward their table loading mode and render-owned request token together.");
  invariant(!source.includes('loadingReason: "table-filter-loading"'), "Filter reloads must not depend on the retired interaction-busy loading reason.");
}

invariant(
  tableLoading.includes('const preserveRenderedRows = options.loadingMode !== "blank" && shouldPreserveRenderedRows(currentBody);')
    && tableLoading.includes('if (body && !preserveRenderedRows && !hasCanonicalLoadingRows(body)) primeLoadingRows();'),
  "Blank-mode table requests must replace settled rows through the canonical table-loading runtime.",
);
invariant(
  bootstrap.includes("const TABLE_LOADING_ROW_OPACITIES = Object.freeze([0.86, 0.76, 0.66, 0.56, 0.46, 0.36, 0.28, 0.20, 0.13, 0.07]);")
    && bootstrap.includes("return TABLE_LOADING_ROW_OPACITIES.length;")
    && bootstrap.includes('row.className = "mflTableLoadingRow";'),
  "Filter loading must reuse exactly ten canonical faded loading rows.",
);
invariant(
  styles.includes("--mfl-table-row-outer-height: 39px;")
    && styles.includes("#progressionPage .playerTableScroller tbody > tr {\n  height: var(--mfl-table-row-outer-height);\n}")
    && styles.includes("#progressionPage .playerTableScroller td {\n  height: var(--mfl-table-row-height);\n  min-height: var(--mfl-table-row-height);\n  line-height: var(--mfl-table-row-height);\n  vertical-align: middle;\n}"),
  "Populated and loading table rows must share the canonical tbody/tr/td height contract.",
);
invariant(
  !loading.includes(".mflTableLoadingRow {\n  height:")
    && !loading.includes(".mflTableLoadingRow > td {\n  height:")
    && !loading.includes(".mflTableLoadingRow:last-child"),
  "Loading presentation must not own separate row height or last-row border geometry; all ten placeholders must inherit the desktop row contract.",
);
invariant(
  styles.includes("#tableBody > .mflTableLoadingRow > td {\n  padding-top: 0;\n  padding-bottom: 0;\n  background: var(--surface-muted);")
    && !styles.includes("#tableBody > .mflTableLoadingRow > td {\n  height:"),
  "Loading rows may own appearance only, never a competing height declaration.",
);
const horizontalStandardsRule = `.playerTableScroller,
  .tableScroller,
  .advancedPlayerTableSection,
  .mflStatsAgeDistribution {
    scrollbar-width: none;
  }`;
const horizontalMsRule = `.playerTableScroller,
.tableScroller,
.advancedPlayerTableSection,
.mflStatsAgeDistribution {
  -ms-overflow-style: none;
}`;
const horizontalWebkitRule = `.playerTableScroller::-webkit-scrollbar,
.tableScroller::-webkit-scrollbar,
.advancedPlayerTableSection::-webkit-scrollbar,
.mflStatsAgeDistribution::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}`;
invariant(
  scrollbars.includes(horizontalStandardsRule)
    && scrollbars.includes(horizontalMsRule)
    && scrollbars.includes(horizontalWebkitRule),
  "Player-table scrolling must stay native while the shared horizontal-overflow scrollbar owner hides its chrome so it cannot appear as a sixth loading row.",
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

console.log("Quick Filter loading keeps exactly ten equal blank rows on canonical row geometry, with horizontal scrollbar chrome removed from the loading surface.");
