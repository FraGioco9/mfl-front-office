(() => {
  const currentVersion = "1.149.73";
  const maxNoteLength = 100;
  const watchlistViewsKey = "watchlistViews";
  const watchlistViews = {};

  const recoveredChangelog = [
    ["1.149.73", "Keep every table column visible during sidebar transitions and normalize the changelog"],
    ["1.149.72", "Restore static source loading and remove the Vercel app bundle wrapper"],
    ["1.149.71", "Limit notes to 100 characters, remember watchlist views, smooth sidebar transitions, and fix player pages"],
    ["1.149.70", "Keep the current version visible in the footer"],
    ["1.149.69", "Persist the last selected view for each watchlist"],
    ["1.149.68", "Improve sidebar transitions and player page data loading"],
    ["1.149.67", "Stabilize the deployed site source and database update flow"],
  ];

  function syncChangelog() {
    const changelog = document.querySelector(".changelogList");
    if (!changelog) return;

    const existing = new Map(
      Array.from(changelog.querySelectorAll("li")).map((item) => [
        item.querySelector("span")?.textContent?.trim(),
        item,
      ])
    );

    recoveredChangelog.slice().reverse().forEach(([version, description]) => {
      const label = `v${version}`;
      let entry = existing.get(label);
      if (!entry) {
        entry = document.createElement("li");
        changelog.prepend(entry);
      }
      entry.innerHTML = `<span>${label}</span><p>${description}</p>`;
    });

    changelog.querySelectorAll("li").forEach((entry) => {
      const version = entry.querySelector("span");
      const description = entry.querySelector("p");
      if (!version || !description) return;
      version.textContent = version.textContent.trim();
      description.textContent = description.textContent.trim().replace(/\s+/g, " ");
    });
  }

  function syncVisibleVersion() {
    const footerLink = document.querySelector('.siteFooter a[href="/changelog"]');
    if (footerLink) footerLink.textContent = `MFL Front Office v${currentVersion}`;
    document.querySelectorAll("[data-app-version], .footerVersion, #footerVersion").forEach((element) => {
      element.textContent = `v${currentVersion}`;
    });
    syncChangelog();
  }

  const style = document.createElement("style");
  style.textContent = [
    ".appShell,.appShell main,.tableScroller,.tableScroller table{will-change:width}",
    ".appShell.sourceSidebarTransition .tableScroller table,.appShell.sourceSidebarTransition .tableScroller col,.appShell.sourceSidebarTransition .tableScroller th,.appShell.sourceSidebarTransition .tableScroller td{visibility:visible!important;opacity:1!important}",
    ".appShell.sourceSidebarTransition .tableScroller th,.appShell.sourceSidebarTransition .tableScroller td,.appShell.sourceSidebarTransition .tableScroller a,.appShell.sourceSidebarTransition .tableScroller button{transition:none!important}",
    ".appShell.sourceSidebarTransition .tableScroller{overflow-x:auto!important}",
    ".appShell.sourceSidebarTransition .tableScroller table{width:100%!important;min-width:100%!important;table-layout:fixed!important}"
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

  let frozenColumns = null;
  let transitionTimer = 0;
  const originalBuildTableColGroup = typeof buildTableColGroup === "function" ? buildTableColGroup : null;
  const originalBuildHeader = typeof buildHeader === "function" ? buildHeader : null;
  const originalRenderTable = typeof renderTable === "function" ? renderTable : null;

  if (typeof currentViewColumns === "function") {
    const originalCurrentViewColumns = currentViewColumns;
    currentViewColumns = function stableCurrentViewColumns(...args) {
      return frozenColumns ? [...frozenColumns] : originalCurrentViewColumns.apply(this, args);
    };
  }

  if (originalBuildTableColGroup) {
    buildTableColGroup = function stableBuildTableColGroup(...args) {
      if (frozenColumns && tableColGroup?.children.length) return tableColGroup;
      return originalBuildTableColGroup.apply(this, args);
    };
  }

  if (originalBuildHeader) {
    buildHeader = function stableBuildHeader(...args) {
      if (frozenColumns) return tableHead;
      return originalBuildHeader.apply(this, args);
    };
  }

  if (originalRenderTable) {
    renderTable = function stableRenderTable(...args) {
      if (frozenColumns) return tableBody;
      return originalRenderTable.apply(this, args);
    };
  }

  function finishSidebarTransition() {
    if (!frozenColumns) return;
    frozenColumns = null;
    appShell?.classList.remove("sourceSidebarTransition");
    if (originalBuildTableColGroup) originalBuildTableColGroup();
    if (originalBuildHeader) originalBuildHeader();
    if (typeof applyFilters === "function" && typeof tablePageKey === "function" && tablePageKey()) applyFilters();
  }

  if (typeof toggleMenu === "function") {
    const originalToggleMenu = toggleMenu;
    toggleMenu = function smoothToggleMenu(...args) {
      frozenColumns = typeof currentViewColumns === "function" ? [...currentViewColumns()] : [];
      window.clearTimeout(transitionTimer);
      appShell?.classList.add("sourceSidebarTransition");

      const result = originalToggleMenu.apply(this, args);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        transitionTimer = window.setTimeout(finishSidebarTransition, 320);
      }));
      return result;
    };

    appShell?.addEventListener("transitionend", (event) => {
      if (event.target === appShell || event.target === sidebar || event.target === menuRail) {
        window.clearTimeout(transitionTimer);
        finishSidebarTransition();
      }
    });
  }
})();