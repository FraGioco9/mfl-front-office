(() => {
  const currentVersion = "1.149.74";
  const maxNoteLength = 100;
  const watchlistViewsKey = "watchlistViews";
  const watchlistViews = {};

  const recoveredChangelog = [
    ["1.149.74", "Keep every table column continuously visible during sidebar transitions and place recent patches in the v1.149 section"],
    ["1.149.73", "Keep every table column visible during sidebar transitions and normalize the changelog"],
    ["1.149.72", "Restore static source loading and remove the Vercel app bundle wrapper"],
    ["1.149.71", "Limit notes to 100 characters, remember watchlist views, smooth sidebar transitions, and fix player pages"],
    ["1.149.70", "Keep the current version visible in the footer"],
    ["1.149.69", "Persist the last selected view for each watchlist"],
    ["1.149.68", "Improve sidebar transitions and player page data loading"],
  ];

  function normalizePatchText(entry, label, description) {
    const version = entry.querySelector("span");
    const text = entry.querySelector("p");
    if (version && text) {
      version.textContent = label;
      text.textContent = description;
    } else {
      entry.innerHTML = `<span>${label}</span><p>${description}</p>`;
    }
  }

  function updatePatchCount(section, count) {
    if (!section) return;
    const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (/\d+\s+patch(?:es)?/i.test(node.nodeValue || "")) {
        node.nodeValue = node.nodeValue.replace(/\d+\s+patch(?:es)?/i, `${count} patches`);
        return;
      }
    }
  }

  function syncChangelog() {
    const changelog = document.querySelector(".changelogList");
    if (!changelog) return false;

    const looseRecentEntries = Array.from(changelog.children).filter((entry) => {
      const version = entry.querySelector(":scope > span")?.textContent?.trim();
      return recoveredChangelog.some(([number]) => version === `v${number}`);
    });
    looseRecentEntries.forEach((entry) => entry.remove());

    const referenceVersion = Array.from(changelog.querySelectorAll("li span"))
      .find((item) => item.textContent.trim() === "v1.149.67");
    const referenceEntry = referenceVersion?.closest("li");
    if (!referenceEntry) return false;

    const patchList = referenceEntry.parentElement;
    if (!patchList) return false;

    recoveredChangelog.slice().reverse().forEach(([version, description]) => {
      const label = `v${version}`;
      let entry = Array.from(patchList.children).find(
        (item) => item.querySelector("span")?.textContent?.trim() === label
      );
      if (!entry) {
        entry = referenceEntry.cloneNode(true);
        patchList.insertBefore(entry, patchList.firstElementChild || referenceEntry);
      }
      normalizePatchText(entry, label, description);
    });

    Array.from(patchList.querySelectorAll(":scope > li")).forEach((entry) => {
      const version = entry.querySelector("span");
      const description = entry.querySelector("p");
      if (!version || !description) return;
      version.textContent = version.textContent.trim();
      description.textContent = description.textContent.trim().replace(/\s+/g, " ");
    });

    const section = patchList.closest("details, .changelogVersion, .changelogGroup, li, section, div");
    updatePatchCount(section, patchList.querySelectorAll(":scope > li").length);
    return true;
  }

  function scheduleChangelogSync() {
    if (syncChangelog()) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (syncChangelog() || attempts >= 20) window.clearInterval(timer);
    }, 50);
  }

  function syncVisibleVersion() {
    const footerLink = document.querySelector('.siteFooter a[href="/changelog"]');
    if (footerLink) footerLink.textContent = `MFL Front Office v${currentVersion}`;
    document.querySelectorAll("[data-app-version], .footerVersion, #footerVersion").forEach((element) => {
      element.textContent = `v${currentVersion}`;
    });
    scheduleChangelogSync();
  }

  const style = document.createElement("style");
  style.textContent = [
    ".tableScroller.sidebarSnapshotActive{position:relative!important}",
    ".tableScroller.sidebarSnapshotActive>table:not(.sidebarTableSnapshot){opacity:0!important}",
    ".sidebarTableSnapshot{position:absolute!important;inset:0 auto auto 0!important;width:100%!important;min-width:0!important;table-layout:fixed!important;z-index:20!important;pointer-events:none!important;margin:0!important;opacity:1!important;visibility:visible!important}",
    ".sidebarTableSnapshot col,.sidebarTableSnapshot th,.sidebarTableSnapshot td,.sidebarTableSnapshot a,.sidebarTableSnapshot button{opacity:1!important;visibility:visible!important;transition:none!important}",
    ".appShell,.appShell main,.tableScroller{will-change:width}",
  ].join("");
  document.head.appendChild(style);

  syncVisibleVersion();
  document.addEventListener("DOMContentLoaded", syncVisibleVersion, { once: true });

  if (typeof sanitizePlayerNote === "function") {
    sanitizePlayerNote = function sanitizePlayerNote100(note) {
      return String(note || "").replace(/\r\n/g, "\n").slice(0, maxNoteLength).trim();
    };
  }

  if (typeof updatePlayerNoteCount === "function") {
    updatePlayerNoteCount = function updatePlayerNoteCount100(input) {
      if (input && input.value.length > maxNoteLength) input.value = input.value.slice(0, maxNoteLength);
      const counter = playerDetail?.querySelector("#playerNotesCount");
      if (counter) counter.textContent = `${input?.value?.length || 0}/${maxNoteLength}`;
    };
  }

  if (typeof renderPlayerPage === "function") {
    const originalRenderPlayerPage = renderPlayerPage;
    renderPlayerPage = function fixedRenderPlayerPage(playerId) {
      const id = String(playerId || "");
      const row = typeof rowByPlayerId === "function" ? rowByPlayerId(id) : null;
      const dataIsChanging = Boolean(state.dataLoadPromise) || !state.dataLoaded || !state.rows.length;

      if (!row && dataIsChanging) {
        if (playerDetail) playerDetail.innerHTML = '<div class="emptyState">Loading player...</div>';
        Promise.resolve(state.dataLoadPromise).finally(() => {
          if (state.currentPage !== "player") return;
          originalRenderPlayerPage(id);
          const input = playerDetail?.querySelector("#playerNotesInput");
          if (input) {
            input.maxLength = maxNoteLength;
            input.value = input.value.slice(0, maxNoteLength);
            updatePlayerNoteCount(input);
          }
        });
        return;
      }

      originalRenderPlayerPage(id);
      const input = playerDetail?.querySelector("#playerNotesInput");
      if (input) {
        input.maxLength = maxNoteLength;
        input.value = input.value.slice(0, maxNoteLength);
        updatePlayerNoteCount(input);
      }
    };
  }

  if (typeof currentDataAccess === "function") {
    const originalCurrentDataAccess = currentDataAccess;
    currentDataAccess = function fixedCurrentDataAccess(pageName = state.currentPage) {
      if (pageName === "player") {
        return typeof hasProgressionAccess === "function" && hasProgressionAccess() ? "full" : "public";
      }
      return originalCurrentDataAccess.apply(this, arguments);
    };
  }

  if (typeof setPage === "function") {
    const originalSetPage = setPage;
    setPage = async function fixedSetPage(pageName, updateHash = true, options = {}) {
      if (pageName === "player" && state.dataAccess === "owned" && !(typeof hasProgressionAccess === "function" && hasProgressionAccess())) {
        if (typeof captureCurrentDataSnapshot === "function") captureCurrentDataSnapshot();
        state.dataLoaded = false;
        state.dataLoadPromise = null;
      }
      return originalSetPage.call(this, pageName, updateHash, options);
    };
  }

  function rememberCurrentWatchlistView() {
    if (state.currentPage === "watchlist" && state.currentWatchlistId && state.view) {
      watchlistViews[state.currentWatchlistId] = state.view;
    }
  }

  if (typeof currentTableState === "function") {
    const originalCurrentTableState = currentTableState;
    currentTableState = function currentTableStateWithWatchlistViews(...args) {
      rememberCurrentWatchlistView();
      return { ...originalCurrentTableState.apply(this, args), [watchlistViewsKey]: { ...watchlistViews } };
    };
  }

  if (typeof stripPersistentSortState === "function") {
    const originalStripPersistentSortState = stripPersistentSortState;
    stripPersistentSortState = function stripPersistentSortStateWithWatchlistViews(tableState) {
      return {
        ...originalStripPersistentSortState.call(this, tableState),
        [watchlistViewsKey]: { ...(tableState?.[watchlistViewsKey] || watchlistViews) },
      };
    };
  }

  if (typeof applyWalletTableState === "function") {
    const originalApplyWalletTableState = applyWalletTableState;
    applyWalletTableState = function applyWalletTableStateWithWatchlistViews(tableState) {
      const incoming = tableState?.[watchlistViewsKey];
      if (incoming && typeof incoming === "object" && !Array.isArray(incoming)) {
        Object.entries(incoming).forEach(([watchlistId, view]) => {
          if (watchlistId && typeof view === "string") watchlistViews[watchlistId] = view;
        });
      }
      return originalApplyWalletTableState.call(this, tableState);
    };
  }

  if (typeof setView === "function") {
    const originalSetView = setView;
    setView = function setViewWithWatchlistSync(viewName) {
      const result = originalSetView.apply(this, arguments);
      rememberCurrentWatchlistView();
      if (state.currentPage === "watchlist" && typeof saveTableState === "function") saveTableState();
      return result;
    };
  }

  if (typeof switchWatchlist === "function") {
    const originalSwitchWatchlist = switchWatchlist;
    switchWatchlist = function switchWatchlistWithSavedView(watchlistId) {
      rememberCurrentWatchlistView();
      const result = originalSwitchWatchlist.apply(this, arguments);
      const savedView = watchlistViews[String(watchlistId || "")];
      if (savedView && typeof normalizeViewForPage === "function") {
        state.view = normalizeViewForPage(savedView, "watchlist");
        state.page = 1;
        if (typeof updateViewButtons === "function") updateViewButtons();
        if (typeof buildHeader === "function") buildHeader();
        if (typeof applyFilters === "function") applyFilters();
        if (typeof saveTableState === "function") saveTableState();
      }
      return result;
    };
  }

  let transitionTimer = 0;
  let activeSnapshot = null;
  let activeScroller = null;

  function removeDuplicateIds(root) {
    root.removeAttribute?.("id");
    root.querySelectorAll?.("[id]").forEach((element) => element.removeAttribute("id"));
  }

  function createSidebarSnapshot() {
    const visibleTable = Array.from(document.querySelectorAll(".tableScroller > table"))
      .find((table) => table.offsetParent !== null && !table.classList.contains("evaluationTable"));
    if (!visibleTable) return;

    const scroller = visibleTable.parentElement;
    const snapshot = visibleTable.cloneNode(true);
    removeDuplicateIds(snapshot);
    snapshot.classList.add("sidebarTableSnapshot");
    snapshot.setAttribute("aria-hidden", "true");

    const sourceCols = Array.from(visibleTable.querySelectorAll("colgroup col"));
    const snapshotCols = Array.from(snapshot.querySelectorAll("colgroup col"));
    const totalWidth = visibleTable.getBoundingClientRect().width || 1;
    sourceCols.forEach((column, index) => {
      if (!snapshotCols[index]) return;
      const width = column.getBoundingClientRect().width;
      snapshotCols[index].style.width = `${(width / totalWidth) * 100}%`;
      snapshotCols[index].style.minWidth = "0";
      snapshotCols[index].style.maxWidth = "none";
    });

    scroller.classList.add("sidebarSnapshotActive");
    scroller.appendChild(snapshot);
    activeScroller = scroller;
    activeSnapshot = snapshot;
  }

  function finishSidebarTransition() {
    window.clearTimeout(transitionTimer);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      activeSnapshot?.remove();
      activeScroller?.classList.remove("sidebarSnapshotActive");
      activeSnapshot = null;
      activeScroller = null;
    }));
  }

  if (typeof toggleMenu === "function") {
    const originalToggleMenu = toggleMenu;
    toggleMenu = function smoothToggleMenu(...args) {
      finishSidebarTransition();
      createSidebarSnapshot();
      const result = originalToggleMenu.apply(this, args);
      transitionTimer = window.setTimeout(finishSidebarTransition, 420);
      return result;
    };

    [appShell, sidebar, menuRail].filter(Boolean).forEach((element) => {
      element.addEventListener("transitionend", (event) => {
        if (event.target === element) finishSidebarTransition();
      });
    });
  }
})();

