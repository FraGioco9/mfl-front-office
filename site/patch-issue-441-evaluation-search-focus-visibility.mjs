import { readFile, writeFile } from "node:fs/promises";

const replaceOnce = (source, before, after, label) => {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing patch target: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Patch target is not unique: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
};

const runtimePath = new URL("./evaluation-search-state-runtime.js", import.meta.url);
let runtime = await readFile(runtimePath, "utf8");

runtime = replaceOnce(
  runtime,
  `  let recentLoadingActive = false;\n  let directPointerFocus = false;`,
  `  let recentLoadingActive = false;\n  let resultPointerDown = false;\n  let directPointerFocus = false;`,
  "result pointer state",
);

runtime = replaceOnce(
  runtime,
  `  function syncClearButton(field = input()) {`,
  `  function shouldShowTypedResults(field = input()) {\n    if (!(field instanceof HTMLInputElement) || !active()) return true;\n    if (!field.value.trim() || !playerSelected()) return true;\n    return document.activeElement === field || resultPointerDown;\n  }\n\n  function syncTypedResultVisibility(field = input()) {\n    if (shouldShowTypedResults(field)) return;\n    const results = document.getElementById("evaluationSearchResults");\n    if (results instanceof HTMLElement) results.hidden = true;\n  }\n\n  function syncClearButton(field = input()) {`,
  "typed result focus visibility helpers",
);

runtime = replaceOnce(
  runtime,
  `    syncSelectedPlayerLabel(field);\n    syncClearButton(field);\n    if (!field.value.trim()) void restoreEmptyRecentResults(false, true);`,
  `    syncSelectedPlayerLabel(field);\n    syncClearButton(field);\n    syncTypedResultVisibility(field);\n    if (!field.value.trim()) void restoreEmptyRecentResults(false, true);`,
  "sync hides loaded typed results when unfocused",
);

runtime = replaceOnce(
  runtime,
  `  function onPointerDown(event) {\n    const field = input();\n    clearDirectPointerFocus();\n    if (event.target instanceof Element) {\n      const title = event.target.closest(".evaluationSearch .field > span");`,
  `  function onPointerDown(event) {\n    const field = input();\n    clearDirectPointerFocus();\n    resultPointerDown = event.target instanceof Element\n      && Boolean(event.target.closest("#evaluationSearchResults .evaluationSearchResult"));\n    if (resultPointerDown) return;\n    if (event.target instanceof Element) {\n      const title = event.target.closest(".evaluationSearch .field > span");`,
  "preserve result click through input blur",
);

runtime = replaceOnce(
  runtime,
  `  function onRecentLoadingFocusCapture(event) {`,
  `  function onPointerUp() {\n    resultPointerDown = false;\n  }\n\n  function onRecentLoadingFocusCapture(event) {`,
  "reset result pointer state",
);

runtime = replaceOnce(
  runtime,
  `  function onBlur(event) {\n    const field = input();\n    if (!(field instanceof HTMLInputElement) || event.target !== field) return;\n    syncSelectedPlayerLabel(field);\n    syncClearButton(field);\n  }`,
  `  function onBlur(event) {\n    const field = input();\n    if (!(field instanceof HTMLInputElement) || event.target !== field) return;\n    syncSelectedPlayerLabel(field);\n    syncClearButton(field);\n    syncTypedResultVisibility(field);\n  }`,
  "blur hides loaded typed results",
);

runtime = replaceOnce(
  runtime,
  `  function onReady() {\n    installCoreBridges();\n    void restoreEmptyRecentResults(false);\n  }`,
  `  function onReady() {\n    installCoreBridges();\n    const field = input();\n    if (field instanceof HTMLInputElement) {\n      syncClearButton(field);\n      syncTypedResultVisibility(field);\n    }\n    void restoreEmptyRecentResults(false);\n  }`,
  "ready state enforces typed result visibility",
);

runtime = replaceOnce(
  runtime,
  `    syncSelectedPlayerLabel(field);\n    syncClearButton(field);\n    if (!field.value.trim()) void restoreEmptyRecentResults(false, true);\n  }\n\n  purgeLegacyLocalRecentState();`,
  `    syncSelectedPlayerLabel(field);\n    syncClearButton(field);\n    syncTypedResultVisibility(field);\n    if (!field.value.trim()) void restoreEmptyRecentResults(false, true);\n  }\n\n  purgeLegacyLocalRecentState();`,
  "route activation enforces typed result visibility",
);

runtime = replaceOnce(
  runtime,
  `  document.addEventListener("pointerdown", onPointerDown, true);\n  document.addEventListener("focus", onRecentLoadingFocusCapture, true);`,
  `  document.addEventListener("pointerdown", onPointerDown, true);\n  document.addEventListener("pointerup", onPointerUp, true);\n  document.addEventListener("focus", onRecentLoadingFocusCapture, true);`,
  "install pointerup listener",
);

runtime = replaceOnce(
  runtime,
  `    document.removeEventListener("pointerdown", onPointerDown, true);\n    document.removeEventListener("focus", onRecentLoadingFocusCapture, true);`,
  `    document.removeEventListener("pointerdown", onPointerDown, true);\n    document.removeEventListener("pointerup", onPointerUp, true);\n    document.removeEventListener("focus", onRecentLoadingFocusCapture, true);`,
  "remove pointerup listener",
);

runtime = replaceOnce(
  runtime,
  `    recentLoadingActive = false;\n    recentWriteSequence += 1;`,
  `    recentLoadingActive = false;\n    resultPointerDown = false;\n    recentWriteSequence += 1;`,
  "destroy resets result pointer state",
);

