// @ts-check

import { replaceRequired, replaceRequiredFunction } from "./app-core-splitter-utils.js";

const OPTIMIZED_RESTORED_TABLE_CONTROLS = `function syncRestoredTableControls(pageName = tablePageKey() || "progression") {
  const restored = state.pendingTableControlRestore;
  if (!restored || restored.pageName !== pageName) return false;

  const availableColumns = availableFilterColumns(pageName);
  const allowedColumns = new Set(availableColumns);
  const restoredRules = restored.rules.filter((rule) => allowedColumns.has(rule.column));
  const currentRules = readFilterDraftRules();
  const restoreContext = [pageName, state.view, ...availableColumns].join("|");
  const contextMatches = filterRules.dataset.mflRestoreContext === restoreContext;
  const rulesMatch = currentRules.length === restoredRules.length
    && currentRules.every((rule, index) => {
      const expected = restoredRules[index];
      return rule.column === expected.column
        && rule.connector === expected.connector
        && rule.operator === expected.operator
        && rule.value === expected.value
        && rule.valueTo === expected.valueTo;
    });
  const controlsMatch = pageSizeSelect.value === String(state.pageSize)
    && hideRetiredInput.checked === restored.hideRetired
    && hideRetiringInput.checked === restored.hideRetiring
    && Boolean(hideMflPlayersInput?.checked) === restored.hideMflPlayers
    && Boolean(packablePlayersInput?.checked) === restored.mflPackable
    && newMintsInput.checked === restored.newMints;

  if (contextMatches && rulesMatch && controlsMatch) {
    updateFilterSummary();
    if (document.documentElement.dataset.mflResetTableFilters === pageName) {
      delete document.documentElement.dataset.mflResetTableFilters;
    }
    state.pendingTableControlRestore = null;
    return true;
  }

  const pageSize = String(state.pageSize);
  if (pageSizeSelect.value !== pageSize) pageSizeSelect.value = pageSize;
  if (hideRetiredInput.checked !== restored.hideRetired) hideRetiredInput.checked = restored.hideRetired;
  if (hideRetiringInput.checked !== restored.hideRetiring) hideRetiringInput.checked = restored.hideRetiring;
  if (hideMflPlayersInput && hideMflPlayersInput.checked !== restored.hideMflPlayers) {
    hideMflPlayersInput.checked = restored.hideMflPlayers;
  }
  if (packablePlayersInput && packablePlayersInput.checked !== restored.mflPackable) {
    packablePlayersInput.checked = restored.mflPackable;
  }
  if (newMintsInput.checked !== restored.newMints) newMintsInput.checked = restored.newMints;

  if (!contextMatches || !rulesMatch) {
    filterRules.replaceChildren();
    for (const rule of restoredRules) {
      addFilterRule(rule.column, {
        connector: rule.connector,
        operator: rule.operator,
        value: rule.value,
        valueTo: rule.valueTo,
        focus: false,
      });
    }

    populateAddFilterSelect(pageName);
    refreshRuleColumnSelects(pageName);
    filterRules.dataset.mflRestoreContext = restoreContext;
  }

  updateFilterSummary();
  if (document.documentElement.dataset.mflResetTableFilters === pageName) {
    delete document.documentElement.dataset.mflResetTableFilters;
  }
  state.pendingTableControlRestore = null;
  return true;
}`;

export function optimizeTableChromeRuntimeArtifacts(artifacts) {
  const input = artifacts && typeof artifacts === "object" ? artifacts : {};
  let core = String(input.core || "");
  const routeChunks = { ...(input.routeChunks || {}) };
  let table = String(routeChunks.table || "");
  if (!core) throw new Error("Cannot optimize Table chrome work without the shared application core.");
  if (!table) throw new Error("Cannot optimize Table chrome work without the Table route chunk.");

  core = replaceRequired(
    core,
    `      state.incrementalApplying = true;\n      try {\n        buildHeader();\n        applyFilters({ save: options.save !== false });`,
    `      state.incrementalApplying = true;\n      try {\n        applyFilters({ save: options.save !== false });`,
    "skip same-view header synchronization during incremental page reloads",
  );

  core = replaceRequired(
    core,
    `    state.pageSize = Number(payload.pageSize || state.pageSize);\n    pageSizeSelect.value = String(state.pageSize);`,
    `    state.pageSize = Number(payload.pageSize || state.pageSize);\n    const nextPageSizeValue = String(state.pageSize);\n    if (pageSizeSelect.value !== nextPageSizeValue) pageSizeSelect.value = nextPageSizeValue;`,
    "avoid unchanged page-size control writes while applying incremental payloads",
  );

  table = replaceRequiredFunction(
    table,
    "syncRestoredTableControls",
    OPTIMIZED_RESTORED_TABLE_CONTROLS,
    "Table restored-control structural reuse",
  );

  routeChunks.table = table;
  return Object.freeze({
    ...input,
    core,
    routeChunks: Object.freeze(routeChunks),
  });
}
