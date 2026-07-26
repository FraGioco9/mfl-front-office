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