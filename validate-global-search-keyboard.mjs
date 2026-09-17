import { readFile } from "node:fs/promises";
import { invariant } from "./validation/assertions.mjs";
import { readCanonicalCoreSource } from "./validate-core-sources.mjs";

const shared = readCanonicalCoreSource("shared");
const foundations = String(await readFile(new URL("./ui-foundations.css", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");

const keydownStart = shared.indexOf('document.addEventListener("keydown", (event) => {');
const keydownEnd = shared.indexOf("\n});", keydownStart);
const keydown = keydownStart >= 0 && keydownEnd > keydownStart
  ? shared.slice(keydownStart, keydownEnd)
  : "";

invariant(
  shared.includes("function focusedGlobalSearchResult() {")
    && shared.includes("active instanceof HTMLButtonElement")
    && shared.includes("playerSearchResults.contains(active)")
    && shared.includes('active.classList.contains("searchResult")'),
  "Global Search keyboard activation must resolve only the actually focused result button.",
);

invariant(
  keydown.includes('event.key === "Escape" && !searchModal.hidden')
    && keydown.includes("event.preventDefault();\n    closeSearch();")
    && !keydown.includes("searchModal.contains(document.activeElement)) document.activeElement.blur();"),
  "Escape must close Global Search through the canonical modal lifecycle instead of only blurring its focused control.",
);

invariant(
  keydown.includes('event.key === "Enter" && !searchModal.hidden && focusedGlobalSearchResult()')
    && keydown.includes("event.preventDefault();\n    focusedGlobalSearchResult()?.click();"),
  "Enter must explicitly activate the focused Global Search result instead of relying on browser default button activation.",
);

invariant(
  foundations.includes(".searchResult:focus-visible,\n.evaluationSearchResult:focus-visible {\n  outline: none;\n}")
    && shared.includes('active.classList.contains("searchResult")'),
  "Search-result keyboard focus must keep the existing row highlight without a second browser-default light outline.",
);

console.log("Global Search keyboard close, focused-result activation, and row-highlight focus styling are validated.");
