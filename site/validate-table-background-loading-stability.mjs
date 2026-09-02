import { readFile } from "node:fs/promises";

const runtime = String(await readFile(new URL("./table-loading-runtime.js", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const index = String(await readFile(new URL("./index.html", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const projection = String(await readFile(new URL("./sync-release-projections.mjs", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

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
  "body.rows.length === 5",
  "Array.from(body.rows).every((row) => row.classList.contains(BLANK_ROW_CLASS))",
  "if (body && !preserveRenderedRows && !hasCanonicalLoadingRows(body)) primeLoadingRows();",
  "function syncRenderedRows() {",
  "if (!(body instanceof HTMLTableSectionElement) || !hasRealRows(body)) return false;",
  "if (page) page.hidden = !pagerRouteActive();",
  'if (shouldPreserveRenderedRows() && !snapshot.reasons.includes(FILTER_LOADING_REASON)) return;',
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
    && syncSource.includes("const renderedRowsVisible = syncRenderedRows();")
    && syncSource.includes("if (!renderedRowsVisible) hidePager();")
    && syncSource.includes("else hidePlayerCount();")
    && syncSource.indexOf("syncRenderedRows()") < syncSource.indexOf("shouldPreserveRenderedRows()")
    && syncSource.indexOf("shouldPreserveRenderedRows()") < syncSource.indexOf("show({ replaceExisting: true })")
    && syncSource.includes("!snapshot.reasons.includes(FILTER_LOADING_REASON)"),
  "Global loading-state updates must reveal pager chrome as soon as real rows exist while preserving settled rows for background loads and allowing blank filter/page loads.",
);

invariant(
  runtime.includes("function hidePager() {")
    && runtime.includes("if (page) page.hidden = true;")
    && runtime.includes("function syncRenderedRows() {")
    && runtime.includes("if (page) page.hidden = !pagerRouteActive();")
    && !runtime.includes("preservePager"),
  "Pager chrome must be hidden for blank loading rows and released from the same runtime as soon as real rows are rendered.",
);

invariant(
  index.includes('html:not([data-mfl-ready="true"]) #progressionPage nav.pager {\n        display: none;\n      }')
    && !index.includes('html.mflDataLoading #progressionPage nav.pager'),
  "First-paint CSS must not keep nav.pager hidden after real data renders merely because the broader data-loading class is still active.",
);
invariant(
  projection.includes("export function normalizeIndexPagerLoadingProjection(source) {")
    && projection.includes('html\\.mflDataLoading #progressionPage nav\\.pager')
    && projection.includes("normalizeIndexPagerLoadingProjection("),
  "Release projection generation must canonically preserve the data-render pager visibility rule in index.html.",
);

console.log("Settled table rows remain stable during background loading, blank page/filter loads hide pager chrome, and nav.pager appears at the real-data render boundary.");
