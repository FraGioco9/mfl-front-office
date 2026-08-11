(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "1.123.33");
  const LOADING_TEXT = "Loading players...";
  const NAVIGATION_INTENT_MS = 1500;
  const VIEW_BY_SLUG = Object.freeze({
    attributes: "attributes",
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
  let navigationIntentRoute = null;
  let navigationIntentExpiresAt = 0;

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

  function tableContextActive() {
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

  function displayColumnKey(column, pageName) {
    return column === "wallet_name" && ["myplayers", "agents", "mfl"].includes(pageName)
      ? "owned_since"
      : column;
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

  function show() {
    if (!tableContextActive()) return false;
    const { head, body, empty } = tableElements();
    if (!head || !body) return false;

    const existingCell = body.querySelector(":scope > .staticTableLoadingRow > .staticTableLoadingCell");
    if (existingCell instanceof HTMLTableCellElement) {
      existingCell.colSpan = Math.max(1, head.rows[0]?.cells.length || 1);
      existingCell.textContent = LOADING_TEXT;
      body.dataset.staticLoading = "true";
      if (empty) {
        empty.hidden = true;
        empty.textContent = "";
      }
      return true;
    }

    const row = document.createElement("tr");
    const cell = document.createElement("td");
    row.className = "staticTableLoadingRow";
    cell.className = "staticTableLoadingCell";
    cell.colSpan = Math.max(1, head.rows[0]?.cells.length || 1);
    cell.textContent = LOADING_TEXT;
    row.appendChild(cell);
    body.replaceChildren(row);
    body.dataset.staticLoading = "true";
    if (empty) {
      empty.hidden = true;
      empty.textContent = "";
    }
    return true;
  }

  function primeRoute(route) {
    if (!route || !primeHeader(route.pageName, route.view)) return false;
    show();
    return true;
  }

  function routeForTarget(target) {
    if (!(target instanceof Element)) return null;
    const viewButton = target.closest(".viewButton[data-view]");
    if (viewButton instanceof HTMLElement) {
      const view = String(viewButton.dataset.view || "");
      if (view === "stats") return null;
      const pathRoute = routeFromPath();
      const explicitPage = normalizedPage(viewButton.dataset.page || "");
      const pageName = explicitPage || normalizedPage(document.body?.dataset.page || pathRoute?.pageName);
      if (!pageName || !VIEW_COLUMNS[view]) return null;
      return { pageName, view };
    }

    const nav = target.closest("#sidebar .navButton[href]");
    if (nav instanceof HTMLAnchorElement) {
      try {
        return routeFromPath(new URL(nav.href, window.location.href).pathname);
      } catch {
        return null;
      }
    }
    return null;
  }

  function activePrimeRoute() {
    if (navigationIntentRoute && performance.now() < navigationIntentExpiresAt) {
      return navigationIntentRoute;
    }
    navigationIntentRoute = null;
    navigationIntentExpiresAt = 0;
    return routeFromPath();
  }

  function sync() {
    frame = 0;
    if (destroyed || !tableContextActive()) return;
    const { body, empty } = tableElements();
    if (!body) return;

    const legacyLoadingVisible = Boolean(
      empty
      && !empty.hidden
      && String(empty.textContent || "").trim() === LOADING_TEXT,
    );
    if (legacyLoadingVisible) {
      const route = activePrimeRoute();
      if (route) primeHeader(route.pageName, route.view);
      show();
    }
  }

  function schedule() {
    if (!frame && !destroyed) frame = requestAnimationFrame(sync);
  }

  function onNavigationIntent(event) {
    const route = routeForTarget(event.target instanceof Element ? event.target : null);
    if (!route) return;
    navigationIntentRoute = route;
    navigationIntentExpiresAt = performance.now() + NAVIGATION_INTENT_MS;
    primeRoute(route);
  }

  function onPopState() {
    navigationIntentRoute = null;
    navigationIntentExpiresAt = 0;
    const route = routeFromPath();
    if (route) primeRoute(route);
    schedule();
  }

  function installLegacyBridge() {
    try {
      window.eval(`(() => {
        if (typeof showTableBusyState !== "function" || showTableBusyState.__mflSingleLoadingState) return;
        const original = showTableBusyState;
        const wrapped = function (message = "${LOADING_TEXT}") {
          if (String(message || "") === "${LOADING_TEXT}" && window.__mflTableLoadingRuntime?.show?.()) {
            return;
          }
          return original.apply(this, arguments);
        };
        wrapped.__mflSingleLoadingState = true;
        wrapped.__mflOriginal = original;
        showTableBusyState = wrapped;
      })();`);
    } catch {
      // The observer still collapses a legacy loading state before it can paint
      // if a future core stops exposing the binding used by the bridge.
    }
    sync();
  }

  observer = new MutationObserver(() => {
    // MutationObserver callbacks run before paint. Collapse the legacy empty
    // state immediately rather than waiting one animation frame and flashing a
    // second visual version of "Loading players...".
    sync();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
    attributeFilter: ["hidden", "data-page"],
  });
  window.addEventListener("pointerdown", onNavigationIntent, true);
  window.addEventListener("popstate", onPopState);
  window.addEventListener("mfl:ready", installLegacyBridge);

  const initialRoute = routeFromPath();
  if (initialRoute) primeRoute(initialRoute);

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    observer?.disconnect();
    window.removeEventListener("pointerdown", onNavigationIntent, true);
    window.removeEventListener("popstate", onPopState);
    window.removeEventListener("mfl:ready", installLegacyBridge);
  }

  window.__mflTableLoadingRuntime = Object.freeze({
    version: VERSION,
    show,
    sync,
    primeHeader,
    primeRoute,
    installLegacyBridge,
    destroy,
  });
  sync();
})();
