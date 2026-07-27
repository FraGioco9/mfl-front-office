from pathlib import Path

app_path = Path("site/app.js")
source = app_path.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global source
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    source = source.replace(old, new, 1)


replace_once(
    'const VERSION = "1.150.0";',
    'const VERSION = "1.150.1";',
    "version",
)
replace_once(
    'description.textContent = "Add club pages, searchable club routes, division details, and position-sorted club squads";',
    'description.textContent = "Load club pages atomically, add public progression views, remove club quick filters and pagination, and keep shared column widths identical";',
    "changelog description",
)

public_views_marker = "/* v1.150.1 public progression table views */"
club_pages_marker = "/* Consolidated from v1500-club-pages.js */"
if public_views_marker not in source:
    if club_pages_marker not in source:
        raise SystemExit("club pages marker not found")
    public_views_patch = r'''/* v1.150.1 public progression table views */
(() => {
  const PUBLIC_PROGRESSION_VIEWS = ["current", "all"];
  const PUBLIC_TABLE_PAGES = new Set(["watchlist", "club"]);

  tablePages.add("club");
  pageViewOptions.watchlist = Array.from(new Set([
    ...(pageViewOptions.watchlist || []),
    ...PUBLIC_PROGRESSION_VIEWS,
  ]));
  pageViewOptions.club = ["attributes", "contracts", ...PUBLIC_PROGRESSION_VIEWS];
  defaultPageViews.club = "attributes";

  if (typeof allowedViewsForPage === "function") {
    const originalAllowedViewsForPage = allowedViewsForPage;
    allowedViewsForPage = function allowedViewsForPublicTables(pageName = state.currentPage) {
      const allowed = originalAllowedViewsForPage.apply(this, arguments) || [];
      if (!PUBLIC_TABLE_PAGES.has(pageName)) return allowed;
      return Array.from(new Set([...allowed, ...PUBLIC_PROGRESSION_VIEWS]));
    };
  }

  if (typeof normalizeViewForPage === "function") {
    const originalNormalizeViewForPage = normalizeViewForPage;
    normalizeViewForPage = function normalizePublicProgressionView(viewName, pageName = state.currentPage) {
      if (PUBLIC_TABLE_PAGES.has(pageName) && PUBLIC_PROGRESSION_VIEWS.includes(String(viewName || ""))) {
        return String(viewName);
      }
      return originalNormalizeViewForPage.apply(this, arguments);
    };
  }

  if (typeof currentDataAccess === "function") {
    const originalCurrentDataAccess = currentDataAccess;
    currentDataAccess = function currentPublicProgressionDataAccess(pageName = state.currentPage) {
      if (PUBLIC_TABLE_PAGES.has(pageName) && PUBLIC_PROGRESSION_VIEWS.includes(state.view)) {
        return originalCurrentDataAccess.call(this, "progression");
      }
      return originalCurrentDataAccess.apply(this, arguments);
    };
  }
})();

'''
    source = source.replace(club_pages_marker, public_views_patch + club_pages_marker, 1)

replace_once(
    '  const CLUB_VIEWS = new Set(["contracts", "attributes"]);',
    '  const CLUB_VIEWS = new Set(["attributes", "contracts", "current", "all"]);',
    "club views",
)

replace_once(
    '''  function clubRoute(pathname = normalizedPath()) {
    const match = pathname.match(/^\\/(?:clubs|club)\\/([^/]+)(?:\\/(contracts|attributes))?$/i);
    if (!match) return null;
    return {
      clubId: decodeURIComponent(match[1]),
      view: CLUB_VIEWS.has(String(match[2] || "").toLowerCase())
        ? String(match[2]).toLowerCase()
        : "attributes",
    };
  }
''',
    '''  function clubRoute(pathname = normalizedPath()) {
    const match = pathname.match(/^\\/(?:clubs|club)\\/([^/]+)(?:\\/(contracts|attributes|current-season|all-time))?$/i);
    if (!match) return null;
    const routeView = String(match[2] || "").toLowerCase();
    const view = routeView === "current-season"
      ? "current"
      : routeView === "all-time"
        ? "all"
        : routeView;
    return {
      clubId: decodeURIComponent(match[1]),
      view: CLUB_VIEWS.has(view) ? view : "attributes",
    };
  }
''',
    "club route",
)

