import { readFile } from "node:fs/promises";

const runtime = String(await readFile(new URL("./table-loading-runtime.js", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

for (const required of [
  "function shouldPreserveRenderedRows(body = elements().body) {",
  "!hasRealRows(body)",
  'root.classList.contains("mflInitialRouteResolved")',
  '!root.classList.contains("mflNavigationPending")',
  "const currentBody = elements().body;",
  "const preserveRenderedRows = shouldPreserveRenderedRows(currentBody);",
  "const body = preserveRenderedRows",
  ": prepareLoadingSurface();",
  "function hasCanonicalLoadingRows(body) {",
  'body.dataset.staticLoading === "true"',
  "body.rows.length === 5",
  "Array.from(body.rows).every((row) => row.classList.contains(BLANK_ROW_CLASS))",
  "if (body && !preserveRenderedRows && !hasCanonicalLoadingRows(body)) primeLoadingRows();",
  "hidePager();",
  'if (shouldPreserveRenderedRows() && !snapshot.reasons.includes(FILTER_LOADING_REASON)) return;',
  "show({ replaceExisting: true });",
]) {
  invariant(runtime.includes(required), `Background table loading stability is missing ${required}`);
}

const beginStart = runtime.indexOf("function beginRequest(routeScope) {");
const beginEnd = runtime.indexOf("function hydrateInitialClubHeader() {", beginStart);
const beginSource = runtime.slice(beginStart, beginEnd);
invariant(
  beginStart >= 0
    && beginEnd > beginStart
    && beginSource.indexOf("shouldPreserveRenderedRows(currentBody)") < beginSource.indexOf("prepareLoadingSurface()")
    && beginSource.includes("if (body && !preserveRenderedRows && !hasCanonicalLoadingRows(body)) primeLoadingRows();"),
  "A post-route background request must preserve settled rows and adopt an already-primed refresh skeleton instead of rebuilding it.",
);

const syncStart = runtime.indexOf("function sync(snapshot = loadingSnapshot()) {");
const syncEnd = runtime.indexOf("function installCoreBridge() {", syncStart);
const syncSource = runtime.slice(syncStart, syncEnd);
invariant(
  syncStart >= 0
    && syncEnd > syncStart
    && syncSource.indexOf("hidePager();") < syncSource.indexOf("shouldPreserveRenderedRows()")
    && syncSource.indexOf("shouldPreserveRenderedRows()") < syncSource.indexOf("show({ replaceExisting: true })")
    && syncSource.includes("!snapshot.reasons.includes(FILTER_LOADING_REASON)"),
  "Global loading-state updates must preserve a settled table for background loads while allowing filter loads to show the canonical blank rows.",
);

invariant(
  runtime.includes("function hidePager() {")
    && runtime.includes("if (page) page.hidden = true;")
    && !runtime.includes("preservePager"),
  "Every active Table load must hide pager chrome even when settled rows remain rendered.",
);

console.log("Settled table rows remain visible during ordinary background loading, filter loading uses blank rows, and every active Table load hides pager chrome until the request settles.");
