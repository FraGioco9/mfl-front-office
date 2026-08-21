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

/**
 * Keep Club's fixed Position -> Overall ordering local to the Club route.
 * Shared table sort state belongs only to pages whose headers can actually change
 * sorting. Club headers are read-only and expose Position as the fixed primary key.
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

  const normalizedCore = replaceRequired(
    core,
    CLUB_PREPARE_SHARED_SORT,
    CLUB_PREPARE_LOCAL_SORT,
    "Club route preparation does not mutate shared sort state",
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
