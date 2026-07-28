from pathlib import Path
import re

APP_PATH = Path("site/app.js")
STYLE_PATH = Path("site/styles.css")
INDEX_PATH = Path("site/index.html")

app = APP_PATH.read_text(encoding="utf-8")
styles = STYLE_PATH.read_text(encoding="utf-8")
index = INDEX_PATH.read_text(encoding="utf-8")

old_version = 'const VERSION = "1.150.3";'
if old_version not in app:
    raise SystemExit("Expected v1.150.3 version marker was not found in site/app.js")
app = app.replace(old_version, 'const VERSION = "1.150.4";', 1)

old_description = "Reveal club pages atomically, stabilize table columns, fix Watchlist view switching, prioritize search results, and center pinned-sidebar layouts"
new_description = "Fix club-page loading, center opted-out layouts and footer outside the pinned sidebar, and keep shared columns exactly the same width across views"
if old_description not in app:
    raise SystemExit("Expected v1.150.3 changelog description was not found")
app = app.replace(old_description, new_description, 1)

old_switch = '''  function setClubSwitching(active) {
    document.body.classList.toggle("clubViewSwitching", active);
    if (active) {
      document.querySelectorAll(".navButton.active").forEach((link) => link.classList.remove("active"));
    }
  }
'''
new_switch = '''  function setClubSwitching(active) {
    document.body.classList.toggle("clubViewSwitching", active);
    if (active) {
      if (typeof loadingScreen !== "undefined" && loadingScreen) {
        loadingScreen.hidden = false;
        loadingScreen.classList.remove("leaving");
      }
      document.querySelectorAll(".navButton.active").forEach((link) => link.classList.remove("active"));
    }
  }
'''
if old_switch not in app:
    raise SystemExit("Expected setClubSwitching implementation was not found")
app = app.replace(old_switch, new_switch, 1)

finish_pattern = re.compile(
    r'  function finishClubSwitch\(\) \{.*?\n  \}\n\n\n  function hideClubPageControls',
    re.S,
)
new_finish = '''  function finishClubSwitch() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        if (typeof buildTableColGroup === "function") buildTableColGroup();
        if (typeof window.applyExactPlayerTableWidths === "function") window.applyExactPlayerTableWidths();
        applyClubPresentation();

        requestAnimationFrame(() => {
          if (typeof window.applyExactPlayerTableWidths === "function") window.applyExactPlayerTableWidths();
          applyClubPresentation();
          setClubSwitching(false);

          if (
            typeof loadingScreen !== "undefined"
            && loadingScreen
            && !document.body.classList.contains("loading")
            && !document.body.classList.contains("booting")
          ) {
            loadingScreen.hidden = false;
            loadingScreen.classList.add("leaving");
            window.setTimeout(() => {
              if (!document.body.classList.contains("clubViewSwitching")) {
                loadingScreen.hidden = true;
                loadingScreen.classList.remove("leaving");
              }
            }, 230);
          }

          resolve();
        });
      });
    });
  }


  function hideClubPageControls'''
app, replaced = finish_pattern.subn(new_finish, app, count=1)
if replaced != 1:
    raise SystemExit("Expected finishClubSwitch implementation was not replaced")

old_app_marker = "/* v1.150.3 stable pinned layout and atomic club loading */"
if old_app_marker not in app:
    raise SystemExit("Expected v1.150.3 appended app patch was not found")
app = app.split(old_app_marker, 1)[0].rstrip()

