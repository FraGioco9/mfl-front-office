(() => {
  const VERSION = "1.119.37";
  const CLUB_PAGE = "club";
  const MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0";
  const CLUB_ID_COLUMNS = [
    "active_contract_club_id",
    "club_id",
    "current_club_id",
    "active_club_id",
  ];
  const CLUB_VIEW_SLUGS = {
    attributes: "attributes",
    contracts: "contracts",
    current: "current-season",
    all: "all-time",
  };
  const POSITION_ORDER = [
    "GK", "RB", "CB", "LB", "RWB", "LWB", "CDM", "RM", "CM", "LM", "CAM", "RW", "CF", "LW", "ST",
  ];
  const POSITION_RANK = new Map(POSITION_ORDER.map((position, index) => [position, index]));
  const activeShareButtons = new Set();

  const previousRuntime = window.__mflClubViewRuntimeState;
  if (previousRuntime?.clickHandler) {
    window.removeEventListener("click", previousRuntime.clickHandler, true);
  }
  if (previousRuntime?.monitorTimer) {
    window.clearInterval(previousRuntime.monitorTimer);
  }
  if (previousRuntime?.installTimer) {
    window.clearInterval(previousRuntime.installTimer);
  }

  const clubViewSnapshots = previousRuntime?.clubViewSnapshots instanceof Map
    ? previousRuntime.clubViewSnapshots
    : new Map();

  let installed = false;
  let installTimer = 0;
  let monitorTimer = 0;
  let filteringClubRows = false;
  let clickHandler = null;

  function syncShareCursor() {
    document.documentElement.classList.toggle("evaluationShareBusy", activeShareButtons.size > 0);
  }

  function finishShareCursor(button) {
    activeShareButtons.delete(button);
    syncShareCursor();
  }

  function trackShareButton(button) {
    activeShareButtons.add(button);
    syncShareCursor();
    const startedAt = Date.now();

    const check = () => {
      const shareLoading = typeof state !== "undefined" && Boolean(state?.evaluationShareLoading);
      const buttonLoading = button.isConnected && button.disabled;
      if ((shareLoading || buttonLoading) && Date.now() - startedAt < 45000) {
        window.setTimeout(check, 50);
        return;
      }
      finishShareCursor(button);
    };

    window.requestAnimationFrame(check);
  }

  function installShareCursor() {
    let style = document.getElementById("evaluationShareBusyCursorStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "evaluationShareBusyCursorStyles";
      style.textContent = `
        html.evaluationShareBusy,
        html.evaluationShareBusy body,
        html.evaluationShareBusy body * {
          cursor: wait !important;
        }
      `;
      document.head.appendChild(style);
    }

    if (window.__mflEvaluationShareCursorBound) return;
    window.__mflEvaluationShareCursorBound = true;
    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest("#evaluationShareButton, .evaluationLoadShareButton");
      if (!(button instanceof HTMLButtonElement) || button.disabled) return;
      trackShareButton(button);
    }, true);
  }

  function routeFromLocation() {
    const match = window.location.pathname.match(/^\/(?:clubs|club)\/([^/]+)(?:\/([^/]+))?\/?$/i);
    if (!match) return null;
    const view = {
      attributes: "attributes",
      contracts: "contracts",
      "current-season": "current",
      "all-time": "all",
    }[String(match[2] || "attributes").toLowerCase()] || "attributes";
    return { clubId: decodeURIComponent(match[1]), view };
  }

  function canonicalClubRoute(clubId, view) {
    const slug = CLUB_VIEW_SLUGS[view] || CLUB_VIEW_SLUGS.attributes;
    return `/clubs/${encodeURIComponent(String(clubId || ""))}/${slug}`;
  }

  function clubSnapshotKey(clubId, view) {
    return `${String(clubId || "")}:${String(view || "attributes")}`;
  }

  function cloneRows(rows) {
    return (Array.isArray(rows) ? rows : []).map((row) => (
      Array.isArray(row)
        ? [...row]
        : row && typeof row === "object"
          ? { ...row }
          : row
    ));
  }

  function clubIdColumn(columns = state?.columns) {
    if (!Array.isArray(columns)) return "";
    return CLUB_ID_COLUMNS.find((column) => columns.includes(column)) || "";
  }

  function rowsForClub(rows, clubId, columns = state?.columns) {
    const idColumn = clubIdColumn(columns);
    if (!idColumn || !clubId || !Array.isArray(rows)) return Array.isArray(rows) ? rows : [];
    return rows.filter((row) => String(getValue(row, idColumn)) === String(clubId));
  }

  function clubViewIsSettled(route) {
    if (!route || typeof state === "undefined") return false;
    if (state.currentPage !== CLUB_PAGE || state.view !== route.view) return false;
    if (!Array.isArray(state.columns) || !Array.isArray(state.rows)) return false;
    if (Number(state.interactionBusyDepth || 0) > 0) return false;
    if (document.documentElement.classList.contains("appBusy")) return false;
    if (document.body.classList.contains("appBusy") || document.body.classList.contains("clubViewSwitching")) return false;
    const empty = document.querySelector("#emptyState");
    if (empty && !empty.hidden && /loading players/i.test(String(empty.textContent || ""))) return false;
    return true;
  }

  function captureClubView(route = routeFromLocation()) {
    if (!clubViewIsSettled(route)) return false;
    clubViewSnapshots.set(clubSnapshotKey(route.clubId, route.view), {
      columns: [...state.columns],
      rows: cloneRows(state.rows),
      pageSize: Number(state.pageSize || 100),
      tableSourceRowsCount: Number(state.tableSourceRowsCount || state.rows.length || 0),
      incrementalTotalRows: Number(state.incrementalTotalRows || state.rows.length || 0),
      incrementalSourceRows: Number(state.incrementalSourceRows || state.rows.length || 0),
      incrementalLastKey: String(state.incrementalLastKey || ""),
      incrementalLastLoadedAt: Number(state.incrementalLastLoadedAt || Date.now()),
      incrementalRoute: state.incrementalRoute && typeof state.incrementalRoute === "object"
        ? { ...state.incrementalRoute }
        : null,
      dataAccess: state.dataAccess,
      dataLoaded: Boolean(state.dataLoaded),
      manifest: state.manifest,
    });
    return true;
  }

  function restoreClubView(clubId, view) {
    const snapshot = clubViewSnapshots.get(clubSnapshotKey(clubId, view));
    if (!snapshot || typeof state === "undefined") return false;

    window.history.replaceState({}, "", canonicalClubRoute(clubId, view));
    state.currentPage = CLUB_PAGE;
    state.view = view;
    state.page = 1;
    state.pageSize = snapshot.pageSize;
    state.sortKey = "positions";
    state.sortDirection = "asc";
    state.columns = [...snapshot.columns];
    state.rows = cloneRows(snapshot.rows);
    state.filteredRows = [];
    state.tableSourceRowsCount = snapshot.tableSourceRowsCount;
    state.incrementalTotalRows = snapshot.incrementalTotalRows;
    state.incrementalSourceRows = snapshot.incrementalSourceRows;
    state.incrementalLastKey = snapshot.incrementalLastKey;
    state.incrementalLastLoadedAt = snapshot.incrementalLastLoadedAt;
    state.incrementalRoute = snapshot.incrementalRoute ? { ...snapshot.incrementalRoute, view, clubId } : null;
    state.incrementalMode = true;
    state.dataAccess = snapshot.dataAccess;
    state.dataLoaded = true;
    state.manifest = snapshot.manifest;

    document.body.dataset.page = CLUB_PAGE;
    document.body.classList.remove("clubViewSwitching");
    document.querySelectorAll(".navButton.active").forEach((button) => button.classList.remove("active"));

    if (typeof rebuildColumnIndexMap === "function") rebuildColumnIndexMap();
    if (typeof pageSizeSelect !== "undefined" && pageSizeSelect) {
      pageSizeSelect.value = String(state.pageSize);
    }

    const previousApplying = Boolean(state.incrementalApplying);
    state.incrementalApplying = true;
    try {
      if (typeof updateViewButtons === "function") updateViewButtons();
      if (typeof buildTableColGroup === "function") buildTableColGroup();
      if (typeof buildHeader === "function") buildHeader();
      if (typeof applyFilters === "function") applyFilters({ save: false, localOnly: true });
    } finally {
      state.incrementalApplying = previousApplying;
    }

    if (typeof revealAppShell === "function") revealAppShell();
    if (typeof syncHomeLoginButton === "function") syncHomeLoginButton();
    if (typeof window.applyExactPlayerTableWidths === "function") {
      window.applyExactPlayerTableWidths();
      window.requestAnimationFrame(() => window.applyExactPlayerTableWidths());
    }
    captureClubView({ clubId, view });
    return true;
  }

  function primaryPosition(row) {
    if (typeof playerPositions === "function") {
      return String(playerPositions(row)?.[0] || "").trim().toUpperCase();
    }
    return String(getValue(row, "positions") || "").split(",")[0].trim().toUpperCase();
  }

  function comparePositions(a, b) {
    const aPosition = primaryPosition(a);
    const bPosition = primaryPosition(b);
    const aRank = POSITION_RANK.has(aPosition) ? POSITION_RANK.get(aPosition) : POSITION_ORDER.length;
    const bRank = POSITION_RANK.has(bPosition) ? POSITION_RANK.get(bPosition) : POSITION_ORDER.length;
    const direction = state.sortDirection === "desc" ? -1 : 1;
    if (aRank !== bRank) return (aRank - bRank) * direction;

    const aOverall = Number(getValue(a, "overall"));
    const bOverall = Number(getValue(b, "overall"));
    if (Number.isFinite(aOverall) && Number.isFinite(bOverall) && aOverall !== bOverall) {
      return bOverall - aOverall;
    }
    return String(getValue(a, "name") || "").localeCompare(String(getValue(b, "name") || ""));
  }

  function headerColumn(event) {
    if (!(event.target instanceof Element)) return "";
    const cell = event.target.closest("#tableHead th.sortable");
    if (!cell || typeof currentViewColumns !== "function") return "";
    const row = cell.parentElement;
    if (!row) return "";
    const index = Array.from(row.children).indexOf(cell) - 1;
    const columns = currentViewColumns();
    return index >= 0 && index < columns.length ? String(columns[index] || "") : "";
  }

  function resetSortCycle(event) {
    if (typeof state === "undefined" || state.currentPage !== CLUB_PAGE) return false;
    const column = headerColumn(event);
    if (!column || state.sortKey !== column) return false;

    const defaultDirection = typeof numberColumns !== "undefined" && numberColumns.has(column) ? "desc" : "asc";
    const reverseDirection = defaultDirection === "desc" ? "asc" : "desc";
    if (state.sortDirection !== reverseDirection) return false;

    event.preventDefault();
    event.stopImmediatePropagation();
    state.sortKey = "positions";
    state.sortDirection = "asc";
    state.page = 1;
    if (typeof buildHeader === "function") buildHeader();
    if (typeof applyFilters === "function") applyFilters({ save: false, localOnly: true });
    return true;
  }

  function elementContext(element) {
    if (!element) return "";
    const attributes = Array.from(element.attributes || [])
      .map((attribute) => `${attribute.name}=${attribute.value}`)
      .join(" ");
    return `${element.textContent || ""} ${attributes}`.trim().toLowerCase();
  }

  function playerMflNavigationTarget(event) {
    if (typeof state === "undefined") return null;
    const playerPageActive = state.currentPage === "player" || /^\/players?\//i.test(window.location.pathname);
    if (!playerPageActive || !(event.target instanceof Element)) return null;

    const interactive = event.target.closest(
      "a,button,[role='button'],[data-wallet-address],[data-agent-wallet],[data-wallet]",
    );
    if (!interactive || interactive.closest("#sidebar,#menuRail")) return null;

    const context = elementContext(interactive);
    const text = String(interactive.textContent || "").trim().toLowerCase();
    return context.includes("mfl wallet")
      || context.includes(MFL_WALLET_ADDRESS)
      || text === "mfl"
      ? interactive
      : null;
  }

  async function navigateToMflLikeSidebar() {
    const pageName = "mfl";
    const view = typeof preferredViewForPage === "function"
      ? preferredViewForPage(pageName)
      : "attributes";
    const targetOptions = { view };

    if (typeof pagePath === "function") {
      const targetPath = pagePath(pageName, targetOptions);
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (targetPath === currentPath) return;
    }

    if (typeof paintLoadingOverlayNow === "function") {
      const access = typeof currentDataAccess === "function" ? currentDataAccess(pageName) : "public";
      const message = typeof loadingMessageForAccess === "function"
        ? loadingMessageForAccess(access)
        : "Loading player data";
      await paintLoadingOverlayNow(message);
    }

    if (typeof setPage === "function") {
      await setPage(pageName, true, targetOptions);
    } else {
      window.location.assign(`/mfl/${view === "stats" ? "stats" : "attributes"}`);
    }
  }

  function handlePlayerMflNavigation(event) {
    if (!playerMflNavigationTarget(event)) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (typeof closeSearch === "function") closeSearch();
    void navigateToMflLikeSidebar().catch((error) => {
      if (typeof showToast === "function") {
        showToast(error?.message || "Could not open MFL.");
      }
    });
    return true;
  }

  function handleCachedClubView(event) {
    if (typeof state === "undefined" || state.currentPage !== CLUB_PAGE) return false;
    if (!(event.target instanceof Element)) return false;
    const button = event.target.closest(".viewButton[data-view]");
    if (!button) return false;

    const route = routeFromLocation();
    const nextView = String(button.dataset.view || "");
    if (!route || !Object.hasOwn(CLUB_VIEW_SLUGS, nextView) || nextView === route.view) return false;

    captureClubView(route);
    if (!clubViewSnapshots.has(clubSnapshotKey(route.clubId, nextView))) return false;

    event.preventDefault();
    event.stopImmediatePropagation();
    return restoreClubView(route.clubId, nextView);
  }

  function handleWindowClick(event) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (handlePlayerMflNavigation(event)) return;
    if (handleCachedClubView(event)) return;
    resetSortCycle(event);
  }

  function install() {
    if (installed) return true;
    if (typeof state === "undefined" || typeof compareRows !== "function" || typeof applyFilters !== "function") {
      return false;
    }

    const nativeCompareRows = compareRows;
    compareRows = function compareRowsWithClubSorting(a, b) {
      if (filteringClubRows && state.sortKey === "positions") return comparePositions(a, b);
      if (filteringClubRows) return nativeCompareRows.call(this, a, b);
      if (state.currentPage !== CLUB_PAGE) return nativeCompareRows.call(this, a, b);

      const previousPage = state.currentPage;
      state.currentPage = ["current", "all"].includes(state.view) ? "progression" : "database";
      try {
        return state.sortKey === "positions" ? comparePositions(a, b) : nativeCompareRows.call(this, a, b);
      } finally {
        state.currentPage = previousPage;
      }
    };

    const nativeApplyFilters = applyFilters;
    applyFilters = function applyFiltersWithClubSorting(options = {}) {
      if (state.currentPage !== CLUB_PAGE) return nativeApplyFilters.apply(this, arguments);
      const route = routeFromLocation();
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
        const result = nativeApplyFilters.call(this, { ...options, save: false, localOnly: true });
        state.tableSourceRowsCount = sourceRows.length;
        return result;
      } finally {
        state.rows = originalRows;
        state.currentPage = originalPage;
        state.sortKey = requestedSortKey;
        state.sortDirection = requestedSortDirection;
        filteringClubRows = false;
      }
    };

    clickHandler = handleWindowClick;
    window.addEventListener("click", clickHandler, true);
    monitorTimer = window.setInterval(() => captureClubView(), 100);
    document.documentElement.dataset.clubViewCacheVersion = VERSION;
    window.__mflClubViewRuntimeState = {
      clickHandler,
      monitorTimer,
      installTimer: 0,
      clubViewSnapshots,
    };
    installed = true;
    if (installTimer) window.clearInterval(installTimer);
    return true;
  }

  installShareCursor();
  if (!install()) {
    installTimer = window.setInterval(() => {
      if (install()) return;
      if (window.__mflClubViewRuntimeState) {
        window.__mflClubViewRuntimeState.installTimer = installTimer;
      }
    }, 25);
    window.setTimeout(() => {
      if (installTimer) window.clearInterval(installTimer);
      installTimer = 0;
    }, 15000);
  }
})();