replace_once(
    '''  function canonicalClubRoute(clubId = activeClubId, view = state.view) {
    const safeView = view === "contracts" ? "contracts" : "attributes";
    return `/clubs/${encodeURIComponent(clubId)}/${safeView}`;
  }
''',
    '''  function canonicalClubRoute(clubId = activeClubId, view = state.view) {
    const safeView = view === "current"
      ? "current-season"
      : view === "all"
        ? "all-time"
        : view === "contracts"
          ? "contracts"
          : "attributes";
    return `/clubs/${encodeURIComponent(clubId)}/${safeView}`;
  }
''',
    "canonical club route",
)

replace_once(
    '''  function setClubSwitching(active) {
    document.body.classList.toggle("clubViewSwitching", active);
  }
''',
    '''  function setClubSwitching(active) {
    document.body.classList.toggle("clubViewSwitching", active);
    if (active) {
      document.querySelectorAll(".navButton.active").forEach((link) => link.classList.remove("active"));
    }
  }
''',
    "club switching",
)

old_finish_start = source.index("  function finishClubSwitch() {")
old_finish_end = source.index("\n\n  function hideClubPageControls()", old_finish_start)
source = source[:old_finish_start] + r'''  function finishClubSwitch() {
    return new Promise((resolve) => {
      let attempts = 0;
      let stableFrames = 0;
      let previousSignature = "";

      const checkStableClubPage = () => {
        attempts += 1;
        if (typeof buildTableColGroup === "function") buildTableColGroup();
        if (typeof window.applyExactPlayerTableWidths === "function") window.applyExactPlayerTableWidths();
        applyClubPresentation();

        const page = document.querySelector("#progressionPage");
        const columns = Array.from(document.querySelectorAll("#tableColGroup > col"));
        const visibleViews = Array.from(document.querySelectorAll("#progressionPage .viewButton:not([hidden])"))
          .map((button) => `${button.dataset.view}:${button.classList.contains("active")}`)
          .join("|");
        const signature = [
          page && !page.hidden ? "visible" : "hidden",
          tablePageTitle?.textContent || "",
          visibleViews,
          tableBody?.childElementCount || 0,
          columns.map((column) => `${column.className}:${column.style.width}`).join("|"),
        ].join("::");

        if (columns.length && signature === previousSignature) stableFrames += 1;
        else stableFrames = 0;
        previousSignature = signature;

        if (stableFrames >= 2 || attempts >= 120) {
          requestAnimationFrame(() => requestAnimationFrame(() => {
            applyClubPresentation();
            setClubSwitching(false);
            resolve();
          }));
          return;
        }

        requestAnimationFrame(checkStableClubPage);
      };

      requestAnimationFrame(checkStableClubPage);
    });
  }
''' + source[old_finish_end:]

old_controls_start = source.index("  function hideClubPageControls() {")
old_controls_end = source.index("\n\n  function applyClubPresentation()", old_controls_start)
source = source[:old_controls_start] + r'''  function hideClubPageControls() {
    const views = document.querySelector("#progressionPage .views");
    if (views) {
      const orderedViews = ["attributes", "contracts", "current", "all"];
      orderedViews.forEach((viewName) => {
        const button = views.querySelector(`.viewButton[data-view="${viewName}"]`);
        if (button) views.appendChild(button);
      });
      views.querySelectorAll(".viewButton").forEach((button) => {
        button.hidden = !CLUB_VIEWS.has(button.dataset.view);
      });
    }

    const quickFilters = document.querySelector("#progressionPage .quickFilters");
    if (quickFilters) quickFilters.hidden = true;
    document.querySelectorAll("#progressionPage .pager, #progressionPage nav.pager").forEach((pager) => {
      pager.hidden = true;
    });
  }

  function restoreStandardControls() {
    const quickFilters = document.querySelector("#progressionPage .quickFilters");
    if (quickFilters) quickFilters.hidden = false;
    const controlsBar = document.querySelector("#progressionPage .controlsBar");
    if (controlsBar) controlsBar.hidden = false;
    document.querySelectorAll("#progressionPage .pager, #progressionPage nav.pager").forEach((pager) => {
      pager.hidden = false;
    });
  }
''' + source[old_controls_end:]

