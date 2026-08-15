(() => {
  "use strict";

  const TABLE_VIEW_CONFIG = window.__mflTableViewConfig || Object.freeze({});
  const TABLE_PAGES = new Set(Object.keys(TABLE_VIEW_CONFIG));
  const FILTER_STORAGE_KEY = "mfl-table-filters-v1";
  const PAGE_SIZE_ESCAPE_CLASS = "mflPageSizeEscapeSuppressed";
  const STYLE_ID = "mflPageSizeLoadingRuntimeStyles";
  const VIEW_BY_SLUG = Object.freeze({
    attributes: "attributes",
    squad: "attributes",
    stats: "stats",
    contracts: "contracts",
    "next-overall": "next",
    "current-season": "current",
    "all-time": "all",
  });
  const DEFAULT_VIEW = Object.freeze(Object.fromEntries(
    Object.entries(TABLE_VIEW_CONFIG).map(([pageName, config]) => [
      pageName,
      String(config?.fallback || "attributes"),
    ]),
  ));
  const ALLOWED_VIEWS = Object.freeze(Object.fromEntries(
    Object.entries(TABLE_VIEW_CONFIG).map(([pageName, config]) => [
      pageName,
      new Set(Array.isArray(config?.order) ? config.order : []),
    ]),
  ));
  const ENTITY_VIEW_ORDER = Object.freeze({
    agents: Object.freeze([...(TABLE_VIEW_CONFIG.agents?.order || [])]),
    club: Object.freeze([...(TABLE_VIEW_CONFIG.club?.order || [])]),
  });
  const ENTITY_VIEW_LABELS = Object.freeze({
    agents: Object.freeze({
      attributes: "Attributes",
      contracts: "Contracts",
      next: "Next Overall",
      current: "Current Season",
      all: "All Time",
    }),
    club: Object.freeze({
      attributes: "Squad",
      contracts: "Contracts",
      current: "Current Season",
      all: "All Time",
    }),
  });
  const previous = window.__mflTableNavigationChromeRuntime;
  previous?.destroy?.();

  let pendingPage = "";
  let pendingView = "";
  let repairFrame = 0;
  let entityButtonRepairFrame = 0;
  let pageSizeEscapeFrame = 0;
  let pageSizeEscapeTimer = 0;
  let pageSizeEscapeSelect = null;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #sidebar .navButton.active {
      pointer-events: none;
      cursor: default;
    }

    html.mflInteractionBusy #pageSizeSelect,
    html.mflInteractionBusy #pageSizeSelect:hover,
    html.mflInteractionBusy #pageSizeSelect:focus,
    html.mflInteractionBusy #pageSizeSelect:focus-visible,
    html[data-interaction-busy="true"] #pageSizeSelect,
    html[data-interaction-busy="true"] #pageSizeSelect:hover,
    html[data-interaction-busy="true"] #pageSizeSelect:focus,
    html[data-interaction-busy="true"] #pageSizeSelect:focus-visible,
    html.mflDataLoading #pageSizeSelect,
    html.mflDataLoading #pageSizeSelect:hover,
    html.mflDataLoading #pageSizeSelect:focus,
    html.mflDataLoading #pageSizeSelect:focus-visible,
    body.loading #pageSizeSelect,
    body.loading #pageSizeSelect:hover,
    body.loading #pageSizeSelect:focus,
    body.loading #pageSizeSelect:focus-visible,
    body[aria-busy="true"] #pageSizeSelect,
    body[aria-busy="true"] #pageSizeSelect:hover,
    body[aria-busy="true"] #pageSizeSelect:focus,
    body[aria-busy="true"] #pageSizeSelect:focus-visible {
      outline: none !important;
      border-color: var(--border-strong) !important;
      background: var(--surface) !important;
      color: var(--text) !important;
      box-shadow: none !important;
      transform: none !important;
      transition: none !important;
      animation: none !important;
      pointer-events: none !important;
      cursor: default !important;
    }
  `;
  document.head.appendChild(style);

  function normalizePage(value) {
    const page = String(value || "").toLowerCase();
    if (page === "my-players") return "myplayers";
    return page;
  }

  function navFromTarget(target) {
    if (!(target instanceof Element)) return null;
    const nav = target.closest("#sidebar .navButton[data-page]");
    return nav instanceof HTMLAnchorElement ? nav : null;
  }

  function tablePageFromTarget(target) {
    const nav = navFromTarget(target);
    if (!nav) return "";
    const page = normalizePage(nav.dataset.page);
    return TABLE_PAGES.has(page) ? page : "";
  }

  function normalizeDestinationView(page, view) {
    const normalized = String(view || "").toLowerCase();
    return ALLOWED_VIEWS[page]?.has(normalized) ? normalized : DEFAULT_VIEW[page] || "attributes";
  }

  function entityRouteFromPath(pathname = window.location.pathname) {
    const path = String(pathname || "").replace(/\/+$/, "") || "/";
    const agentMatch = path.match(/^\/agents\/[^/]+(?:\/([^/]+))?$/i);
    if (agentMatch) {
      const view = normalizeDestinationView("agents", VIEW_BY_SLUG[String(agentMatch[1] || "attributes").toLowerCase()]);
      return { page: "agents", view };
    }

    const clubMatch = path.match(/^\/(?:clubs|club)\/[^/]+(?:\/([^/]+))?$/i);
    if (clubMatch) {
      const slug = String(clubMatch[1] || "squad").toLowerCase();
      const view = normalizeDestinationView("club", VIEW_BY_SLUG[slug]);
      return { page: "club", view };
    }
    return null;
  }

  function entityDestinationFromTarget(target) {
    if (!(target instanceof Element)) return null;

    const link = target.closest("a[href]");
    if (link instanceof HTMLAnchorElement) {
      try {
        const url = new URL(link.href, window.location.origin);
        if (url.origin === window.location.origin) {
          const route = entityRouteFromPath(url.pathname);
          if (route) return route;
        }
      } catch {
        // Fall through to button-backed search results.
      }
    }

    if (target.closest(".clubSearchResult[data-club-id]")) {
      return { page: "club", view: "attributes" };
    }

    if (target.closest('[data-search-key^="agent:"], .agentSearchResult[data-wallet-address], .agentSearchResult[data-agent-address]')) {
      return { page: "agents", view: "attributes" };
    }

    return null;
  }

  function syncEntityViewButtons(route) {
    if (!route || !ENTITY_VIEW_ORDER[route.page]) return;
    const views = document.querySelector("#progressionPage .views");
    if (!(views instanceof HTMLElement)) return;

    const order = ENTITY_VIEW_ORDER[route.page];
    const labels = ENTITY_VIEW_LABELS[route.page];
    const allowed = new Set(order);
    const switcher = document.getElementById("watchlistSwitcher");

    views.querySelectorAll(":scope > .viewButton[data-view]").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const view = String(button.dataset.view || "");
      const visible = allowed.has(view);
      if (button.hidden === visible) button.hidden = !visible;
      if (visible && button.dataset.page !== route.page) button.dataset.page = route.page;
      const expectedLabel = labels[view];
      if (expectedLabel && button.textContent !== expectedLabel) button.textContent = expectedLabel;
      const active = visible && view === route.view;
      if (button.classList.contains("active") !== active) button.classList.toggle("active", active);
      if (button.getAttribute("aria-pressed") !== String(active)) {
        button.setAttribute("aria-pressed", String(active));
      }
    });

    order.forEach((viewName) => {
      const button = views.querySelector(`:scope > .viewButton[data-view="${viewName}"]`);
      if (button) views.insertBefore(button, switcher || null);
    });
    if (switcher instanceof HTMLElement) switcher.hidden = true;
  }

  function revealEntityDestination(route) {
    if (!route) return;
    const progressionPage = document.getElementById("progressionPage");
    if (progressionPage instanceof HTMLElement) {
      document.querySelectorAll("main > .pageView").forEach((candidate) => {
        if (candidate instanceof HTMLElement) candidate.hidden = candidate !== progressionPage;
      });
      progressionPage.hidden = false;
    }
    if (document.body && document.body.dataset.page !== route.page) {
      document.body.dataset.page = route.page;
    }
    syncEntityViewButtons(route);
    window.__mflTableLoadingRuntime?.syncSharedViewButtonPage?.(route.page);
    window.__mflTableLoadingRuntime?.primeHeader?.(route.page, route.view);
  }

  function repairEntityButtons(fallback = null) {
    const route = entityRouteFromPath() || fallback;
    if (route) syncEntityViewButtons(route);
  }

  function scheduleEntityButtonRepair(fallback = null) {
    queueMicrotask(() => repairEntityButtons(fallback));
    if (entityButtonRepairFrame) cancelAnimationFrame(entityButtonRepairFrame);
    entityButtonRepairFrame = requestAnimationFrame(() => {
      entityButtonRepairFrame = 0;
      repairEntityButtons(fallback);
    });
  }

  function cachedPageState(page) {
    try {
      const saved = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || "null");
      const state = saved?.pages?.[page];
      return state && typeof state === "object" ? state : null;
    } catch {
      return null;
    }
  }

  function viewFromNav(nav, page) {
    if (!(nav instanceof HTMLAnchorElement)) return normalizeDestinationView(page, cachedPageState(page)?.view);
    let routeView = "";
    try {
      const path = new URL(nav.href, window.location.origin).pathname;
      const slug = String(path.split("/").filter(Boolean).at(-1) || "").toLowerCase();
      routeView = VIEW_BY_SLUG[slug] || "";
    } catch {
      routeView = "";
    }
    return normalizeDestinationView(page, routeView || cachedPageState(page)?.view);
  }

  function activeSavedFilterCount(page) {
    const rules = cachedPageState(page)?.rules;
    if (!Array.isArray(rules)) return 0;
    return rules.filter((rule) => {
      const operator = String(rule?.operator || "");
      const value = String(rule?.value || "").trim();
      const valueTo = String(rule?.valueTo || "").trim();
      return operator === "between" || operator === "during"
        ? Boolean(value && valueTo)
        : Boolean(value);
    }).length;
  }

  function destinationTitle(page) {
    if (page === "database") return "Database";
    if (page === "mfl") return "MFL Wallet";
    if (page === "myplayers") return "My Players";
    if (page === "progression") return "Progression";
    if (page === "watchlist") {
      const name = String(window.__mflWatchlistRouteUiRuntime?.currentName?.() || "").trim();
      return name ? `Watchlist - ${name}` : "Watchlist";
    }
    if (page === "agents") {
      const navLabel = document.querySelector('#sidebar .navButton[data-page="agents"] .navText');
      return String(navLabel?.textContent || "Agents").trim() || "Agents";
    }
    return "";
  }

  function hideOtherPageViews(activePage) {
    document.querySelectorAll("main > .pageView").forEach((page) => {
      if (!(page instanceof HTMLElement)) return;
      page.hidden = page !== activePage;
    });
  }

  function revealLockedDestination(page) {
    if (!["watchlist", "myplayers"].includes(page)) return false;
    if (document.documentElement.dataset.storedWalletOptIn === "true") return false;
    const lockedPage = document.getElementById("myPlayersLockedPage");
    if (!(lockedPage instanceof HTMLElement)) return false;
    hideOtherPageViews(lockedPage);
    const title = document.getElementById("optInLockedTitle");
    const message = document.getElementById("optInLockedMessage");
    if (title) title.textContent = page === "watchlist" ? "Watchlist" : "My Players";
    if (message) {
      message.textContent = page === "watchlist"
        ? "In order to use the watchlist, you need to opt in."
        : "In order to see your players, you need to opt in.";
    }
    return true;
  }

  function revealStatsDestination(page) {
    const statsPage = document.getElementById(page === "database" ? "databaseStatsPage" : "mflStatsPage");
    if (!(statsPage instanceof HTMLElement)) return false;
    hideOtherPageViews(statsPage);
    if (page === "mfl") window.__mflSharedTableUiRuntime?.primeMflStatsOverallFilters?.();
    if (page === "database") window.__mflDatabaseStatsStateRuntime?.sync?.();
    return true;
  }

  function revealTableDestination() {
    const progressionPage = document.getElementById("progressionPage");
    if (!(progressionPage instanceof HTMLElement)) return false;
    hideOtherPageViews(progressionPage);
    return true;
  }

  function syncDestinationStaticControls(page, view) {
    const title = document.getElementById("tablePageTitle");
    const titleText = destinationTitle(page);
    if (title instanceof HTMLElement && titleText) title.textContent = titleText;

    const newMintsLabel = document.getElementById("newMintsLabel");
    if (newMintsLabel instanceof HTMLElement) {
      newMintsLabel.textContent = page === "mfl" ? "Only aged players" : "Only new mints";
    }

    const filterSummary = document.getElementById("filterSummary");
    if (filterSummary instanceof HTMLElement) {
      filterSummary.textContent = `${activeSavedFilterCount(page)} active`;
    }

    const pageState = cachedPageState(page);
    const pageSizeSelect = document.getElementById("pageSizeSelect");
    const pageSize = Number(pageState?.pageSize || 100);
    if (pageSizeSelect instanceof HTMLSelectElement
      && Array.from(pageSizeSelect.options).some((option) => Number(option.value) === pageSize)) {
      pageSizeSelect.value = String(pageSize);
    }

    const switcher = document.getElementById("watchlistSwitcher");
    if (switcher instanceof HTMLElement) switcher.hidden = page !== "watchlist";
    const watchlistCount = document.getElementById("watchlistPlayerCount");
    if (watchlistCount instanceof HTMLElement && page !== "watchlist") watchlistCount.hidden = true;

    document.querySelectorAll("#progressionPage .views .viewButton[data-view]").forEach((button) => {
      if (!(button instanceof HTMLButtonElement) || button.hidden) return;
      const active = String(button.dataset.view || "") === view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function primeDestination(page, view) {
    if (!TABLE_PAGES.has(page)) return;
    if (revealLockedDestination(page)) return;

    const statsDestination = ["database", "mfl"].includes(page) && view === "stats";
    if (statsDestination) {
      revealStatsDestination(page);
      return;
    }

    revealTableDestination();
    window.__mflSharedTableUiRuntime?.prime?.(page);
    syncDestinationStaticControls(page, view);

    // Navigation owns static first paint only. The data router owns whether a
    // route is actually loading: cached incremental payloads render directly,
    // while uncached routes call showTableBusyState() themselves. Priming just
    // the header preserves immediate static chrome without creating fake
    // loading rows for a route that is already in memory.
    window.__mflTableLoadingRuntime?.syncSharedViewButtonPage?.(page);
    window.__mflTableLoadingRuntime?.primeHeader?.(page, view);
    window.__mflFilterControlsRuntime?.sync?.();
  }

  function bodyPageForDestination(page, view) {
    if (page === "database" && view === "stats") return "databasestats";
    if (page === "mfl" && view === "stats") return "mflstats";
    return page;
  }

  function showDestinationChrome(page, nav = null) {
    const view = viewFromNav(nav, page);
    pendingPage = page;
    pendingView = view;
    const bodyPage = bodyPageForDestination(page, view);
    if (document.body && document.body.dataset.page !== bodyPage) {
      document.body.dataset.page = bodyPage;
    }
    primeDestination(page, view);
  }

  function finishDestinationChrome(page, nav = null) {
    const view = viewFromNav(nav, page);
    queueMicrotask(() => {
      if (pendingPage !== page) return;
      pendingView = view;
      primeDestination(page, view);
      if (repairFrame) cancelAnimationFrame(repairFrame);
      repairFrame = requestAnimationFrame(() => {
        repairFrame = 0;
        if (pendingPage !== page) return;
        primeDestination(page, pendingView || view);
        pendingPage = "";
        pendingView = "";
      });
    });
  }

  function pageSizeSelectFromEscape(event) {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.id === "pageSizeSelect") return target;
    const active = document.activeElement;
    return active instanceof HTMLSelectElement && active.id === "pageSizeSelect" ? active : null;
  }

  function blurPageSizeSelect(select) {
    if (!(select instanceof HTMLSelectElement) || !select.isConnected) return;
    select.classList.add(PAGE_SIZE_ESCAPE_CLASS);
    select.blur();
  }

  function clearPageSizeHighlightOnEscape(event) {
    if (event.key !== "Escape") return;
    const select = pageSizeSelectFromEscape(event);
    if (!select) return;

    pageSizeEscapeSelect = select;
    blurPageSizeSelect(select);

    if (pageSizeEscapeFrame) cancelAnimationFrame(pageSizeEscapeFrame);
    pageSizeEscapeFrame = requestAnimationFrame(() => {
      pageSizeEscapeFrame = 0;
      blurPageSizeSelect(select);
    });
  }

  function finishPageSizeEscape(event) {
    if (event.key !== "Escape") return;
    const select = pageSizeSelectFromEscape(event) || pageSizeEscapeSelect;
    if (!(select instanceof HTMLSelectElement)) return;

    blurPageSizeSelect(select);
    pageSizeEscapeSelect = null;

    if (pageSizeEscapeTimer) window.clearTimeout(pageSizeEscapeTimer);
    pageSizeEscapeTimer = window.setTimeout(() => {
      pageSizeEscapeTimer = 0;
      blurPageSizeSelect(select);
    }, 0);
  }

  function onPointerDown(event) {
    const entityDestination = entityDestinationFromTarget(event.target);
    if (entityDestination) {
      // Do not replace or hide the current page before the anchor's click event.
      // The entity router needs the original link to remain connected long enough
      // to commit the Agent/Club route.
      return;
    }

    const nav = navFromTarget(event.target);
    const page = tablePageFromTarget(event.target);
    if (page) {
      showDestinationChrome(page, nav);
      return;
    }
    if (nav) {
      pendingPage = "";
      pendingView = "";
    }
  }

  function onClick(event) {
    const entityDestination = entityDestinationFromTarget(event.target);
    if (entityDestination) {
      // This listener runs in capture phase. Let the target's real navigation
      // handler run first, then prime entity chrome only if the URL committed.
      queueMicrotask(() => {
        const committedRoute = entityRouteFromPath();
        if (!committedRoute) return;
        revealEntityDestination(committedRoute);
        scheduleEntityButtonRepair(committedRoute);
      });
      return;
    }

    const nav = navFromTarget(event.target);
    const page = tablePageFromTarget(event.target);
    if (!page) return;
    if (pendingPage !== page) showDestinationChrome(page, nav);
    finishDestinationChrome(page, nav);
  }

  function onPopState() {
    pendingPage = "";
    pendingView = "";
    if (repairFrame) cancelAnimationFrame(repairFrame);
    repairFrame = 0;
    const entityRoute = entityRouteFromPath();
    if (entityRoute) scheduleEntityButtonRepair(entityRoute);
  }

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", clearPageSizeHighlightOnEscape, true);
  document.addEventListener("keyup", finishPageSizeEscape, true);
  window.addEventListener("popstate", onPopState);
  const initialEntityRoute = entityRouteFromPath();
  if (initialEntityRoute) syncEntityViewButtons(initialEntityRoute);

  function destroy() {
    if (repairFrame) cancelAnimationFrame(repairFrame);
    repairFrame = 0;
    if (entityButtonRepairFrame) cancelAnimationFrame(entityButtonRepairFrame);
    entityButtonRepairFrame = 0;
    if (pageSizeEscapeFrame) cancelAnimationFrame(pageSizeEscapeFrame);
    pageSizeEscapeFrame = 0;
    if (pageSizeEscapeTimer) window.clearTimeout(pageSizeEscapeTimer);
    pageSizeEscapeTimer = 0;
    pageSizeEscapeSelect = null;
    pendingPage = "";
    pendingView = "";
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", clearPageSizeHighlightOnEscape, true);
    document.removeEventListener("keyup", finishPageSizeEscape, true);
    window.removeEventListener("popstate", onPopState);
    style.remove();
  }

  window.__mflTableNavigationChromeRuntime = Object.freeze({ destroy });
})();