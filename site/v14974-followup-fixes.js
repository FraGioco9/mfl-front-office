(() => {
  const requestedPatchText = "Keep every table column continuously visible during sidebar transitions";
  const mflWalletAddress = "0xff8d2bbed8164db0";
  const attributesColumnWidths = new Map();
  let syncingColumnWidths = false;
  let columnWidthSyncFrame = 0;

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

  function activePlayerTable() {
    return document.querySelector("#playerTable, #databaseTable, .tableScroller > table:not(.sidebarTableSnapshot), main table:has(colgroup)");
  }

  function columnKey(header, index) {
    const datasetKey = header?.dataset?.column
      || header?.dataset?.sortKey
      || header?.dataset?.key
      || header?.getAttribute?.("data-column")
      || header?.getAttribute?.("data-sort-key");
    if (datasetKey) return String(datasetKey).trim().toLowerCase();

    const text = String(header?.textContent || "")
      .replace(/[▲▼↕]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    return text || `column-${index}`;
  }

  function tableColumns() {
    const table = activePlayerTable();
    if (!table) return { table: null, headers: [], columns: [] };
    return {
      table,
      headers: Array.from(table.querySelectorAll("thead tr:first-child > th")),
      columns: Array.from(table.querySelectorAll("colgroup > col")),
    };
  }

  function clearForcedColumnWidths(table) {
    if (!table) return;
    table.querySelectorAll("colgroup > col").forEach((column) => {
      column.style.removeProperty("width");
      column.style.removeProperty("min-width");
      column.style.removeProperty("max-width");
    });
    table.querySelectorAll("thead tr:first-child > th, tbody tr:first-child > td").forEach((cell) => {
      cell.style.removeProperty("width");
      cell.style.removeProperty("min-width");
      cell.style.removeProperty("max-width");
    });
  }

  function captureAttributesColumnWidths() {
    const { table, headers, columns } = tableColumns();
    if (!table || !headers.length || headers.length !== columns.length) return false;

    clearForcedColumnWidths(table);
    const tableWidth = table.getBoundingClientRect().width;
    if (!(tableWidth > 0)) return false;

    attributesColumnWidths.clear();
    headers.forEach((header, index) => {
      const column = columns[index];
      const measuredWidth = header.getBoundingClientRect().width || column.getBoundingClientRect().width;
      if (!(measuredWidth > 0)) return;
      attributesColumnWidths.set(columnKey(header, index), {
        pixels: measuredWidth,
        percent: (measuredWidth / tableWidth) * 100,
      });
    });
    return attributesColumnWidths.size > 0;
  }

  function applyCanonicalWidth(element, canonical) {
    if (!element || !canonical) return;
    element.style.setProperty("width", `${canonical.percent}%`, "important");
    element.style.setProperty("min-width", `${canonical.pixels}px`, "important");
    element.style.setProperty("max-width", `${canonical.pixels}px`, "important");
  }

  function applyAttributesColumnWidths() {
    if (!attributesColumnWidths.size) return false;
    const { table, headers, columns } = tableColumns();
    if (!table || !headers.length || headers.length !== columns.length) return false;

    const firstRowCells = Array.from(table.querySelectorAll("tbody tr:first-child > td"));
    headers.forEach((header, index) => {
      const canonical = attributesColumnWidths.get(columnKey(header, index));
      if (!canonical) return;
      applyCanonicalWidth(columns[index], canonical);
      applyCanonicalWidth(header, canonical);
      applyCanonicalWidth(firstRowCells[index], canonical);
    });
    return true;
  }

  function synchronizeCommonColumnWidths() {
    if (syncingColumnWidths || typeof state !== "object" || !state) return;
    if (!["attributes", "current", "all", "next", "contracts"].includes(state.view)) return;
    if (typeof buildTableColGroup !== "function" || typeof buildHeader !== "function") return;

    syncingColumnWidths = true;
    try {
      if (!attributesColumnWidths.size) {
        if (state.view === "attributes") {
          captureAttributesColumnWidths();
        } else {
          const currentView = state.view;
          const currentPage = state.page;
          state.view = typeof normalizeViewForPage === "function"
            ? normalizeViewForPage("attributes", state.currentPage)
            : "attributes";
          buildTableColGroup();
          buildHeader();
          captureAttributesColumnWidths();
          state.view = currentView;
          state.page = currentPage;
          buildTableColGroup();
          buildHeader();
        }
      }

      applyAttributesColumnWidths();
    } finally {
      syncingColumnWidths = false;
    }
  }

  function queueCommonColumnWidthSync() {
    if (columnWidthSyncFrame) cancelAnimationFrame(columnWidthSyncFrame);
    columnWidthSyncFrame = requestAnimationFrame(() => {
      columnWidthSyncFrame = requestAnimationFrame(() => {
        columnWidthSyncFrame = 0;
        synchronizeCommonColumnWidths();
      });
    });
  }

  if (typeof buildHeader === "function") {
    const originalBuildHeader = buildHeader;
    buildHeader = function buildHeaderWithCanonicalWidths() {
      const result = originalBuildHeader.apply(this, arguments);
      if (!syncingColumnWidths) queueCommonColumnWidthSync();
      return result;
    };
  }

  if (typeof renderTable === "function") {
    const originalRenderTable = renderTable;
    renderTable = function renderTableWithCanonicalWidths() {
      const result = originalRenderTable.apply(this, arguments);
      queueCommonColumnWidthSync();
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
      queueCommonColumnWidthSync();
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
  renamePatch();
  document.addEventListener("DOMContentLoaded", () => {
    keepSidebarExpanded();
    renamePatch();
    queueCommonColumnWidthSync();
  }, { once: true });
})();