app += r'''

/* v1.150.4 pinned content grid and shared table widths */
(() => {
  const TABLE_ROUTE = /^\/(?:database(?:\/|$)|mfl(?:\/attributes)?\/?$|agents?(?:\/|$)|progression(?:\/|$)|watchlist(?:\/|$)|my-players(?:\/|$)|clubs?\/[^/]+(?:\/|$)|club\/[^/]+(?:\/|$))/i;
  const CLUB_ROUTE = /^\/(?:clubs?|club)\/[^/]+(?:\/|$)/i;
  const TABLE_PAGES = new Set(["database", "mfl", "agents", "progression", "watchlist", "myplayers", "club"]);
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
  const FILLER_CLASS = "col-shared-width-filler";
  const initialTableRoute = TABLE_ROUTE.test(window.location.pathname)
    && !/^\/mfl\/stats\/?$/i.test(window.location.pathname)
    && !CLUB_ROUTE.test(window.location.pathname);
  let cachedLayoutKey = "";
  let cachedContentWidth = 0;
  let revealFrame = 0;
  let revealAttempts = 0;

  if (initialTableRoute) document.body.classList.add("tableLayoutPending");

  function playerTablePageActive() {
    return TABLE_PAGES.has(String(state?.currentPage || "")) || TABLE_ROUTE.test(window.location.pathname);
  }

  function pinnedSidebarWidth() {
    const rail = document.querySelector("#menuRail");
    if (!rail || rail.hidden) return 0;
    return 190;
  }

  function sharedContentWidth() {
    const main = document.querySelector("main");
    if (!main) return 0;
    const styles = window.getComputedStyle(main);
    const viewportWidth = document.documentElement.clientWidth;
    const sidebarWidth = pinnedSidebarWidth();
    const paddingLeft = parseFloat(styles.paddingLeft) || 0;
    const paddingRight = parseFloat(styles.paddingRight) || 0;
    const key = [viewportWidth, sidebarWidth, paddingLeft, paddingRight].join(":");
    if (key !== cachedLayoutKey) {
      cachedLayoutKey = key;
      cachedContentWidth = Math.max(0, viewportWidth - sidebarWidth - paddingLeft - paddingRight);
    }
    return cachedContentWidth;
  }

  function restoreSingleTable() {
    document.querySelectorAll(".tableBodyScroller").forEach((bodyScroller) => {
      const bodyTable = bodyScroller.querySelector("table");
      const headerScroller = bodyScroller.previousElementSibling?.classList.contains("tableHeaderScroller")
        ? bodyScroller.previousElementSibling
        : null;
      const tableHead = headerScroller?.querySelector("thead");
      if (bodyTable && tableHead && !bodyTable.querySelector("thead")) {
        const colGroup = bodyTable.querySelector("colgroup");
        if (colGroup?.nextSibling) bodyTable.insertBefore(tableHead, colGroup.nextSibling);
        else bodyTable.prepend(tableHead);
      }
      headerScroller?.remove();
      bodyScroller.classList.remove("tableBodyScroller");
    });
  }

  function widthForColumn(column) {
    const className = Object.keys(WIDTHS).find((name) => column.classList.contains(name));
    return className ? WIDTHS[className] : null;
  }

  function removeFillers(table, colGroup) {
    colGroup.querySelectorAll(`.${FILLER_CLASS}, .col-stable-width-filler, .col-exact-width-filler`).forEach((element) => element.remove());
    table.querySelectorAll(
      `th.${FILLER_CLASS}, td.${FILLER_CLASS}, th.col-stable-width-filler, td.col-stable-width-filler, th.col-exact-width-filler, td.col-exact-width-filler`,
    ).forEach((element) => element.remove());
  }

  function appendFiller(table, widthInPixels) {
    if (!(widthInPixels > 0.01)) return;
    const width = `${widthInPixels.toFixed(4)}px`;
    const fillerColumn = document.createElement("col");
    fillerColumn.className = FILLER_CLASS;
    fillerColumn.style.setProperty("width", width, "important");
    fillerColumn.style.setProperty("min-width", width, "important");
    fillerColumn.style.setProperty("max-width", width, "important");
    table.querySelector("colgroup")?.appendChild(fillerColumn);
    table.querySelectorAll("thead tr, tbody tr").forEach((row) => {
      const cell = document.createElement(row.closest("thead") ? "th" : "td");
      cell.className = FILLER_CLASS;
      cell.setAttribute("aria-hidden", "true");
      cell.style.setProperty("width", width, "important");
      cell.style.setProperty("min-width", width, "important");
      cell.style.setProperty("max-width", width, "important");
      row.appendChild(cell);
    });
  }

  function applySharedTableWidths() {
    if (!playerTablePageActive()) return false;
    restoreSingleTable();
    const page = document.querySelector("#progressionPage");
    const table = page?.querySelector(".tableScroller table");
    const colGroup = table?.querySelector("colgroup");
    const contentWidth = sharedContentWidth();
    if (!page || page.hidden || !table || !colGroup || !(contentWidth > 0)) return false;

    removeFillers(table, colGroup);
    const columns = Array.from(colGroup.children);
    const percentages = columns.map(widthForColumn);
    if (!percentages.length || percentages.some((width) => !Number.isFinite(width))) return false;
    const totalPercentage = percentages.reduce((sum, width) => sum + width, 0);
    if (totalPercentage > 100.01) return false;

    const exactWidth = `${contentWidth.toFixed(4)}px`;
    page.querySelectorAll(".tableShell, .tableScroller").forEach((element) => {
      element.style.setProperty("width", exactWidth, "important");
      element.style.setProperty("min-width", exactWidth, "important");
      element.style.setProperty("max-width", exactWidth, "important");
      element.style.setProperty("box-sizing", "border-box", "important");
      element.style.setProperty("overflow", "visible", "important");
    });
    table.style.setProperty("table-layout", "fixed", "important");
    table.style.setProperty("width", exactWidth, "important");
    table.style.setProperty("min-width", exactWidth, "important");
    table.style.setProperty("max-width", exactWidth, "important");
    table.style.setProperty("box-sizing", "border-box", "important");
    table.style.setProperty("border-spacing", "0", "important");

    let assignedWidth = 0;
    columns.forEach((column, index) => {
      const pixelWidth = contentWidth * percentages[index] / 100;
      assignedWidth += pixelWidth;
      const width = `${pixelWidth.toFixed(4)}px`;
      column.style.setProperty("width", width, "important");
      column.style.setProperty("min-width", width, "important");
      column.style.setProperty("max-width", width, "important");
      column.style.setProperty("transition", "none", "important");
    });
    appendFiller(table, Math.max(0, contentWidth - assignedWidth));
    return true;
  }

  function revealInitialTable() {
    cancelAnimationFrame(revealFrame);
    revealFrame = requestAnimationFrame(() => {
      const appLoading = document.body.classList.contains("loading") || document.body.classList.contains("booting");
      const ready = applySharedTableWidths();
      if ((appLoading || !ready) && revealAttempts < 180) {
        revealAttempts += 1;
        revealInitialTable();
        return;
      }
      revealAttempts = 0;
      requestAnimationFrame(() => {
        applySharedTableWidths();
        document.body.classList.remove("tableLayoutPending");
      });
    });
  }

  function syncPinnedSidebarState() {
    const visible = pinnedSidebarWidth() > 0;
    const changed = document.body.classList.contains("pinnedSidebarVisible") !== visible;
    document.body.classList.toggle("pinnedSidebarVisible", visible);
    if (changed) {
      cachedLayoutKey = "";
      cachedContentWidth = 0;
      requestAnimationFrame(applySharedTableWidths);
    }
  }

  if (typeof buildTableColGroup === "function") {
    const originalBuildTableColGroup = buildTableColGroup;
    buildTableColGroup = function buildTableColGroupWithSharedWidths() {
      const result = originalBuildTableColGroup.apply(this, arguments);
      applySharedTableWidths();
      return result;
    };
  }

  if (typeof buildHeader === "function") {
    const originalBuildHeader = buildHeader;
    buildHeader = function buildHeaderWithSharedWidths() {
      const result = originalBuildHeader.apply(this, arguments);
      applySharedTableWidths();
      return result;
    };
  }

  if (typeof renderTable === "function") {
    const originalRenderTable = renderTable;
    renderTable = function renderTableWithSharedWidths() {
      const result = originalRenderTable.apply(this, arguments);
      applySharedTableWidths();
      if (document.body.classList.contains("tableLayoutPending")) revealInitialTable();
      return result;
    };
  }

  if (typeof updateViewButtons === "function") {
    const originalUpdateViewButtons = updateViewButtons;
    updateViewButtons = function updateViewButtonsWithSharedWidths() {
      const result = originalUpdateViewButtons.apply(this, arguments);
      applySharedTableWidths();
      return result;
    };
  }

  const rail = document.querySelector("#menuRail");
  if (rail) {
    const railObserver = new MutationObserver(syncPinnedSidebarState);
    railObserver.observe(rail, { attributes: true, attributeFilter: ["hidden"] });
  }

  window.applyExactPlayerTableWidths = applySharedTableWidths;
  window.addEventListener("resize", () => {
    cachedLayoutKey = "";
    cachedContentWidth = 0;
    applySharedTableWidths();
  }, { passive: true });

  syncPinnedSidebarState();
  applySharedTableWidths();
  if (initialTableRoute) revealInitialTable();
})();
'''

