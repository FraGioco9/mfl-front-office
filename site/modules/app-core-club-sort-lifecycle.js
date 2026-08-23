// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const CLUB_PREPARE_SHARED_SORT = `    } else if (clubTarget) {
      state.view = clubTarget.view;
      state.page = 1;
      state.sortKey = "positions";
      state.sortDirection = "asc";
    }`;

const CLUB_PREPARE_LOCAL_SORT = `    } else if (clubTarget) {
      state.view = clubTarget.view;
      state.page = 1;
    }`;

const CLUB_CACHE_SHARED_SORT = `    state.currentPage = CLUB_PAGE;
    state.view = view;
    state.page = 1;
    state.pageSize = Number(payload.pageSize || state.pageSize);
    state.sortKey = "positions";
    state.sortDirection = "asc";`;

const CLUB_CACHE_LOCAL_SORT = `    state.currentPage = CLUB_PAGE;
    state.view = view;
    state.page = 1;
    state.pageSize = Number(payload.pageSize || state.pageSize);`;

const CLUB_TRANSITION_SHARED_SORT = `      if (!routeAlreadyCommitted) {
        const transition = await runPageTransition(CLUB_PAGE, updateHistory, {
          view: nextView,
          clubId: activeClubId,
          path: route,
          replace: !updateHistory,
          sortKey: "positions",
          sortDirection: "asc",
        });
        if (!transition) return;
      } else {
        state.sortKey = "positions";
        state.sortDirection = "asc";
      }`;

const CLUB_TRANSITION_LOCAL_SORT = `      if (!routeAlreadyCommitted) {
        const transition = await runPageTransition(CLUB_PAGE, updateHistory, {
          view: nextView,
          clubId: activeClubId,
          path: route,
          replace: !updateHistory,
        });
        if (!transition) return;
      }`;

const CLUB_RENDER_SHARED_SORT = `      state.page = 1;
      state.sortKey = "positions";
      state.sortDirection = "asc";
      state.pageSize = Math.max(100, clubRows().length || 100);`;

const CLUB_RENDER_LOCAL_SORT = `      state.page = 1;
      state.pageSize = Math.max(100, clubRows().length || 100);`;

const CLUB_RESTORE_SHARED_SORT = `  if (pageName === "club") {
    state.view = normalizeViewForPage(options.view || state.view || "attributes", pageName);
    state.page = 1;
    state.sortKey = "positions";
    state.sortDirection = "asc";
    state.selectedPlayerIds = new Set();`;

const CLUB_RESTORE_LOCAL_SORT = `  if (pageName === "club") {
    state.view = normalizeViewForPage(options.view || state.view || "attributes", pageName);
    state.page = 1;
    state.selectedPlayerIds = new Set();`;

const GENERIC_HEADER_SORT_STATE = `    const isSorted = state.sortKey === column;`;
const CLUB_AWARE_HEADER_SORT_STATE = `    const clubPositionSort = state.currentPage === "club" && column === "positions";
    const isSorted = state.currentPage !== "club" && state.sortKey === column;`;

const GENERIC_HEADER_SORT_CONTROL = `    cell.appendChild(label);

    if (sortableColumns.has(column)) {`;

const CLUB_AWARE_HEADER_SORT_CONTROL = `    cell.appendChild(label);

    if (clubPositionSort) {
      const arrow = document.createElement("span");
      arrow.className = "sortArrow asc";
      arrow.setAttribute("aria-hidden", "true");
      cell.appendChild(arrow);
    }

    if (state.currentPage !== "club" && sortableColumns.has(column)) {`;

const GENERIC_TABLE_HEADER_CONTEXT_SIGNATURE = `    const signature = [page, state.view, state.sortKey, state.sortDirection].join("|");`;
const CLUB_AWARE_TABLE_HEADER_CONTEXT_SIGNATURE = `    const headerSortKey = page === "club" ? "positions" : state.sortKey;
    const headerSortDirection = page === "club" ? "asc" : state.sortDirection;
    const signature = [page, state.view, headerSortKey, headerSortDirection].join("|");`;

const ROUTE_GATE_RUNTIME_READY = `    const runtimeReady = incomingOptions.__mflRouteRuntimeReady === true;`;
const ROUTE_GATE_RUNTIME_READY_WITH_STATE = `    const runtimeReady = incomingOptions.__mflRouteRuntimeReady === true;
    let previousTableStateSaved = false;`;

const ROUTE_GATE_COMMITTED_OPTIONS = `          const committedOptions = {
            ...incomingOptions,
            skipNavigationTransition: true,
          };`;

const ROUTE_GATE_COMMITTED_OPTIONS_WITH_STATE = `          const committedOptions = {
            ...incomingOptions,
            skipNavigationTransition: true,
            ...(previousTableStateSaved ? { __mflPreviousTableStateSaved: true } : {}),
          };`;

const ROUTE_GATE_TRANSITION_OWNER = `      const runTransition = Reflect.get(window, "__mflRunPageTransition");
      if (typeof runTransition !== "function") {
        throw new Error("Global page transition owner is unavailable.");
      }
      return runTransition(String(pageName || ""), updateHash, incomingOptions, loadCommittedRoute);`;

const ROUTE_GATE_TRANSITION_OWNER_WITH_STATE = `      const previousTablePage = typeof tablePageKey === "function" ? tablePageKey() : null;
      if (previousTablePage && typeof currentTablePageState === "function" && typeof saveTableState === "function") {
        state.tablePageStates[previousTablePage] = currentTablePageState();
        saveTableState();
      }
      previousTableStateSaved = true;

      const runTransition = Reflect.get(window, "__mflRunPageTransition");
      if (typeof runTransition !== "function") {
        throw new Error("Global page transition owner is unavailable.");
      }
      return runTransition(String(pageName || ""), updateHash, incomingOptions, loadCommittedRoute);`;

const TOP_LEVEL_PREVIOUS_TABLE_SAVE = `  const previousTablePage = tablePageKey();
  if (previousTablePage) {
    state.tablePageStates[previousTablePage] = currentTablePageState();
    saveTableState();
  }`;

const TOP_LEVEL_PREVIOUS_TABLE_SAVE_GUARDED = `  if (options.__mflPreviousTableStateSaved !== true) {
    const previousTablePage = tablePageKey();
    if (previousTablePage) {
      state.tablePageStates[previousTablePage] = currentTablePageState();
      saveTableState();
    }
  }`;

const INCREMENTAL_PREVIOUS_TABLE_SAVE = `    const previousPage = state.currentPage;
    const previousTablePage = tablePageKey();
    if (previousTablePage) {
      state.tablePageStates[previousTablePage] = currentTablePageState();
      saveTableState();
    }

    const route = prepareIncrementalRoute(pageName, {`;

const INCREMENTAL_PREVIOUS_TABLE_SAVE_GUARDED = `    const previousPage = state.currentPage;
    if (options.__mflPreviousTableStateSaved !== true) {
      const previousTablePage = tablePageKey();
      if (previousTablePage) {
        state.tablePageStates[previousTablePage] = currentTablePageState();
        saveTableState();
      }
    }

    const route = prepareIncrementalRoute(pageName, {`;

/**
 * Keep Club's fixed Position -> Overall ordering local to the Club route.
 * Shared table sort state belongs only to pages whose headers can actually change
 * sorting. Club headers are read-only and expose Position as the fixed primary key.
 * Header identity uses that same fixed Club contract instead of unrelated shared
 * sort state, so bootstrap and runtime can preserve the same DOM across refresh.
 * Page transitions save the page being left before committing the destination so a
 * Club visit cannot overwrite the destination page's stored sort direction.
 * @param {{core?: string, routeChunks?: Record<string, string>}} routeArtifacts
 */
export function normalizeClubSortLifecycle(routeArtifacts) {
  const artifacts = routeArtifacts && typeof routeArtifacts === "object" ? routeArtifacts : null;
  const routeChunks = artifacts?.routeChunks && typeof artifacts.routeChunks === "object"
    ? artifacts.routeChunks
    : null;
  const core = String(artifacts?.core || "");
  const club = String(routeChunks?.club || "");
  const table = String(routeChunks?.table || "");
  if (!core || !club || !table) throw new Error("Cannot normalize Club sorting without shared, Club, and Table artifacts.");

  let normalizedCore = replaceRequired(
    core,
    CLUB_PREPARE_SHARED_SORT,
    CLUB_PREPARE_LOCAL_SORT,
    "Club route preparation does not mutate shared sort state",
  );
  normalizedCore = replaceRequired(
    normalizedCore,
    GENERIC_TABLE_HEADER_CONTEXT_SIGNATURE,
    CLUB_AWARE_TABLE_HEADER_CONTEXT_SIGNATURE,
    "Club header identity uses its fixed local sort contract",
  );
  normalizedCore = replaceRequired(
    normalizedCore,
    ROUTE_GATE_RUNTIME_READY,
    ROUTE_GATE_RUNTIME_READY_WITH_STATE,
    "route gate tracks pre-transition table-state ownership",
  );
  normalizedCore = replaceRequired(
    normalizedCore,
    ROUTE_GATE_COMMITTED_OPTIONS,
    ROUTE_GATE_COMMITTED_OPTIONS_WITH_STATE,
    "committed route records pre-saved table state",
  );
  normalizedCore = replaceRequired(
    normalizedCore,
    ROUTE_GATE_TRANSITION_OWNER,
    ROUTE_GATE_TRANSITION_OWNER_WITH_STATE,
    "page transition saves the source table before destination commit",
  );
  normalizedCore = replaceRequired(
    normalizedCore,
    TOP_LEVEL_PREVIOUS_TABLE_SAVE,
    TOP_LEVEL_PREVIOUS_TABLE_SAVE_GUARDED,
    "top-level setPage does not overwrite destination state after committed transition",
  );
  normalizedCore = replaceRequired(
    normalizedCore,
    INCREMENTAL_PREVIOUS_TABLE_SAVE,
    INCREMENTAL_PREVIOUS_TABLE_SAVE_GUARDED,
    "incremental setPage does not overwrite destination state after committed transition",
  );

  let normalizedClub = replaceRequired(
    club,
    CLUB_CACHE_SHARED_SORT,
    CLUB_CACHE_LOCAL_SORT,
    "cached Club views preserve shared sort state",
  );
  normalizedClub = replaceRequired(
    normalizedClub,
    CLUB_TRANSITION_SHARED_SORT,
    CLUB_TRANSITION_LOCAL_SORT,
    "Club navigation keeps fixed sorting out of shared transitions",
  );
  normalizedClub = replaceRequired(
    normalizedClub,
    CLUB_RENDER_SHARED_SORT,
    CLUB_RENDER_LOCAL_SORT,
    "Club final render keeps fixed sorting local",
  );

  let normalizedTable = replaceRequired(
    table,
    CLUB_RESTORE_SHARED_SORT,
    CLUB_RESTORE_LOCAL_SORT,
    "Club table restore preserves shared sort state",
  );
  normalizedTable = replaceRequired(
    normalizedTable,
    GENERIC_HEADER_SORT_STATE,
    CLUB_AWARE_HEADER_SORT_STATE,
    "Club header exposes fixed Position sorting without generic sort state",
  );
  normalizedTable = replaceRequired(
    normalizedTable,
    GENERIC_HEADER_SORT_CONTROL,
    CLUB_AWARE_HEADER_SORT_CONTROL,
    "Club header disables generic sort interactions and shows Position ordering",
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