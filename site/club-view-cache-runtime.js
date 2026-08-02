(() => {
  const VERSION = "1.119.33";
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
  const shared = window.__mflClubViewRuntimeState || {
    viewCache: new Map(),
    pendingLoads: new Map(),
    clickHandler: null,
    monitorTimer: 0,
    nativeApplyFilters: null,
    nativeCompareRows: null,
    nativeRouteLoader: null,
    wrappedRouteLoader: null,
    lastStableSignature: "",
  };
  window.__mflClubViewRuntimeState = shared;

  let installed = false;
  let installTimer = 0;
  let filteringClubRows = false;

  function clubRouteFromLocation(viewOverride = "") {
    const match = window.location.pathname.match(/^\/(?:clubs|club)\/([^/]+)(?:\/([^/]+))?\/?$/i);
    if (!match) return null;
    const pathView = {
      attributes: "attributes",
      contracts: "contracts",
      "current-season": "current",
      "all-time": "all",
    }[String(match[2] || "attributes").toLowerCase()] || "attributes";
    const view = CLUB_VIEWS.has(viewOverride) ? viewOverride : pathView;
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

  function clubIdColumn(columns = state?.columns) {
    if (!Array.isArray(columns)) return "";
    return CLUB_ID_COLUMNS.find((column) => {
      if (typeof hasColumn === "function" && columns === state.columns) return hasColumn(column);
      return columns.includes(column);
    }) || "";
  }

  function rowsForClub(rows, clubId, columns = state?.columns) {
    const idColumn = clubIdColumn(columns);
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
    const rankDifference = aRank - bRank;
    if (rankDifference) return state.sortDirection === "desc" ? -rankDifference : rankDifference;

    const aOverall = Number(getValue(a, "overall"));
    const bOverall = Number(getValue(b, "overall"));
    if (Number.isFinite(aOverall) && Number.isFinite(bOverall) && aOverall !== bOverall) {
      return bOverall - aOverall;
    }
    return String(getValue(a, "name") || "").localeCompare(String(getValue(b, "name") || ""));
  }

  function snapshotFromState() {
    return {
      columns: Array.isArray(state.columns) ? [...state.columns] : [],
      rows: cloneRows(state.rows),
      pageSize: Number(state.pageSize || 100),
      totalRows: Number(state.incrementalTotalRows || state.rows?.length || 0),
      sourceRows: Number(state.incrementalSourceRows || state.rows?.length || 0),
      generatedAt: state.manifest?.generated_at || null,
      dataAccess: state.dataAccess || null,
      incrementalMode: Boolean(state.incrementalMode),
      incrementalRoute: state.incrementalRoute ? { ...state.incrementalRoute } : null,
      sortKey: String(state.sortKey || "positions"),
      sortDirection: String(state.sortDirection || "asc"),
    };
  }

  function rememberView(clubId, view) {
    if (!clubId || !CLUB_VIEWS.has(view) || !Array.isArray(state?.rows) || !Array.isArray(state?.columns)) return false;
    shared.viewCache.set(cacheKey(clubId, view), snapshotFromState());
    return true;
  }

  function rememberCurrentView() {
    if (typeof state === "undefined" || state.currentPage !== CLUB_PAGE) return false;
    const current = clubRouteFromLocation(state.view);
    return Boolean(current && rememberView(current.clubId, current.view));
  }

  function bodyIsSwitchingClubView() {
    return document.body.classList.contains("clubViewSwitching")
      || document.body.classList.contains("clubViewLoading");
  }

  function clubViewReady(clubId, view, baseline = null) {
    const route = clubRouteFromLocation();
    if (!route || route.clubId !== String(clubId) || route.view !== view) return false;
    if (typeof state === "undefined" || state.currentPage !== CLUB_PAGE || state.view !== view) return false;
    if (!Array.isArray(state.rows) || !Array.isArray(state.columns) || !state.columns.length) return false;
    if (bodyIsSwitchingClubView()) return false;
    if (!baseline) return true;

    const tableRowCount = typeof tableBody !== "undefined" && tableBody ? tableBody.childElementCount : 0;
    return state.rows !== baseline.rows
      || state.columns !== baseline.columns
      || Number(state.incrementalLastLoadedAt || 0) !== baseline.loadedAt
      || tableRowCount !== baseline.tableRowCount;
  }

  function setDefaultClubSort(render = false) {
    state.sortKey = "positions";
    state.sortDirection = "asc";
    state.page = 1;
    if (render) {
      if (typeof buildHeader === "function") buildHeader();
      if (typeof applyFilters === "function") applyFilters({ save: false });
    }
  }

  function captureLoadedView(clubId, view, useDefaultSort = false) {
    if (!clubViewReady(clubId, view)) return false;
    const key = cacheKey(clubId, view);
    if (useDefaultSort && !shared.viewCache.has(key)) setDefaultClubSort(true);
    shared.pendingLoads.delete(key);
    return rememberView(clubId, view);
  }

  function scheduleLoadedViewCapture(clubId, view, baseline = null) {
    const key = cacheKey(clubId, view);
    const pending = shared.pendingLoads.get(key);
    if (pending?.frame) window.cancelAnimationFrame(pending.frame);

    const entry = {
      baseline: baseline || pending?.baseline || null,
      frames: 0,
      frame: 0,
    };
    shared.pendingLoads.set(key, entry);

    const check = () => {
      const currentEntry = shared.pendingLoads.get(key);
      if (currentEntry !== entry) return;
      if (clubViewReady(clubId, view, entry.baseline)) {
        captureLoadedView(clubId, view, true);
        return;
      }
      entry.frames += 1;
      if (entry.frames >= 900) {
        shared.pendingLoads.delete(key);
        return;
      }
      entry.frame = window.requestAnimationFrame(check);
    };
    entry.frame = window.requestAnimationFrame(check);
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

  function restoreSnapshot(clubId, view, snapshot) {
    window.history.replaceState({}, "", canonicalClubPath(clubId, view));
    document.body.classList.remove("clubViewSwitching", "clubViewLoading");

    state.currentPage = CLUB_PAGE;
    state.view = view;
    state.page = 1;
    state.pageSize = Number(snapshot.pageSize || 100);
    state.columns = [...snapshot.columns];
    state.columnIndexMap = null;
    state.rows = cloneRows(snapshot.rows);
    state.filteredRows = [];
    state.tableSourceRowsCount = 0;
    state.incrementalMode = Boolean(snapshot.incrementalMode);
    state.incrementalTotalRows = Number(snapshot.totalRows || state.rows.length);
    state.incrementalSourceRows = Number(snapshot.sourceRows || state.rows.length);
    state.incrementalRoute = snapshot.incrementalRoute
      ? { ...snapshot.incrementalRoute, pageName: CLUB_PAGE, scope: CLUB_PAGE, view, clubId }
      : { pageName: CLUB_PAGE, scope: CLUB_PAGE, view, clubId, access: state.dataAccess || "public" };
    if (snapshot.dataAccess) state.dataAccess = snapshot.dataAccess;
    state.dataLoaded = true;
    state.incrementalLastLoadedAt = Date.now();
    state.sortKey = String(snapshot.sortKey || "positions");
    state.sortDirection = String(snapshot.sortDirection || "asc");

    if (typeof pageSizeSelect !== "undefined" && pageSizeSelect) pageSizeSelect.value = String(state.pageSize);
    if (typeof updateViewButtons === "function") updateViewButtons();
    if (typeof buildTableColGroup === "function") buildTableColGroup();
    if (typeof buildHeader === "function") buildHeader();
    if (typeof applyFilters === "function") applyFilters({ save: false });
    restoreClubPresentation();

    window.requestAnimationFrame(() => {
      if (typeof window.applyExactPlayerTableWidths === "function") window.applyExactPlayerTableWidths();
      rememberView(clubId, view);
      restoreClubPresentation();
    });
  }

  function headerColumnFromEvent(event) {
    if (!(event.target instanceof Element)) return "";
    const cell = event.target.closest("#tableHead th.sortable");
    if (!cell || typeof currentViewColumns !== "function") return "";
    const row = cell.parentElement;
    if (!row) return "";
    const index = Array.from(row.children).indexOf(cell) - 1;
    const columns = currentViewColumns();
    return index >= 0 && index < columns.length ? String(columns[index] || "") : "";
  }

  function resetClubSortAtEndOfCycle(event) {
    if (typeof state === "undefined" || state.currentPage !== CLUB_PAGE) return false;
    const column = headerColumnFromEvent(event);
    if (!column || state.sortKey !== column) return false;
    const defaultDirection = state.view === "next" && typeof statColumns !== "undefined" && statColumns.includes(column)
      ? "asc"
      : typeof numberColumns !== "undefined" && numberColumns.has(column)
        ? "desc"
        : "asc";
    const reverseDirection = defaultDirection === "desc" ? "asc" : "desc";
    if (state.sortDirection !== reverseDirection) return false;

    event.preventDefault();
    event.stopImmediatePropagation();
    setDefaultClubSort(true);
    rememberCurrentView();
    return true;
  }

  function handleClubViewClick(event) {
    if (!(event.target instanceof Element)) return;
    if (resetClubSortAtEndOfCycle(event)) return;
    if (typeof state === "undefined" || state.currentPage !== CLUB_PAGE) return;

    const button = event.target.closest(".viewButton[data-view]");
    if (!button) return;
    const nextView = String(button.dataset.view || "");
    if (!CLUB_VIEWS.has(nextView) || nextView === state.view) return;

    const current = clubRouteFromLocation(state.view);
    if (!current) return;

    rememberCurrentView();
    const destinationKey = cacheKey(current.clubId, nextView);
    const cached = shared.viewCache.get(destinationKey);
    if (cached) {
      event.preventDefault();
      event.stopImmediatePropagation();
      shared.pendingLoads.delete(destinationKey);
      restoreSnapshot(current.clubId, nextView, cached);
      return;
    }

    const baseline = {
      rows: state.rows,
      columns: state.columns,
      loadedAt: Number(state.incrementalLastLoadedAt || 0),
      tableRowCount: typeof tableBody !== "undefined" && tableBody ? tableBody.childElementCount : 0,
    };
    setDefaultClubSort(false);
    scheduleLoadedViewCapture(current.clubId, nextView, baseline);
  }

  function installRouteLoaderCapture() {
    if (typeof window.mflLoadIncrementalRoutePage !== "function") return false;
    if (window.mflLoadIncrementalRoutePage === shared.wrappedRouteLoader) return true;
    if (window.mflLoadIncrementalRoutePage !== shared.nativeRouteLoader) {
      shared.nativeRouteLoader = window.mflLoadIncrementalRoutePage;
    }
    const nativeLoader = shared.nativeRouteLoader;
    shared.wrappedRouteLoader = async function loadIncrementalRoutePageWithClubCapture(pageName, options = {}) {
      const result = await nativeLoader.apply(this, arguments);
      if (pageName === CLUB_PAGE) {
        const route = clubRouteFromLocation(options?.view || state?.view || "");
        if (route) {
          window.requestAnimationFrame(() => captureLoadedView(route.clubId, route.view, true));
        }
      }
      return result;
    };
    window.mflLoadIncrementalRoutePage = shared.wrappedRouteLoader;
    return true;
  }

  function installCacheAndSorting() {
    if (installed) {
      installRouteLoaderCapture();
      return true;
    }
    if (typeof state === "undefined"
        || typeof applyFilters !== "function"
        || typeof compareRows !== "function") {
      return false;
    }

    if (!shared.nativeCompareRows) shared.nativeCompareRows = compareRows;
    const nativeCompareRows = shared.nativeCompareRows;
    compareRows = function compareRowsWithSortableClubColumns(a, b) {
      if (filteringClubRows && state.sortKey === "positions") return compareClubPositions(a, b);
      if (filteringClubRows) return nativeCompareRows.call(this, a, b);
      if (state.currentPage !== CLUB_PAGE) return nativeCompareRows.call(this, a, b);

      const previousPage = state.currentPage;
      state.currentPage = ["current", "all"].includes(state.view) ? "progression" : "database";
      try {
        return state.sortKey === "positions"
          ? compareClubPositions(a, b)
          : nativeCompareRows.call(this, a, b);
      } finally {
        state.currentPage = previousPage;
      }
    };

    if (!shared.nativeApplyFilters) shared.nativeApplyFilters = applyFilters;
    const nativeApplyFilters = shared.nativeApplyFilters;
    applyFilters = function applyFiltersWithSortableClubRows(options = {}) {
      if (state.currentPage !== CLUB_PAGE) return nativeApplyFilters.apply(this, arguments);

      const route = clubRouteFromLocation(state.view);
      if (!route) return nativeApplyFilters.apply(this, arguments);

      const originalRows = state.rows;
      const originalPage = state.currentPage;
      const requestedSortKey = String(state.sortKey || "positions");
      const requestedSortDirection = String(state.sortDirection || "asc");
      const sourceRows = rowsForClub(originalRows, route.clubId, state.columns);

      filteringClubRows = true;
      state.rows = sourceRows;
      state.currentPage = ["current", "all"].includes(route.view) ? "progression" : "database";
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
        window.requestAnimationFrame(() => {
          rememberCurrentView();
          restoreClubPresentation();
        });
      }
    };

    if (shared.clickHandler) window.removeEventListener("click", shared.clickHandler, true);
    shared.clickHandler = handleClubViewClick;
    window.addEventListener("click", shared.clickHandler, true);

    installed = true;
    document.documentElement.dataset.clubViewCacheVersion = VERSION;
    if (installTimer) window.clearInterval(installTimer);
    installRouteLoaderCapture();

    const current = clubRouteFromLocation(state.view);
    if (current && state.currentPage === CLUB_PAGE) scheduleLoadedViewCapture(current.clubId, current.view);

    if (shared.monitorTimer) window.clearInterval(shared.monitorTimer);
    shared.monitorTimer = window.setInterval(() => {
      installRouteLoaderCapture();
      const route = clubRouteFromLocation(state?.view || "");
      if (!route || state?.currentPage !== CLUB_PAGE || !clubViewReady(route.clubId, route.view)) return;
      const signature = [
        cacheKey(route.clubId, route.view),
        Array.isArray(state.rows) ? state.rows.length : 0,
        Array.isArray(state.columns) ? state.columns.join(",") : "",
        state.sortKey,
        state.sortDirection,
        Number(state.incrementalLastLoadedAt || 0),
        typeof tableBody !== "undefined" && tableBody ? tableBody.childElementCount : 0,
      ].join("|");
      if (signature === shared.lastStableSignature) return;
      shared.lastStableSignature = signature;
      rememberView(route.clubId, route.view);
    }, 120);
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