old_style_marker = "/* v1.150.3 - Pinned sidebar and atomic page layout */"
if old_style_marker not in styles:
    raise SystemExit("Expected v1.150.3 style patch was not found")
styles = styles.split(old_style_marker, 1)[0].rstrip()

styles += r'''

/* v1.150.4 - Pinned content area, centered guest states, and shared table grid */
:root {
  --pinned-sidebar-width: 190px;
  --pinned-topbar-height: 102px;
}

html {
  overflow-y: scroll;
  scrollbar-gutter: stable;
}

.appShell,
.appShell.menuClosed,
.appShell.sidebarClosed,
.appShell.sidebarCollapsed,
.appShell.collapsed {
  --sidebar-offset: var(--pinned-sidebar-width) !important;
  transition: none !important;
}

.menuRail,
.appShell.menuClosed .menuRail,
.appShell.sidebarClosed .menuRail,
.appShell.sidebarCollapsed .menuRail,
.appShell.collapsed .menuRail {
  width: var(--pinned-sidebar-width) !important;
  padding: 14px !important;
  align-items: stretch !important;
  transition: none !important;
}

.sidebar,
.appShell.menuClosed .sidebar,
.appShell.sidebarClosed .sidebar,
.appShell.sidebarCollapsed .sidebar,
.appShell.collapsed .sidebar {
  width: 162px !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
  align-items: stretch !important;
  transition: none !important;
}

.menuButton,
.appShell.menuClosed .menuButton,
.appShell.sidebarClosed .menuButton,
.appShell.sidebarCollapsed .menuButton,
.appShell.collapsed .menuButton {
  width: 100% !important;
  margin: 0 !important;
  justify-content: flex-start !important;
  pointer-events: none !important;
  cursor: default !important;
  transition: none !important;
}

.appShell.menuClosed .menuText,
.appShell.sidebarClosed .menuText,
.appShell.sidebarCollapsed .menuText,
.appShell.collapsed .menuText,
.appShell.menuClosed .navText,
.appShell.sidebarClosed .navText,
.appShell.sidebarCollapsed .navText,
.appShell.collapsed .navText {
  max-width: 112px !important;
  margin-left: 8px !important;
  opacity: 1 !important;
}

.appShell.menuClosed .navButton,
.appShell.sidebarClosed .navButton,
.appShell.sidebarCollapsed .navButton,
.appShell.collapsed .navButton {
  justify-content: flex-start !important;
  width: 100% !important;
  gap: 8px !important;
  padding: 0 14px !important;
}

main,
.siteFooter {
  box-sizing: border-box !important;
  transition: none !important;
}

body.pinnedSidebarVisible main,
body.pinnedSidebarVisible .siteFooter {
  width: calc(100% - var(--pinned-sidebar-width)) !important;
  margin-left: var(--pinned-sidebar-width) !important;
}

body:not(.pinnedSidebarVisible) main,
body:not(.pinnedSidebarVisible) .siteFooter,
.menuRail[hidden] + main {
  width: 100% !important;
  margin-left: 0 !important;
}

.siteFooter {
  justify-items: center !important;
  text-align: center !important;
}

main > .pageView,
.homePage,
.changelogPage,
.myPlayersLockedPage {
  left: auto !important;
}

body.guest main > .pageView:not([hidden]) {
  margin-left: auto;
  margin-right: auto;
}

.myPlayersLockedPage:not([hidden]) {
  display: grid !important;
  place-items: center !important;
  width: 100% !important;
  min-height: calc(100vh - var(--pinned-topbar-height) - 52px) !important;
  margin: 0 !important;
  padding: 24px !important;
}

.myPlayersLockedContent,
body.guest main > .pageView:not([hidden]) > [class*="LockedContent"],
body.guest main > .pageView:not([hidden]) > [class*="OptIn"] {
  margin-left: auto !important;
  margin-right: auto !important;
  text-align: center;
}

#progressionPage {
  transition: opacity 180ms ease, transform 180ms ease !important;
}

body.tableLayoutPending #progressionPage,
body.clubViewSwitching #progressionPage {
  visibility: visible !important;
  opacity: 0 !important;
  transform: translateY(6px) !important;
  pointer-events: none !important;
}

body.clubViewSwitching #progressionPage {
  transition: opacity 180ms ease, transform 180ms ease !important;
}

body.tableLayoutPending #loadingScreen,
body.clubViewSwitching #loadingScreen {
  display: grid !important;
  visibility: visible !important;
  align-content: center !important;
  justify-items: center !important;
  opacity: 1 !important;
  pointer-events: auto !important;
}

body.tableLayoutPending #loadingScreen .loadingBox,
body.clubViewSwitching #loadingScreen .loadingBox {
  margin: 0 auto !important;
}

body[data-page="watchlist"] #progressionPage .views {
  display: flex !important;
  justify-content: flex-start !important;
  text-align: left !important;
}

body[data-page="watchlist"] #progressionPage .viewButton[data-view="attributes"] { order: 1 !important; }
body[data-page="watchlist"] #progressionPage .viewButton[data-view="next"] { order: 2 !important; }
body[data-page="watchlist"] #progressionPage .viewButton[data-view="contracts"] { order: 3 !important; }
body[data-page="watchlist"] #progressionPage .viewButton[data-view="current"] { order: 4 !important; }
body[data-page="watchlist"] #progressionPage .viewButton[data-view="all"] { order: 5 !important; }
body[data-page="watchlist"] #progressionPage .watchlistSwitcher {
  order: 10 !important;
  margin-left: auto !important;
}

#progressionPage .tableShell,
#progressionPage .tableScroller,
#progressionPage .tableScroller table {
  box-sizing: border-box !important;
}

#progressionPage .tableShell,
#progressionPage .tableScroller {
  overflow: visible !important;
}

#progressionPage .tableScroller table {
  table-layout: fixed !important;
  border-spacing: 0 !important;
}

#progressionPage .tableScroller table,
#progressionPage .tableScroller col,
#progressionPage .tableScroller th,
#progressionPage .tableScroller td {
  transition: none !important;
  animation: none !important;
}

#progressionPage .tableScroller .col-shared-width-filler,
#progressionPage .tableScroller .col-stable-width-filler,
#progressionPage .tableScroller .col-exact-width-filler {
  padding: 0 !important;
  border-left: 0 !important;
  border-right: 0 !important;
  background: inherit !important;
  pointer-events: none !important;
}

@media (min-width: 901px) {
  body:not(.loading):not(.booting).pinnedSidebarVisible.tableLayoutPending #loadingScreen,
  body:not(.loading):not(.booting).pinnedSidebarVisible.clubViewSwitching #loadingScreen {
    inset: var(--pinned-topbar-height) 0 0 var(--pinned-sidebar-width) !important;
    width: auto !important;
    height: auto !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  #progressionPage {
    transition: none !important;
  }
}
'''

index = index.replace('/styles.css?v=1.150.3', '/styles.css?v=1.150.4')
index = index.replace('/app.js?v=1.150.3', '/app.js?v=1.150.4')
if '/styles.css?v=1.150.4' not in index or '/app.js?v=1.150.4' not in index:
    raise SystemExit("Failed to update index asset versions")

APP_PATH.write_text(app + "\n", encoding="utf-8")
STYLE_PATH.write_text(styles + "\n", encoding="utf-8")
INDEX_PATH.write_text(index, encoding="utf-8")
