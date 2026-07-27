from pathlib import Path

app_path = Path("site/app.js")
source = app_path.read_text(encoding="utf-8")

source = source.replace('const VERSION = "1.150.1";', 'const VERSION = "1.150.2";', 1)
source = source.replace(
    'description.textContent = "Load club pages atomically, add public progression views, remove club quick filters and pagination, and keep shared column widths identical";',
    'description.textContent = "Align Watchlist views, remove club filters, stabilize first-frame table widths, reveal club pages atomically, and normalize watchlist tooltip opacity";',
    1,
)

marker = "/* v1.150.2 watchlist and atomic table polish */"
if marker in source:
    source = source.split(marker, 1)[0].rstrip()

source += r'''

/* v1.150.2 watchlist and atomic table polish */
(() => {
  const TABLE_ROUTE = /^\/(?:database|mfl|agents?|progression|watchlist|my-players|clubs?|club)(?:\/|$)/i;
  const INITIAL_CLUB_ROUTE = /^\/(?:clubs?|club)\/[^/]+(?:\/|$)/i;
  const WATCHLIST_ROUTE = /^\/watchlist(?:\/|$)/i;
  const TOOLTIP_TEXT = "you need at least one watchlist";
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
  const initialTableRoute = TABLE_ROUTE.test(window.location.pathname);
  const initialClubRoute = INITIAL_CLUB_ROUTE.test(window.location.pathname);
  let sharedTableWidth = 0;
  let measuredCandidate = 0;
  let measuredStableFrames = 0;
  let queuedFrame = 0;
  let applyingWidths = false;
  let syncFrame = 0;

  if (initialTableRoute) document.body.classList.add("tableLayoutPending");
  if (initialClubRoute) {
    document.body.classList.add("clubInitialAtomic");
    document.querySelectorAll(".navButton.active").forEach((button) => button.classList.remove("active"));
  }

  function isClubPage() {
    return state?.currentPage === "club" || INITIAL_CLUB_ROUTE.test(window.location.pathname);
  }

  function isWatchlistPage() {
    return state?.currentPage === "watchlist" || WATCHLIST_ROUTE.test(window.location.pathname);
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

  function measuredPageWidth() {
    const page = document.querySelector("#progressionPage");
    if (!page || page.hidden) return 0;
    const styles = window.getComputedStyle(page);
    const padding = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
    const width = page.getBoundingClientRect().width - padding;
    return Number.isFinite(width) && width > 0 ? width : 0;
  }

  function establishSharedWidth() {
    const candidate = measuredPageWidth();
    if (!candidate) return false;
    if (Math.abs(candidate - measuredCandidate) <= 0.1) measuredStableFrames += 1;
    else {
      measuredCandidate = candidate;
      measuredStableFrames = 1;
    }
    if (!sharedTableWidth && measuredStableFrames >= 2) sharedTableWidth = candidate;
    return sharedTableWidth > 0;
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

  function applyFinalExactWidths() {
    if (applyingWidths) return false;
    applyingWidths = true;
    try {
      restoreSingleTable();
      if (!establishSharedWidth()) return false;
      const exactWidth = `${sharedTableWidth}px`;
      document.querySelectorAll("#progressionPage .tableShell, #progressionPage .tableScroller").forEach((element) => {
        element.style.setProperty("width", exactWidth, "important");
        element.style.setProperty("min-width", exactWidth, "important");
        element.style.setProperty("max-width", exactWidth, "important");
        element.style.setProperty("box-sizing", "border-box", "important");
        element.style.setProperty("overflow", "visible", "important");
      });
      let applied = false;
      document.querySelectorAll("#progressionPage .tableScroller table").forEach((table) => {
        const colGroup = table.querySelector("colgroup");
        if (!colGroup) return;
        removeFiller(table, colGroup);
        const columns = Array.from(colGroup.children);
        const percentages = columns.map(widthForColumn);
        if (!percentages.length || percentages.some((width) => !Number.isFinite(width))) return;
        const total = percentages.reduce((sum, width) => sum + width, 0);
        if (total > 100 + EPSILON) return;
        table.style.setProperty("table-layout", "fixed", "important");
        table.style.setProperty("width", exactWidth, "important");
        table.style.setProperty("min-width", exactWidth, "important");
        table.style.setProperty("max-width", exactWidth, "important");
        table.style.setProperty("box-sizing", "border-box", "important");
        table.style.setProperty("border-spacing", "0", "important");
        let assigned = 0;
        columns.forEach((column, index) => {
          const pixelWidth = sharedTableWidth * percentages[index] / 100;
          assigned += pixelWidth;
          const width = `${pixelWidth}px`;
          column.style.setProperty("width", width, "important");
          column.style.setProperty("min-width", width, "important");
          column.style.setProperty("max-width", width, "important");
          column.style.setProperty("transition", "none", "important");
        });
        appendFiller(table, Math.max(0, sharedTableWidth - assigned));
        applied = true;
      });
      return applied;
    } finally {
      applyingWidths = false;
    }
  }

  function queueFinalExactWidths() {
    cancelAnimationFrame(queuedFrame);
    queuedFrame = requestAnimationFrame(() => {
      applyFinalExactWidths();
      requestAnimationFrame(applyFinalExactWidths);
    });
  }

  window.applyExactPlayerTableWidths = applyFinalExactWidths;

  function arrangeWatchlistViews() {
    if (!isWatchlistPage()) return;
    const views = document.querySelector("#progressionPage .views");
    if (!views) return;
    const switcher = views.querySelector("#watchlistSwitcher, .watchlistSwitcher");
    ["attributes", "next", "contracts", "current", "all"].forEach((viewName) => {
      const button = views.querySelector(`.viewButton[data-view="${viewName}"]`);
      if (button) views.insertBefore(button, switcher || null);
    });
    if (switcher) views.appendChild(switcher);
  }

  function hideClubControls() {
    if (!isClubPage()) return;
    const quickFilters = document.querySelector("#progressionPage .quickFilters");
    const controls = document.querySelector("#progressionPage .controlsBar");
    if (quickFilters) quickFilters.hidden = true;
    if (controls) controls.hidden = true;
    document.querySelectorAll("#progressionPage .pager, #progressionPage nav.pager").forEach((pager) => {
      pager.hidden = true;
    });
  }

  function normalizeWatchlistTooltipOpacity() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const matches = [];
    while (walker.nextNode()) {
      if (String(walker.currentNode.nodeValue || "").trim().toLowerCase() === TOOLTIP_TEXT) {
        matches.push(walker.currentNode.parentElement);
      }
    }
    document.querySelectorAll(".watchlistMinimumTooltip").forEach((element) => element.classList.remove("watchlistMinimumTooltip"));
    matches.filter(Boolean).forEach((element) => {
      element.classList.add("watchlistMinimumTooltip");
      const tooltip = element.closest('[role="tooltip"], .tooltip, [class*="Tooltip"], [class*="tooltip"]') || element;
      tooltip.classList.add("watchlistMinimumTooltip");
      let ancestor = tooltip.parentElement;
      while (ancestor && ancestor !== document.body) {
        const opacity = parseFloat(window.getComputedStyle(ancestor).opacity);
        if (Number.isFinite(opacity) && opacity < 1 && (ancestor.matches("button,[aria-disabled='true'],:disabled") || ancestor.classList.contains("disabled"))) {
          ancestor.classList.add("watchlistTooltipOpacityHost");
          break;
        }
        ancestor = ancestor.parentElement;
      }
    });
  }

  function syncPagePolish() {
    arrangeWatchlistViews();
    hideClubControls();
    normalizeWatchlistTooltipOpacity();
    queueFinalExactWidths();
    if (document.body.classList.contains("clubInitialAtomic")) {
      document.querySelectorAll(".navButton.active").forEach((button) => button.classList.remove("active"));
    }
  }

  function queuePagePolish() {
    cancelAnimationFrame(syncFrame);
    syncFrame = requestAnimationFrame(syncPagePolish);
  }

  function tableSignature() {
    const page = document.querySelector("#progressionPage");
    const columns = Array.from(document.querySelectorAll("#tableColGroup > col:not(.col-exact-width-filler)"));
    return [
      page && !page.hidden ? "visible" : "hidden",
      sharedTableWidth.toFixed(2),
      tableBody?.childElementCount || 0,
      columns.map((column) => `${column.className}:${column.style.width}`).join("|"),
    ].join("::");
  }

  function revealWhenStable() {
    let previous = "";
    let stableFrames = 0;
    let attempts = 0;
    const check = () => {
      attempts += 1;
      syncPagePolish();
      const applied = applyFinalExactWidths();
      const signature = tableSignature();
      if (applied && signature && signature === previous) stableFrames += 1;
      else stableFrames = 0;
      previous = signature;
      const clubReady = !initialClubRoute || (
        state?.currentPage === "club"
        && document.body.dataset.page === "club"
        && document.querySelector("#progressionPage")?.hidden === false
        && String(document.querySelector("#tablePageTitle")?.textContent || "").trim()
      );
      if ((stableFrames >= 3 && clubReady) || attempts >= 240) {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          syncPagePolish();
          applyFinalExactWidths();
          document.body.classList.remove("tableLayoutPending", "clubInitialAtomic");
        }));
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }

  if (typeof buildTableColGroup === "function") {
    const originalBuildTableColGroup = buildTableColGroup;
    buildTableColGroup = function buildTableColGroupWithFinalWidths() {
      const result = originalBuildTableColGroup.apply(this, arguments);
      queuePagePolish();
      return result;
    };
  }
  if (typeof buildHeader === "function") {
    const originalBuildHeader = buildHeader;
    buildHeader = function buildHeaderWithFinalWidths() {
      const result = originalBuildHeader.apply(this, arguments);
      queuePagePolish();
      return result;
    };
  }
  if (typeof renderTable === "function") {
    const originalRenderTable = renderTable;
    renderTable = function renderTableWithFinalWidths() {
      const result = originalRenderTable.apply(this, arguments);
      queuePagePolish();
      return result;
    };
  }
  if (typeof updateViewButtons === "function") {
    const originalUpdateViewButtons = updateViewButtons;
    updateViewButtons = function updateViewButtonsWithFinalLayout() {
      const result = originalUpdateViewButtons.apply(this, arguments);
      queuePagePolish();
      return result;
    };
  }

  const style = document.createElement("style");
  style.textContent = `
    body.tableLayoutPending #progressionPage {
      visibility: hidden !important;
      opacity: 0 !important;
    }
    body.clubInitialAtomic #appShell {
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
    body.clubInitialAtomic #loadingScreen {
      display: flex !important;
      visibility: visible !important;
      opacity: 1 !important;
      pointer-events: auto !important;
    }
    body[data-page="watchlist"] #progressionPage .views {
      justify-content: flex-start !important;
      text-align: left !important;
    }
    body[data-page="watchlist"] #progressionPage .views .viewButton {
      order: 0 !important;
    }
    body[data-page="watchlist"] #progressionPage .watchlistSwitcher {
      order: 1 !important;
      margin-left: auto !important;
    }
    body[data-page="club"] #progressionPage .quickFilters,
    body[data-page="club"] #progressionPage .controlsBar,
    body[data-page="club"] #progressionPage .pager,
    body[data-page="club"] #progressionPage nav.pager {
      display: none !important;
    }
    #progressionPage .tableShell,
    #progressionPage .tableScroller,
    #progressionPage .tableScroller table {
      box-sizing: border-box !important;
    }
    .watchlistMinimumTooltip {
      opacity: 1 !important;
      filter: none !important;
    }
    .watchlistTooltipOpacityHost {
      opacity: 1 !important;
    }
    .watchlistTooltipOpacityHost > :not(.watchlistMinimumTooltip) {
      opacity: var(--disabled-opacity, .55);
    }
  `;
  document.head.appendChild(style);

  const observer = new MutationObserver(queuePagePolish);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "hidden", "style"] });
  window.addEventListener("resize", () => {
    sharedTableWidth = 0;
    measuredCandidate = 0;
    measuredStableFrames = 0;
    document.body.classList.add("tableLayoutPending");
    revealWhenStable();
  }, { passive: true });

  queuePagePolish();
  if (initialTableRoute) revealWhenStable();
})();
'''

app_path.write_text(source, encoding="utf-8")

for temporary in (
    ".github/scripts/patch_v1502_ui_polish.py",
    ".github/workflows/one-time-v1502-ui-polish.yml",
    ".github/v1502-ui-trigger",
):
    Path(temporary).unlink(missing_ok=True)