/* Consolidated from v14974-mfl-wallet-search-fix.js */
(() => {
  const mflWalletAddress = "0xff8d2bbed8164db0";

  function elementContext(element) {
    if (!element) return "";

    const text = String(element.textContent || "").trim().toLowerCase();
    const attributes = Array.from(element.attributes || [])
      .map((attribute) => `${attribute.name}=${attribute.value}`)
      .join(" ")
      .toLowerCase();

    return `${text} ${attributes}`;
  }

  function clickedMflWallet(event) {
    const target = event?.target;
    if (!target?.closest) return false;

    // Inspect only the element that performs the navigation. Do not inspect the
    // whole composed path, because a page ancestor may contain "MFL Wallet"
    // even when an unrelated navigation control was clicked.
    const interactiveElement = target.closest(
      "a,button,[role='button'],[data-wallet-address],[data-agent-wallet],[data-wallet]",
    );

    if (interactiveElement) {
      const context = elementContext(interactiveElement);
      if (context.includes("mfl wallet") || context.includes(mflWalletAddress)) return true;
    }

    // Search results may use a non-interactive row as their click target.
    const searchContainer = target.closest(
      "#searchModal,.searchResults,#playerSearchResults,[class*='searchResult']",
    );
    if (!searchContainer) return false;

    const searchResult = target.closest(
      "li,[role='option'],[data-wallet-address],[data-agent-wallet],[data-wallet],.searchResult,[class*='searchResultItem']",
    );
    if (!searchResult || !searchContainer.contains(searchResult)) return false;

    const context = elementContext(searchResult);
    return context.includes("mfl wallet") || context.includes(mflWalletAddress);
  }

  document.addEventListener("click", (event) => {
    if (!clickedMflWallet(event)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (typeof closeSearch === "function") closeSearch();

    // Always open the MFL Wallet profile on Attributes. This intentionally
    // ignores the last saved MFL view, which may have been Stats.
    window.location.assign("/mfl/attributes");
  }, true);
})();


/* Consolidated from v14974-followup-fixes.js */
(() => {
  const requestedPatchText = "Keep every table column continuously visible during sidebar transitions";
  const mflWalletAddress = "0xff8d2bbed8164db0";
  const tableColumnPercentages = {
    selection: 3,
    player_id: 3,
    nationality_flag: 3,
    name: 13,
    nationality: 7,
    age: 6,
    positions: 6,
    player_seasons: 5,
    overall: 6,
    pace: 6,
    shooting: 6,
    passing: 6,
    dribbling: 6,
    defense: 6,
    physical: 6,
    goalkeeping: 6,
    wallet_name: 10,
    owned_since: 10,
    active_contract_revenue_share: 8,
    active_contract_club_name: 19,
    active_contract_club_division: 9,
    player_link: 2,
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

  function clearLegacyPixelWidths(element) {
    if (!element) return;
    element.style.removeProperty("min-width");
    element.style.removeProperty("max-width");
  }

  function remainderColumnName(columnNames) {
    if (columnNames.includes("active_contract_club_name")) return "active_contract_club_name";
    if (columnNames.includes("wallet_name")) return "wallet_name";
    if (columnNames.includes("owned_since")) return "owned_since";
    if (columnNames.includes("name")) return "name";
    return columnNames[columnNames.length - 1];
  }

  function applyPercentageTableColumnWidths() {
    if (typeof tableColGroup === "undefined" || !tableColGroup || typeof currentViewColumns !== "function") return;

    const table = tableColGroup.closest("table");
    const columns = Array.from(tableColGroup.children);
    const columnNames = ["selection", ...currentViewColumns()];
    if (!table || columns.length !== columnNames.length) return;

    const percentages = columnNames.map((columnName) => Number(tableColumnPercentages[columnName]));
    if (percentages.some((percentage) => !Number.isFinite(percentage) || percentage <= 0)) return;

    const totalPercentage = percentages.reduce((sum, percentage) => sum + percentage, 0);
    const remainderIndex = columnNames.indexOf(remainderColumnName(columnNames));
    if (remainderIndex < 0) return;

    percentages[remainderIndex] += 100 - totalPercentage;
    if (percentages[remainderIndex] <= 0) return;

    columns.forEach((column, index) => {
      clearLegacyPixelWidths(column);
      column.style.setProperty("width", `${percentages[index]}%`, "important");
    });

    clearLegacyPixelWidths(table);
    table.style.setProperty("table-layout", "fixed", "important");
    table.style.setProperty("width", "100%", "important");
  }

  if (typeof buildTableColGroup === "function") {
    const originalBuildTableColGroup = buildTableColGroup;
    buildTableColGroup = function buildTableColGroupWithPercentageWidths() {
      const result = originalBuildTableColGroup.apply(this, arguments);
      applyPercentageTableColumnWidths();
      return result;
    };
  }

  if (typeof buildHeader === "function") {
    const originalBuildHeader = buildHeader;
    buildHeader = function buildHeaderWithPercentageWidths() {
      const result = originalBuildHeader.apply(this, arguments);
      applyPercentageTableColumnWidths();
      return result;
    };
  }

  if (typeof renderTable === "function") {
    const originalRenderTable = renderTable;
    renderTable = function renderTableWithPercentageWidths() {
      const result = originalRenderTable.apply(this, arguments);
      applyPercentageTableColumnWidths();
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
      applyPercentageTableColumnWidths();
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
  requestAnimationFrame(applyPercentageTableColumnWidths);
  document.addEventListener("DOMContentLoaded", () => {
    keepSidebarExpanded();
    renamePatch();
    requestAnimationFrame(applyPercentageTableColumnWidths);
  }, { once: true });
})();

/* Consolidated from v14974-column-width-fix.js */
(() => {
  const columnPercentages = {
    selection: 3,
    player_id: 3,
    nationality_flag: 3,
    name: 13,
    nationality: 7,
    age: 6,
    positions: 6,
    player_seasons: 5,
    overall: 6,
    pace: 6,
    shooting: 6,
    passing: 6,
    dribbling: 6,
    defense: 6,
    physical: 6,
    goalkeeping: 6,
    wallet_name: 9,
    owned_since: 9,
    active_contract_revenue_share: 8,
    active_contract_club_name: 19,
    active_contract_club_division: 9,
    player_link: 3,
  };

  function flexibleColumnIndex(columnNames) {
    const preferredColumns = [
      "active_contract_club_name",
      "wallet_name",
      "owned_since",
      "name",
    ];

    for (const columnName of preferredColumns) {
      const index = columnNames.indexOf(columnName);
      if (index >= 0) return index;
    }

    return columnNames.length - 1;
  }

  function viewPercentages(columnNames) {
    const percentages = columnNames.map((columnName) => Number(columnPercentages[columnName]));
    if (percentages.some((percentage) => !Number.isFinite(percentage) || percentage <= 0)) return null;

    const total = percentages.reduce((sum, percentage) => sum + percentage, 0);
    const flexibleIndex = flexibleColumnIndex(columnNames);
    percentages[flexibleIndex] += 100 - total;

    return percentages[flexibleIndex] > 0 ? percentages : null;
  }

  function clearLegacySizing(element) {
    if (!element) return;
    element.style.removeProperty("min-width");
    element.style.removeProperty("max-width");
  }

  function applySharedGridWidths() {
    if (typeof tableColGroup === "undefined" || !tableColGroup || typeof currentViewColumns !== "function") return false;

    const table = tableColGroup.closest("table");
    if (!table) return false;

    const columnNames = ["selection", ...currentViewColumns()];
    const percentages = viewPercentages(columnNames);
    const colElements = Array.from(tableColGroup.children);
    if (!percentages || colElements.length !== columnNames.length) return false;

    clearLegacySizing(table);
    table.style.setProperty("table-layout", "fixed", "important");
    table.style.setProperty("width", "100%", "important");

    colElements.forEach((column, index) => {
      const width = `${percentages[index]}%`;
      clearLegacySizing(column);
      column.style.setProperty("width", width, "important");
    });

    Array.from(table.rows).forEach((row) => {
      Array.from(row.cells).forEach((cell, index) => {
        if (index >= percentages.length) return;
        const width = `${percentages[index]}%`;
        clearLegacySizing(cell);
        cell.style.setProperty("box-sizing", "border-box", "important");
        cell.style.setProperty("width", width, "important");
      });
    });

    return true;
  }

  let scheduledFrame = 0;
  function scheduleSharedGridWidths() {
    if (scheduledFrame) cancelAnimationFrame(scheduledFrame);
    scheduledFrame = requestAnimationFrame(() => {
      scheduledFrame = 0;
      applySharedGridWidths();
      requestAnimationFrame(applySharedGridWidths);
    });
  }

  function scheduleInitialWidths() {
    scheduleSharedGridWidths();
    [0, 50, 150, 350, 750].forEach((delay) => setTimeout(scheduleSharedGridWidths, delay));
  }

  function scheduleAfterResult(result) {
    scheduleSharedGridWidths();
    if (result && typeof result.then === "function") {
      result.finally(scheduleInitialWidths);
    } else {
      scheduleInitialWidths();
    }
    return result;
  }

  if (typeof restoreSavedTableState === "function") {
    const originalRestoreSavedTableState = restoreSavedTableState;
    restoreSavedTableState = function restoreSavedTableStateWithSharedGrid() {
      return scheduleAfterResult(originalRestoreSavedTableState.apply(this, arguments));
    };
  }

  if (typeof buildTableColGroup === "function") {
    const originalBuildTableColGroup = buildTableColGroup;
    buildTableColGroup = function buildTableColGroupWithSharedGrid() {
      return scheduleAfterResult(originalBuildTableColGroup.apply(this, arguments));
    };
  }

  if (typeof buildHeader === "function") {
    const originalBuildHeader = buildHeader;
    buildHeader = function buildHeaderWithSharedGrid() {
      return scheduleAfterResult(originalBuildHeader.apply(this, arguments));
    };
  }

  if (typeof renderTable === "function") {
    const originalRenderTable = renderTable;
    renderTable = function renderTableWithSharedGrid() {
      return scheduleAfterResult(originalRenderTable.apply(this, arguments));
    };
  }

  if (typeof setPage === "function") {
    const originalSetPage = setPage;
    setPage = function setPageWithSharedGrid() {
      return scheduleAfterResult(originalSetPage.apply(this, arguments));
    };
  }

  const tableObserver = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.type === "childList" && (mutation.addedNodes.length || mutation.removedNodes.length))) {
      scheduleSharedGridWidths();
    }
  });

  function observeTableRendering() {
    const target = typeof tableColGroup !== "undefined" && tableColGroup
      ? tableColGroup.closest("table")?.parentElement || tableColGroup.closest("table")
      : document.body;
    if (target) tableObserver.observe(target, { childList: true, subtree: true });
  }

  scheduleInitialWidths();
  observeTableRendering();
  document.addEventListener("DOMContentLoaded", () => {
    observeTableRendering();
    scheduleInitialWidths();
  }, { once: true });
  window.addEventListener("load", scheduleInitialWidths, { once: true });
  window.addEventListener("pageshow", scheduleInitialWidths);
})();

