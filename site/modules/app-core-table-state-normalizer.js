// @ts-check

function replaceSourceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = start >= 0 ? source.indexOf(endMarker, start + startMarker.length) : -1;
  if (start < 0 || end < 0) {
    throw new Error(`Could not normalize table-state section: ${label}.`);
  }
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Could not normalize table-state pattern: ${label}.`);
  }
  return source.replace(before, after);
}

const PURE_TABLE_STATE_RESTORE = `function normalizedSavedTableControlState(pageName, savedState) {
  const newMints = Boolean(savedState.newMints);
  const mflPackable = pageName === "mfl"
    ? (newMints ? false : (savedState.mflPackable !== undefined ? Boolean(savedState.mflPackable) : true))
    : false;

  return {
    pageName,
    hideRetired: savedState.hideRetired !== false,
    hideRetiring: Boolean(savedState.hideRetiring),
    hideMflPlayers: pageName === "database"
      ? (savedState.hideMflPlayers !== undefined ? Boolean(savedState.hideMflPlayers) : true)
      : false,
    mflPackable,
    newMints,
    rules: Array.isArray(savedState.rules)
      ? savedState.rules.map((rule) => ({ ...rule }))
      : [],
  };
}

function restoreSavedTableState(pageName = tablePageKey() || "progression", options = {}) {
  const savedState = state.tablePageStates?.[pageName]
    || defaultTablePageState(pageName);

  state.view = normalizeViewForPage(options.view || savedState.view, pageName);

  if (Number(savedState.pageSize)) {
    state.pageSize = Number(savedState.pageSize);
  }

  const viewSortState = normalizedViewSortState(
    savedState.viewSortStates?.[state.view] || savedState,
    state.view,
  );
  state.sortKey = viewSortState.sortKey;
  state.sortDirection = viewSortState.sortDirection;
  state.selectedPlayerIds = new Set((savedState.selectedPlayerIds || []).map((playerId) => String(playerId)));
  state.pendingTableControlRestore = normalizedSavedTableControlState(pageName, savedState);
}

function syncRestoredTableControls(pageName = tablePageKey() || "progression") {
  const restored = state.pendingTableControlRestore;
  if (!restored || restored.pageName !== pageName) return false;

  pageSizeSelect.value = String(state.pageSize);
  hideRetiredInput.checked = restored.hideRetired;
  hideRetiringInput.checked = restored.hideRetiring;
  if (hideMflPlayersInput) hideMflPlayersInput.checked = restored.hideMflPlayers;
  if (packablePlayersInput) packablePlayersInput.checked = restored.mflPackable;
  newMintsInput.checked = restored.newMints;

  const allowedColumns = new Set(availableFilterColumns(pageName));
  filterRules.replaceChildren();
  for (const rule of restored.rules) {
    if (!allowedColumns.has(rule.column)) continue;
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
  updateFilterSummary();
  state.pendingTableControlRestore = null;
  return true;
}

`;

export function normalizePureTableStateRestoration(source) {
  let nextSource = String(source || "");
  if (nextSource.includes("function syncRestoredTableControls(")) return nextSource;

  nextSource = replaceSourceSection(
    nextSource,
    "function restoreSavedTableState(pageName = tablePageKey() || \"progression\", options = {}) {",
    "function readFilterDraftRules() {",
    PURE_TABLE_STATE_RESTORE,
    "saved table-state restoration",
  );

  nextSource = replaceRequired(
    nextSource,
    `  if (tablePage) {
    restoreSavedTableState(pageName, { view: options.view });
    updateViewButtons();
    buildHeader();
  }`,
    `  if (tablePage) {
    restoreSavedTableState(pageName, { view: options.view });
    syncRestoredTableControls(pageName);
    updateViewButtons();
    buildHeader();
  }`,
    "canonical table page final render",
  );

  nextSource = replaceRequired(
    nextSource,
    `      if (tablePages.has(pageName)) {
        restoreSavedTableState(pageName, { view: route.view || options.view });
      }
      state.incrementalApplying = true;`,
    `      if (tablePages.has(pageName)) {
        restoreSavedTableState(pageName, { view: route.view || options.view });
        syncRestoredTableControls(pageName);
      }
      state.incrementalApplying = true;`,
    "public incremental table final render",
  );

  return nextSource;
}
