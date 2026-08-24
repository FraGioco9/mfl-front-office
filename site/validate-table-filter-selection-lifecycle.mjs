import { readFile } from "node:fs/promises";
import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => { if (!condition) throw new Error(message); };

const [staticUi, bootstrap, selectionStack, appCore, buildNormalizer] = await Promise.all([
  read("./static-ui-runtime.js"),
  read("./bootstrap.js"),
  read("./selection-stack-runtime.js"),
  read("./modules/app-core.js"),
  read("./modules/app-core-build-normalizer.js"),
]);
const artifacts = normalizeBuiltApplicationCoreArtifacts(appCore);
const generated = [String(artifacts.core || ""), ...Object.values(artifacts.routeChunks || {}).map(String)].join("\n");

invariant(
  staticUi.includes('const pageChanged = Boolean(previousPage && previousPage !== state.page);')
    && staticUi.includes('const viewChanged = Boolean(previousPage && !pageChanged && previousView !== state.view);')
    && staticUi.includes('document.documentElement.dataset.mflResetTableFilters = state.page;')
    && staticUi.includes('showRouteShell(state, { resetFilters });'),
  "Page transitions must mark destination filter reset before first paint while same-page view transitions remain filter-neutral.",
);
invariant(
  staticUi.includes('window.__mflSelectionStackRuntime?.clearForRouteTransition?.();')
    && selectionStack.includes('function clearForRouteTransition() {')
    && selectionStack.includes('clearApplicationSelection(null);'),
  "Page and view transitions must clear player selection through the canonical selection lifecycle owner.",
);
invariant(
  bootstrap.includes('function primeTableChrome(page, urlLike = window.location.href, options = {}) {')
    && bootstrap.includes('const savedState = resetFilters ? {} : storedTablePageState(normalizedPage) || {};')
    && bootstrap.includes('filterRules.replaceChildren();')
    && bootstrap.includes('filterSummary.textContent = "0";')
    && !bootstrap.includes('filterSummary.textContent = "0 active";'),
  "Destination table first paint must show default controls and a count-only zero summary on a page switch.",
);
invariant(
  appCore.includes('function tableStateWithoutPageFilters(pageName, savedState) {')
    && appCore.includes('rules: [],\n    selectedPlayerIds: [],')
    && appCore.includes('const resetFilters = document.documentElement.dataset.mflResetTableFilters === pageName;')
    && appCore.includes('delete document.documentElement.dataset.mflResetTableFilters;'),
  "Table restore must clear only destination filter/selection state and consume the page-reset marker after controls synchronize.",
);
invariant(
  appCore.includes('const storedPageState = pageName !== "club" && !clubTarget && tablePages.has(pageName)')
    && appCore.includes('const resetFilters = document.documentElement.dataset.mflResetTableFilters === pageName;')
    && appCore.includes('? tableStateWithoutPageFilters(pageName, storedPageState)')
    && appCore.includes('if (resetFilters && savedPageState) state.tablePageStates[pageName] = savedPageState;')
    && generated.includes('const storedPageState = pageName !== "club" && !clubTarget && tablePages.has(pageName)')
    && generated.includes('route.filterRules = filterRulesForLoading(pageName, savedPageState, route.view);'),
  "Canonical source must build destination incremental requests from reset filter state before the generated route request runs.",
);
invariant(
  appCore.includes('if (pageName === activePageName && tablePages.has(pageName)) {\n    saveTableStateLocally(currentTableState());\n  }')
    && generated.includes('if (pageName === activePageName && tablePages.has(pageName)) {\n    saveTableStateLocally(currentTableState());\n  }'),
  "Canonical source and generated runtime must snapshot live quick-filter controls before synchronous destination chrome can read persisted state.",
);
invariant(
  !buildNormalizer.includes("normalizePageFilterResetBeforeRequest")
    && !buildNormalizer.includes("normalizeViewFilterStateBeforeTransition")
    && !buildNormalizer.includes("normalizePagerCurrentPageLifecycle")
    && !buildNormalizer.includes("pagerCurrentPageArtifacts")
    && !buildNormalizer.includes("normalizeTableControlCellAlignment")
    && !buildNormalizer.includes("tableControlCellArtifacts")
    && !buildNormalizer.includes("normalizeHomeSummaryLifecycle")
    && !buildNormalizer.includes("homeSummaryArtifacts")
    && !buildNormalizer.includes("normalizeGlobalSearchOpenLifecycle")
    && !buildNormalizer.includes("globalSearchArtifacts")
    && !buildNormalizer.includes("normalizeStatsNavigationLifecycle")
    && !buildNormalizer.includes("statsNavigationArtifacts")
    && !buildNormalizer.includes("normalizeEvaluationRecentReadiness")
    && !buildNormalizer.includes("evaluationRecentArtifacts")
    && !buildNormalizer.includes("normalizeEvaluationLoadLifecycle")
    && !buildNormalizer.includes("evaluationLoadArtifacts")
    && !buildNormalizer.includes("normalizeEvaluationSavedValuationCache")
    && buildNormalizer.includes("return watchlistArtifacts;"),
  "Build normalization must not inject page/view filter, editable-pager, Table control-cell, Stats navigation, or Evaluation recent-readiness behavior.",
);
const activeViewNoOp = generated.indexOf('if (pageName === activePageName && viewName === activeViewName) return;');
const liveFilterSnapshot = generated.indexOf('saveTableStateLocally(currentTableState());', activeViewNoOp);
const viewTransition = generated.indexOf('runViewTransition(', activeViewNoOp);
invariant(
  activeViewNoOp >= 0 && liveFilterSnapshot > activeViewNoOp && viewTransition > liveFilterSnapshot,
  "Live quick-filter state must be persisted after the active-view no-op and before any view transition begins.",
);
invariant(
  appCore.includes('function appliedTableFilterSignature(rules) {')
    && appCore.includes('if (lastAppliedTableFilterSignature && filterSignature !== lastAppliedTableFilterSignature) {\n    state.selectedPlayerIds.clear();\n    state.selectionAnchorPlayerId = null;')
    && generated.includes('function appliedTableFilterSignature(rules) {'),
  "Applied filter changes must clear player selection in the canonical generated table owner.",
);

const sortCommit = 'state.page = 1;\n        buildHeader();\n        applyFilters();';
invariant(
  appCore.includes(sortCommit) && generated.includes(sortCommit),
  "Source and generated sorting must reapply unchanged filters instead of owning a separate selection reset.",
);

console.log("Page filter isolation, live quick-filter preservation across view switches, request-time player reset, and view/filter selection reset validation passed.");