(() => {
  const CLUB_PAGE = "club";
  const CLUB_ID_COLUMNS = [
    "active_contract_club_id",
    "club_id",
    "current_club_id",
    "active_club_id",
  ];
  const CLUB_VIEWS = new Set(["contracts", "attributes"]);
  const POSITION_ORDER = [
    "GK",
    "RB",
    "CB",
    "LB",
    "RWB",
    "LWB",
    "CDM",
    "RM",
    "CM",
    "LM",
    "CAM",
    "RW",
    "CF",
    "LW",
    "ST",
  ];
  const POSITION_RANK = new Map(POSITION_ORDER.map((position, index) => [position, index]));

  let activeClubId = "";
  let openingClub = false;

  function normalizedPath() {
    return window.location.pathname.replace(/\/+$/, "") || "/";
  }

  function clubRoute(pathname = normalizedPath()) {
    const match = pathname.match(/^\/club\/([^/]+)(?:\/(contracts|attributes))?$/i);
    if (!match) return null;
    return {
      clubId: decodeURIComponent(match[1]),
      view: CLUB_VIEWS.has(String(match[2] || "").toLowerCase())
        ? String(match[2]).toLowerCase()
        : "contracts",
    };
  }

  function canonicalClubRoute(clubId = activeClubId, view = state.view) {
    const safeView = view === "attributes" ? "attributes" : "contracts";
    return `/club/${encodeURIComponent(clubId)}/${safeView}`;
  }

  function clubIdColumn() {
    return CLUB_ID_COLUMNS.find((column) => typeof hasColumn === "function" ? hasColumn(column) : state.columns.includes(column)) || "";
  }

  function clubRows(clubId = activeClubId) {
    const idColumn = clubIdColumn();
    if (!clubId || !idColumn || !Array.isArray(state.rows)) return [];
    return state.rows.filter((row) => String(getValue(row, idColumn)) === String(clubId));
  }

  function clubName(clubId = activeClubId) {
    const row = clubRows(clubId)[0];
    return row ? String(getValue(row, "active_contract_club_name") || `Club ${clubId}`) : `Club ${clubId}`;
  }

  function primaryPosition(row) {
    if (typeof playerPositions === "function") {
      return String(playerPositions(row)?.[0] || "").trim().toUpperCase();
    }
    return String(getValue(row, "positions") || "")
      .split(",")[0]
      .trim()
      .toUpperCase();
  }

  function compareClubRows(a, b) {
    const aPosition = primaryPosition(a);
    const bPosition = primaryPosition(b);
    const aRank = POSITION_RANK.has(aPosition) ? POSITION_RANK.get(aPosition) : POSITION_ORDER.length;
    const bRank = POSITION_RANK.has(bPosition) ? POSITION_RANK.get(bPosition) : POSITION_ORDER.length;

    if (aRank !== bRank) return aRank - bRank;

    const aOverall = Number(getValue(a, "overall"));
    const bOverall = Number(getValue(b, "overall"));
    if (Number.isFinite(aOverall) && Number.isFinite(bOverall) && aOverall !== bOverall) {
      return bOverall - aOverall;
    }

    const aName = String(getValue(a, "name") || "");
    const bName = String(getValue(b, "name") || "");
    return aName.localeCompare(bName);
  }

  function setClubSwitching(active) {
    const table = typeof tableBody !== "undefined" && tableBody ? tableBody.closest("table") : null;
    if (table) table.classList.toggle("clubViewSwitching", active);
  }

  function finishClubSwitch() {
    requestAnimationFrame(() => requestAnimationFrame(() => setClubSwitching(false)));
  }

  function hideClubPageControls() {
    const views = document.querySelector("#progressionPage .views");
    if (views) {
      const attributes = views.querySelector('[data-view="attributes"]');
      const contracts = views.querySelector('[data-view="contracts"]');
      views.querySelectorAll(".viewButton").forEach((button) => {
        button.hidden = button !== attributes && button !== contracts;
      });
      if (contracts) views.insertBefore(contracts, attributes || views.firstChild);
    }

    const quickFilters = document.querySelector("#progressionPage .quickFilters");
    if (quickFilters) quickFilters.hidden = true;

    const controlsBar = document.querySelector("#progressionPage .controlsBar");
    if (controlsBar) controlsBar.hidden = true;
  }

  function restoreStandardControls() {
    const quickFilters = document.querySelector("#progressionPage .quickFilters");
    if (quickFilters) quickFilters.hidden = false;

    const controlsBar = document.querySelector("#progressionPage .controlsBar");
    if (controlsBar) controlsBar.hidden = false;
  }

  function applyClubPresentation() {
    if (state.currentPage !== CLUB_PAGE || !activeClubId) return;
    document.body.dataset.page = CLUB_PAGE;
    document.querySelectorAll(".navButton").forEach((link) => link.classList.remove("active"));
    if (typeof tablePageTitle !== "undefined" && tablePageTitle) tablePageTitle.textContent = clubName();
    hideClubPageControls();
    updateClubLinks();
  }

  function updateClubLinks() {
    const idColumn = clubIdColumn();
    if (!idColumn || typeof currentViewColumns !== "function" || typeof currentPageRows !== "function") return;

    const columns = currentViewColumns();
    const clubNameIndex = columns.indexOf("active_contract_club_name");
    if (clubNameIndex < 0 || typeof tableBody === "undefined" || !tableBody) return;

    const rows = currentPageRows();
    Array.from(tableBody.rows).forEach((tableRow, rowIndex) => {
      const row = rows[rowIndex];
      const cell = tableRow.cells[clubNameIndex + 1];
      if (!row || !cell) return;
      const clubId = String(getValue(row, idColumn) || "").trim();
      const name = String(getValue(row, "active_contract_club_name") || "").trim();
      if (!clubId || !name) return;

      const link = document.createElement("a");
      link.href = canonicalClubRoute(clubId, "contracts");
      link.className = "clubPageLink";
      link.textContent = name;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        void openClubPage(clubId, "contracts");
      });
      cell.replaceChildren(link);
    });
  }

  async function openClubPage(clubId, view = "contracts", updateHistory = true) {
    if (!clubId || openingClub) return;
    openingClub = true;
    setClubSwitching(true);
    try {
      activeClubId = String(clubId);
      const nextView = view === "attributes" ? "attributes" : "contracts";

      if (typeof setPage === "function") {
        await setPage("database", false, { view: nextView, skipNavigationLoading: false });
      }

      state.currentPage = CLUB_PAGE;
      state.view = nextView;
      state.page = 1;
      state.sortKey = "positions";
      state.sortDirection = "asc";
      state.pageSize = Math.max(100, clubRows().length || 100);
      if (typeof pageSizeSelect !== "undefined" && pageSizeSelect) pageSizeSelect.value = String(state.pageSize);

      if (typeof filterRules !== "undefined" && filterRules) filterRules.replaceChildren();
      if (typeof hideRetiredInput !== "undefined" && hideRetiredInput) hideRetiredInput.checked = false;
      if (typeof hideRetiringInput !== "undefined" && hideRetiringInput) hideRetiringInput.checked = false;
      if (typeof hideMflPlayersInput !== "undefined" && hideMflPlayersInput) hideMflPlayersInput.checked = false;
      if (typeof newMintsInput !== "undefined" && newMintsInput) newMintsInput.checked = false;

      const route = canonicalClubRoute(activeClubId, nextView);
      if (updateHistory) window.history.pushState({}, "", route);
      else window.history.replaceState({}, "", route);

      if (typeof updateViewButtons === "function") updateViewButtons();
      if (typeof buildHeader === "function") buildHeader();
      if (typeof applyFilters === "function") applyFilters({ save: false });
      applyClubPresentation();
    } finally {
      openingClub = false;
      finishClubSwitch();
    }
  }

  if (typeof compareRows === "function") {
    const originalCompareRows = compareRows;
    compareRows = function compareRowsWithClubPositionOrder(a, b) {
      if (state.currentPage === CLUB_PAGE) return compareClubRows(a, b);
      return originalCompareRows(a, b);
    };
  }

  if (typeof applyFilters === "function") {
    const originalApplyFilters = applyFilters;
    applyFilters = function applyFiltersWithClubRows(options = {}) {
      if (state.currentPage !== CLUB_PAGE || !activeClubId) {
        const result = originalApplyFilters.apply(this, arguments);
        restoreStandardControls();
        requestAnimationFrame(updateClubLinks);
        return result;
      }

      const originalRows = state.rows;
      state.rows = clubRows();
      state.sortKey = "positions";
      state.sortDirection = "asc";
      try {
        const result = originalApplyFilters.call(this, { ...options, save: false });
        state.tableSourceRowsCount = state.rows.length;
        applyClubPresentation();
        return result;
      } finally {
        state.rows = originalRows;
      }
    };
  }

  if (typeof renderTable === "function") {
    const originalRenderTable = renderTable;
    renderTable = function renderTableWithClubLinks() {
      const result = originalRenderTable.apply(this, arguments);
      requestAnimationFrame(() => {
        updateClubLinks();
        applyClubPresentation();
      });
      return result;
    };
  }

  document.addEventListener("click", (event) => {
    if (state.currentPage !== CLUB_PAGE) return;
    const viewButton = event.target.closest?.(".viewButton[data-view]");
    if (!viewButton || !CLUB_VIEWS.has(viewButton.dataset.view)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    setClubSwitching(true);
    state.view = viewButton.dataset.view;
    state.page = 1;
    state.sortKey = "positions";
    state.sortDirection = "asc";
    if (typeof updateViewButtons === "function") updateViewButtons();
    if (typeof buildHeader === "function") buildHeader();
    if (typeof applyFilters === "function") applyFilters({ save: false });
    window.history.replaceState({}, "", canonicalClubRoute(activeClubId, state.view));
    finishClubSwitch();
  }, true);

  window.addEventListener("popstate", () => {
    const route = clubRoute();
    if (route) void openClubPage(route.clubId, route.view, false);
  });

  function bootClubRoute() {
    const path = normalizedPath();
    if (path.toLowerCase() === "/club") {
      window.location.replace("/");
      return;
    }

    const route = clubRoute(path);
    if (!route) return;

    const canonicalRoute = canonicalClubRoute(route.clubId, route.view);
    if (path !== canonicalRoute) window.history.replaceState({}, "", canonicalRoute);
    void openClubPage(route.clubId, route.view, false);
  }

  const style = document.createElement("style");
  style.textContent = `
    .clubPageLink {
      color: var(--text, #fff) !important;
      text-decoration: none;
      transition: color 120ms ease;
    }
    .clubPageLink:hover,
    .clubPageLink:focus-visible {
      color: #78c7ff !important;
    }
    table.clubViewSwitching {
      visibility: hidden;
    }
  `;
  document.head.appendChild(style);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootClubRoute, { once: true });
  } else {
    bootClubRoute();
  }
})();