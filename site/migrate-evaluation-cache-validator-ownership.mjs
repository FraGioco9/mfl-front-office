// Temporary one-shot validator migration; removed by its workflow before commit.
// Trigger after the workflow exists on this branch.
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve(import.meta.dirname, "validate-evaluation-search-lifecycle.mjs");
const source = String(await readFile(path, "utf8")).replace(/\r\n?/g, "\n");
const startMarker = `invariant(\n  generatedSharedCore.includes("let evaluationPageCacheReady = false;")`;
const endMarker = `invariant(\n  searchRuntime.includes("void restoreEmptyRecentResults(true, active());"),`;
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0 || end <= start) throw new Error("Could not isolate the legacy Evaluation cache/re-entry assertion.");
const replacement = `const evaluationCacheMarkers = [
  "let evaluationPageCacheReady = false;",
  "function preparePlainEvaluationReentry() {",
  'state.evaluationShareId = "";',
  'state.evaluationSavedId = "";',
  "state.evaluationPlayerId = null;",
  "state.evaluationOverallRows = {};",
  "state.evaluationSummaryPositions = {};",
  'evaluationSearchInput.value = "";',
  "renderEmptyEvaluationSelection(false, true);",
  "function renderEmptyEvaluationSelection(showRecentResults = true, forcePlain = false) {",
  'const pendingEvaluationRoute = !forcePlain && window.location.pathname === "/evaluation" && Boolean(',
  "const cachedEvaluationReentry = plainEvaluationRoute",
  "options.reuseCachedRoute === true",
  "evaluationPageCacheReady;",
  'document.documentElement.classList.remove("mflEvaluationReady");',
  "await finishEvaluationReadiness();",
  "evaluationPageCacheReady = true;",
  "const setPageWithoutRouteLoading = setPage;",
  'const reuseCachedEvaluationRoute = pageName === "evaluation" && evaluationPageCacheReady;',
  "reuseCachedRoute: reuseCachedEvaluationRoute",
  'if (pageName === "evaluation") preparePlainEvaluationReentry();',
  "await setPageWithoutRouteLoading(pageName, true, options);",
  "await setPage(pageName, true, options);",
  'if (pageName === "evaluation") {\\n    if (options.plain) {',
];
const generatedEvaluationLifecycle = \`\${generatedSharedCore}\\n\${generatedEvaluationCore}\`;
for (const marker of evaluationCacheMarkers) {
  invariant(
    appCoreSource.includes(marker),
    \`Canonical Evaluation source must own cached plain-route re-entry through \${marker}\`,
  );
  invariant(
    generatedEvaluationLifecycle.includes(marker),
    \`Generated shared/Evaluation artifacts must preserve cached plain-route re-entry through \${marker}\`,
  );
}
invariant(
  searchRuntime.includes('window.addEventListener("mfl:evaluation-ready", onReady);')
    && !searchRuntime.includes("MutationObserver")
    && !generatedEvaluationLifecycle.includes('window.dispatchEvent(new CustomEvent("mfl:evaluation-route-active"));'),
  "Plain Evaluation re-entry must clear stale player chrome before first paint, reuse the completed in-session route without Uniform Loading/readiness work, and keep first visit/refresh on the normal loading path.",
);
`;
await writeFile(path, `${source.slice(0, start)}${replacement}${source.slice(end)}`);
console.log("Evaluation cache/re-entry validator now follows source ownership through structural splitting.");
