(() => {
  const VERSION = "1.119.36";
  const CLUB_PAGE = "club";
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
  const activeShareButtons = new Set();

  const previousRuntime = window.__mflClubViewRuntimeState;
  if (previousRuntime?.clickHandler) {
    window.removeEventListener("click", previousRuntime.clickHandler, true);
  }
  if (previousRuntime?.monitorTimer) {
    window.clearInterval(previousRuntime.monitorTimer);
  }
  if (previousRuntime?.pendingLoads instanceof Map) {
    previousRuntime.pendingLoads.forEach((entry) => {
      if (entry?.frame) window.cancelAnimationFrame(entry.frame);
    });
  }
  delete window.__mflClubViewRuntimeState;

  let installed = false;
  let installTimer = 0;
  let filteringClubRows = false;

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

  function clubIdColumn(columns = state?.columns) {
    if (!Array.isArray(columns)) return "";
    return CLUB_ID_COLUMNS.find((column) => columns.includes(column)) || "";
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
    if (typeof state === "undefined" || state.currentPage !== CLUB_PAGE) return;
    const column = headerColumn(event);
    if (!column || state.sortKey !== column) return;

    const defaultDirection = typeof numberColumns !== "undefined" && numberColumns.has(column) ? "desc" : "asc";
    const reverseDirection = defaultDirection === "desc" ? "asc" : "desc";
    if (state.sortDirection !== reverseDirection) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    state.sortKey = "positions";
    state.sortDirection = "asc";
    state.page = 1;
    if (typeof buildHeader === "function") buildHeader();
    if (typeof applyFilters === "function") applyFilters({ save: false });
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
        const result = nativeApplyFilters.call(this, { ...options, save: false });
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

    window.addEventListener("click", resetSortCycle, true);
    document.documentElement.dataset.clubViewCacheVersion = VERSION;
    installed = true;
    if (installTimer) window.clearInterval(installTimer);
    return true;
  }

  installShareCursor();
  if (!install()) {
    installTimer = window.setInterval(install, 25);
    window.setTimeout(() => {
      if (installTimer) window.clearInterval(installTimer);
      installTimer = 0;
    }, 15000);
  }
})();
