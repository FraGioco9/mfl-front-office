(() => {
  const VERSION = "1.119.31";
  const CLUB_PAGE = "club";
  const CLUB_VIEWS = new Set(["attributes", "contracts", "current", "all"]);
  const VIEW_SLUGS = {
    attributes: "attributes",
    contracts: "contracts",
    current: "current-season",
    all: "all-time",
  };
  const CLUB_ID_COLUMNS = [
    "active_contract_club_id",
    "club_id",
    "current_club_id",
    "active_club_id",
  ];
  const POSITION_ORDER = [
    "GK", "RB", "CB", "LB", "RWB", "LWB", "CDM", "RM", "CM", "LM", "CAM", "RW", "CF", "LW", "ST",
  ];
  const POSITION_RANK = new Map(POSITION_ORDER.map((position, index) => [position, index]));
  const viewCache = new Map();
  let installed = false;
  let installTimer = 0;
  let filteringClubRows = false;
  let clubDelegatePage = "database";

  function clubRouteFromLocation(viewOverride = "") {
    const match = window.location.pathname.match(/^\/(?:clubs|club)\/([^/]+)(?:\/([^/]+))?\/?$/i);
    if (!match) return null;
    const view = viewOverride || ({
      attributes: "attributes",
      contracts: "contracts",
      "current-season": "current",
      "all-time": "all",
    }[String(match[2] || "attributes").toLowerCase()] || "attributes");
    return {
      clubId: decodeURIComponent(match[1]),
      view,
    };
  }

  function canonicalClubPath(clubId, view) {
    return `/clubs/${encodeURIComponent(String(clubId || ""))}/${VIEW_SLUGS[view] || "attributes"}`;
  }

  function cacheKey(clubId, view) {
    return `${String(clubId || "")}:${String(view || "attributes")}`;
  }

  function cloneRows(rows) {
    return Array.isArray(rows) ? rows.map((row) => {
      if (Array.isArray(row)) return [...row];
      if (row && typeof row === "object") return { ...row };
      return row;
    }) : [];
  }

  function clonePayload(payload) {
    return {
      ...payload,
      columns: Array.isArray(payload?.columns) ? [...payload.columns] : [],
      rows: cloneRows(payload?.rows),
    };
  }

  function clubIdColumn() {
    if (typeof state === "undefined" || !Array.isArray(state.columns)) return "";
    return CLUB_ID_COLUMNS.find((column) => {
      if (typeof hasColumn === "function") return hasColumn(column);
      return state.columns.includes(column);
    }) || "";
  }

  function rowsForClub(rows, clubId) {
    const idColumn = clubIdColumn();
    if (!idColumn || !clubId || !Array.isArray(rows)) return Array.isArray(rows) ? rows : [];
    return rows.filter((row) => String(getValue(row, idColumn)) === String(clubId));
  }

  function primaryPosition(row) {
    if (typeof playerPositions === "function") {
      return String(playerPositions(row)?.[0] || "").trim().toUpperCase();
    }
    return String(getValue(row, "positions") || "").split(",")[0].trim().toUpperCase();
  }

  function compareClubPositions(a, b) {
    const aPosition = primaryPosition(a);
    const bPosition = primaryPosition(b);
    const aRank = POSITION_RANK.has(aPosition) ? POSITION_RANK.get(aPosition) : POSITION_ORDER.length;
    const bRank = POSITION_RANK.has(bPosition) ? POSITION_RANK.get(bPosition) : POSITION_ORDER.length;
    let result = aRank - bRank;
    if (!result) {
      const aOverall = Number(getValue(a, "overall"));
      const bOverall = Number(getValue(b, "overall"));
      if (Number.isFinite(aOverall) && Number.isFinite(bOverall) && aOverall !== bOverall) {
        result = bOverall - aOverall;
      }
    }
    if (!result) {
      result = String(getValue(a, "name") || "").localeCompare(String(getValue(b, "name") || ""));
    }
    return state.sortDirection === "desc" ? -result : result;
  }

  function resolvedClubRoute(route = null) {
    const fallback = clubRouteFromLocation(route?.view || (typeof state !== "undefined" ? state.view : ""));
    const clubId = String(route?.clubId || fallback?.clubId || "").trim();
    const view = String(route?.view || fallback?.view || "attributes");
    return clubId && CLUB_VIEWS.has(view) ? { clubId, view } : null;
  }

  function snapshotFromState() {
    return {
      columns: Array.isArray(state.columns) ? [...state.columns] : [],
      rows: cloneRows(state.rows),
      page: 1,
      pageSize: Number(state.pageSize || 100),
      totalRows: Number(state.incrementalTotalRows || state.rows.length),
      sourceRows: Number(state.incrementalSourceRows || state.rows.length),
      generatedAt: state.manifest?.generated_at || null,
      sortKey: String(state.sortKey || "positions"),
      sortDirection: String(state.sortDirection || "asc"),
    };
  }

  function rememberPayload(route, payload) {
    const clubRoute = resolvedClubRoute(route);
    if (!route || route.scope !== "club" || !clubRoute) return;
    if (!payload || !Array.isArray(payload.rows)) return;
    viewCache.set(cacheKey(clubRoute.clubId, clubRoute.view), {
      ...clonePayload(payload),
      sortKey: String(state.sortKey || "positions"),
      sortDirection: String(state.sortDirection || "asc"),
    });
  }

  function rememberCurrentView() {
    if (typeof state === "undefined" || state.currentPage !== CLUB_PAGE || !state.dataLoaded) return;
    const current = clubRouteFromLocation(state.view);
    if (!current || !CLUB_VIEWS.has(current.view) || !Array.isArray(state.rows)) return;
    viewCache.set(cacheKey(current.clubId, current.view), snapshotFromState());
  }

  function restoreClubPresentation() {
    document.body.dataset.page = CLUB_PAGE;
    document.body.classList.remove("clubViewSwitching", "clubViewLoading");
    document.querySelectorAll(".navButton.active").forEach((link) => link.classList.remove("active"));
    const quickFilters = document.querySelector("#progressionPage .quickFilters");
    if (quickFilters) quickFilters.hidden = true;
    const controlsBar = document.querySelector("#progressionPage .controlsBar");
    if (controlsBar) controlsBar.hidden = true;
    document.querySelectorAll("#progressionPage .pager, #progressionPage nav.pager").forEach((pager) => {
      pager.hidden = true;
    });
    if (typeof loadingScreen !== "undefined" && loadingScreen && !loadingScreen.hidden) {
      loadingScreen.hidden = true;
      loadingScreen.classList.remove("failed", "complete", "leaving");
    }
  }

  function renderCachedView(clubId, nextView, cachedPayload) {
    window.history.replaceState({}, "", canonicalClubPath(clubId, nextView));

    state.currentPage = CLUB_PAGE;
    state.view = nextView;
    state.page = 1;
    state.sortKey = String(cachedPayload.sortKey || "positions");
    state.sortDirection = String(cachedPayload.sortDirection || "asc");
    state.pageSize = Number(cachedPayload.pageSize || state.pageSize || 100);

    const route = typeof incrementalRouteTarget === "function"
      ? incrementalRouteTarget("club", { view: nextView })
      : {
          pageName: "club",
          scope: "club",
          clubId,
          view: nextView,
          access: state.dataAccess || "public",
        };

    applyIncrementalPayload(route, clonePayload(cachedPayload));
    state.currentPage = CLUB_PAGE;
    state.view = nextView;
    state.sortKey = String(cachedPayload.sortKey || "positions");
    state.sortDirection = String(cachedPayload.sortDirection || "asc");
    state.pageSize = Number(cachedPayload.pageSize || state.pageSize || 100);

    if (typeof pageSizeSelect !== "undefined" && pageSizeSelect) {
      pageSizeSelect.value = String(state.pageSize);
    }
    if (typeof updateViewButtons === "function") updateViewButtons();
    if (typeof buildHeader === "function") buildHeader();
    if (typeof applyFilters === "function") applyFilters({ save: false });
    restoreClubPresentation();

    window.requestAnimationFrame(() => {
      if (typeof buildTableColGroup === "function") buildTableColGroup();
      if (typeof window.applyExactPlayerTableWidths === "function") window.applyExactPlayerTableWidths();
      restoreClubPresentation();
    });
  }

  function handleClubViewClick(event) {
    if (!(event.target instanceof Element)) return;
    if (typeof state === "undefined" || state.currentPage !== CLUB_PAGE) return;

    const button = event.target.closest(".viewButton[data-view]");
    if (!button) return;

    const nextView = String(button.dataset.view || "");
    if (!CLUB_VIEWS.has(nextView) || nextView === state.view) return;

    const current = clubRouteFromLocation(state.view);
    if (!current) return;

    rememberCurrentView();
    const cached = viewCache.get(cacheKey(current.clubId, nextView));
    if (!cached) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    renderCachedView(current.clubId, nextView, cached);
  }

  function installCacheAndSorting() {
    if (installed) return true;
    if (typeof state === "undefined"
        || typeof requestIncrementalRoute !== "function"
        || typeof applyIncrementalPayload !== "function"
        || typeof applyFilters !== "function"
        || typeof compareRows !== "function") {
      return false;
    }

    const nativeCompareRows = compareRows;
    compareRows = function compareRowsWithSortableClubColumns(a, b) {
      if ((state.currentPage === CLUB_PAGE || filteringClubRows) && state.sortKey === "positions") {
        return compareClubPositions(a, b);
      }
      if (filteringClubRows) {
        return nativeCompareRows.call(this, a, b);
      }
      if (state.currentPage === CLUB_PAGE) {
        const previousPage = state.currentPage;
        state.currentPage = ["current", "all"].includes(state.view) ? "progression" : "database";
        try {
          return nativeCompareRows.call(this, a, b);
        } finally {
          state.currentPage = previousPage;
        }
      }
      return nativeCompareRows.call(this, a, b);
    };

    const nativeApplyFilters = applyFilters;
    applyFilters = function applyFiltersWithSortableClubRows(options = {}) {
      if (state.currentPage !== CLUB_PAGE) {
        return nativeApplyFilters.apply(this, arguments);
      }

      const route = clubRouteFromLocation(state.view);
      if (!route) return nativeApplyFilters.apply(this, arguments);

      const originalRows = state.rows;
      const originalPage = state.currentPage;
      const requestedSortKey = String(state.sortKey || "positions");
      const requestedSortDirection = String(state.sortDirection || "asc");
      const sourceRows = rowsForClub(originalRows, route.clubId);

      filteringClubRows = true;
      clubDelegatePage = ["current", "all"].includes(route.view) ? "progression" : "database";
      state.rows = sourceRows;
      state.currentPage = clubDelegatePage;
      state.sortKey = requestedSortKey;
      state.sortDirection = requestedSortDirection;
      try {
        const result = nativeApplyFilters.call(this, { ...options, save: false });
        state.tableSourceRowsCount = sourceRows.length;
        return result;
      } finally {
        state.rows = originalRows;
        state.currentPage = originalPage;
        state.sortKey = requestedSortKey;
        state.sortDirection = requestedSortDirection;
        filteringClubRows = false;
        restoreClubPresentation();
        window.requestAnimationFrame(restoreClubPresentation);
      }
    };

    const nativeRequestIncrementalRoute = requestIncrementalRoute;
    requestIncrementalRoute = async function requestIncrementalRouteWithClubViewCache(route, page = 1, options = {}) {
      const clubRoute = route?.scope === "club" ? resolvedClubRoute(route) : null;
      if (clubRoute && Number(page) === 1 && !options?.force) {
        const cached = viewCache.get(cacheKey(clubRoute.clubId, clubRoute.view));
        if (cached) {
          const payload = clonePayload(cached);
          applyIncrementalPayload(route, payload);
          if (typeof incrementalRequestDetails === "function") {
            state.incrementalLastKey = incrementalRequestDetails(route, page).requestKey;
          }
          state.incrementalLastLoadedAt = Date.now();
          return payload;
        }
      }

      const payload = await nativeRequestIncrementalRoute.apply(this, arguments);
      if (clubRoute && Number(page) === 1) {
        rememberPayload(route, payload || snapshotFromState());
      }
      return payload;
    };

    // The native club view handler is registered on document in capture phase.
    // Window capture runs first, so a cached destination is restored before
    // the native handler can display "Loading players...".
    window.addEventListener("click", handleClubViewClick, true);

    installed = true;
    document.documentElement.dataset.clubViewCacheVersion = VERSION;
    if (installTimer) window.clearInterval(installTimer);
    return true;
  }

  if (!installCacheAndSorting()) {
    installTimer = window.setInterval(installCacheAndSorting, 25);
    window.setTimeout(() => {
      if (installTimer) window.clearInterval(installTimer);
      installTimer = 0;
    }, 15000);
  }
})();
