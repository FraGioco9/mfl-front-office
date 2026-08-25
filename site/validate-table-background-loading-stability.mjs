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
  "if (body && !preserveRenderedRows && !loadingRowsMatchCurrentStructure(body)) primeLoadingRows();",
  "hidePager();",
  "if (shouldPreserveRenderedRows()) return;",
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
    && beginSource.includes("if (body && !preserveRenderedRows && !loadingRowsMatchCurrentStructure(body)) primeLoadingRows();"),
  "A post-route background request must decide whether to preserve rendered rows and reuse a structurally valid loading tbody before preparing new placeholders.",
);

const syncStart = runtime.indexOf("function sync(snapshot = loadingSnapshot()) {");
const syncEnd = runtime.indexOf("function installCoreBridge() {", syncStart);
const syncSource = runtime.slice(syncStart, syncEnd);
invariant(
  syncStart >= 0
    && syncEnd > syncStart
    && syncSource.indexOf("hidePager();") < syncSource.indexOf("shouldPreserveRenderedRows()")
    && syncSource.indexOf("shouldPreserveRenderedRows()") < syncSource.indexOf("show({ replaceExisting: true })"),
  "Global loading-state updates must not replace a settled table unless a navigation is actually pending.",
);

invariant(
  runtime.includes("function hidePager() {")
    && runtime.includes("if (page) page.hidden = true;")
    && !runtime.includes("preservePager"),
  "Every active Table load must hide pager chrome even when settled rows remain rendered.",
);

console.log("Settled table rows remain visible during background loading, structurally valid refresh placeholders are reused, and every active Table load hides pager chrome until the request settles.");