/* Consolidated from v14974-agent-views-fix.js */
(() => {
  const removedAgentViews = new Set(["current", "all"]);
  const removedAgentSlugs = new Set(["current-season", "all-time"]);

  function isAgentsPage() {
    if (typeof state === "object" && state?.currentPage === "agents") return true;
    return /^\/agents?(?:\/|$)/i.test(window.location.pathname);
  }

  function normalizedAgentView(viewName) {
    return removedAgentViews.has(String(viewName || "").toLowerCase()) ? "attributes" : viewName;
  }

  function hideRemovedAgentViewButtons() {
    if (!isAgentsPage()) return;

    document.querySelectorAll("button,a,[role='button']").forEach((element) => {
      const view = String(
        element.dataset?.view
        || element.dataset?.tableView
        || element.getAttribute("data-page-view")
        || "",
      ).toLowerCase();
      const text = String(element.textContent || "").trim().toLowerCase();
      const removed = removedAgentViews.has(view)
        || removedAgentSlugs.has(view)
        || text === "current season"
        || text === "all time";

      if (removed) element.remove();
    });
  }

  function replaceRemovedAgentRoute() {
    if (!isAgentsPage()) return;
    const pathname = window.location.pathname;
    const nextPath = pathname.replace(/\/(current-season|all-time)\/?$/i, "/attributes");
    if (nextPath !== pathname) window.history.replaceState(window.history.state, "", `${nextPath}${window.location.search}${window.location.hash}`);
  }

  function enforceAllowedAgentView(render = true) {
    if (!isAgentsPage() || typeof state !== "object" || !state) return false;
    if (!removedAgentViews.has(String(state.view || "").toLowerCase())) {
      hideRemovedAgentViewButtons();
      return false;
    }

    state.view = "attributes";
    state.page = 1;
    replaceRemovedAgentRoute();

    if (render) {
      if (typeof updateViewButtons === "function") updateViewButtons();
      if (typeof buildTableColGroup === "function") buildTableColGroup();
      if (typeof buildHeader === "function") buildHeader();
      if (typeof applyFilters === "function") applyFilters({ save: false });
      else if (typeof renderTable === "function") renderTable();
    }

    hideRemovedAgentViewButtons();
    return true;
  }

  if (typeof normalizeViewForPage === "function") {
    const originalNormalizeViewForPage = normalizeViewForPage;
    normalizeViewForPage = function normalizeViewWithoutRemovedAgentViews(viewName, pageName) {
      const nextView = pageName === "agents" ? normalizedAgentView(viewName) : viewName;
      return originalNormalizeViewForPage.call(this, nextView, pageName);
    };
  }

  if (typeof restoreSavedTableState === "function") {
    const originalRestoreSavedTableState = restoreSavedTableState;
    restoreSavedTableState = function restoreAgentStateWithoutRemovedViews(pageName, options = {}) {
      const nextOptions = pageName === "agents" && removedAgentViews.has(String(options?.view || "").toLowerCase())
        ? { ...options, view: "attributes" }
        : options;
      const result = originalRestoreSavedTableState.call(this, pageName, nextOptions);
      if (pageName === "agents") enforceAllowedAgentView(false);
      return result;
    };
  }

  if (typeof setPage === "function") {
    const originalSetPage = setPage;
    setPage = async function setPageWithoutRemovedAgentViews(pageName, updateHash = true, options = {}) {
      const nextOptions = pageName === "agents" && removedAgentViews.has(String(options?.view || "").toLowerCase())
        ? { ...options, view: "attributes" }
        : options;
      const result = await originalSetPage.call(this, pageName, updateHash, nextOptions);
      if (pageName === "agents") enforceAllowedAgentView(true);
      hideRemovedAgentViewButtons();
      return result;
    };
  }

  if (typeof updateViewButtons === "function") {
    const originalUpdateViewButtons = updateViewButtons;
    updateViewButtons = function updateAgentViewButtonsWithoutRemovedViews() {
      const result = originalUpdateViewButtons.apply(this, arguments);
      hideRemovedAgentViewButtons();
      return result;
    };
  }

  const observer = new MutationObserver(() => {
    if (!isAgentsPage()) return;
    enforceAllowedAgentView(false);
    hideRemovedAgentViewButtons();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  replaceRemovedAgentRoute();
  requestAnimationFrame(() => enforceAllowedAgentView(true));
  document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(() => enforceAllowedAgentView(true)), { once: true });
  window.addEventListener("pageshow", () => requestAnimationFrame(() => enforceAllowedAgentView(true)));
})();


/* Consolidated from v1500-club-pages.js */
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
    "GK", "RB", "CB", "LB", "RWB", "LWB", "CDM", "RM", "CM", "LM", "CAM", "RW", "CF", "LW", "ST",
  ];
  const POSITION_RANK = new Map(POSITION_ORDER.map((position, index) => [position, index]));

  let activeClubId = "";
  let openingClub = false;
  const initialClubRoute = clubRoute();

  function normalizedPath() {
    return window.location.pathname.replace(/\/+$/, "") || "/";
  }

  function clubRoute(pathname = normalizedPath()) {
    const match = pathname.match(/^\/(?:clubs|club)\/([^/]+)(?:\/(contracts|attributes))?$/i);
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
    return `/clubs/${encodeURIComponent(clubId)}/${safeView}`;
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
    return String(getValue(row, "positions") || "").split(",")[0].trim().toUpperCase();
  }

  function compareClubRows(a, b) {
    const aPosition = primaryPosition(a);
    const bPosition = primaryPosition(b);
    const aRank = POSITION_RANK.has(aPosition) ? POSITION_RANK.get(aPosition) : POSITION_ORDER.length;
    const bRank = POSITION_RANK.has(bPosition) ? POSITION_RANK.get(bPosition) : POSITION_ORDER.length;
    if (aRank !== bRank) return aRank - bRank;

    const aOverall = Number(getValue(a, "overall"));
    const bOverall = Number(getValue(b, "overall"));
    if (Number.isFinite(aOverall) && Number.isFinite(bOverall) && aOverall !== bOverall) return bOverall - aOverall;
    return String(getValue(a, "name") || "").localeCompare(String(getValue(b, "name") || ""));
  }

  function setClubSwitching(active) {
    document.body.classList.toggle("clubViewSwitching", active);
  }

  function finishClubSwitch() {
    requestAnimationFrame(() => {
      if (typeof buildTableColGroup === "function") buildTableColGroup();
      requestAnimationFrame(() => window.setTimeout(() => setClubSwitching(false), 80));
    });
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

  function openClubImmediately(clubId, view = "contracts") {
    const route = canonicalClubRoute(clubId, view);
    if (`${window.location.pathname}${window.location.search}` !== route) {
      window.history.pushState({}, "", route);
    }
    void openClubPage(clubId, view, false);
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
        openClubImmediately(clubId, "contracts");
      });
      cell.replaceChildren(link);
    });
  }

  function clubSearchEntries(query) {
    const idColumn = clubIdColumn();
    if (!query || !idColumn || !Array.isArray(state.rows)) return [];
    const normalizedQuery = typeof normalizeSearchText === "function" ? normalizeSearchText(query) : String(query).toLowerCase();
    const clubs = new Map();

    state.rows.forEach((row) => {
      const clubId = String(getValue(row, idColumn) || "").trim();
      const name = String(getValue(row, "active_contract_club_name") || "").trim();
      if (!clubId || !name || clubs.has(clubId)) return;
      const searchable = typeof normalizeSearchText === "function"
        ? normalizeSearchText(`${name} ${clubId}`)
        : `${name} ${clubId}`.toLowerCase();
      if (searchable.includes(normalizedQuery)) clubs.set(clubId, { clubId, name });
    });

    return Array.from(clubs.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 5);
  }

  function addClubSearchResults() {
    if (typeof playerSearchInput === "undefined" || typeof playerSearchResults === "undefined") return;
    const query = String(playerSearchInput.value || "").trim();
    const entries = clubSearchEntries(query);
    if (!entries.length) return;

    const fragment = document.createDocumentFragment();
    entries.forEach(({ clubId, name }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "searchResult clubSearchResult";
      const safeName = typeof escapeHtml === "function" ? escapeHtml(name) : name;
      const safeId = typeof escapeHtml === "function" ? escapeHtml(clubId) : clubId;
      button.innerHTML = `<strong>${safeName}</strong><span>Club &middot; #${safeId}</span>`;
      button.addEventListener("click", () => {
        if (typeof closeSearch === "function") closeSearch();
        openClubImmediately(clubId, "contracts");
      });
      fragment.appendChild(button);
    });
    playerSearchResults.prepend(fragment);
    playerSearchResults.classList.add("filledSearchResults");
  }

  async function openClubPage(clubId, view = "contracts", updateHistory = true) {
    if (!clubId || openingClub) return;
    openingClub = true;
    setClubSwitching(true);
    try {
      activeClubId = String(clubId);
      const nextView = view === "attributes" ? "attributes" : "contracts";
      const route = canonicalClubRoute(activeClubId, nextView);
      if (updateHistory && `${window.location.pathname}${window.location.search}` !== route) {
        window.history.pushState({}, "", route);
      } else if (!updateHistory && normalizedPath() !== route) {
        window.history.replaceState({}, "", route);
      }

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

  if (typeof renderSearchResultsNow === "function") {
    const originalRenderSearchResultsNow = renderSearchResultsNow;
    renderSearchResultsNow = function renderSearchResultsNowWithClubs() {
      const result = originalRenderSearchResultsNow.apply(this, arguments);
      addClubSearchResults();
      return result;
    };
  }

  if (initialClubRoute && typeof showHomeShell === "function") {
    const originalShowHomeShell = showHomeShell;
    let initialClubHandled = false;
    showHomeShell = async function showHomeShellWithInitialClub(pageName, updateHistory, options) {
      if (!initialClubHandled) {
        initialClubHandled = true;
        await originalShowHomeShell.call(this, "database", false, { view: initialClubRoute.view });
        await openClubPage(initialClubRoute.clubId, initialClubRoute.view, false);
        return;
      }
      return originalShowHomeShell.apply(this, arguments);
    };
  }

  document.addEventListener("click", (event) => {
    if (state.currentPage !== CLUB_PAGE) return;
    const viewButton = event.target.closest?.(".viewButton[data-view]");
    if (!viewButton || !CLUB_VIEWS.has(viewButton.dataset.view)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    const nextView = viewButton.dataset.view;
    window.history.replaceState({}, "", canonicalClubRoute(activeClubId, nextView));
    setClubSwitching(true);
    state.view = nextView;
    state.page = 1;
    state.sortKey = "positions";
    state.sortDirection = "asc";
    if (typeof updateViewButtons === "function") updateViewButtons();
    if (typeof buildHeader === "function") buildHeader();
    if (typeof applyFilters === "function") applyFilters({ save: false });
    finishClubSwitch();
  }, true);

  window.addEventListener("popstate", () => {
    const route = clubRoute();
    if (route) void openClubPage(route.clubId, route.view, false);
  });

  function bootClubRoute() {
    const path = normalizedPath();
    if (/^\/(?:clubs|club)$/i.test(path)) {
      window.location.replace("/");
      return;
    }
    const route = clubRoute(path);
    if (!route || initialClubRoute) return;
    const canonicalRoute = canonicalClubRoute(route.clubId, route.view);
    if (path !== canonicalRoute) window.history.replaceState({}, "", canonicalRoute);
    void openClubPage(route.clubId, route.view, false);
  }

  const style = document.createElement("style");
  style.textContent = `
    .clubPageLink { color: var(--text, #fff) !important; text-decoration: none; transition: color 120ms ease; }
    .clubPageLink:hover, .clubPageLink:focus-visible { color: #78c7ff !important; }
    body.clubViewSwitching #progressionPage .tableScroller { visibility: hidden !important; }
  `;
  document.head.appendChild(style);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootClubRoute, { once: true });
  } else {
    bootClubRoute();
  }
})();

