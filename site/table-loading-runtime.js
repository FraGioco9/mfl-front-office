(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "1.123.33");
  const PAGER_SELECTOR = "#progressionPage nav.pager";
  const STYLE_ID = "mflTableLoadingStyles";
  const BLANK_ROW_CLASS = "staticTableBlankRow";
  const BLANK_ROW_OPACITIES = Object.freeze([0.82, 0.62, 0.44, 0.27, 0.13]);
  const TABLE_ROW_HEIGHT = 38;
  const LEGACY_TABLE_PAGES = new Set(["database", "mfl", "progression", "watchlist", "myplayers", "agents"]);
  const VIEW_BY_SLUG = Object.freeze({
    attributes: "attributes",
    stats: "stats",
    contracts: "contracts",
    "next-overall": "next",
    "current-season": "current",
    "all-time": "all",
  });
  const BASE_COLUMNS = Object.freeze([
    "player_id",
    "nationality_flag",
    "name",
    "nationality",
    "age",
    "positions",
    "player_seasons",
  ]);
  const STAT_COLUMNS = Object.freeze([
    "overall",
    "pace",
    "shooting",
    "passing",
    "dribbling",
    "defense",
    "physical",
  ]);
  const VIEW_COLUMNS = Object.freeze({
    attributes: [...BASE_COLUMNS, ...STAT_COLUMNS, "wallet_name", "player_link"],
    current: [...BASE_COLUMNS, ...STAT_COLUMNS, "wallet_name", "player_link"],
    all: [...BASE_COLUMNS, ...STAT_COLUMNS, "wallet_name", "player_link"],
    next: [...BASE_COLUMNS, ...STAT_COLUMNS, "wallet_name", "player_link"],
    contracts: [
      ...BASE_COLUMNS,
      "overall",
      "active_contract_revenue_share",
      "active_contract_club_name",
      "active_contract_club_division",
      "wallet_name",
      "player_link",
    ],
  });
  const COLUMN_META = Object.freeze({
    player_id: ["ID", "col-id"],
    nationality_flag: ["", "col-flag"],
    name: ["Name", "col-name"],
    nationality: ["Nationality", "col-nationality"],
    age: ["Age", "col-age"],
    positions: ["Positions", "col-positions"],
    player_seasons: ["Seasons", "col-seasons"],
    overall: ["Overall", "col-stat col-overall"],
    pace: ["Pace", "col-stat"],
    shooting: ["Shooting", "col-stat"],
    passing: ["Passing", "col-stat"],
    dribbling: ["Dribbling", "col-stat"],
    defense: ["Defense", "col-stat"],
    physical: ["Physical", "col-stat"],
    wallet_name: ["Agent", "col-agent"],
    owned_since: ["Joined Agency", "col-agent"],
    active_contract_revenue_share: ["Rev. Share", "col-contract-revenue"],
    active_contract_club_name: ["Club Name", "col-contract-club"],
    active_contract_club_division: ["Division", "col-contract-division"],
    player_link: ["", "col-link"],
  });

  const previous = window.__mflTableLoadingRuntime;
  previous?.destroy?.();

  let observer = null;
  let frame = 0;
  let destroyed = false;
  let pagerObservedDataLoading = false;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #tableBody > .${BLANK_ROW_CLASS},
    #tableBody > .${BLANK_ROW_CLASS} > td {
      pointer-events: none !important;
      transition: none !important;
      animation: none !important;
    }

    #tableBody > .${BLANK_ROW_CLASS} > td {
      height: ${TABLE_ROW_HEIGHT}px !important;
      min-height: ${TABLE_ROW_HEIGHT}px !important;
      padding-top: 0 !important;
      padding-bottom: 0 !important;
      background: var(--surface-muted) !important;
      color: transparent !important;
      user-select: none !important;
    }

    #tableBody > .${BLANK_ROW_CLASS}:hover > td,
    #tableBody > .${BLANK_ROW_CLASS} > td:hover {
      background: var(--surface-muted) !important;
      background-image: none !important;
    }
  `;
  document.head.appendChild(style);

  function normalizedPage(value) {
    const page = String(value || "").toLowerCase();
    if (page === "databasestats") return "database";
    if (page === "mflstats") return "mfl";
    if (page === "my-players") return "myplayers";
    if (page === "clubs") return "club";
    return page;
  }

  function routeFromPath(pathname = window.location.pathname) {
    const path = String(pathname || "/");
    if (/^\/(?:database|mfl)\/stats\/?$/i.test(path)) return null;
    const parts = path.split("/").filter(Boolean);
    const first = String(parts[0] || "").toLowerCase();
    let pageName = "";
    if (first === "my-players") pageName = "myplayers";
    else if (first === "clubs" || first === "club") pageName = "club";
    else if (["database", "mfl", "progression", "watchlist", "agents"].includes(first)) pageName = first;
    if (!pageName) return null;
    const last = String(parts.at(-1) || "").toLowerCase();
    const fallbackView = pageName === "progression" || pageName === "watchlist" ? "current" : "attributes";
    return { pageName, view: VIEW_BY_SLUG[last] || fallbackView };
  }

  function isPlayerTableRoute(pathname = window.location.pathname) {
    return Boolean(routeFromPath(pathname));
  }

  function statsRouteActive() {
    const path = String(window.location.pathname || "/");
    const bodyPage = String(document.body?.dataset.page || "").toLowerCase();
    return /^\/(?:database|mfl)\/stats\/?$/i.test(path)
      || bodyPage === "databasestats"
      || bodyPage === "mflstats";
  }

  function tableContextActive() {
    if (statsRouteActive()) return false;
    if (isPlayerTableRoute()) return true;
    const page = normalizedPage(document.body?.dataset.page || "");
    return ["database", "mfl", "progression", "watchlist", "myplayers", "agents", "club"].includes(page);
  }

  function tableElements() {
    const head = document.getElementById("tableHead");
    const body = document.getElementById("tableBody");
    const empty = document.getElementById("emptyState");
    const colGroup = document.getElementById("tableColGroup");
    return {
      head: head instanceof HTMLTableSectionElement ? head : null,
      body: body instanceof HTMLTableSectionElement ? body : null,
      empty: empty instanceof HTMLElement ? empty : null,
      colGroup: colGroup instanceof HTMLTableColElement ? colGroup : null,
    };
  }

  function pagerElements() {
    return Array.from(document.querySelectorAll(PAGER_SELECTOR))
      .filter((pager) => pager instanceof HTMLElement);
  }

  function dataLoadingActive() {
    return document.documentElement.classList.contains("mflDataLoading");
  }

  function hidePagerForLoading() {
    const pagers = pagerElements();
    const alreadyOwned = pagers.some((pager) => pager.dataset.staticLoadingPager === "true");
    if (!alreadyOwned) pagerObservedDataLoading = false;
    if (dataLoadingActive()) pagerObservedDataLoading = true;

    pagers.forEach((pager) => {
      if (pager.dataset.staticLoadingPager !== "true") {
        pager.dataset.staticLoadingPreviousHidden = pager.hidden ? "true" : "false";
        pager.dataset.staticLoadingPreviousDisplay = pager.style.getPropertyValue("display");
        pager.dataset.staticLoadingPreviousDisplayPriority = pager.style.getPropertyPriority("display");
      }
      pager.dataset.staticLoadingPager = "true";
      pager.hidden = true;
      pager.style.setProperty("display", "none", "important");
    });
  }

  function releasePagerWhenReady() {
    const pagers = pagerElements();
    if (!pagers.some((pager) => pager.dataset.staticLoadingPager === "true")) return false;
    if (dataLoadingActive()) {
      pagerObservedDataLoading = true;
      return false;
    }
    if (!pagerObservedDataLoading) return false;

    const body = document.getElementById("tableBody");
    if (body instanceof HTMLElement) {
      delete body.dataset.staticLoading;
      body.querySelectorAll(`:scope > .${BLANK_ROW_CLASS}`).forEach((row) => row.remove());
    }
    pagers.forEach((pager) => {
      if (pager.dataset.staticLoadingPager !== "true") return;
      const previouslyHidden = pager.dataset.staticLoadingPreviousHidden === "true";
      const previousDisplay = pager.dataset.staticLoadingPreviousDisplay || "";
      const previousDisplayPriority = pager.dataset.staticLoadingPreviousDisplayPriority || "";
      delete pager.dataset.staticLoadingPager;
      delete pager.dataset.staticLoadingPreviousHidden;
      delete pager.dataset.staticLoadingPreviousDisplay;
      delete pager.dataset.staticLoadingPreviousDisplayPriority;
      pager.hidden = previouslyHidden;
      if (previousDisplay) {
        pager.style.setProperty("display", previousDisplay, previousDisplayPriority);
      } else {
        pager.style.removeProperty("display");
      }
    });
    pagerObservedDataLoading = false;
    return true;
  }

  function displayColumnKey(column, pageName) {
    return column === "wallet_name" && ["myplayers", "agents", "mfl"].includes(pageName)
      ? "owned_since"
      : column;
  }

  function syncSharedViewButtonPage(pageName) {
    const normalizedPageName = normalizedPage(pageName);
    const legacyPageName = LEGACY_TABLE_PAGES.has(normalizedPageName) ? normalizedPageName : "";
    document.querySelectorAll("#progressionPage .views .viewButton[data-view]").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      if (legacyPageName) {
        if (button.dataset.page !== legacyPageName) button.dataset.page = legacyPageName;
      } else if (button.hasAttribute("data-page")) {
        button.removeAttribute("data-page");
      }
    });
  }

  function primeHeader(pageName, view) {
    const normalizedPageName = normalizedPage(pageName);
    const columns = VIEW_COLUMNS[view];
    const { head, colGroup } = tableElements();
    if (!columns || !head || !colGroup) return false;

    const row = document.createElement("tr");
    const selectCell = document.createElement("th");
    const selectInput = document.createElement("input");
    const selectCol = document.createElement("col");
    const cols = document.createDocumentFragment();
    selectCell.className = "selectionCell";
    selectInput.id = "selectVisiblePlayersInput";
    selectInput.type = "checkbox";
    selectInput.setAttribute("aria-label", "Select visible players");
    selectCell.appendChild(selectInput);
    row.appendChild(selectCell);
    selectCol.className = "col-select";
    cols.appendChild(selectCol);

    columns.forEach((column) => {
      const key = displayColumnKey(column, normalizedPageName);
      const meta = COLUMN_META[key];
      if (!meta) return;
      const cell = document.createElement("th");
      const label = document.createElement("span");
      const col = document.createElement("col");
      const classes = String(meta[1] || "").split(/\s+/).filter(Boolean);
      if (classes.length) {
        cell.classList.add(...classes);
        col.classList.add(...classes);
      }
      label.textContent = meta[0];
      cell.appendChild(label);
      row.appendChild(cell);
      cols.appendChild(col);
    });

    head.replaceChildren(row);
    head.dataset.staticHeader = "true";
    head.dataset.staticHeaderPage = normalizedPageName;
    head.dataset.staticHeaderView = view;
    colGroup.replaceChildren(cols);
    return true;
  }

  function blankRowsReady(body, columnCount) {
    const rows = Array.from(body.rows);
    return rows.length === BLANK_ROW_OPACITIES.length
      && rows.every((row, index) => (
        row.classList.contains(BLANK_ROW_CLASS)
        && row.cells.length === columnCount
        && row.dataset.loadingRow === String(index + 1)
      ));
  }

  function show() {
    if (!tableContextActive()) return false;
    const { head, body, empty } = tableElements();
    if (!head || !body) return false;
    hidePagerForLoading();

    const columnCount = Math.max(1, head.rows[0]?.cells.length || 1);
    if (!blankRowsReady(body, columnCount)) {
      const fragment = document.createDocumentFragment();
      BLANK_ROW_OPACITIES.forEach((opacity, index) => {
        const row = document.createElement("tr");
        row.className = BLANK_ROW_CLASS;
        row.dataset.loadingRow = String(index + 1);
        row.setAttribute("aria-hidden", "true");
        row.style.opacity = String(opacity);
        for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
          row.appendChild(document.createElement("td"));
        }
        fragment.appendChild(row);
      });
      body.replaceChildren(fragment);
    }

    body.dataset.staticLoading = "true";
    if (empty) {
      empty.hidden = true;
      empty.textContent = "";
    }
    return true;
  }

  function primeRoute(route) {
    if (!route) return false;
    syncSharedViewButtonPage(route.pageName);
    if (!primeHeader(route.pageName, route.view)) return false;
    show();
    return true;
  }

  function activePrimeRoute() {
    return routeFromPath();
  }

  function releaseInactiveTableLoading() {
    const { body } = tableElements();
    if (body) {
      delete body.dataset.staticLoading;
      body.querySelectorAll(`:scope > .${BLANK_ROW_CLASS}`).forEach((row) => row.remove());
    }

    pagerElements().forEach((pager) => {
      if (pager.dataset.staticLoadingPager !== "true") return;
      const previouslyHidden = pager.dataset.staticLoadingPreviousHidden === "true";
      const previousDisplay = pager.dataset.staticLoadingPreviousDisplay || "";
      const previousDisplayPriority = pager.dataset.staticLoadingPreviousDisplayPriority || "";
      delete pager.dataset.staticLoadingPager;
      delete pager.dataset.staticLoadingPreviousHidden;
      delete pager.dataset.staticLoadingPreviousDisplay;
      delete pager.dataset.staticLoadingPreviousDisplayPriority;
      pager.hidden = previouslyHidden;
      if (previousDisplay) {
        pager.style.setProperty("display", previousDisplay, previousDisplayPriority);
      } else {
        pager.style.removeProperty("display");
      }
    });

    pagerObservedDataLoading = false;
  }

  function sync() {
    frame = 0;
    if (destroyed) return;
    if (!tableContextActive()) {
      releaseInactiveTableLoading();
      return;
    }
    const route = activePrimeRoute();
    if (route) syncSharedViewButtonPage(route.pageName);
    const { body, empty } = tableElements();
    if (!body) return;

    if (!dataLoadingActive() && pagerObservedDataLoading && releasePagerWhenReady()) return;

    const rows = Array.from(body.rows);
    const blankRowsOnly = rows.length > 0 && rows.every((row) => row.classList.contains(BLANK_ROW_CLASS));
    const loadingOwned = body.dataset.staticLoading === "true";
    const loadingSurfaceNeedsRepair = body.rows.length === 0
      || blankRowsOnly
      || Boolean(empty && !empty.hidden);

    if ((dataLoadingActive() || loadingOwned) && loadingSurfaceNeedsRepair) {
      if (route) primeHeader(route.pageName, route.view);
      show();
      return;
    }
    releasePagerWhenReady();
  }

  function schedule() {
    if (!frame && !destroyed) frame = requestAnimationFrame(sync);
  }

  function installCoreBridge() {
    // legacy-core delegates to this runtime directly. Rewriting the
    // same global function again can create competing wrapper chains.
    sync();
  }

  // Observe only state changes that can start/end table loading.
  // Never observe the table DOM itself: show() mutates that DOM, so a
  // subtree observer can repeatedly trigger sync() -> show() forever.
  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  if (document.body) {
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-page"],
    });
  }
  window.addEventListener("mfl:ready", installCoreBridge);

  const initialRoute = routeFromPath();
  if (initialRoute) primeRoute(initialRoute);

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    observer?.disconnect();
    window.removeEventListener("mfl:ready", installCoreBridge);
    document.querySelectorAll(`#tableBody > .${BLANK_ROW_CLASS}`).forEach((row) => row.remove());
    style.remove();
  }

  window.__mflTableLoadingRuntime = Object.freeze({
    version: VERSION,
    show,
    sync,
    primeHeader,
    primeRoute,
    syncSharedViewButtonPage,
    installCoreBridge,
    destroy,
  });
  sync();
})();
