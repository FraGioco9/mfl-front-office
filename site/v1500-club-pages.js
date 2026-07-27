(() => {
  const CLUB_PAGE = "club";
  const CLUB_ID_COLUMNS = [
    "active_contract_club_id",
    "club_id",
    "current_club_id",
    "active_club_id",
  ];

  let activeClubId = "";
  let openingClub = false;

  function normalizedPath() {
    return window.location.pathname.replace(/\/+$/, "") || "/";
  }

  function clubRouteId(pathname = normalizedPath()) {
    const match = pathname.match(/^\/club\/([^/]+)$/i);
    return match ? decodeURIComponent(match[1]) : "";
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

    if (typeof openFiltersButton !== "undefined" && openFiltersButton) openFiltersButton.hidden = true;
    if (typeof quickClearFiltersButton !== "undefined" && quickClearFiltersButton) quickClearFiltersButton.hidden = true;
    if (typeof filterSummary !== "undefined" && filterSummary) filterSummary.hidden = true;

    if (typeof pageSizeSelect !== "undefined" && pageSizeSelect) {
      const pageSizeControl = pageSizeSelect.closest("label") || pageSizeSelect.parentElement;
      if (pageSizeControl) pageSizeControl.hidden = true;
    }
  }

  function restoreStandardControls() {
    const quickFilters = document.querySelector("#progressionPage .quickFilters");
    if (quickFilters) quickFilters.hidden = false;
    if (typeof openFiltersButton !== "undefined" && openFiltersButton) openFiltersButton.hidden = false;
    if (typeof quickClearFiltersButton !== "undefined" && quickClearFiltersButton) quickClearFiltersButton.hidden = false;
    if (typeof filterSummary !== "undefined" && filterSummary) filterSummary.hidden = false;
    if (typeof pageSizeSelect !== "undefined" && pageSizeSelect) {
      const pageSizeControl = pageSizeSelect.closest("label") || pageSizeSelect.parentElement;
      if (pageSizeControl) pageSizeControl.hidden = false;
    }
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
      link.href = `/club/${encodeURIComponent(clubId)}`;
      link.className = "clubPageLink";
      link.textContent = name;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        void openClubPage(clubId);
      });
      cell.replaceChildren(link);
    });
  }

  async function openClubPage(clubId, view = "contracts", updateHistory = true) {
    if (!clubId || openingClub) return;
    openingClub = true;
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
      if (typeof newMintsInput !== "undefined" && newMintsInput) newMintsInput.checked = false;

      if (updateHistory) window.history.pushState({}, "", `/club/${encodeURIComponent(activeClubId)}`);
      else window.history.replaceState({}, "", `/club/${encodeURIComponent(activeClubId)}`);

      if (typeof updateViewButtons === "function") updateViewButtons();
      if (typeof buildHeader === "function") buildHeader();
      if (typeof applyFilters === "function") applyFilters({ save: false });
      applyClubPresentation();
    } finally {
      openingClub = false;
    }
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
    if (!viewButton || !["attributes", "contracts"].includes(viewButton.dataset.view)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    state.view = viewButton.dataset.view;
    state.page = 1;
    state.sortKey = "positions";
    state.sortDirection = "asc";
    if (typeof updateViewButtons === "function") updateViewButtons();
    if (typeof buildHeader === "function") buildHeader();
    if (typeof applyFilters === "function") applyFilters({ save: false });
    window.history.replaceState({}, "", `/club/${encodeURIComponent(activeClubId)}`);
  }, true);

  window.addEventListener("popstate", () => {
    const clubId = clubRouteId();
    if (clubId) void openClubPage(clubId, "contracts", false);
  });

  function bootClubRoute() {
    const path = normalizedPath();
    if (path.toLowerCase() === "/club") {
      window.location.replace("/");
      return;
    }
    const clubId = clubRouteId(path);
    if (clubId) void openClubPage(clubId, "contracts", false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootClubRoute, { once: true });
  } else {
    bootClubRoute();
  }
})();