/* Consolidated from v1500-club-polish.js */
(() => {
  const VERSION = "1.150.0";
  const MAX_SEARCH_RESULTS = 5;
  const RECENT_CLUBS_STORAGE_KEY = "mfl-recent-search-clubs";
  const CLUB_ID_COLUMNS = ["active_contract_club_id", "club_id", "current_club_id", "active_club_id"];
  let clubWidthUnlockTimer = null;
  let clubWidthObserver = null;
  let clubWidthLockStartedAt = 0;

  function clubIdColumn() {
    if (!Array.isArray(state?.columns)) return "";
    return CLUB_ID_COLUMNS.find((column) => state.columns.includes(column)) || "";
  }

  function clubRowById(clubId) {
    const idColumn = clubIdColumn();
    if (!idColumn || !Array.isArray(state?.rows)) return null;
    return state.rows.find((row) => String(getValue(row, idColumn) || "").trim() === String(clubId).trim()) || null;
  }

  function clubIdFromResult(button) {
    if (button.dataset.clubId) return button.dataset.clubId;
    const info = String(button.querySelector(":scope > span")?.textContent || "");
    const match = info.match(/#([^\s·]+)/);
    const clubId = match ? match[1].trim() : "";
    if (clubId) button.dataset.clubId = clubId;
    return clubId;
  }

  function normalizedClubSearchData(clubId) {
    const row = clubRowById(clubId);
    if (!row) return null;
    const name = String(getValue(row, "active_contract_club_name") || "").trim();
    const division = typeof contractDivisionInfo === "function"
      ? contractDivisionInfo(getValue(row, "active_contract_club_division"))
      : null;
    return name ? { clubId: String(clubId), name, division } : null;
  }

  function normalizeClubResult(button) {
    const clubId = clubIdFromResult(button);
    const data = normalizedClubSearchData(clubId);
    const title = button.querySelector(":scope > strong");
    const info = button.querySelector(":scope > span");
    if (!data || !title || !info) {
      button.remove();
      return;
    }

    button.dataset.clubId = data.clubId;
    title.textContent = data.name;
    info.replaceChildren(document.createTextNode(`Club · #${data.clubId}`));
    if (data.division) {
      info.append(document.createTextNode(" · "));
      const label = document.createElement("span");
      label.className = "clubSearchDivision";
      label.textContent = data.division.name;
      label.style.color = data.division.color;
      info.appendChild(label);
    }
  }

  function readRecentClubs() {
    try {
      const value = JSON.parse(localStorage.getItem(RECENT_CLUBS_STORAGE_KEY) || "[]");
      return Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, MAX_SEARCH_RESULTS) : [];
    } catch {
      return [];
    }
  }

  function rememberClub(clubId) {
    const key = String(clubId || "").trim();
    if (!key) return;
    const recent = [key, ...readRecentClubs().filter((id) => id !== key)].slice(0, MAX_SEARCH_RESULTS);
    try {
      localStorage.setItem(RECENT_CLUBS_STORAGE_KEY, JSON.stringify(recent));
    } catch {
      // Recent clubs still work for this session when storage is unavailable.
    }
  }

  function createRecentClubResult(clubId) {
    const data = normalizedClubSearchData(clubId);
    if (!data) return null;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "searchResult clubSearchResult recentClubSearchResult";
    button.dataset.clubId = data.clubId;
    const title = document.createElement("strong");
    title.textContent = data.name;
    const info = document.createElement("span");
    button.append(title, info);
    normalizeClubResult(button);
    button.addEventListener("click", () => {
      rememberClub(data.clubId);
      if (typeof closeSearch === "function") closeSearch();
      window.location.assign(`/clubs/${encodeURIComponent(data.clubId)}/contracts`);
    });
    return button;
  }

  function prependRecentClubs() {
    if (typeof playerSearchInput === "undefined" || typeof playerSearchResults === "undefined") return;
    if (String(playerSearchInput.value || "").trim()) return;
    const fragment = document.createDocumentFragment();
    readRecentClubs().forEach((clubId) => {
      const result = createRecentClubResult(clubId);
      if (result) fragment.appendChild(result);
    });
    if (fragment.childElementCount) playerSearchResults.prepend(fragment);
  }

  function finalizeSearchResults() {
    if (typeof playerSearchResults === "undefined" || !playerSearchResults) return;
    prependRecentClubs();
    playerSearchResults.querySelectorAll(".clubSearchResult").forEach(normalizeClubResult);

    const seen = new Set();
    Array.from(playerSearchResults.querySelectorAll(":scope > .searchResult")).forEach((result) => {
      const clubId = result.classList.contains("clubSearchResult") ? clubIdFromResult(result) : "";
      const key = clubId ? `club:${clubId}` : "";
      if (key && seen.has(key)) result.remove();
      else if (key) seen.add(key);
    });

    const results = Array.from(playerSearchResults.querySelectorAll(":scope > .searchResult"));
    results.slice(MAX_SEARCH_RESULTS).forEach((result) => result.remove());
    const visibleResults = playerSearchResults.querySelectorAll(":scope > .searchResult");
    playerSearchResults.querySelectorAll(":scope > .searchHint").forEach((hint) => {
      if (visibleResults.length) hint.remove();
    });
    playerSearchResults.classList.toggle("filledSearchResults", visibleResults.length > 0);
  }

  if (typeof renderSearchResultsNow === "function") {
    const originalRenderSearchResultsNow = renderSearchResultsNow;
    renderSearchResultsNow = function renderSearchResultsNowV1500() {
      const result = originalRenderSearchResultsNow.apply(this, arguments);
      finalizeSearchResults();
      return result;
    };
  }

  document.addEventListener("click", (event) => {
    const result = event.target.closest?.(".clubSearchResult");
    if (result) rememberClub(clubIdFromResult(result));
  }, true);

  function setFooterVersion() {
    const footerLink = document.querySelector(".siteFooter a[data-page='changelog']");
    if (footerLink) footerLink.textContent = `MFL Front Office v${VERSION}`;
    document.querySelectorAll("[data-app-version]").forEach((element) => {
      element.textContent = `v${VERSION}`;
    });
  }

  function createChangelogItem() {
    const item = document.createElement("li");
    item.dataset.version = VERSION;
    const version = document.createElement("span");
    version.textContent = `v${VERSION}`;
    const description = document.createElement("p");
    description.textContent = "Add club pages, searchable club routes, division details, and position-sorted club squads";
    item.append(version, description);
    return item;
  }

  function collapseOlderChangelogSections(list) {
    Array.from(list.querySelectorAll(":scope > .changelogMinorSection")).forEach((section, index) => {
      const expanded = index === 0;
      section.classList.toggle("is-expanded", expanded);
      section.querySelector(":scope > .changelogMinorToggle")?.setAttribute("aria-expanded", expanded ? "true" : "false");
    });
  }

  function addChangelogSection() {
    const list = document.querySelector(".changelogList");
    if (!list) return;
    Array.from(list.children).forEach((child) => {
      if (!child.classList.contains("changelogMinorSection") && /^v1\.150\.0$/i.test(child.querySelector(":scope > span")?.textContent || "")) child.remove();
    });
    let section = Array.from(list.querySelectorAll(":scope > .changelogMinorSection")).find((candidate) =>
      /^v1\.150$/i.test(candidate.querySelector(".changelogMinorVersion")?.textContent || ""),
    );
    if (!section) {
      section = document.createElement("li");
      section.className = "changelogMinorSection";
      const toggle = document.createElement("button");
      toggle.className = "changelogMinorToggle";
      toggle.type = "button";
      const title = document.createElement("span");
      title.className = "changelogMinorVersion";
      title.textContent = "v1.150";
      const meta = document.createElement("span");
      meta.className = "changelogMinorMeta";
      meta.textContent = "1 patch";
      const chevron = document.createElement("span");
      chevron.className = "changelogMinorChevron";
      chevron.setAttribute("aria-hidden", "true");
      chevron.textContent = ">";
      toggle.append(title, meta, chevron);
      const panel = document.createElement("div");
      panel.className = "changelogMinorPanel";
      const inner = document.createElement("div");
      inner.className = "changelogMinorPanelInner";
      const patchList = document.createElement("ol");
      patchList.className = "changelogPatchList";
      patchList.appendChild(createChangelogItem());
      inner.appendChild(patchList);
      panel.appendChild(inner);
      section.append(toggle, panel);
      toggle.addEventListener("click", () => {
        const expanded = section.classList.toggle("is-expanded");
        toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
      });
      list.prepend(section);
    } else if (!section.querySelector(`[data-version='${VERSION}']`)) {
      section.querySelector(".changelogPatchList")?.prepend(createChangelogItem());
    }
    collapseOlderChangelogSections(list);
  }

  function rebuildClubColumns() {
    if (typeof buildTableColGroup === "function") buildTableColGroup();
  }

  function scheduleClubWidthUnlock() {
    window.clearTimeout(clubWidthUnlockTimer);
    const elapsed = Date.now() - clubWidthLockStartedAt;
    const wait = Math.max(180, 650 - elapsed);
    clubWidthUnlockTimer = window.setTimeout(() => {
      rebuildClubColumns();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        document.body.classList.remove("clubWidthHardLock");
        clubWidthObserver?.disconnect();
        clubWidthObserver = null;
      }));
    }, wait);
  }

  function lockClubWidths() {
    window.clearTimeout(clubWidthUnlockTimer);
    clubWidthLockStartedAt = Date.now();
    document.body.classList.add("clubWidthHardLock");
    rebuildClubColumns();
    clubWidthObserver?.disconnect();
    const colGroup = document.querySelector("#tableColGroup");
    if (colGroup) {
      clubWidthObserver = new MutationObserver(() => {
        rebuildClubColumns();
        scheduleClubWidthUnlock();
      });
      clubWidthObserver.observe(colGroup, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });
    }
    scheduleClubWidthUnlock();
  }

  document.addEventListener("pointerdown", (event) => {
    if (state?.currentPage !== "club") return;
    const button = event.target.closest?.(".viewButton[data-view='contracts'], .viewButton[data-view='attributes']");
    if (button) lockClubWidths();
  }, true);

  const style = document.createElement("style");
  style.textContent = `
    .clubSearchResult > span { display: block !important; }
    .clubSearchDivision { display: inline !important; font-weight: 400 !important; }
    .clubPageLink, .contractDivisionLabel { font-weight: 400 !important; }
    .appShell:not(.menuClosed) .tableScroller .col-age { width: 2.5% !important; }
    .appShell:not(.menuClosed) .tableScroller .col-positions { width: 10% !important; }
    .appShell.menuClosed .tableScroller .col-age { width: 36.9px !important; }
    .appShell.menuClosed .tableScroller .col-positions { width: 147.6px !important; }
    body.clubWidthHardLock #progressionPage .tableShell,
    body.clubWidthHardLock #progressionPage .pager { visibility: hidden !important; opacity: 0 !important; }
    body.clubWidthHardLock #progressionPage .tableScroller table,
    body.clubWidthHardLock #progressionPage .tableScroller col { transition: none !important; }
  `;
  document.head.appendChild(style);

  function initialize() {
    setFooterVersion();
    addChangelogSection();
    finalizeSearchResults();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();

/* Consolidated from v1500-exact-column-widths.js */
(() => {
  const WIDTHS = {
    "col-select": 3,
    "col-id": 3,
    "col-flag": 3,
    "col-name": 13,
    "col-nationality": 7,
    "col-age": 4,
    "col-positions": 8,
    "col-seasons": 5,
    "col-stat": 6,
    "col-contract-revenue": 8,
    "col-contract-club": 19,
    "col-contract-division": 9,
    "col-agent": 9,
    "col-joined-agency": 9,
    "col-owned-since": 9,
    "col-link": 3,
  };

  const isClubRoute = () => /^\/clubs\/[^/]+(?:\/(?:attributes|contracts))?\/?$/i.test(window.location.pathname);
  let clubRevealTimer = 0;

  if (isClubRoute()) {
    document.body.classList.add("clubAtomicInitial");
  }

  function applyExactColumnWidths() {
    const colGroup = document.querySelector("#tableColGroup");
    if (!colGroup) return false;

    let matched = 0;
    Array.from(colGroup.children).forEach((col) => {
      const matchedClass = Object.keys(WIDTHS).find((className) => col.classList.contains(className));
      if (!matchedClass) return;
      matched += 1;
      const width = `${WIDTHS[matchedClass]}%`;
      col.style.setProperty("width", width, "important");
      col.style.setProperty("min-width", width, "important");
      col.style.setProperty("max-width", width, "important");
      col.style.setProperty("transition", "none", "important");
    });

    return matched > 0;
  }

  function removeClubPager() {
    if (state?.currentPage !== "club" && !isClubRoute()) return;
    document.querySelectorAll("#progressionPage nav.pager, #progressionPage .pager").forEach((pager) => pager.remove());
  }

  function clubContentReady() {
    return Boolean(
      document.querySelector("#progressionPage") &&
      document.querySelector("#tableColGroup") &&
      document.querySelector("#tableBody") &&
      applyExactColumnWidths()
    );
  }

  function revealClubPage(className) {
    window.clearTimeout(clubRevealTimer);
    let attempts = 0;
    let stableFrames = 0;
    let previousSignature = "";

    const check = () => {
      attempts += 1;
      removeClubPager();
      applyExactColumnWidths();
      const signature = Array.from(document.querySelectorAll("#tableColGroup > col"))
        .map((col) => col.style.width)
        .join("|");

      if (clubContentReady() && signature && signature === previousSignature) stableFrames += 1;
      else stableFrames = 0;
      previousSignature = signature;

      if (stableFrames >= 2 || attempts >= 120) {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          document.body.classList.remove(className);
        }));
        return;
      }

      clubRevealTimer = window.setTimeout(check, 16);
    };

    check();
  }

  if (typeof buildTableColGroup === "function") {
    const originalBuildTableColGroup = buildTableColGroup;
    buildTableColGroup = function buildTableColGroupWithExactPercentages() {
      const result = originalBuildTableColGroup.apply(this, arguments);
      applyExactColumnWidths();
      removeClubPager();
      return result;
    };
  }

  if (typeof buildHeader === "function") {
    const originalBuildHeader = buildHeader;
    buildHeader = function buildHeaderWithExactPercentages() {
      const result = originalBuildHeader.apply(this, arguments);
      applyExactColumnWidths();
      removeClubPager();
      return result;
    };
  }

  if (typeof renderTable === "function") {
    const originalRenderTable = renderTable;
    renderTable = function renderTableWithExactPercentages() {
      const result = originalRenderTable.apply(this, arguments);
      applyExactColumnWidths();
      removeClubPager();
      return result;
    };
  }

  document.addEventListener("pointerdown", (event) => {
    if (state?.currentPage !== "club") return;
    const button = event.target.closest?.(".viewButton[data-view='attributes'], .viewButton[data-view='contracts']");
    if (!button) return;
    document.body.classList.add("clubAtomicSwitch");
  }, true);

  document.addEventListener("click", (event) => {
    if (state?.currentPage !== "club") return;
    const button = event.target.closest?.(".viewButton[data-view='attributes'], .viewButton[data-view='contracts']");
    if (!button) return;
    window.setTimeout(() => revealClubPage("clubAtomicSwitch"), 0);
  }, true);

  const observer = new MutationObserver(() => {
    applyExactColumnWidths();
    removeClubPager();

    if (document.body.classList.contains("clubAtomicInitial") && !document.body.classList.contains("loading")) {
      revealClubPage("clubAtomicInitial");
    }
  });

  function initialize() {
    applyExactColumnWidths();
    removeClubPager();
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

    if (document.body.classList.contains("clubAtomicInitial") && !document.body.classList.contains("loading")) {
      revealClubPage("clubAtomicInitial");
    }
  }

  const style = document.createElement("style");
  style.textContent = `
    .appShell .tableScroller table {
      width: 100% !important;
      table-layout: fixed !important;
    }
    .appShell .tableScroller col.col-select { width: 3% !important; min-width: 3% !important; max-width: 3% !important; }
    .appShell .tableScroller col.col-id { width: 3% !important; min-width: 3% !important; max-width: 3% !important; }
    .appShell .tableScroller col.col-flag { width: 3% !important; min-width: 3% !important; max-width: 3% !important; }
    .appShell .tableScroller col.col-name { width: 13% !important; min-width: 13% !important; max-width: 13% !important; }
    .appShell .tableScroller col.col-nationality { width: 7% !important; min-width: 7% !important; max-width: 7% !important; }
    .appShell .tableScroller col.col-age { width: 4% !important; min-width: 4% !important; max-width: 4% !important; }
    .appShell .tableScroller col.col-positions { width: 8% !important; min-width: 8% !important; max-width: 8% !important; }
    .appShell .tableScroller col.col-seasons { width: 5% !important; min-width: 5% !important; max-width: 5% !important; }
    .appShell .tableScroller col.col-stat { width: 6% !important; min-width: 6% !important; max-width: 6% !important; }
    .appShell .tableScroller col.col-contract-revenue { width: 8% !important; min-width: 8% !important; max-width: 8% !important; }
    .appShell .tableScroller col.col-contract-club { width: 19% !important; min-width: 19% !important; max-width: 19% !important; }
    .appShell .tableScroller col.col-contract-division { width: 9% !important; min-width: 9% !important; max-width: 9% !important; }
    .appShell .tableScroller col.col-agent,
    .appShell .tableScroller col.col-joined-agency,
    .appShell .tableScroller col.col-owned-since { width: 9% !important; min-width: 9% !important; max-width: 9% !important; }
    .appShell .tableScroller col.col-link { width: 3% !important; min-width: 3% !important; max-width: 3% !important; }
    .appShell .tableScroller .selectionCell { width: auto !important; min-width: 0 !important; }
    body[data-page="club"] #progressionPage nav.pager,
    body[data-page="club"] #progressionPage .pager { display: none !important; }
    body.clubAtomicInitial #loadingScreen { display: flex !important; visibility: visible !important; opacity: 1 !important; }
    body.clubAtomicInitial #progressionPage,
    body.clubAtomicSwitch #progressionPage .tableShell { visibility: hidden !important; opacity: 0 !important; }
    body.clubAtomicInitial #progressionPage *,
    body.clubAtomicSwitch #progressionPage .tableShell * { transition: none !important; }
  `;
  document.head.appendChild(style);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();