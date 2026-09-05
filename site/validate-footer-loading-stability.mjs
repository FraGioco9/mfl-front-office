import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => { if (!condition) throw new Error(message); };
const includes = (source, token, message) => invariant(source.includes(token), message);

const [bootstrap, tableLoading, footer, loading, stylesBase, styles] = await Promise.all([
  read("./bootstrap.js"),
  read("./table-loading-runtime.js"),
  read("./footer.css"),
  read("./loading.css"),
  read("./styles-base.css"),
  read("./styles.css"),
]);

for (const token of [
  "const TABLE_LOADING_ROW_OPACITIES = Object.freeze([0.86, 0.76, 0.66, 0.56, 0.46, 0.36, 0.28, 0.20, 0.13, 0.07]);",
  "function tableLoadingRowCount() {",
  "return TABLE_LOADING_ROW_OPACITIES.length;",
  'Reflect.set(window, "__mflTableLoadingRowCount", tableLoadingRowCount);',
  "const rowCount = tableLoadingRowCount();",
  "Array.from({ length: rowCount }, (_, index) => {",
  "const opacity = TABLE_LOADING_ROW_OPACITIES[index];",
]) includes(bootstrap, token, `Bootstrap ten-row footer loading contract is missing: ${token}`);

for (const forbidden of [
  "TABLE_LOADING_FALLBACK_ROW_COUNT",
  'const select = document.getElementById("pageSizeSelect");',
  "[25, 50, 100].includes(requested)",
]) {
  invariant(!bootstrap.includes(forbidden), `Table loading must no longer reserve the selected page size through ${forbidden}`);
}

for (const token of [
  "function loadingRowCount() {",
  'Reflect.get(window, "__mflTableLoadingRowCount")',
  'const count = typeof owner === "function" ? Number(owner()) : 10;',
  "return Number.isInteger(count) && count > 0 ? count : 10;",
  "body.rows.length === loadingRowCount()",
  'const TABLE_ROUTE_SCOPES = new Set(["database", "progression", "mfl", "agent", "watchlist", "myplayers", "club"]);',
]) includes(tableLoading, token, `Runtime ten-row footer loading contract is missing: ${token}`);

for (const token of [
  "grid-template-rows: max-content max-content;",
  "main > .pageView {",
  "min-height: 800px;",
  "row-gap: 22px;",
  "grid-row: 2;",
]) includes(footer, token, `Footer follow-content layout is missing: ${token}`);

invariant(!footer.includes("grid-template-rows: minmax(calc(100% - 22px), auto) auto;"), "Footer must not reserve a viewport-sized first grid row on table pages.");
const scrollerStart = styles.indexOf("#progressionPage .playerTableScroller {");
const scrollerEnd = styles.indexOf("\n}", scrollerStart);
const scrollerBlock = scrollerStart >= 0 && scrollerEnd > scrollerStart ? styles.slice(scrollerStart, scrollerEnd) : "";
invariant(scrollerBlock && !scrollerBlock.includes("min-height:"), "Footer minimum geometry must be independent of table row height and Rows selection.");
invariant(!scrollerBlock.includes("var(--mfl-table-row-outer-height)"), "Table scroller must not derive footer placement from row geometry.");

for (const source of [footer, loading, stylesBase]) {
  invariant(!/mflDataLoading[^\n{]*siteFooterDetails|siteFooterDetails[^\n{]*mflDataLoading/.test(source), "Loading state must not hide or override the footer itself.");
}

invariant(!footer.includes("!important"), "Footer loading stability must not add !important.");
console.log("Footer follows actual page content with a shared fixed 800px content-top floor, a 22px gap, and exactly ten table-loading rows independent of the Rows setting.");
