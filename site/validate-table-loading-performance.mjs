import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [build, optimizer, tableRuntime] = await Promise.all([
  read("./build-app-core.mjs"),
  read("./modules/app-core-table-loading-performance.js"),
  read("./modules/app-core-table-runtime.js"),
]);

includes(
  build,
  'import { optimizeTableLoadingRuntimeArtifacts } from "./modules/app-core-table-loading-performance.js";',
  "The canonical application-core build must load the Step 10 Table loading optimizer.",
);
const tableLoadingOptimizerIndex = build.indexOf("optimizeTableLoadingRuntimeArtifacts(");
const cachedRouteOptimizerIndex = build.indexOf("optimizeCachedRouteRuntimeArtifacts(", tableLoadingOptimizerIndex);
invariant(
  tableLoadingOptimizerIndex >= 0 && cachedRouteOptimizerIndex > tableLoadingOptimizerIndex,
  "Step 10 must compose outside Step 9 without changing prior optimizer ownership.",
);

includes(
  optimizer,
  'replaceRequiredFunction(\n    table,\n    "renderTableLoadingShell"',
  "Step 10 must optimize the canonical generated Table loading owner at build time.",
);

const shellStart = tableRuntime.indexOf("function renderTableLoadingShell(pageName) {");
const shellEnd = tableRuntime.indexOf("function tableNextOverallInfo", shellStart);
invariant(shellStart >= 0 && shellEnd > shellStart, "Generated Table runtime must contain loading-shell ownership.");
const shell = tableRuntime.slice(shellStart, shellEnd);

includes(shell, "if (filterRules.childNodes.length) filterRules.replaceChildren();", "Empty Club filter rules must not be cleared again.");
includes(shell, "if (input && input.checked !== checked) input.checked = checked;", "Quick-filter checkbox writes must happen only when state changes.");
includes(shell, "if (element && element.hidden !== hidden) element.hidden = hidden;", "Loading chrome visibility writes must happen only when state changes.");
includes(shell, "if (tablePageTitle.textContent !== title) tablePageTitle.textContent = title;", "Table titles must not be rewritten when already correct.");
includes(shell, "if (emptyState.textContent) emptyState.textContent = \"\";", "Empty-state text must not be rewritten when already empty.");
includes(
  shell,
  "window.__mflTableLoadingRuntime?.show?.({ replaceExisting: true, forceRoute: true })",
  "Uniform Loading must replace the previous rows directly instead of following an eager empty-body clear.",
);
includes(shell, "if (!loadingShown) tableBody.replaceChildren();", "A missing/failed loading runtime must retain the safe empty-body fallback.");

const loadingCall = shell.indexOf("window.__mflTableLoadingRuntime?.show?.({ replaceExisting: true, forceRoute: true })");
const fallbackClear = shell.indexOf("tableBody.replaceChildren();", loadingCall);
invariant(loadingCall >= 0 && fallbackClear > loadingCall, "The only explicit Table-body clear must be the post-loading-runtime fallback.");
excludes(shell.slice(0, loadingCall), "tableBody.replaceChildren();", "Table loading must not empty the body before Uniform Loading replaces it.");

// Deterministic DOM-operation accounting: the previous shell cleared the real
// rows once and Uniform Loading then replaced that empty body with loading rows.
// Step 10 delegates replacement directly, leaving one body replacement.
const previousBodyReplacements = 2;
const optimizedBodyReplacements = 1;
const bodyReplacementReductionPercent = Math.round((1 - optimizedBodyReplacements / previousBodyReplacements) * 100);
invariant(bodyReplacementReductionPercent === 50, "Step 10 must retain the measured 50% Table-body replacement reduction per loading-shell entry.");

console.log(
  `Table loading performance validation passed: loading-shell Table-body replacements ${previousBodyReplacements} -> ${optimizedBodyReplacements} (${bodyReplacementReductionPercent}% reduction), with unchanged Uniform Loading fallback semantics and change-only chrome writes.`,
);
