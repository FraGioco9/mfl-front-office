(() => {
  const VERSION = "1.119.42";
  const CLUB_PAGE = "club";
  const CLUB_VIEWS = new Set(["attributes", "contracts", "current", "all"]);
  const MFL_WALLET_ADDRESS = "0xff8d2bbed8164db0";
  const POSITION_ORDER = [
    "GK", "RB", "CB", "LB", "RWB", "LWB", "CDM", "RM", "CM", "LM", "CAM", "RW", "CF", "LW", "ST",
  ];
  const POSITION_RANK = new Map(POSITION_ORDER.map((position, index) => [position, index]));
  const activeShareButtons = new Set();

  const previousRuntime = window.__mflClubViewRuntimeState;
  if (previousRuntime?.clickHandler) {
    window.removeEventListener("click", previousRuntime.clickHandler, true);
  }
  if (previousRuntime?.shareClickHandler) {
    document.removeEventListener("click", previousRuntime.shareClickHandler, true);
  }
  if (previousRuntime?.monitorTimer) {
    window.clearInterval(previousRuntime.monitorTimer);
  }
  if (previousRuntime?.installTimer) {
    window.clearInterval(previousRuntime.installTimer);
  }
  if (previousRuntime?.captureTimers instanceof Map) {
    previousRuntime.captureTimers.forEach((timer) => window.clearTimeout(timer));
  }
  if (
    previousRuntime?.requestWrapper
    && previousRuntime?.nativeRequestIncrementalRoute
    && typeof requestIncrementalRoute === "function"
    && requestIncrementalRoute === previousRuntime.requestWrapper
  ) {
    requestIncrementalRoute = previousRuntime.nativeRequestIncrementalRoute;
  }
  if (
    previousRuntime?.loadWrapper
    && previousRuntime?.nativeLoadIncrementalRoutePage
    && window.mflLoadIncrementalRoutePage === previousRuntime.loadWrapper
  ) {
    window.mflLoadIncrementalRoutePage = previousRuntime.nativeLoadIncrementalRoutePage;
  }
  delete window.__mflClubViewRuntimeState;

  let installed = false;
  let installTimer = 0;
  let filteringClubRows = false;
  let clickHandler = null;
  let shareClickHandler = null;

  function syncShareCursor() {
    document.documentElement.classList.toggle("evaluationShareBusy", activeShareButtons.size > 0);
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
      activeShareButtons.delete(button);
      syncShareCursor();
    };

    window.requestAnimationFrame(check);
  }

  function installShareCursor() {
    let style = document.getElementById("evaluationShareBusyCursorStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "evaluationShareBusyCursorStyles";
      document.head.appendChild(style);
    }
    style.textContent = `
      html.evaluationShareBusy,
      html.evaluationShareBusy body,
      html.evaluationShareBusy body * {
        cursor: wait !important;
      }
    `;

    shareClickHandler = (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest("#evaluationShareButton, .evaluationLoadShareButton");
      if (!(button instanceof HTMLButtonElement) || button.disabled) return;
      trackShareButton(button);
    };
    document.addEventListener("click", shareClickHandler, true);
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

  function clubViewButton(event) {
    if (typeof state === "undefined" || state.currentPage !== CLUB_PAGE || !(event.target instanceof Element)) {
      return null;
    }
    const button = event.target.closest(".viewButton[data-view]");
    return button && CLUB_VIEWS.has(String(button.dataset.view || "")) ? button : null;
  }

  function handleClubViewNavigation(event) {
    const button = clubViewButton(event);
    if (!button) return false;
    const route = routeFromLocation();
    if (!route) return false;

    event.preventDefault();
    event.stopImmediatePropagation();

    const nextView = String(button.dataset.view || "");
    if (!nextView || nextView === route.view) return true;

    if (typeof window.mflOpenClubPage === "function") {
      window.mflOpenClubPage(route.clubId, nextView);
      return true;
    }

    const slug = nextView === "current"
      ? "current-season"
      : nextView === "all"
        ? "all-time"
        : nextView === "contracts"
          ? "contracts"
          : "attributes";
    window.location.assign(`/clubs/${encodeURIComponent(route.clubId)}/${slug}`);
    return true;
  }

  function clubIdColumn(columns = state?.columns) {
    if (!Array.isArray(columns)) return "";
    return [
      "active_contract_club_id",
      "club_id",
      "current_club_id",
      "active_club_id",
    ].find((column) => columns.includes(column)) || "";
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
    if (typeof state === "undefined" || state.currentPage !== CLUB_PAGE) return false;
    const column = headerColumn(event);
    if (!column || state.sortKey !== column) return false;

    const defaultDirection = typeof numberColumns !== "undefined" && numberColumns.has(column)
      ? "desc"
      : "asc";
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
    if (typeof state === "undefined" || !(event.target instanceof Element)) return null;
    const playerPageActive = state.currentPage === "player"
      || /^\/players?\//i.test(window.location.pathname);
    if (!playerPageActive) return null;

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

    if (typeof paintLoadingOverlayNow === "function") {
      const access = typeof currentDataAccess === "function"
        ? currentDataAccess(pageName)
        : "public";
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

  function handleWindowClick(event) {
    if (
      event instanceof MouseEvent
      && (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
    ) {
      return;
    }
    if (handlePlayerMflNavigation(event)) return;
    if (handleClubViewNavigation(event)) return;
    resetSortCycle(event);
  }

  function install() {
    if (installed) return true;
    if (typeof state === "undefined" || typeof compareRows !== "function" || typeof applyFilters !== "function") {
      return false;
    }

    const nativeCompareRows = compareRows;
    compareRows = function compareRowsWithClubPositionOrder(a, b) {
      if (filteringClubRows && state.sortKey === "positions") return comparePositions(a, b);
      if (filteringClubRows) return nativeCompareRows.call(this, a, b);
      if (state.currentPage !== CLUB_PAGE) return nativeCompareRows.call(this, a, b);

      const previousPage = state.currentPage;
      state.currentPage = ["current", "all"].includes(state.view) ? "progression" : "database";
      try {
        return state.sortKey === "positions"
          ? comparePositions(a, b)
          : nativeCompareRows.call(this, a, b);
      } finally {
        state.currentPage = previousPage;
      }
    };

    const nativeApplyFilters = applyFilters;
    applyFilters = function applyFiltersWithClubRows(options = {}) {
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
    document.documentElement.dataset.clubViewCacheVersion = VERSION;
    window.__mflClubViewRuntimeState = {
      clickHandler,
      shareClickHandler,
      installTimer: 0,
    };
    installed = true;
    if (installTimer) window.clearInterval(installTimer);
    return true;
  }

  installShareCursor();
  if (!install()) {
    installTimer = window.setInterval(() => {
      if (install()) return;
    }, 25);
    window.setTimeout(() => {
      if (installTimer) window.clearInterval(installTimer);
      installTimer = 0;
    }, 15000);
  }
})();
