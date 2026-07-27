(() => {
  const requestedPatchText = "Keep every table column continuously visible during sidebar transitions";
  const mflWalletAddress = "0xff8d2bbed8164db0";
  const fixedTableColumnWidths = {
    selection: 42,
    player_id: 62,
    nationality_flag: 32,
    name: 192,
    nationality: 132,
    age: 57.28,
    positions: 112,
    player_seasons: 77,
    overall: 94,
    pace: 94,
    shooting: 94,
    passing: 94,
    dribbling: 94,
    defense: 94,
    physical: 94,
    goalkeeping: 94,
    wallet_name: 177,
    owned_since: 177,
    active_contract_revenue_share: 132,
    active_contract_club_name: 219.16,
    active_contract_club_division: 272,
    player_link: 47,
  };

  function keepSidebarExpanded() {
    if (typeof state === "object" && state) state.menuOpen = true;

    [document.body, typeof appShell !== "undefined" ? appShell : null, typeof sidebar !== "undefined" ? sidebar : null, typeof menuRail !== "undefined" ? menuRail : null]
      .filter(Boolean)
      .forEach((element) => {
        element.classList.remove("menuClosed", "sidebarClosed", "sidebarCollapsed", "collapsed");
        element.classList.add("menuOpen");
      });

    if (typeof menuButton !== "undefined" && menuButton) {
      menuButton.disabled = true;
      menuButton.tabIndex = -1;
      menuButton.setAttribute("aria-disabled", "true");
      menuButton.setAttribute("aria-expanded", "true");
      menuButton.style.pointerEvents = "none";
      menuButton.style.cursor = "default";
    }
  }

  const sidebarStyle = document.createElement("style");
  sidebarStyle.textContent = [
    "#menuButton,.menuButton,[data-action='toggle-menu']{pointer-events:none!important;cursor:default!important;color:#fff!important;opacity:1!important}",
    "#menuButton *,.menuButton * ,[data-action='toggle-menu'] *{color:#fff!important;opacity:1!important}",
    "#menuButton svg,.menuButton svg,[data-action='toggle-menu'] svg{stroke:#fff!important;fill:none!important}",
    "#menuButton svg [fill]:not([fill='none']),.menuButton svg [fill]:not([fill='none']),[data-action='toggle-menu'] svg [fill]:not([fill='none']){fill:#fff!important}",
    ".appShell.menuClosed,.appShell.sidebarClosed,.appShell.sidebarCollapsed,.appShell.collapsed{grid-template-columns:var(--sidebar-width,260px) minmax(0,1fr)!important}",
  ].join("");
  document.head.appendChild(sidebarStyle);

  if (typeof toggleMenu === "function") {
    toggleMenu = function permanentlyExpandedMenu() {
      keepSidebarExpanded();
    };
  }

  function installFixedTableColumnWidths() {
    if (typeof tableColumnWidths !== "object" || !tableColumnWidths) return;
    Object.assign(tableColumnWidths, fixedTableColumnWidths);
  }

  function applyExactTableColumnWidths() {
    installFixedTableColumnWidths();
    if (typeof tableColGroup === "undefined" || !tableColGroup || typeof currentViewColumns !== "function") return;

    const table = tableColGroup.closest("table");
    const columns = Array.from(tableColGroup.children);
    const columnNames = ["selection", ...currentViewColumns()];
    if (!table || columns.length !== columnNames.length) return;

    let totalWidth = 0;
    columns.forEach((column, index) => {
      const columnName = columnNames[index];
      const width = Number(fixedTableColumnWidths[columnName] ?? tableColumnWidths[columnName]);
      if (!Number.isFinite(width) || width <= 0) return;
      const value = `${width}px`;
      column.style.setProperty("width", value, "important");
      column.style.setProperty("min-width", value, "important");
      column.style.setProperty("max-width", value, "important");
      totalWidth += width;
    });

    if (totalWidth > 0) {
      const value = `${totalWidth}px`;
      table.style.setProperty("table-layout", "fixed", "important");
      table.style.setProperty("width", value, "important");
      table.style.setProperty("min-width", value, "important");
      table.style.setProperty("max-width", value, "important");
    }
  }

  installFixedTableColumnWidths();

  if (typeof buildTableColGroup === "function") {
    const originalBuildTableColGroup = buildTableColGroup;
    buildTableColGroup = function buildTableColGroupWithFixedWidths() {
      installFixedTableColumnWidths();
      const result = originalBuildTableColGroup.apply(this, arguments);
      applyExactTableColumnWidths();
      return result;
    };
  }

  if (typeof buildHeader === "function") {
    const originalBuildHeader = buildHeader;
    buildHeader = function buildHeaderWithFixedWidths() {
      installFixedTableColumnWidths();
      const result = originalBuildHeader.apply(this, arguments);
      applyExactTableColumnWidths();
      return result;
    };
  }

  if (typeof renderTable === "function") {
    const originalRenderTable = renderTable;
    renderTable = function renderTableWithFixedWidths() {
      const result = originalRenderTable.apply(this, arguments);
      applyExactTableColumnWidths();
      return result;
    };
  }

  function routeViewFromPath() {
    const match = window.location.pathname.match(/^\/watchlist\/[^/]+\/(attributes|next-overall|contracts|current-season|all-time)\/?$/i);
    if (!match) return "";
    return {
      attributes: "attributes",
      "next-overall": "next",
      contracts: "contracts",
      "current-season": "current",
      "all-time": "all",
    }[match[1].toLowerCase()] || "";
  }

  function enforceWatchlistRouteView(render = true) {
    const routeView = routeViewFromPath();
    if (!routeView || state.currentPage !== "watchlist") return false;

    const normalizedView = typeof normalizeViewForPage === "function"
      ? normalizeViewForPage(routeView, "watchlist")
      : routeView;

    if (state.view === normalizedView) return true;

    state.view = normalizedView;
    state.page = 1;

    if (render) {
      if (typeof updateViewButtons === "function") updateViewButtons();
      if (typeof buildTableColGroup === "function") buildTableColGroup();
      if (typeof buildHeader === "function") buildHeader();
      if (typeof applyFilters === "function") applyFilters({ save: false });
    }

    return true;
  }

  if (typeof restoreSavedTableState === "function") {
    const originalRestoreSavedTableState = restoreSavedTableState;
    restoreSavedTableState = function restoreSavedTableStateWithRoute(pageName, options = {}) {
      const routeView = routeViewFromPath();
      const result = originalRestoreSavedTableState.call(
        this,
        pageName,
        routeView ? { ...options, view: routeView } : options,
      );
      if (routeView) {
        state.view = typeof normalizeViewForPage === "function"
          ? normalizeViewForPage(routeView, "watchlist")
          : routeView;
      }
      return result;
    };
  }

  if (typeof setPage === "function") {
    const originalSetPage = setPage;
    setPage = async function setPageWithWatchlistRoute(pageName, updateHash = true, options = {}) {
      const routeView = pageName === "watchlist" ? routeViewFromPath() : "";
      const nextOptions = routeView ? { ...options, view: routeView } : options;
      const result = await originalSetPage.call(this, pageName, updateHash, nextOptions);
      keepSidebarExpanded();
      if (pageName === "watchlist" && routeView) enforceWatchlistRouteView(true);
      applyExactTableColumnWidths();
      return result;
    };
  }

  function renamePatch() {
    document.querySelectorAll(".changelogList li").forEach((entry) => {
      const version = entry.querySelector("span")?.textContent?.trim();
      const description = entry.querySelector("p");
      if (version === "v1.149.74" && description) description.textContent = requestedPatchText;
    });
  }

  function searchResultForMflWallet(target) {
    const result = target?.closest?.("a,button,[role='button'],li");
    if (!result || !result.closest("#searchModal,.searchResults,#playerSearchResults,[class*='searchResult']")) return null;
    const context = [result, result.closest("li"), result.parentElement]
      .filter(Boolean)
      .map((element) => `${element.textContent || ""} ${Array.from(element.attributes || []).map((attribute) => `${attribute.name}=${attribute.value}`).join(" ")}`.toLowerCase())
      .join(" ");
    return context.includes("mfl wallet") || context.includes(mflWalletAddress) ? result : null;
  }

  function onMflStatsPage() {
    return window.location.pathname.toLowerCase() === "/mfl/stats"
      || state.currentPage === "mflstats"
      || (state.currentPage === "mfl" && state.view === "stats");
  }

  document.addEventListener("click", (event) => {
    if (typeof menuButton !== "undefined" && menuButton && (event.target === menuButton || menuButton.contains(event.target))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      keepSidebarExpanded();
      return;
    }

    if (!onMflStatsPage() || !searchResultForMflWallet(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (typeof closeSearch === "function") closeSearch();
    void setPage("mfl", true, { view: "attributes", skipNavigationLoading: true });
  }, true);

  keepSidebarExpanded();
  installFixedTableColumnWidths();
  renamePatch();
  requestAnimationFrame(applyExactTableColumnWidths);
  document.addEventListener("DOMContentLoaded", () => {
    keepSidebarExpanded();
    installFixedTableColumnWidths();
    renamePatch();
    requestAnimationFrame(applyExactTableColumnWidths);
  }, { once: true });
})();