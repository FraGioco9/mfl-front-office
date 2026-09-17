import { readFile } from "node:fs/promises";
import { invariant } from "./validation/assertions.mjs";
import { readCanonicalCoreSource } from "./validate-core-sources.mjs";

const shared = readCanonicalCoreSource("shared");
const controls = String(await readFile(new URL("./control-interactions-runtime.js", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const foundations = String(await readFile(new URL("./ui-foundations.css", import.meta.url), "utf8")).replace(/\r\n?/g, "\n");

const keydownStart = shared.indexOf('document.addEventListener("keydown", (event) => {');
const keydownEnd = shared.indexOf("\n});", keydownStart);
const keydown = keydownStart >= 0 && keydownEnd > keydownStart
  ? shared.slice(keydownStart, keydownEnd)
  : "";

invariant(
  shared.includes("/** @param {EventTarget | null} [target] */\nfunction focusedGlobalSearchResult(target = document.activeElement) {")
    && shared.includes("target instanceof HTMLButtonElement")
    && shared.includes("playerSearchResults.contains(target)")
    && shared.includes('target.classList.contains("searchResult")'),
  "Global Search keyboard activation must resolve the result button that actually owns the key event.",
);

invariant(
  shared.includes("function handleGlobalSearchEscape(event) {")
    && shared.includes('if (searchModal.hasAttribute("hidden")) return false;')
    && shared.includes("if (event.target === playerSearchInput) {\n    playerSearchInput.blur();\n  } else {\n    closeSearch();\n  }")
    && shared.includes('Reflect.get(window, "__mflControlInteractionsRuntime")?.registerEscapeHandler?.(\n  "global-search",\n  handleGlobalSearchEscape,\n  { priority: 200 },\n);')
    && !keydown.includes('event.key === "Escape" && !searchModal.hidden'),
  "Global Search Escape must use capture-phase ownership: first blur the focused search input, otherwise close Search.",
);

invariant(
  controls.includes("function globalSearchResultOwnsEnter(target) {")
    && controls.includes('document.getElementById("searchModal")')
    && controls.includes('target.classList.contains("searchResult")')
    && controls.includes("!globalSearchResultOwnsEnter(event.target)"),
  "The global modal Enter guard must let a focused Global Search result receive Enter instead of swallowing it in capture phase.",
);

invariant(
  keydown.includes('event.key === "Enter" && !searchModal.hasAttribute("hidden") && focusedGlobalSearchResult(event.target)')
    && keydown.includes("event.preventDefault();\n    focusedGlobalSearchResult(event.target)?.click();"),
  "Enter must explicitly activate the Global Search result that owns the keyboard event.",
);

invariant(
  foundations.includes(".searchResult:focus-visible,\n.evaluationSearchResult:focus-visible {\n  outline: none;\n}")
    && shared.includes('target.classList.contains("searchResult")'),
  "Search-result keyboard focus must keep the existing row highlight without a second browser-default light outline.",
);

console.log("Global Search capture-owned Escape, result Enter activation, and row-highlight focus styling are validated.");
