const fs = require("node:fs");
const path = require("node:path");

function runtimeFix() {
  const currentVersion = "1.149.71";
  const maxNoteLength = 100;
  const watchlistViewsKey = "watchlistViews";

  function syncVisibleVersion() {
    document.querySelectorAll("[data-app-version], .footerVersion, #footerVersion").forEach((element) => {
      element.textContent = `v${currentVersion}`;
    });

    let footer = document.querySelector(".siteFooter, body > footer");
    if (!footer) {
      footer = document.createElement("footer");
      footer.className = "siteFooter runtimeVersionFooter";
      document.body.appendChild(footer);
    }

    let version = footer.querySelector("[data-app-version]");
    if (!version) {
      version = document.createElement("span");
      version.dataset.appVersion = "";
      footer.appendChild(version);
    }
    version.textContent = `v${currentVersion}`;

    const changelog = document.querySelector(".changelogList");
    const exists = changelog && Array.from(changelog.querySelectorAll("li span"))
      .some((item) => item.textContent === `v${currentVersion}`);
    if (changelog && !exists) {
      const entry = document.createElement("li");
      entry.innerHTML = `<span>v${currentVersion}</span><p>Limit notes to 100 characters, sync each watchlist view, stabilize sidebar transitions, and fix player page data access</p>`;
      changelog.prepend(entry);
    }
  }

  const style = document.createElement("style");
  style.textContent = [
    ".runtimeVersionFooter{display:flex;justify-content:center;padding:10px 16px 18px;color:var(--muted,#8f98aa);font-size:13px}",
    ".appShell.runtimeSidebarTransition .tableScroller{overflow-x:hidden!important}",
    ".appShell.runtimeSidebarTransition .tableScroller table,.appShell.runtimeSidebarTransition .tableScroller col,.appShell.runtimeSidebarTransition .tableScroller th,.appShell.runtimeSidebarTransition .tableScroller td{visibility:visible!important;opacity:1!important}",
    ".appShell.runtimeSidebarTransition .tableScroller th,.appShell.runtimeSidebarTransition .tableScroller td,.appShell.runtimeSidebarTransition .tableScroller a,.appShell.runtimeSidebarTransition .tableScroller button{transition:none!important}"
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
      if (input && input.value.length > maxNoteLength) {
        input.value = input.value.slice(0, maxNoteLength);
      }
      const counter = playerDetail?.querySelector("#playerNotesCount");
      if (counter) {
        counter.textContent = `${input?.value?.length || 0}/${maxNoteLength}`;
      }
    };
  }

  if (typeof renderPlayerPage === "function") {
    const originalRenderPlayerPage = renderPlayerPage;
    renderPlayerPage = function fixedRenderPlayerPage(playerId) {
      const id = String(playerId || "");
      const row = typeof rowByPlayerId === "function" ? rowByPlayerId(id) : null;
      const dataIsChanging = Boolean(state.dataLoadPromise) || !state.dataLoaded || !state.rows.length;

      if (!row && dataIsChanging) {
        if (playerDetail) {
          playerDetail.innerHTML = '<div class="emptyState">Loading player...</div>';
        }
        Promise.resolve(state.dataLoadPromise).finally(() => {
          if (state.currentPage === "player") {
            originalRenderPlayerPage(id);
            const input = playerDetail?.querySelector("#playerNotesInput");
            if (input) {
              input.maxLength = maxNoteLength;
              input.value = input.value.slice(0, maxNoteLength);
              updatePlayerNoteCount(input);
            }
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
        if (typeof captureCurrentDataSnapshot === "function") {
          captureCurrentDataSnapshot();
        }
        state.dataLoaded = false;
        state.dataLoadPromise = null;
      }
      return originalSetPage.call(this, pageName, updateHash, options);
    };
  }

  const watchlistViews = {};

  function rememberCurrentWatchlistView() {
    if (state.currentPage === "watchlist" && state.currentWatchlistId && state.view) {
      watchlistViews[state.currentWatchlistId] = state.view;
    }
  }

  if (typeof currentTableState === "function") {
    const originalCurrentTableState = currentTableState;
    currentTableState = function currentTableStateWithWatchlistViews(...args) {
      rememberCurrentWatchlistView();
      return {
        ...originalCurrentTableState.apply(this, args),
        [watchlistViewsKey]: { ...watchlistViews },
      };
    };
  }

  if (typeof stripPersistentSortState === "function") {
    const originalStripPersistentSortState = stripPersistentSortState;
    stripPersistentSortState = function stripPersistentSortStateWithWatchlistViews(tableState) {
      const stripped = originalStripPersistentSortState.call(this, tableState);
      return {
        ...stripped,
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
          if (watchlistId && typeof view === "string") {
            watchlistViews[watchlistId] = view;
          }
        });
      }
      return originalApplyWalletTableState.call(this, tableState);
    };
  }

  if (typeof setView === "function") {
    const originalSetView = setView;
    setView = async function setViewWithWatchlistSync(viewName) {
      const result = await originalSetView.apply(this, arguments);
      rememberCurrentWatchlistView();
      if (state.currentPage === "watchlist" && typeof saveTableState === "function") {
        saveTableState();
      }
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
  let frozenTableWidth = "";
  let animationTimer = 0;
  const table = document.querySelector(".tableScroller table");

  if (typeof currentViewColumns === "function") {
    const originalCurrentViewColumns = currentViewColumns;
    currentViewColumns = function stableCurrentViewColumns(...args) {
      return frozenColumns ? [...frozenColumns] : originalCurrentViewColumns.apply(this, args);
    };
  }

  const originalBuildTableColGroup = typeof buildTableColGroup === "function" ? buildTableColGroup : null;
  const originalBuildHeader = typeof buildHeader === "function" ? buildHeader : null;
  const originalRenderTable = typeof renderTable === "function" ? renderTable : null;

  if (originalBuildTableColGroup) {
    buildTableColGroup = function stableBuildTableColGroup(...args) {
      if (frozenColumns && tableColGroup?.children.length) {
        return tableColGroup;
      }
      return originalBuildTableColGroup.apply(this, args);
    };
  }

  if (originalBuildHeader) {
    buildHeader = function stableBuildHeader(...args) {
      if (frozenColumns) {
        return tableHead;
      }
      return originalBuildHeader.apply(this, args);
    };
  }

  if (originalRenderTable) {
    renderTable = function stableRenderTable(...args) {
      if (frozenColumns) {
        return tableBody;
      }
      return originalRenderTable.apply(this, args);
    };
  }

  if (typeof toggleMenu === "function") {
    const originalToggleMenu = toggleMenu;
    toggleMenu = function smoothToggleMenu(...args) {
      frozenColumns = typeof currentViewColumns === "function" ? [...currentViewColumns()] : [];
      window.clearTimeout(animationTimer);

      if (table) {
        frozenTableWidth = `${table.getBoundingClientRect().width}px`;
        table.style.width = frozenTableWidth;
        table.style.minWidth = frozenTableWidth;
      }

      appShell?.classList.add("runtimeSidebarTransition");
      const result = originalToggleMenu.apply(this, args);

      animationTimer = window.setTimeout(() => {
        frozenColumns = null;
        appShell?.classList.remove("runtimeSidebarTransition");
        if (table) {
          table.style.removeProperty("width");
          table.style.removeProperty("min-width");
        }
        if (originalBuildHeader) originalBuildHeader();
        if (typeof applyFilters === "function" && typeof tablePageKey === "function" && tablePageKey()) {
          applyFilters();
        }
      }, 230);

      return result;
    };
  }
}

const PATCH = `\n;(${runtimeFix.toString()})();\n`;

module.exports = (request, response) => {
  try {
    const source = fs.readFileSync(path.join(process.cwd(), "app.js"), "utf8");
    response.setHeader("Content-Type", "application/javascript; charset=utf-8");
    response.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    response.status(200).send(source + PATCH);
  } catch (error) {
    response.status(500).send(`console.error(${JSON.stringify("Could not load application bundle.")});`);
  }
};