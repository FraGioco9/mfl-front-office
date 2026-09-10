import { invariant } from "./validation/assertions.mjs";
import { readFile } from "node:fs/promises";
import { readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");

const [loadingRuntime, tableCore, generatedTableRuntime, index, firstPaint, tablesSource, buildCore] = await Promise.all([
  read("./table-loading-runtime.js"),
  Promise.resolve(readCanonicalCoreSource("table")),
  read("./modules/app-core-table-runtime.js"),
  read("./index.html"),
  read("./html-sources/first-paint.html"),
  read("./html-sources/tables.html"),
  read("./build-app-core.mjs"),
]);

const renderStart = tableCore.indexOf("function tableRenderTableOwner() {");
const renderEnd = tableCore.indexOf("\nfunction showTableBusyState() {", renderStart);
invariant(renderStart >= 0 && renderEnd > renderStart, "Table core must expose the canonical table render owner.");
const renderSource = tableCore.slice(renderStart, renderEnd);

const rowCommitMarker = "tableBody.replaceChildren(fragment);";
const pagerRuntimeMarker = 'const tableLoadingRuntime = Reflect.get(window, "__mflTableLoadingRuntime");';
const pagerCommitMarker = 'if (tableLoadingRuntime && typeof tableLoadingRuntime.sync === "function") tableLoadingRuntime.sync();';
const pagerStateMarker = "syncPagerCurrentPage(state.page, totalPages);";
const globalPagerReadyRule = 'html:not([data-mfl-ready="true"]) #progressionPage nav.pager';
const parserHiddenPager = '<nav class="pager" aria-label="Pagination" hidden>';
const activeFirstPaintCss = firstPaint.replace(/\/\*[\s\S]*?\*\//g, "");
const activeIndexCss = index.replace(/\/\*[\s\S]*?\*\//g, "");

invariant(
  loadingRuntime.includes("function syncRenderedRows() {")
    && loadingRuntime.includes("if (page) page.hidden = !pagerRouteActive();")
    && loadingRuntime.includes("function sync(snapshot = loadingSnapshot()) {")
    && loadingRuntime.includes("const renderedRowsPresent = syncRenderedRows();"),
  "Table loading sync must retain route-aware pager reconciliation for committed rows.",
);
invariant(
  renderSource.includes(rowCommitMarker)
    && renderSource.includes(pagerRuntimeMarker)
    && renderSource.includes(pagerCommitMarker)
    && renderSource.indexOf(pagerRuntimeMarker) > renderSource.indexOf(rowCommitMarker)
    && renderSource.indexOf(pagerCommitMarker) > renderSource.indexOf(pagerRuntimeMarker)
    && renderSource.indexOf(pagerCommitMarker) < renderSource.indexOf(pagerStateMarker),
  "A populated table render must reconcile pager visibility in the same synchronous commit as its rows, before the render owner returns.",
);
invariant(
  generatedTableRuntime.includes(rowCommitMarker)
    && generatedTableRuntime.includes(pagerRuntimeMarker)
    && generatedTableRuntime.includes(pagerCommitMarker),
  "Generated Table runtime must preserve same-commit pager visibility for populated single-page tables.",
);
invariant(
  tablesSource.includes(parserHiddenPager)
    && index.includes(parserHiddenPager)
    && !activeFirstPaintCss.includes(globalPagerReadyRule)
    && !activeIndexCss.includes(globalPagerReadyRule),
  "Single-page refresh must use native parser-hidden pager state, then rely on the row-commit owner rather than active global app-readiness CSS.",
);
invariant(
  firstPaint.includes("Pager starts hidden through its native `hidden` attribute; table data readiness owns release.")
    && !buildCore.includes("removeGlobalPagerReadyGate"),
  "Pager readiness must be owned by canonical first-paint/Table sources, not a generated-index repair in build-app-core.",
);

console.log("Single-page pager render-commit validation passed.");
