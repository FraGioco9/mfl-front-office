import { readFile } from "node:fs/promises";
import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => { if (!condition) throw new Error(message); };

const [staticUi, bootstrap, selectionStack, appCore] = await Promise.all([
  read("./static-ui-runtime.js"),
  read("./bootstrap.js"),
  read("./selection-stack-runtime.js"),
  read("./modules/app-core.js"),
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
    && bootstrap.includes('filterSummary.textContent = "0 active";'),
  "Destination table first paint must show default controls and zero advanced filters on a page switch.",
);
invariant(
  appCore.includes('function tableStateWithoutPageFilters(pageName, savedState) {')
    && appCore.includes('rules: [],\n    selectedPlayerIds: [],')
    && appCore.includes('const resetFilters = document.documentElement.dataset.mflResetTableFilters === pageName;')
    && appCore.includes('delete document.documentElement.dataset.mflResetTableFilters;'),
  "Table restore must clear only destination filter/selection state and consume the page-reset marker after controls synchronize.",
);
invariant(
  appCore.includes('function appliedTableFilterSignature(rules) {')
    && appCore.includes('if (lastAppliedTableFilterSignature && filterSignature !== lastAppliedTableFilterSignature) {\n    state.selectedPlayerIds.clear();\n    state.selectionAnchorPlayerId = null;')
    && generated.includes('function appliedTableFilterSignature(rules) {'),
  "Applied filter changes must clear player selection in the canonical generated table owner.",
);

const sortCommit = 'state.page = 1;\n        buildHeader();\n        applyFilters();';
invariant(
  appCore.includes(sortCommit)
    && !sortCommit.includes("clearSelection(")
    && !sortCommit.includes("selectedPlayerIds.clear()"),
  "Sorting must reapply unchanged filters without directly clearing player selection.",
);

console.log("Page filter isolation and view/filter selection reset validation passed.");