replace_once(
    '      const nextView = view === "contracts" ? "contracts" : "attributes";',
    '      const nextView = CLUB_VIEWS.has(String(view || "")) ? String(view) : "attributes";',
    "club next view",
)
replace_once(
    '        await setPage("database", false, { view: nextView, skipNavigationLoading: false });',
    '        const sourcePage = ["current", "all"].includes(nextView) ? "progression" : "database";\n        await setPage(sourcePage, false, { view: nextView, skipNavigationLoading: false });',
    "club source page",
)
replace_once(
    '''    } finally {
      openingClub = false;
      finishClubSwitch();
    }
''',
    '''    } finally {
      openingClub = false;
      await finishClubSwitch();
    }
''',
    "await club reveal",
)

replace_once(
    '''  const initialClubRoute = clubRoute();
''',
    '''  const initialClubRoute = clubRoute();
  if (initialClubRoute) setClubSwitching(true);
''',
    "initial club switching",
)

replace_once(
    '''    body.clubViewSwitching #progressionPage .tableShell { visibility: hidden !important; opacity: 0 !important; }
    body.clubViewSwitching #progressionPage .tableScroller table,
    body.clubViewSwitching #progressionPage .tableScroller col { transition: none !important; }
''',
    '''    body.clubViewSwitching #progressionPage { visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; }
    body.clubViewSwitching #progressionPage,
    body.clubViewSwitching #progressionPage * { transition: none !important; animation: none !important; }
    body[data-page="club"] #progressionPage .quickFilters,
    body[data-page="club"] #progressionPage .pager,
    body[data-page="club"] #progressionPage nav.pager { display: none !important; }
''',
    "club atomic CSS",
)

lock_start = source.index("  function lockClubWidths() {")
lock_end = source.index("\n\n  document.addEventListener(\"pointerdown\"", lock_start)
source = source[:lock_start] + r'''  function lockClubWidths() {
    document.body.classList.remove("clubWidthHardLock");
    rebuildClubColumns();
  }
''' + source[lock_end:]

source = source.replace(
    '    body.clubWidthHardLock #progressionPage .tableShell,\n    body.clubWidthHardLock #progressionPage .pager { visibility: hidden !important; opacity: 0 !important; }\n    body.clubWidthHardLock #progressionPage .tableScroller table,\n    body.clubWidthHardLock #progressionPage .tableScroller col { transition: none !important; }\n',
    '',
    1,
)

width_marker = "/* Single exact player-table width engine */"
if width_marker not in source:
    raise SystemExit("table width engine marker not found")
