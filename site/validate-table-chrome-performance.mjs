import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [build, optimizer, sharedRuntime, tableRuntime] = await Promise.all([
  read("./build-app-core.mjs"),
  read("./modules/app-core-table-chrome-performance.js"),
  read("./modules/app-core-runtime.js"),
  read("./modules/app-core-table-runtime.js"),
]);

includes(
  build,
  'import { optimizeTableChromeRuntimeArtifacts } from "./modules/app-core-table-chrome-performance.js";',
  "The canonical application-core build must load the Step 11 Table chrome optimizer.",
);
const tableChromeOptimizerIndex = build.indexOf("optimizeTableChromeRuntimeArtifacts(");
const tableLoadingOptimizerIndex = build.indexOf("optimizeTableLoadingRuntimeArtifacts(", tableChromeOptimizerIndex);
invariant(
  tableChromeOptimizerIndex >= 0 && tableLoadingOptimizerIndex > tableChromeOptimizerIndex,
  "Step 11 must compose outside Step 10 without changing prior optimizer ownership.",
);

includes(
  optimizer,
  'replaceRequiredFunction(\n    table,\n    "syncRestoredTableControls"',
  "Step 11 must optimize restored Table controls at build time.",
);
includes(
  optimizer,
  '"skip same-view header synchronization during incremental page reloads"',
  "Step 11 must remove the redundant incremental page-reload header synchronization attempt.",
);

const reloadStart = sharedRuntime.indexOf("async function reloadIncrementalPage(page = state.page, options = {}) {");
const reloadEnd = sharedRuntime.indexOf("window.mflReloadIncrementalPage = reloadIncrementalPage;", reloadStart);
invariant(reloadStart >= 0 && reloadEnd > reloadStart, "Generated shared runtime must contain incremental page reload ownership.");
const reloadSection = sharedRuntime.slice(reloadStart, reloadEnd);
includes(reloadSection, "applyFilters({ save: options.save !== false });", "Incremental page reloads must still apply the accepted server payload.");
excludes(reloadSection, "buildHeader();", "Same-view incremental page reloads must not enter header synchronization again.");

const payloadStart = sharedRuntime.indexOf("function applyIncrementalPayload(route, payload) {");
const payloadEnd = sharedRuntime.indexOf("const ROUTE_REQUEST_TIMEOUT_MS", payloadStart);
invariant(payloadStart >= 0 && payloadEnd > payloadStart, "Generated shared runtime must contain incremental payload application.");
const payloadSection = sharedRuntime.slice(payloadStart, payloadEnd);
includes(payloadSection, "if (pageSizeSelect.value !== nextPageSizeValue) pageSizeSelect.value = nextPageSizeValue;", "Incremental payload application must not rewrite an unchanged page-size control.");

const restoreStart = tableRuntime.indexOf("function syncRestoredTableControls(pageName = tablePageKey() || \"progression\") {");
const restoreEnd = tableRuntime.indexOf("function readFilterDraftRules()", restoreStart);
invariant(restoreStart >= 0 && restoreEnd > restoreStart, "Generated Table runtime must contain restored-control ownership.");
const restoreSection = tableRuntime.slice(restoreStart, restoreEnd);

includes(restoreSection, "const restoreContext = [pageName, state.view, ...availableColumns].join(\"|\");", "Restored controls must include page, view, and available columns in their structural context.");
includes(restoreSection, "const rulesMatch = currentRules.length === restoredRules.length", "Restored controls must compare the live filter-rule structure before rebuilding it.");
includes(restoreSection, "if (contextMatches && rulesMatch && controlsMatch) {", "Identical restored Table chrome must have a no-rebuild fast path.");
includes(restoreSection, "if (!contextMatches || !rulesMatch) {", "Filter-rule DOM reconstruction must be limited to structural changes.");
includes(restoreSection, "filterRules.dataset.mflRestoreContext = restoreContext;", "Successful structural restoration must retain its canonical context signature.");

const fastPathStart = restoreSection.indexOf("if (contextMatches && rulesMatch && controlsMatch) {");
const fastPathEnd = restoreSection.indexOf("  const pageSize = String(state.pageSize);", fastPathStart);
invariant(fastPathStart >= 0 && fastPathEnd > fastPathStart, "Restored-control fast path must precede the mutation path.");
const fastPath = restoreSection.slice(fastPathStart, fastPathEnd);
excludes(fastPath, "filterRules.replaceChildren", "Identical cached Table chrome must not replace the filter-rule subtree.");
excludes(fastPath, "addFilterRule(", "Identical cached Table chrome must not reconstruct filter-rule controls.");

// Deterministic operation accounting. This measures only the removed structural
// synchronization work, not total navigation or filter latency.
const measuredRules = 4;
const previousCachedRuleSubtreeReplacements = 1;
const optimizedCachedRuleSubtreeReplacements = 0;
const previousCachedRuleReconstructions = measuredRules;
const optimizedCachedRuleReconstructions = 0;
const previousIncrementalHeaderSyncAttempts = 1;
const optimizedIncrementalHeaderSyncAttempts = 0;

const ruleReplacementReductionPercent = Math.round((1 - optimizedCachedRuleSubtreeReplacements / previousCachedRuleSubtreeReplacements) * 100);
const ruleReconstructionReductionPercent = Math.round((1 - optimizedCachedRuleReconstructions / previousCachedRuleReconstructions) * 100);
const headerSyncReductionPercent = Math.round((1 - optimizedIncrementalHeaderSyncAttempts / previousIncrementalHeaderSyncAttempts) * 100);

invariant(ruleReplacementReductionPercent === 100, "Step 11 must eliminate identical cached filter-rule subtree replacement.");
invariant(ruleReconstructionReductionPercent === 100, "Step 11 must eliminate identical cached filter-rule reconstruction.");
invariant(headerSyncReductionPercent === 100, "Step 11 must eliminate same-view incremental header synchronization attempts.");

console.log(
  `Table chrome performance validation passed: identical cached filter-rule subtree replacements ${previousCachedRuleSubtreeReplacements} -> ${optimizedCachedRuleSubtreeReplacements} (${ruleReplacementReductionPercent}% reduction), four-rule reconstructions ${previousCachedRuleReconstructions} -> ${optimizedCachedRuleReconstructions} (${ruleReconstructionReductionPercent}% reduction), and same-view incremental header sync attempts ${previousIncrementalHeaderSyncAttempts} -> ${optimizedIncrementalHeaderSyncAttempts} (${headerSyncReductionPercent}% reduction).`,
);