runtime = replaceOnce(
  runtime,
  `    selectEmptySearch,\n    ownsEmptyRecentResults,\n    destroy,`,
  `    selectEmptySearch,\n    ownsEmptyRecentResults,\n    shouldShowTypedResults,\n    destroy,`,
  "export typed result visibility contract",
);

await writeFile(runtimePath, runtime);

const appCorePath = new URL("./modules/app-core.js", import.meta.url);
let appCore = await readFile(appCorePath, "utf8");
appCore = replaceOnce(
  appCore,
  `  const query = normalizeSearchText(evaluationSearchInput.value.trim());\n\n  if (!query && window.__mflEvaluationSearchStateRuntime?.ownsEmptyRecentResults?.()) {`,
  `  const query = normalizeSearchText(evaluationSearchInput.value.trim());\n\n  if (query && window.__mflEvaluationSearchStateRuntime?.shouldShowTypedResults?.() === false) {\n    evaluationSearchResults.hidden = true;\n    return;\n  }\n\n  if (!query && window.__mflEvaluationSearchStateRuntime?.ownsEmptyRecentResults?.()) {`,
  "canonical typed result visibility guard",
);
await writeFile(appCorePath, appCore);

const validatorPath = new URL("./validate-evaluation-search-lifecycle.mjs", import.meta.url);
let validator = await readFile(validatorPath, "utf8");
validator = replaceOnce(
  validator,
  `invariant(\n  searchRuntime.includes("function recentRule()")\n    && searchRuntime.includes("return active();")\n    && !searchRuntime.includes("if (field.value.trim()) return document.activeElement === field;"),\n  "Evaluation search results must remain eligible while the Evaluation page is active even after a typed search loses focus.",\n);\ninvariant(\n  !searchRuntime.includes("hideTypedBlurredResults"),\n  "Blurred non-empty Evaluation searches must keep their current result list visible.",\n);`,
  `invariant(\n  searchRuntime.includes("function recentRule()")\n    && searchRuntime.includes("return active();")\n    && !searchRuntime.includes("if (field.value.trim()) return document.activeElement === field;"),\n  "Empty Evaluation recent-result eligibility must remain page-scoped and independent from typed-result focus visibility.",\n);\ninvariant(\n  searchRuntime.includes("function shouldShowTypedResults(field = input())")\n    && searchRuntime.includes("if (!field.value.trim() || !playerSelected()) return true;")\n    && searchRuntime.includes("return document.activeElement === field || resultPointerDown;")\n    && searchRuntime.includes("function syncTypedResultVisibility(field = input())")\n    && searchRuntime.includes("results.hidden = true;")\n    && searchRuntime.includes("shouldShowTypedResults,"),\n  "Loaded non-empty Evaluation results must be visible only while the input is focused, with an in-progress result pointer selection protected.",\n);`,
  "replace old typed blur persistence contract",
);

validator = replaceOnce(
  validator,
  `invariant(\n  blurSource.includes("syncSelectedPlayerLabel(field);")\n    && blurSource.includes("syncClearButton(field);")\n    && !blurSource.includes("hidden = true")\n    && !blurSource.includes("replaceChildren")\n    && !blurSource.includes("restoreEmptyRecentResults")\n    && !blurSource.includes("setTimeout"),\n  "Evaluation blur must preserve typed results and must not independently re-render the recent-results surface.",\n);`,
  `invariant(\n  blurSource.includes("syncSelectedPlayerLabel(field);")\n    && blurSource.includes("syncClearButton(field);")\n    && blurSource.includes("syncTypedResultVisibility(field);")\n    && !blurSource.includes("replaceChildren")\n    && !blurSource.includes("restoreEmptyRecentResults")\n    && !blurSource.includes("setTimeout"),\n  "Evaluation blur must hide loaded typed results through the search-state owner without clearing results or disturbing empty recent-result rendering.",\n);`,
  "blur lifecycle validation",
);

validator = replaceOnce(
  validator,
  `invariant(\n  renderSource.includes('button.addEventListener("click", async () => {')`,
  `invariant(\n  renderSource.includes("if (query && window.__mflEvaluationSearchStateRuntime?.shouldShowTypedResults?.() === false) {")\n    && renderSource.includes("evaluationSearchResults.hidden = true;")\n    && renderSource.indexOf("shouldShowTypedResults?.() === false") < renderSource.indexOf("evaluationSearchResults.replaceChildren();"),\n  "Canonical Evaluation search rendering must not re-open loaded typed results while the search input is unfocused.",\n);\ninvariant(\n  renderSource.includes('button.addEventListener("click", async () => {')`,
  "canonical renderer visibility validation",
);

validator = replaceOnce(
  validator,
  `    && searchRuntime.includes('document.addEventListener("focus", onRecentLoadingFocusCapture, true);')\n    && searchRuntime.includes('document.addEventListener("blur", onRecentLoadingBlurCapture, true);'),`,
  `    && searchRuntime.includes('document.addEventListener("focus", onRecentLoadingFocusCapture, true);')\n    && searchRuntime.includes('document.addEventListener("blur", onRecentLoadingBlurCapture, true);')\n    && searchRuntime.includes('document.addEventListener("pointerup", onPointerUp, true);')\n    && pointerDownSource.includes('event.target.closest("#evaluationSearchResults .evaluationSearchResult")')\n    && pointerDownSource.includes("if (resultPointerDown) return;"),`,
  "protect result pointer selection validation",
);

await writeFile(validatorPath, validator);