source = source.split(width_marker, 1)[0].rstrip()
source += r'''

/* Single exact player-table width engine */
(() => {
  document.documentElement.style.setProperty("overflow-y", "scroll", "important");
  document.documentElement.style.setProperty("scrollbar-gutter", "stable", "important");

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

  const FILLER_CLASS = "col-exact-width-filler";
  const EPSILON = 0.01;
  let applyingWidths = false;
  let queuedFrame = 0;

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

  function sharedTableWidth() {
    const page = document.querySelector("#progressionPage");
    if (!page || page.hidden) return 0;
    const styles = window.getComputedStyle(page);
    const horizontalPadding = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
    const width = page.clientWidth - horizontalPadding;
    return Number.isFinite(width) && width > 0 ? width : 0;
  }

  function removeFiller(table, colGroup) {
    colGroup.querySelectorAll(`.${FILLER_CLASS}`).forEach((element) => element.remove());
    table.querySelectorAll(`th.${FILLER_CLASS}, td.${FILLER_CLASS}`).forEach((element) => element.remove());
  }

  function appendFiller(table, widthInPixels) {
    if (widthInPixels <= EPSILON) return;
    const width = `${widthInPixels}px`;
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

  function applyExactTableWidths() {
    if (applyingWidths) return false;
    applyingWidths = true;

    try {
      restoreSingleTable();
      const tableWidth = sharedTableWidth();
      if (!tableWidth) return false;

      document.querySelectorAll("#progressionPage .tableShell, #progressionPage .tableScroller").forEach((element) => {
        element.style.setProperty("width", "100%", "important");
        element.style.setProperty("min-width", "0", "important");
        element.style.setProperty("max-width", "100%", "important");
        element.style.setProperty("box-sizing", "border-box", "important");
        element.style.setProperty("overflow", "visible", "important");
      });

      document.querySelectorAll("#progressionPage .tableScroller table").forEach((table) => {
        const colGroup = table.querySelector("colgroup");
        if (!colGroup) return;

        removeFiller(table, colGroup);
        const columns = Array.from(colGroup.children);
        const percentages = columns.map(widthForColumn);
        if (!percentages.length || percentages.some((width) => !Number.isFinite(width))) return;

        const totalPercentage = percentages.reduce((sum, width) => sum + width, 0);
        if (totalPercentage > 100 + EPSILON) return;

        const exactWidth = `${tableWidth}px`;
        table.style.setProperty("table-layout", "fixed", "important");
        table.style.setProperty("width", exactWidth, "important");
        table.style.setProperty("min-width", exactWidth, "important");
        table.style.setProperty("max-width", exactWidth, "important");
        table.style.setProperty("box-sizing", "border-box", "important");
        table.style.setProperty("border-spacing", "0", "important");

        let assignedWidth = 0;
        columns.forEach((column, index) => {
          const pixelWidth = tableWidth * percentages[index] / 100;
          assignedWidth += pixelWidth;
          const width = `${pixelWidth}px`;
          column.style.setProperty("width", width, "important");
          column.style.setProperty("min-width", width, "important");
          column.style.setProperty("max-width", width, "important");
          column.style.setProperty("transition", "none", "important");
        });

        appendFiller(table, Math.max(0, tableWidth - assignedWidth));
      });

      return true;
    } finally {
      applyingWidths = false;
    }
  }

  function queueExactTableWidths() {
    cancelAnimationFrame(queuedFrame);
    queuedFrame = requestAnimationFrame(() => {
      applyExactTableWidths();
      requestAnimationFrame(applyExactTableWidths);
    });
  }

  window.applyExactPlayerTableWidths = applyExactTableWidths;

  if (typeof buildTableColGroup === "function") {
    const originalBuildTableColGroup = buildTableColGroup;
    buildTableColGroup = function buildTableColGroupWithExactGrid() {
      const result = originalBuildTableColGroup.apply(this, arguments);
      queueExactTableWidths();
      return result;
    };
  }

  if (typeof buildHeader === "function") {
    const originalBuildHeader = buildHeader;
    buildHeader = function buildHeaderWithExactGrid() {
      const result = originalBuildHeader.apply(this, arguments);
      queueExactTableWidths();
      return result;
    };
  }

  if (typeof renderTable === "function") {
    const originalRenderTable = renderTable;
    renderTable = function renderTableWithExactGrid() {
      const result = originalRenderTable.apply(this, arguments);
      queueExactTableWidths();
      return result;
    };
  }

  const style = document.createElement("style");
  style.textContent = `
    #progressionPage,
    #progressionPage .tableShell,
    #progressionPage .tableScroller {
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }

    #progressionPage { min-width: 0 !important; }

    #progressionPage .tableShell,
    #progressionPage .tableScroller {
      min-width: 0 !important;
      overflow: visible !important;
      max-height: none !important;
      scrollbar-gutter: auto !important;
    }

    #progressionPage .tableScroller table {
      table-layout: fixed !important;
      border-spacing: 0 !important;
    }

    #progressionPage .tableScroller .${FILLER_CLASS} {
      padding: 0 !important;
      border-left: 0 !important;
      border-right: 0 !important;
      background: inherit !important;
      pointer-events: none !important;
    }

    #progressionPage .tableScroller table,
    #progressionPage .tableScroller col,
    #progressionPage .tableScroller th,
    #progressionPage .tableScroller td,
    #progressionPage .tableScroller tr:hover,
    #progressionPage .tableScroller tr:hover > th,
    #progressionPage .tableScroller tr:hover > td {
      transition: none !important;
      animation: none !important;
    }
  `;
  document.head.appendChild(style);

  window.addEventListener("resize", queueExactTableWidths, { passive: true });
  document.addEventListener("click", (event) => {
    if (event.target.closest?.(".viewButton[data-view]")) queueExactTableWidths();
  }, true);

  if (window.ResizeObserver) {
    const widthObserver = new ResizeObserver(queueExactTableWidths);
    const page = document.querySelector("#progressionPage");
    if (page) widthObserver.observe(page);
  }

  queueExactTableWidths();
})();
'''

app_path.write_text(source, encoding="utf-8")

for temporary_path in (
    ".github/scripts/patch_club_atomic_views.py",
    ".github/workflows/one-time-club-atomic-views.yml",
    ".github/club-page-fix-trigger",
):
    Path(temporary_path).unlink(missing_ok=True)
