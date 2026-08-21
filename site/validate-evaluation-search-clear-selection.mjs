import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [layoutRuntime, searchRuntime, indexHtml] = await Promise.all([
  read("./evaluation-layout-runtime.js"),
  read("./evaluation-search-state-runtime.js"),
  read("./index.html"),
]);

invariant(
  !layoutRuntime.includes(".focus(")
    && !layoutRuntime.includes(".select(")
    && !layoutRuntime.includes("selectWhenReady")
    && !layoutRuntime.includes("mfl:ready")
    && !layoutRuntime.includes("mfl:loading-state"),
  "Evaluation layout must not automatically focus or select the search input on first paint, readiness, loading completion, or route return.",
);

const clearStart = searchRuntime.indexOf('const clear = event.target.closest("#evaluationSearchClearButton");');
const clearEnd = searchRuntime.indexOf('const result = event.target.closest("#evaluationSearchResults .evaluationSearchResult");', clearStart);
const clearSource = clearStart >= 0 && clearEnd > clearStart ? searchRuntime.slice(clearStart, clearEnd) : "";
invariant(
  clearSource.includes("directPointerFocus = true;")
    && clearSource.includes("field.focus({ preventScroll: true });")
    && clearSource.includes("field.select();")
    && clearSource.includes("clearDirectPointerFocus();"),
  "Clicking the Evaluation clear X must focus and select the empty Evaluation search input.",
);

invariant(
  !indexHtml.includes('id="evaluationSearchInput" autofocus')
    && !indexHtml.includes('autofocus id="evaluationSearchInput"'),
  "The Evaluation search input must not use HTML autofocus on first paint.",
);

invariant(
  !searchRuntime.includes("blockSearchInteractionWhileLoading")
    && !searchRuntime.includes('addEventListener("beforeinput"'),
  "Evaluation clear-only selection must not add keyboard blocking while loading.",
);

console.log("Evaluation search clear-selection validation passed: no automatic selection and clear X selects the input.");
