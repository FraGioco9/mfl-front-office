// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const DIRECT_INITIAL_CLUB_STARTUP = `  if (initialClubRoute && typeof showHomeShell === "function") {
    const originalShowHomeShell = showHomeShell;
    let initialClubHandled = false;
    showHomeShell = async function showHomeShellWithInitialClub(pageName, updateHistory, options) {
      if (!initialClubHandled) {
        initialClubHandled = true;
        await openClubPage(initialClubRoute.clubId, initialClubRoute.view, false);
        return;
      }
      return originalShowHomeShell.apply(this, arguments);
    };
  }`;

const PUBLIC_GATE_INITIAL_CLUB_STARTUP = `  if (initialClubRoute && typeof showHomeShell === "function") {
    const originalShowHomeShell = showHomeShell;
    let initialClubHandled = false;
    showHomeShell = async function showHomeShellWithInitialClub(pageName, updateHistory, options) {
      if (!initialClubHandled) {
        initialClubHandled = true;
        const canonicalRoute = canonicalClubRoute(initialClubRoute.clubId, initialClubRoute.view);
        if (normalizedPath() !== canonicalRoute) window.history.replaceState({}, "", canonicalRoute);
        const navigateClub = window.mflOpenClubPage;
        if (typeof navigateClub !== "function") throw new Error("Club navigation gate is unavailable during startup.");
        await navigateClub(initialClubRoute.clubId, initialClubRoute.view);
        return;
      }
      return originalShowHomeShell.apply(this, arguments);
    };
  }`;

const BLOCKING_TITLE_SETTLEMENT = `      if (!dataLoaded) return;
      const resolvedClubTitle = await clubTitleReady;
      if (resolvedClubTitle && String(activeClubId) === nextClubId) {
        activeClubTitle = resolvedClubTitle;
      }

      state.currentPage = CLUB_PAGE;`;

const ROSTER_OWNED_TITLE_SETTLEMENT = `      if (!dataLoaded) return;
      const loadedClubTitle = clubTitleIdentityFromRows(activeClubId);
      if (loadedClubTitle) activeClubTitle = saveClubTitleIdentity(loadedClubTitle);

      state.currentPage = CLUB_PAGE;`;

const GENERIC_INCREMENTAL_LOADING_FILTERS = `    if (tableRoute) {
      globalThis.syncQuickFilterLabels?.();`;

const CLUB_FREE_INCREMENTAL_LOADING_FILTERS = `    if (tableRoute) {
      if (route.scope !== "club") globalThis.syncQuickFilterLabels?.();`;

const GENERIC_PREPARE_SAVED_PAGE_STATE = `    const savedPageState = !clubTarget && tablePages.has(pageName)
      ? state.tablePageStates?.[pageName] || defaultTablePageState(pageName)
      : null;`;

const CLUB_FREE_PREPARE_SAVED_PAGE_STATE = `    const savedPageState = pageName !== "club" && !clubTarget && tablePages.has(pageName)
      ? state.tablePageStates?.[pageName] || defaultTablePageState(pageName)
      : null;`;

const GENERIC_INCREMENTAL_PAYLOAD_RENDER = `      if (tablePages.has(pageName)) {
        restoreSavedTableState(pageName, { view: route.view || options.view });
        syncRestoredTableControls(pageName);
      }
      state.incrementalApplying = true;
      try {
        updateViewButtons();
        buildHeader();
        originalApplyFilters.call(this, { save: false });
      } finally {
        state.incrementalApplying = false;
      }
      return true;`;

const CLUB_OWNED_INCREMENTAL_PAYLOAD_RENDER = `      const clubPage = pageName === "club";
      if (tablePages.has(pageName) && !clubPage) {
        restoreSavedTableState(pageName, { view: route.view || options.view });
        syncRestoredTableControls(pageName);
      }
      if (clubPage) {
        state.currentPage = "club";
      }
      state.incrementalApplying = true;
      try {
        updateViewButtons();
        buildHeader();
        if (!clubPage) originalApplyFilters.call(this, { save: false });
      } finally {
        state.incrementalApplying = false;
      }
      return true;`;

const CLUB_FINAL_RENDER = `      if (typeof updateViewButtons === "function") updateViewButtons();
      applyClubPresentation();
      captureClubView(nextView);`;

const CLUB_FINAL_ROSTER_RENDER = `      if (typeof updateViewButtons === "function") updateViewButtons();
      if (typeof buildHeader === "function") buildHeader();
      if (typeof applyFilters === "function") applyFilters({ save: false, localOnly: true });
      applyClubPresentation();
      captureClubView(nextView);`;

const CLUB_APPLY_FILTER_OVERRIDE = `  if (typeof applyFilters === "function") {
    const originalApplyFilters = applyFilters;
    applyFilters = function applyFiltersWithClubRows(options = {}) {
      if (state.currentPage !== CLUB_PAGE || !activeClubId) {
        const result = originalApplyFilters.apply(this, arguments);
        restoreStandardControls();
        return result;
      }

      const originalRows = state.rows;
      state.rows = clubRows();
      state.sortKey = "positions";
      state.sortDirection = "asc";
      try {
        const result = originalApplyFilters.call(this, { ...options, save: false });
        state.tableSourceRowsCount = state.rows.length;
        return result;
      } finally {
        state.rows = originalRows;
      }
    };
  }`;

const RESTORE_STANDARD_CONTROLS = `  function restoreStandardControls() {
    const quickFilters = document.querySelector("#progressionPage .quickFilters");
    if (quickFilters) quickFilters.hidden = false;
    const controlsBar = document.querySelector("#progressionPage .controlsBar");
    if (controlsBar) controlsBar.hidden = false;
    document.querySelectorAll("#progressionPage .pager, #progressionPage nav.pager").forEach((pager) => {
      pager.hidden = false;
    });
  }`;

const GENERIC_TABLE_LOADING_SHELL = `function renderTableLoadingShell(pageName) {
  state.currentPage = pageName;
  const tablePage = tablePages.has(pageName);

  if (!tablePage) {
    return;
  }

  restoreSavedTableState(pageName);
  globalThis.syncQuickFilterLabels?.();
  updateViewButtons();
  if (pageName === "agents") {
    renderAgentPageTitle(state.currentAgentWalletAddress || agentWalletAddressFromUrl());
  } else if (pageName !== "club") {
    tablePageTitle.textContent = tableTitleForPage(pageName);
  }
  emptyState.hidden = true;
  emptyState.textContent = "";
  tableBody.replaceChildren();
  window.__mflTableLoadingRuntime?.show?.();
}`;

const CLUB_AWARE_TABLE_LOADING_SHELL = `function renderTableLoadingShell(pageName) {
  state.currentPage = pageName;
  const tablePage = tablePages.has(pageName);

  if (!tablePage) {
    return;
  }

  const clubPage = pageName === "club";
  if (clubPage) {
    state.pendingTableControlRestore = null;
    filterRules.replaceChildren();
    hideRetiredInput.checked = false;
    hideRetiringInput.checked = false;
    if (hideMflPlayersInput) hideMflPlayersInput.checked = false;
    if (packablePlayersInput) packablePlayersInput.checked = false;
    newMintsInput.checked = false;
    const quickFilters = document.querySelector("#progressionPage .quickFilters");
    if (quickFilters) quickFilters.hidden = true;
    const controlsBar = document.querySelector("#progressionPage .controlsBar");
    if (controlsBar) controlsBar.hidden = true;
    document.querySelectorAll("#progressionPage .pager, #progressionPage nav.pager").forEach((pager) => {
      pager.hidden = true;
    });
  } else {
    restoreSavedTableState(pageName);
    globalThis.syncQuickFilterLabels?.();
  }

  updateViewButtons();
  if (pageName === "agents") {
    renderAgentPageTitle(state.currentAgentWalletAddress || agentWalletAddressFromUrl());
  } else if (pageName !== "club") {
    tablePageTitle.textContent = tableTitleForPage(pageName);
  }
  emptyState.hidden = true;
  emptyState.textContent = "";
  tableBody.replaceChildren();
  window.__mflTableLoadingRuntime?.show?.();
}`;

const TABLE_RESTORE_START = `function tableRestoreSavedTableStateOwner(pageName = tablePageKey() || "progression", options = {}) {
  const storedState = state.tablePageStates?.[pageName]`;

const CLUB_FREE_TABLE_RESTORE_START = `function tableRestoreSavedTableStateOwner(pageName = tablePageKey() || "progression", options = {}) {
  if (pageName === "club") {
    state.view = normalizeViewForPage(options.view || state.view || "attributes", pageName);
    state.page = 1;
    state.sortKey = "positions";
    state.sortDirection = "asc";
    state.selectedPlayerIds = new Set();
    state.pendingTableControlRestore = null;
    return;
  }

  const storedState = state.tablePageStates?.[pageName]`;

const TABLE_CONTROL_SYNC_START = `function syncRestoredTableControls(pageName = tablePageKey() || "progression") {
  const restored = state.pendingTableControlRestore;`;

const CLUB_FREE_TABLE_CONTROL_SYNC_START = `function syncRestoredTableControls(pageName = tablePageKey() || "progression") {
  if (pageName === "club") {
    state.pendingTableControlRestore = null;
    return false;
  }

  const restored = state.pendingTableControlRestore;`;

const TABLE_APPLY_FILTER_START = `function tableApplyFiltersOwner(options = {}) {
  const rules = readFilterRules();`;

const CLUB_FILTER_FREE_TABLE_APPLY_START = `function tableApplyFiltersOwner(options = {}) {
  if (state.currentPage === "club") {
    state.tableSourceRowsCount = state.rows.length;
    state.filteredRows = [...state.rows];
    state.filteredRows.sort(compareRows);
    state.pendingTableControlRestore = null;
    filterRules.replaceChildren();
    hideRetiredInput.checked = false;
    hideRetiringInput.checked = false;
    if (hideMflPlayersInput) hideMflPlayersInput.checked = false;
    if (packablePlayersInput) packablePlayersInput.checked = false;
    newMintsInput.checked = false;
    if (filterSummary) filterSummary.textContent = "0 active";
    emptyState.textContent = "No players found for this club.";
    syncActiveWatchlistFromSet();
    renderTable();
    return;
  }

  const rules = readFilterRules();`;

const EAGER_RUNTIME_COMMENTS = [
  "/* Keep MFL Wallet search navigation anchored to Attributes. */\n\n",
  "/* Layout-centered feedback and transition-free shared views */\n",
  "/* Session-cached incremental route data and destination-first loading */\n",
];

export function normalizeClubStartupLifecycle(routeArtifacts) {
  const artifacts = routeArtifacts && typeof routeArtifacts === "object" ? routeArtifacts : null;
  const routeChunks = artifacts?.routeChunks && typeof artifacts.routeChunks === "object"
    ? artifacts.routeChunks
    : null;
  const club = String(routeChunks?.club || "");
  const core = String(artifacts?.core || "");
  const table = String(routeChunks?.table || "");
  if (!club) throw new Error("Cannot normalize an empty Club route artifact.");
  if (!core) throw new Error("Cannot normalize an empty shared application core.");
  if (!table) throw new Error("Cannot normalize an empty Table route artifact for Club.");

  let normalizedClub = replaceRequired(
    club,
    DIRECT_INITIAL_CLUB_STARTUP,
    PUBLIC_GATE_INITIAL_CLUB_STARTUP,
    "shared public Club navigation gate for refresh",
  );
  normalizedClub = replaceRequired(
    normalizedClub,
    BLOCKING_TITLE_SETTLEMENT,
    ROSTER_OWNED_TITLE_SETTLEMENT,
    "Club roster independent of title preflight",
  );
  normalizedClub = replaceRequired(
    normalizedClub,
    CLUB_FINAL_RENDER,
    CLUB_FINAL_ROSTER_RENDER,
    "Club-owned final roster render",
  );
  normalizedClub = replaceRequired(
    normalizedClub,
    CLUB_APPLY_FILTER_OVERRIDE,
    "",
    "single canonical Table filter owner for Club rows",
  );
  normalizedClub = replaceRequired(
    normalizedClub,
    RESTORE_STANDARD_CONTROLS,
    "",
    "remove obsolete Club filter-override cleanup",
  );

  let normalizedCore = replaceRequired(
    core,
    GENERIC_PREPARE_SAVED_PAGE_STATE,
    CLUB_FREE_PREPARE_SAVED_PAGE_STATE,
    "Club route preparation bypasses saved table filter state",
  );
  normalizedCore = replaceRequired(
    normalizedCore,
    GENERIC_INCREMENTAL_LOADING_FILTERS,
    CLUB_FREE_INCREMENTAL_LOADING_FILTERS,
    "Club loading skips generic quick-filter initialization",
  );
  normalizedCore = replaceRequired(
    normalizedCore,
    GENERIC_INCREMENTAL_PAYLOAD_RENDER,
    CLUB_OWNED_INCREMENTAL_PAYLOAD_RENDER,
    "Club payload defers rendering until filter-free Club state is ready",
  );
  for (const comment of EAGER_RUNTIME_COMMENTS) normalizedCore = normalizedCore.replace(comment, "");

  let normalizedTable = replaceRequired(
    table,
    GENERIC_TABLE_LOADING_SHELL,
    CLUB_AWARE_TABLE_LOADING_SHELL,
    "Club retains Table loading shell without filter restoration",
  );
  normalizedTable = replaceRequired(
    normalizedTable,
    TABLE_RESTORE_START,
    CLUB_FREE_TABLE_RESTORE_START,
    "Club table-state restore excludes filter state",
  );
  normalizedTable = replaceRequired(
    normalizedTable,
    TABLE_CONTROL_SYNC_START,
    CLUB_FREE_TABLE_CONTROL_SYNC_START,
    "Club never synchronizes restored filter controls",
  );
  normalizedTable = replaceRequired(
    normalizedTable,
    TABLE_APPLY_FILTER_START,
    CLUB_FILTER_FREE_TABLE_APPLY_START,
    "Club table render bypasses the filter pipeline",
  );

  return Object.freeze({
    ...artifacts,
    core: normalizedCore,
    routeChunks: Object.freeze({
      ...routeChunks,
      club: normalizedClub,
      table: normalizedTable,
    }),
  });
}
