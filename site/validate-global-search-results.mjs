import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [runtime, styles] = await Promise.all([
  read("./global-search-runtime.js"),
  read("./styles-base.css"),
]);

for (const required of [
  "const MAX_GLOBAL_SEARCH_RESULTS = 10;",
  "function normalizeTypedSearchResults() {",
  'results.querySelectorAll(":scope > .searchResult")',
  "directResults.slice(MAX_GLOBAL_SEARCH_RESULTS).forEach((result) => result.remove());",
  'results.classList.remove("filledSearchResults");',
  "coreContracts()?.renderGlobalSearchResults?.();\n      normalizeTypedSearchResults();",
  "cap: normalizeTypedSearchResults,",
]) {
  invariant(runtime.includes(required), `Global Search result ownership is missing ${required}`);
}

invariant(
  styles.includes(".searchResults {\n  display: grid;\n  gap: 8px;")
    && styles.includes("grid-auto-rows: 66px;")
    && styles.includes("overflow: auto;"),
  "Global Search must retain the existing fixed 66px result boxes, 8px spacing, and scrolling container.",
);

invariant(
  styles.includes(".searchDialog {\n  display: flex;\n  flex-direction: column;\n  width: min(960px, calc(100vw - 32px));\n  height: 501px;")
    && styles.includes(".searchBody {\n  display: grid;\n  gap: 12px;\n  padding: 16px 18px 8px;"),
  "Global Search popup must preserve five full fixed-height result boxes with matching 12px spacing above and below the result stack.",
);

invariant(
  !runtime.includes('document.createElement("style")') && !runtime.includes("!important"),
  "Global Search result layout must not be implemented through runtime CSS or priority overrides.",
);

console.log("Global Search caps typed results at 10 and preserves five visible, fixed, non-overlapping result boxes.");
