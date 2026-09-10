import { readFile } from "node:fs/promises";

import { coreSourceByDomain } from "./modules/core-source-manifest.js";
import { readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => { if (!condition) throw new Error(message); };

const [staticUi, bootstrap, selectionStack, sharedCore, tableCore, generatedShared, generatedTable, buildCore] = await Promise.all([
  read("./static-ui-runtime.js"),
  read("./bootstrap.js"),
  read("./selection-stack-runtime.js"),
  Promise.resolve(readCanonicalCoreSource("shared")),
  Promise.resolve(readCanonicalCoreSource("table")),
  read("./modules/app-core-runtime.js"),
  read("./modules/app-core-table-runtime.js"),
  read("./build-app-core.mjs"),
]);
const appCore = `${sharedCore}\n${tableCore}`;
const generated = `${generatedShared}\n${generatedTable}`;

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
    && bootstrap.includes('const controlState = normalizedBootstrapTableControlState(normalizedPage, view, savedState);')
    && bootstrap.includes('const activeRuleCount = resetFilters ? 0 : controlState.activeRuleCount;')
    && bootstrap.includes('filterSummary.textContent = String(activeRuleCount);')
    && bootstrap.includes('filterRules.replaceChildren();')
    && !bootstrap.includes('filterSummary.textContent = "0 active";'),
  "Destination table first paint must preserve saved controls and a count-only saved-rule summary while explicit page resets remain zeroed.",
);
invariant(
  bootstrap.includes('function normalizedBootstrapTableControlState(pageName, viewName, savedState = {}) {'),
  "Bootstrap must own a normalized fallback for saved first-paint table controls.",
);
const quickFiltersMarkup = await read("./index.html");
const quickFiltersStart = quickFiltersMarkup.indexOf('<section class="quickFilters" aria-label="Quick filters">');
const quickFiltersProjection = quickFiltersMarkup.indexOf('const state = window.__mflInitialTableControlState;', quickFiltersStart);
const controlsBarStart = quickFiltersMarkup.indexOf('<section class="controlsBar" aria-label="Table controls">', quickFiltersStart);
invariant(
  quickFiltersMarkup.includes('window.__mflNormalizeInitialTableControlState = normalizeInitialTableControlState;')
    && quickFiltersMarkup.includes('window.__mflInitialTableControlState = normalizeInitialTableControlState(')
    && quickFiltersMarkup.includes('const mflPackable = pageName === "mfl"\n            ? (newMints ? false')
    && quickFiltersStart >= 0
    && quickFiltersProjection > quickFiltersStart
    && controlsBarStart > quickFiltersProjection
    && quickFiltersMarkup.includes('setChecked("hideRetiredInput", state.hideRetired);')
    && quickFiltersMarkup.includes('setChecked("hideRetiringInput", state.hideRetiring);')
    && quickFiltersMarkup.includes('setChecked("hideMflPlayersInput", state.hideMflPlayers);')
    && quickFiltersMarkup.includes('setChecked("packablePlayersInput", state.mflPackable);')
    && quickFiltersMarkup.includes('setChecked("newMintsInput", state.newMints);')
    && quickFiltersMarkup.includes('filterSummary.textContent = String(activeRuleCount);'),
  "Parser-time first paint must apply saved Quick Filters, MFL exclusivity, and the valid saved-rule count before later table chrome is parsed.",
);
invariant(
  appCore.includes('function tableStateWithoutPageFilters(pageName, savedState) {')
    && appCore.includes('rules: [],\n    selectedPlayerIds: [],')
    && appCore.includes('const resetFilters = document.documentElement.dataset.mflResetTableFilters === pageName;')
    && appCore.includes('delete document.documentElement.dataset.mflResetTableFilters;'),
  "Table restore must clear only destination filter/selection state and consume the page-reset marker after controls synchronize.",
);
invariant(
  !appCore.includes('return columns.filter((column) => column === contractStatusFilterColumn || state.columns.includes(column));')
    && appCore.includes('restoreSavedTableState(pageName);\n    globalThis.syncQuickFilterLabels?.();\n    syncRestoredTableControls(pageName);')
    && !generated.includes('return columns.filter((column) => column === contractStatusFilterColumn || state.columns.includes(column));')
    && generated.includes('restoreSavedTableState(pageName);\n    globalThis.syncQuickFilterLabels?.();\n    syncRestoredTableControls(pageName);'),
  "Advanced Filters must use the destination schema and restore controls during the loading shell instead of waiting for hydrated table columns.",
);
invariant(
  appCore.includes('const pageName = tablePageKey() || state.currentPage || "progression";\n  if (!syncRestoredTableControls(pageName)) {\n    removeUnavailableFilterRules(pageName);\n    populateAddFilterSelect(pageName);\n    refreshRuleColumnSelects(pageName);\n    updateFilterSummary();\n  }\n  state.filterDraftRules = readFilterDraftRules();')
    && generated.includes('const pageName = tablePageKey() || state.currentPage || "progression";\n  if (!syncRestoredTableControls(pageName)) {\n    removeUnavailableFilterRules(pageName);\n    populateAddFilterSelect(pageName);\n    refreshRuleColumnSelects(pageName);\n    updateFilterSummary();\n  }\n  state.filterDraftRules = readFilterDraftRules();'),
  "Opening Advanced Filters must synchronize pending controls or populate the destination-schema selector before capturing the draft, including during initial loading.",
);
invariant(
  appCore.includes('const storedPageState = pageName !== "club" && !clubTarget && tablePages.has(pageName)')
    && appCore.includes('const resetFilters = document.documentElement.dataset.mflResetTableFilters === pageName;')
    && appCore.includes('? tableStateWithoutPageFilters(pageName, storedPageState)')
    && appCore.includes('if (resetFilters && savedPageState) state.tablePageStates[pageName] = savedPageState;')
    && generated.includes('const storedPageState = pageName !== "club" && !clubTarget && tablePages.has(pageName)')
    && generated.includes('route.filterRules = filterRulesForLoading(pageName, restoredPageState, route.view);')
    && generated.includes('route.tableFilters = {'),
  "Canonical source must build destination incremental requests from the resolved filter state before the generated route request runs.",
);
invariant(
  appCore.includes('if (pageName === activePageName && tablePages.has(pageName)) {\n    saveTableStateLocally(currentTableState());\n  }')
    && generated.includes('if (pageName === activePageName && tablePages.has(pageName)) {\n    saveTableStateLocally(currentTableState());\n  }'),
  "Canonical source and generated runtime must snapshot live quick-filter controls before synchronous destination chrome can read persisted state.",
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

invariant(
  !buildCore.includes("app-core-build-normalizer")
    && !buildCore.includes("app-core-filter-control-state")
    && buildCore.includes('from "./modules/core-source-manifest.js"')
    && buildCore.includes("for (const entry of coreSourceManifest)")
    && coreSourceByDomain.table?.source === "table.js"
    && coreSourceByDomain.table?.sources?.length === 3
    && coreSourceByDomain.table.sources[0] === "table.js"
    && coreSourceByDomain.table.sources[1] === "table-render-lifecycle.js"
    && coreSourceByDomain.table.sources[2] === "table-interaction-bindings.js"
    && coreSourceByDomain.table?.runtime === "app-core-table-runtime.js",
  "The canonical build must copy source-owned Table behavior directly from the manifest instead of restoring retired filter/reset transforms.",
);
const sharedBanner = String(coreSourceByDomain.shared?.banner || "");
const tableBanner = String(coreSourceByDomain.table?.banner || "");
invariant(sharedBanner && generatedShared.startsWith(sharedBanner), "Generated shared core must retain its canonical manifest-owned banner.");
invariant(tableBanner && generatedTable.startsWith(tableBanner), "Generated Table core must retain its canonical manifest-owned banner.");
invariant(
  generatedShared.slice(sharedBanner.length).replace(/\s*$/, "") === sharedCore.replace(/\s*$/, "")
    && generatedTable.slice(tableBanner.length).replace(/\s*$/, "") === tableCore.replace(/\s*$/, ""),
  "Generated shared/Table runtimes must exactly match their canonical sources.",
);

const precedenceEvaluatorContract = `function rowMatchesRules(row, rules) {
  if (!rules.length) {
    return true;
  }

  let result = false;
  let andGroupResult = ruleMatches(row, rules[0]);`;
invariant(
  tableCore.includes(precedenceEvaluatorContract)
    && tableCore.includes('result = result || andGroupResult;\n      andGroupResult = current;')
    && tableCore.includes('andGroupResult = andGroupResult && current;')
    && tableCore.includes('return result || andGroupResult;')
    && generatedTable.includes(precedenceEvaluatorContract)
    && generatedTable.includes('return result || andGroupResult;'),
  "The shared Table filter evaluator must resolve contiguous AND groups before OR-ing those groups together in both canonical and generated runtime code.",
);
invariant(
  !tableCore.includes('result = result || current;')
    && !tableCore.includes('result = result && current;'),
  "Mixed filter connectors must not fall back to the retired left-to-right boolean fold.",
);

function evaluateBooleanRuleChain(matches, connectors) {
  if (!matches.length) return true;
  let result = false;
  let andGroupResult = Boolean(matches[0]);
  for (let index = 1; index < matches.length; index += 1) {
    const current = Boolean(matches[index]);
    if (connectors[index] === "or") {
      result = result || andGroupResult;
      andGroupResult = current;
    } else {
      andGroupResult = andGroupResult && current;
    }
  }
  return result || andGroupResult;
}

invariant(evaluateBooleanRuleChain([true, false, false], ["and", "or", "and"]) === true, "A OR (B AND C) must stay true when A is true even if B and C are false.");
invariant(evaluateBooleanRuleChain([false, true, true], ["and", "or", "and"]) === true, "A OR (B AND C) must be true when the second AND group matches.");
invariant(evaluateBooleanRuleChain([false, true, false], ["and", "or", "and"]) === false, "A OR (B AND C) must be false when neither A nor the complete B/C group matches.");
invariant(evaluateBooleanRuleChain([true, true, false, true], ["and", "and", "or", "and"]) === true, "(A AND B) OR (C AND D) must preserve independent AND groups.");
invariant(evaluateBooleanRuleChain([true, true, true], ["and", "and", "and"]) === true, "Pure AND chains must retain their existing semantics.");
invariant(evaluateBooleanRuleChain([false, false, true], ["and", "or", "or"]) === true, "Pure OR chains must retain their existing semantics.");

console.log("Source-owned page filter isolation, live quick-filter preservation, request-time player reset, and view/filter selection lifecycle validation passed.");
