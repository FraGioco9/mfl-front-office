import { invariant } from "./validation/assertions.mjs";
import { readFile } from "node:fs/promises";

const runtime = String(await readFile(new URL("./table-loading-runtime.js", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const index = String(await readFile(new URL("./index.html", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const buildCore = String(await readFile(new URL("./build-app-core.mjs", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const firstPaint = String(await readFile(new URL("./html-sources/first-paint.html", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const tablesSource = String(await readFile(new URL("./html-sources/tables.html", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");

for (const required of [
  "function shouldPreserveRenderedRows(body = elements().body) {",
  "!hasRealRows(body)",
  'root.classList.contains("mflInitialRouteResolved")',
  '!root.classList.contains("mflNavigationPending")',
  "const currentBody = elements().body;",
  'const preserveRenderedRows = options.loadingMode !== "blank" && shouldPreserveRenderedRows(currentBody);',
  "const body = preserveRenderedRows",
  ": prepareLoadingSurface();",
  "function hasCanonicalLoadingRows(body) {",
  'body.dataset.staticLoading === "true"',
  "body.rows.length === loadingRowCount()",
  "Array.from(body.rows).every((row) => row.classList.contains(BLANK_ROW_CLASS))",
  "if (body && !preserveRenderedRows && !hasCanonicalLoadingRows(body)) primeLoadingRows();",
  "function syncRenderedRows() {",
  "if (!(body instanceof HTMLTableSectionElement) || !hasRealRows(body)) return false;",
  "if (page) page.hidden = !pagerRouteActive();",
  "return true;",
  "show({ replaceExisting: true });",
]) {
  invariant(runtime.includes(required), `Background table loading stability is missing ${required}`);
}

const beginStart = runtime.indexOf("function beginRequest(routeScope, options = {}) {");
const beginEnd = runtime.indexOf("function hydrateInitialClubHeader() {", beginStart);
const beginSource = runtime.slice(beginStart, beginEnd);
invariant(
  beginStart >= 0
    && beginEnd > beginStart
    && beginSource.includes('options.loadingMode !== "blank" && shouldPreserveRenderedRows(currentBody)')
    && beginSource.indexOf("shouldPreserveRenderedRows(currentBody)") < beginSource.indexOf("prepareLoadingSurface()")
    && beginSource.includes("if (body && !preserveRenderedRows && !hasCanonicalLoadingRows(body)) primeLoadingRows();"),
  "A post-route background request must preserve settled rows by default while explicit blank-mode pager requests use the canonical loading skeleton.",
);

const syncStart = runtime.indexOf("function sync(snapshot = loadingSnapshot()) {");
const syncEnd = runtime.indexOf("function installCoreBridge() {", syncStart);
const syncSource = runtime.slice(syncStart, syncEnd);
invariant(
  syncStart >= 0
    && syncEnd > syncStart
    && syncSource.includes("const renderedRowsPresent = syncRenderedRows();")
    && syncSource.includes("if (renderedRowsPresent) {\n        hidePlayerCount();\n        return;\n      }")
    && syncSource.includes("hidePager();")
    && syncSource.indexOf("syncRenderedRows()") < syncSource.indexOf("if (renderedRowsPresent)")
    && syncSource.indexOf("if (renderedRowsPresent)") < syncSource.indexOf("hidePager();")
    && syncSource.indexOf("hidePager();") < syncSource.indexOf("show({ replaceExisting: true })"),
  "Global loading-state updates must stop the loading-surface path as soon as real rows exist, before route-ready or broader loading flags finish.",
);

invariant(
  runtime.includes("function hidePager() {")
    && runtime.includes("if (page) page.hidden = true;")
    && runtime.includes("function syncRenderedRows() {")
    && runtime.includes("if (page) page.hidden = !pagerRouteActive();")
    && !runtime.includes("preservePager"),
  "Pager chrome must be hidden for blank loading rows and released from the same runtime as soon as real rows are rendered.",
);

const globalPagerReadyRule = 'html:not([data-mfl-ready="true"]) #progressionPage nav.pager';
const firstPaintWithoutComments = firstPaint.replace(/\/\*[\s\S]*?\*\//g, "");
const indexWithoutComments = index.replace(/\/\*[\s\S]*?\*\//g, "");
invariant(
  !firstPaintWithoutComments.includes(globalPagerReadyRule)
    && !indexWithoutComments.includes(globalPagerReadyRule)
    && !index.includes('html.mflDataLoading #progressionPage nav.pager')
    && tablesSource.includes('<nav class="pager" aria-label="Pagination" hidden>'),
  "Pager first paint must start natively hidden without any active global application-readiness or broad data-loading CSS gate.",
);
invariant(
  firstPaint.includes("Pager starts hidden through its native `hidden` attribute; table data readiness owns release.")
    && firstPaint.includes(globalPagerReadyRule)
    && index.includes(globalPagerReadyRule)
    && !buildCore.includes("removeGlobalPagerReadyGate"),
  "The retired global-ready pager projection may remain only as documented inactive source history; build-app-core must not patch generated HTML.",
);

console.log("Settled rows remain stable during background loading, blank loads hide pager chrome, and nav.pager appears with real data independently of global app readiness.");
