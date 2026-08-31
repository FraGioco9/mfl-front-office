(() => {
  "use strict";

  const STATIC_RELEASE_VERSION = "1.127.7";
  const FILTER_STORAGE_KEY = "mfl-table-filters-v1";
  const LINKED_WALLET_STORAGE_KEY = "mfl-linked-wallet-v1";
  const LINKED_WALLET_DISPLAY_NAME_STORAGE_KEY = "mfl-linked-wallet-display-name-v1";
  const AGENT_DISPLAY_NAMES_STORAGE_KEY = "mfl-agent-display-names-v1";
  const CLUB_DISPLAY_DATA_STORAGE_KEY = "mfl-club-display-data-v1";
  const WALLET_WATCHLIST_STORAGE_PREFIX = "mfl-wallet-watchlist-v1:";
  const EVALUATION_FIRST_PAINT_NAME_STORAGE_PREFIX = "mfl-evaluation-first-paint-name-v2:";
  const EVALUATION_LEGACY_FIRST_PAINT_NAME_STORAGE_PREFIX = "mfl-evaluation-first-paint-name-v1:";
  const LOADING_VALUE_TEXT = "-";
  const BLANK_TABLE_LOADING_TEXT = "\u00a0";
  const FIRST_PAINT_HORIZONTAL_MEDIA = window.matchMedia("(max-width: 900px)");
  const FIRST_PAINT_PHONE_TABLE_MEDIA = window.matchMedia("(max-width: 520px)");
  const FIRST_PAINT_OVERFLOW_CLASS = "mflViewsOverflowing";
  const FIRST_PAINT_PLAYER_TABLE_FADE_LEFT_CLASS = "mflPlayerTableCanScrollLeft";
  const FIRST_PAINT_PLAYER_TABLE_FADE_RIGHT_CLASS = "mflPlayerTableCanScrollRight";
  const FIRST_PAINT_OVERFLOW_EPSILON = 2;
  const APP_CONFIG = Reflect.get(window, "__mflAppConfig");
  if (!APP_CONFIG?.routes || !APP_CONFIG?.table || !APP_CONFIG?.ui) {
    throw new Error("Bootstrap requires canonical pre-bootstrap app configuration.");
  }
  const TABLE_VIEW_BY_SLUG = APP_CONFIG.routes.viewBySlug;
  const TABLE_VIEW_SLUGS = new Set(Object.keys(TABLE_VIEW_BY_SLUG));
  const FIRST_PAINT_BASE_COLUMNS = APP_CONFIG.table.baseColumns;
  const FIRST_PAINT_STAT_COLUMNS = APP_CONFIG.table.statColumns;
  const FIRST_PAINT_CONTRACT_COLUMNS = APP_CONFIG.table.contractColumns;
  const FIRST_PAINT_AGENT_PAGES = new Set(APP_CONFIG.table.joinedAgencyPages);
  const FIRST_PAINT_SORTABLE_COLUMNS = new Set(APP_CONFIG.table.sortableColumns);
  const FIRST_PAINT_COLUMN_CLASSES = APP_CONFIG.table.columnClasses;
  const FIRST_PAINT_COLUMN_LABELS = APP_CONFIG.table.columnLabels;
  const FIRST_PAINT_COMPACT_COLUMN_LABELS = Object.freeze({
    age: "AGE",
    positions: "POS",
    player_seasons: "SZN",
    overall: "OVR",
    pace: "PAC",
    shooting: "SHO",
    passing: "PAS",
    dribbling: "DRI",
    defense: "DEF",
    physical: "PHY",
    goalkeeping: "GK",
    wallet_name: "AGT",
    owned_since: "JOIN",
    active_contract_revenue_share: "REV",
    active_contract_club_name: "CLUB",
    active_contract_club_division: "DIV",
  });
  const MFL_STATS_FILTER_LABELS = Object.freeze(
    APP_CONFIG.ui.mflStatsOverallFilters.map(({ id, label }) => Object.freeze([id, label])),
  );
  const SETTINGS_DATE_FORMAT_LABELS = Object.freeze(
    APP_CONFIG.ui.settingsDateFormats.map(({ value, label }) => Object.freeze([value, label])),
  );
  const SETTINGS_TIME_FORMAT_LABELS = Object.freeze(
    APP_CONFIG.ui.settingsTimeFormats.map(({ value, label }) => Object.freeze([value, label])),
  );
  const root = document.documentElement;
  window.__mflReleaseVersion = STATIC_RELEASE_VERSION;

  function setLoadingValue(target) {
    const element = typeof target === "string" ? document.getElementById(target) : target;
    if (element instanceof HTMLElement) element.textContent = LOADING_VALUE_TEXT;
    return element;
  }

  Reflect.set(window, "__mflLoadingValueText", LOADING_VALUE_TEXT);
  Reflect.set(window, "__mflSetLoadingValue", setLoadingValue);

  root.classList.add("mflSingleRenderPending");
  root.classList.remove("mflInitialRouteResolved");

  function tableViewConfig() {
    return APP_CONFIG.routes.tableViews;
  }

  function routeParts(urlLike = window.location.href) {
    try {
      return new URL(String(urlLike || window.location.href), window.location.href).pathname.split("/").filter(Boolean);
    } catch {
      return window.location.pathname.split("/").filter(Boolean);
    }
  }

  function normalizeWalletAddress(value) {
    const address = String(value || "").trim().toLowerCase();
    return address ? (address.startsWith("0x") ? address : `0x${address}`) : "";
  }

  function decodedRoutePart(value) {
    try {
      return decodeURIComponent(String(value || ""));
    } catch {
      return String(value || "");
    }
  }

  function tableViewFromUrl(page, urlLike = window.location.href) {
    const normalizedPage = String(page || "").toLowerCase();
    const config = tableViewConfig()[normalizedPage];
    if (!config || !Array.isArray(config.order)) return "";

    const parts = routeParts(urlLike);
    const routeSlug = decodedRoutePart(parts[parts.length - 1]).toLowerCase();
    const routeView = TABLE_VIEW_BY_SLUG[routeSlug] || "";
    return config.order.includes(routeView) ? routeView : "";
  }

  function firstPaintWatchlistIdentity(urlLike = window.location.href) {
    const parts = routeParts(urlLike);
    if (String(parts[0] || "").toLowerCase() !== "watchlist") {
      return { id: "", name: "Default" };
    }

    const firstSegment = decodedRoutePart(parts[1]);
    const routeWatchlistId = firstSegment && !TABLE_VIEW_SLUGS.has(firstSegment.toLowerCase())
      ? firstSegment
      : "";

    try {
      const wallet = normalizeWalletAddress(localStorage.getItem(LINKED_WALLET_STORAGE_KEY));
      const stored = wallet
        ? JSON.parse(localStorage.getItem(`${WALLET_WATCHLIST_STORAGE_PREFIX}${wallet}`) || "[]")
        : [];
      const watchlists = Array.isArray(stored) ? stored : [];
      const selected = (routeWatchlistId
        ? watchlists.find((watchlist) => String(watchlist?.id || "") === routeWatchlistId)
        : null) || watchlists[0] || null;
      const name = String(selected?.name || "").trim();
      return {
        id: String(selected?.id || routeWatchlistId || ""),
        name: name || "Default",
      };
    } catch {
      return { id: routeWatchlistId, name: "Default" };
    }
  }

  function firstPaintClubIdentity(urlLike = window.location.href) {
    const parts = routeParts(urlLike);
    const routeRoot = String(parts[0] || "").toLowerCase();
    const clubId = ["club", "clubs"].includes(routeRoot) ? decodedRoutePart(parts[1]).trim() : "";
    if (!clubId) {
      return { clubId: "", name: "Club", divisionName: "", divisionColor: "" };
    }

    try {
      const stored = JSON.parse(localStorage.getItem(CLUB_DISPLAY_DATA_STORAGE_KEY) || "{}");
      const identity = stored && typeof stored === "object" && !Array.isArray(stored)
        ? stored[clubId]
        : null;
      const name = String(identity?.name || "").trim();
      const divisionName = String(identity?.divisionName || "").trim();
      const divisionColor = String(identity?.divisionColor || "").trim();
      return {
        clubId,
        name: name || `Club ${clubId}`,
        divisionName,
        divisionColor,
      };
    } catch {
      return { clubId, name: `Club ${clubId}`, divisionName: "", divisionColor: "" };
    }
  }

  function firstPaintEvaluationRouteState(urlLike = window.location.href) {
    try {
      const route = new URL(String(urlLike || window.location.href), window.location.href);
      const playerId = String(route.searchParams.get("player") || "").trim();
      const savedId = String(route.searchParams.get("saved") || "").trim();
      const shareId = String(route.searchParams.get("share") || "").trim();
      const evaluationRoute = route.pathname === "/evaluation";
      return {
        evaluationRoute,
        plain: evaluationRoute && !playerId && !savedId && !shareId,
        playerId,
        savedId,
        shareId,
        routeKey: `${route.pathname}${route.search}`,
      };
    } catch {
      return {
        evaluationRoute: false,
        plain: false,
        playerId: "",
        savedId: "",
        shareId: "",
        routeKey: "",
      };
    }
  }

  function firstPaintEvaluationPlayerName(urlLike = window.location.href) {
    const routeState = firstPaintEvaluationRouteState(urlLike);
    if (!routeState.evaluationRoute || routeState.plain) return "";

    try {
      const identities = [
        ["saved", routeState.savedId],
        ["share", routeState.shareId],
        ["player", routeState.playerId],
      ];
      for (const [kind, id] of identities) {
        if (!id) continue;
        const cachedName = String(sessionStorage.getItem(`${EVALUATION_FIRST_PAINT_NAME_STORAGE_PREFIX}${kind}:${id}`) || "").trim();
        if (cachedName) return cachedName;
      }
      return String(sessionStorage.getItem(`${EVALUATION_LEGACY_FIRST_PAINT_NAME_STORAGE_PREFIX}${routeState.routeKey}`) || "").trim();
    } catch {
      return "";
    }
  }

  function initialShellTarget() {
    const initialPage = String(root.dataset.initialPage || "home").toLowerCase();
    const tablePage = String(root.dataset.initialTablePage || "").toLowerCase();
    const tableView = String(root.dataset.initialTableView || "").toLowerCase();
    const storedOptIn = root.dataset.storedWalletOptIn === "true";

    if (!storedOptIn && (["watchlist", "myplayers"].includes(tablePage) || initialPage === "settings")) {
      return document.getElementById("myPlayersLockedPage");
    }
    if (tablePage === "database" && tableView === "stats") return document.getElementById("databaseStatsPage");
    if (tablePage === "mfl" && tableView === "stats") return document.getElementById("mflStatsPage");
    if (tablePage) return document.getElementById("progressionPage");
    if (initialPage === "evaluation") return document.getElementById("evaluationPage");
    if (initialPage.startsWith("players/")) return document.getElementById("playerPage");
    if (initialPage === "settings") return document.getElementById("settingsPage");
    if (initialPage === "changelog") return document.getElementById("changelogPage");
    return document.getElementById("homePage");
  }

  function storedTablePageState(page) {
    try {
      const saved = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || "null");
      const pages = saved?.pages && typeof saved.pages === "object" && !Array.isArray(saved.pages)
        ? saved.pages
        : null;
      const pageState = pages?.[page];
      return pageState && typeof pageState === "object" && !Array.isArray(pageState) ? pageState : null;
    } catch {
      return null;
    }
  }

  function firstPaintTableTitle(page, urlLike = window.location.href) {
    if (page === "database") return "Database";
    if (page === "mfl") return "MFL Wallet";
    if (page === "progression") return "Progression";
    if (page === "myplayers") return "My Players";
    if (page === "watchlist") return `Watchlist - ${firstPaintWatchlistIdentity(urlLike).name}`;
    const parts = routeParts(urlLike);
    if (page === "agents") {
      const wallet = String(parts[1] || "").trim();
      try {
        const decodedWallet = wallet ? decodeURIComponent(wallet) : "";
        if (!decodedWallet) return "Agents";
        const normalizedWallet = normalizeWalletAddress(decodedWallet).toLowerCase();
        const agentName = firstPaintAgentNameForWallet(normalizedWallet);
        return agentName ? `${agentName} - ${normalizedWallet}` : normalizedWallet;
      } catch {
        const normalizedWallet = normalizeWalletAddress(wallet).toLowerCase();
        if (!normalizedWallet) return "Agents";
        const agentName = firstPaintAgentNameForWallet(normalizedWallet);
        return agentName ? `${agentName} - ${normalizedWallet}` : normalizedWallet;
      }
    }
    if (page === "club") {
      const identity = firstPaintClubIdentity(urlLike);
      return identity.divisionName ? `${identity.name} - ${identity.divisionName}` : identity.name;
    }
    return "Progression";
  }

  function firstPaintAgentNameForWallet(normalizedWallet) {
    if (!normalizedWallet) return "";
    try {
      const linkedWallet = normalizeWalletAddress(localStorage.getItem(LINKED_WALLET_STORAGE_KEY)).toLowerCase();
      const linkedDisplay = JSON.parse(localStorage.getItem(LINKED_WALLET_DISPLAY_NAME_STORAGE_KEY) || "null");
      if (linkedWallet === normalizedWallet && normalizeWalletAddress(linkedDisplay?.address).toLowerCase() === normalizedWallet) {
        const linkedName = String(linkedDisplay?.name || "").trim();
        if (linkedName) return linkedName;
      }
      const agentNames = JSON.parse(localStorage.getItem(AGENT_DISPLAY_NAMES_STORAGE_KEY) || "{}");
      const storedName = agentNames && typeof agentNames === "object" ? String(agentNames[normalizedWallet] || "").trim() : "";
      return storedName;
    } catch {
      return "";
    }
  }

  function primeViewButtons(page, view) {
    const config = tableViewConfig()[page];
    if (!config || !Array.isArray(config.order)) return;
    const container = document.querySelector("#progressionPage .views");
    if (!(container instanceof HTMLElement)) return;
    if (page === "club") document.getElementById("mflInitialTableViewFirstPaint")?.remove();

    const buttons = new Map();
    container.querySelectorAll(":scope > .viewButton[data-view]").forEach((candidate) => {
      if (!(candidate instanceof HTMLElement)) return;
      const buttonView = String(candidate.dataset.view || "");
      buttons.set(buttonView, candidate);
      candidate.hidden = !config.order.includes(buttonView);
      if (buttonView === "attributes" && candidate instanceof HTMLButtonElement) {
        candidate.textContent = page === "club" ? "Squad" : "Attributes";
      }
    });

    const switcher = document.getElementById("watchlistSwitcher");
    const insertionAnchor = switcher instanceof HTMLElement && switcher.parentElement === container
      ? switcher
      : null;
    config.order.forEach((buttonView) => {
      const button = buttons.get(buttonView);
      if (!(button instanceof HTMLElement)) return;
      button.hidden = false;
      container.insertBefore(button, insertionAnchor);
    });

    const activeView = config.order.includes(view)
      ? view
      : String(config.fallback || config.order[0] || "");
    container.querySelectorAll(":scope > .viewButton[data-view]").forEach((candidate) => {
      if (!(candidate instanceof HTMLElement)) return;
      candidate.classList.toggle("active", String(candidate.dataset.view || "") === activeView);
    });
  }

  function primeTableChrome(page, urlLike = window.location.href, options = {}) {
    const normalizedPage = String(page || "").toLowerCase();
    if (!normalizedPage) return "";

    const config = tableViewConfig()[normalizedPage];
    const requestedView = tableViewFromUrl(normalizedPage, urlLike);
    const view = config?.order?.includes(requestedView) ? requestedView : String(config?.fallback || requestedView || "");
    primeViewButtons(normalizedPage, view);

    if (normalizedPage === "watchlist") {
      const identity = firstPaintWatchlistIdentity(urlLike);
      const watchlistButtonText = document.getElementById("watchlistButtonText");
      if (watchlistButtonText instanceof HTMLElement) watchlistButtonText.textContent = identity.name;
    }

    const title = document.getElementById("tablePageTitle");
    if (title instanceof HTMLElement) {
      if (normalizedPage === "club") {
        const identity = firstPaintClubIdentity(urlLike);
        if (identity.divisionName) {
          const divisionLabel = document.createElement("span");
          divisionLabel.className = "clubPageTitleDivision";
          if (identity.divisionColor) divisionLabel.style.color = identity.divisionColor;
          divisionLabel.textContent = identity.divisionName;
          title.replaceChildren(document.createTextNode(`${identity.name} - `), divisionLabel);
        } else {
          title.textContent = identity.name;
        }
      } else {
        title.textContent = firstPaintTableTitle(normalizedPage, urlLike);
      }
    }

    const clubPage = normalizedPage === "club";
    const resetFilters = Boolean(options.resetFilters);
    const savedState = resetFilters ? {} : storedTablePageState(normalizedPage) || {};
    const quickFilters = document.querySelector("#progressionPage .quickFilters");
    if (quickFilters instanceof HTMLElement) quickFilters.hidden = clubPage;

    const hideRetiredInput = document.getElementById("hideRetiredInput");
    if (hideRetiredInput instanceof HTMLInputElement) hideRetiredInput.checked = clubPage ? false : savedState.hideRetired !== false;

    const hideRetiringInput = document.getElementById("hideRetiringInput");
    if (hideRetiringInput instanceof HTMLInputElement) hideRetiringInput.checked = clubPage ? false : Boolean(savedState.hideRetiring);

    const hideMflPlayersFilter = document.getElementById("hideMflPlayersFilter");
    if (hideMflPlayersFilter instanceof HTMLElement) hideMflPlayersFilter.hidden = normalizedPage !== "database";
    const hideMflPlayersInput = document.getElementById("hideMflPlayersInput");
    if (hideMflPlayersInput instanceof HTMLInputElement) {
      hideMflPlayersInput.checked = normalizedPage === "database"
        ? (savedState.hideMflPlayers !== undefined ? Boolean(savedState.hideMflPlayers) : true)
        : false;
    }

    const packablePlayersFilter = document.getElementById("packablePlayersFilter");
    if (packablePlayersFilter instanceof HTMLElement) packablePlayersFilter.hidden = normalizedPage !== "mfl";
    const packablePlayersInput = document.getElementById("packablePlayersInput");
    if (packablePlayersInput instanceof HTMLInputElement) {
      packablePlayersInput.checked = normalizedPage === "mfl"
        ? (savedState.mflPackable !== undefined ? Boolean(savedState.mflPackable) : true)
        : false;
    }

    const newMintsInput = document.getElementById("newMintsInput");
    if (newMintsInput instanceof HTMLInputElement) newMintsInput.checked = clubPage ? false : Boolean(savedState.newMints);
    const newMintsLabel = document.getElementById("newMintsLabel");
    if (newMintsLabel instanceof HTMLElement) {
      newMintsLabel.textContent = normalizedPage === "mfl" ? "Only aged players" : "Only new mints";
    }

    if (resetFilters) {
      const filterRules = document.getElementById("filterRules");
      if (filterRules instanceof HTMLElement) filterRules.replaceChildren();
      const filterSummary = document.getElementById("filterSummary");
      if (filterSummary instanceof HTMLElement) filterSummary.textContent = "0";
    }

    const pager = document.querySelector("#progressionPage nav.pager");
    if (pager instanceof HTMLElement) pager.hidden = true;
    const watchlistCount = document.getElementById("watchlistPlayerCount");
    if (watchlistCount instanceof HTMLElement) watchlistCount.hidden = true;
    return view;
  }

  Reflect.set(window, "__mflPrimeTableChrome", primeTableChrome);
  Reflect.set(window, "__mflTableTitleForPageFallback", firstPaintTableTitle);

  function firstPaintHorizontalItems(scroller) {
    const selector = scroller.matches("#progressionPage .views")
      ? ":scope > #openFiltersButton, :scope > .viewControlsSeparator, :scope > .viewButton"
      : ":scope > label";
    return Array.from(scroller.querySelectorAll(selector)).filter((candidate) => {
      if (!(candidate instanceof HTMLElement) || candidate.hidden) return false;
      const style = getComputedStyle(candidate);
      return style.display !== "none" && style.position !== "absolute" && candidate.getClientRects().length > 0;
    });
  }

  function firstPaintHorizontalContentWidth(scroller) {
    const items = firstPaintHorizontalItems(scroller);
    if (!items.length) return 0;
    const scrollerStyle = getComputedStyle(scroller);
    const gap = Number.parseFloat(scrollerStyle.columnGap || scrollerStyle.gap) || 0;
    const itemsWidth = items.reduce((total, item) => {
      const style = getComputedStyle(item);
      const marginLeft = Number.parseFloat(style.marginLeft) || 0;
      const marginRight = Number.parseFloat(style.marginRight) || 0;
      return total + item.getBoundingClientRect().width + marginLeft + marginRight;
    }, 0);
    return itemsWidth + gap * Math.max(0, items.length - 1);
  }

  function firstPaintHorizontalShell(scroller) {
    const parent = scroller.parentElement;
    if (parent instanceof HTMLElement && parent.classList.contains("viewsScrollerShell")) return parent;

    const shell = document.createElement("div");
    shell.className = "viewsScrollerShell";
    if (scroller.matches("#progressionPage .quickFilters")) shell.classList.add("quickFiltersScrollerShell");
    scroller.insertAdjacentElement("beforebegin", shell);
    shell.appendChild(scroller);

    if (scroller.matches("#progressionPage .quickFilters")) {
      const count = document.getElementById("watchlistPlayerCount");
      if (count instanceof HTMLElement && count.parentElement === scroller) shell.insertAdjacentElement("afterend", count);
    }
    return shell;
  }

  function syncFirstPaintRightScrollButton(shell, scroller, overflowing) {
    let button = shell.querySelector(":scope > .viewsScrollButton.viewsScrollButtonRight");
    if (!overflowing) {
      if (button instanceof HTMLButtonElement && button.dataset.mflFirstPaintScrollButton === "true") button.remove();
      return;
    }

    if (!(button instanceof HTMLButtonElement)) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "viewsScrollButton viewsScrollButtonRight";
      button.dataset.mflFirstPaintScrollButton = "true";
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>';
      button.addEventListener("click", () => {
        const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
        const distance = Math.max(96, Math.floor(scroller.clientWidth * 0.72));
        const target = Math.min(maxScroll, scroller.scrollLeft + distance);
        scroller.scrollTo({ left: target, behavior: "smooth" });
      });
      shell.appendChild(button);
    }

    const label = scroller.matches("#progressionPage .quickFilters") ? "quick filters" : "views";
    button.setAttribute("aria-label", `Scroll ${label} right`);
    button.setAttribute("aria-hidden", "false");
    button.tabIndex = 0;
    button.classList.add("mflViewsScrollButtonVisible");
  }

  function primeFirstPaintHorizontalOverflow() {
    const scrollers = [
      document.querySelector("#progressionPage .views"),
      document.querySelector("#progressionPage .quickFilters"),
    ];
    scrollers.forEach((scroller) => {
      if (!(scroller instanceof HTMLElement)) return;
      const canRender = FIRST_PAINT_HORIZONTAL_MEDIA.matches
        && !scroller.hidden
        && scroller.getClientRects().length > 0;
      if (!canRender) {
        scroller.classList.remove(FIRST_PAINT_OVERFLOW_CLASS);
        return;
      }

      const shell = firstPaintHorizontalShell(scroller);
      const nativeOverflowing = scroller.scrollWidth - scroller.clientWidth > FIRST_PAINT_OVERFLOW_EPSILON;
      const controlsOverflowing = firstPaintHorizontalContentWidth(scroller) - scroller.clientWidth > FIRST_PAINT_OVERFLOW_EPSILON;
      const overflowing = FIRST_PAINT_HORIZONTAL_MEDIA.matches
        && !scroller.hidden
        && scroller.getClientRects().length > 0
        && nativeOverflowing
        && controlsOverflowing;
      scroller.classList.toggle(FIRST_PAINT_OVERFLOW_CLASS, overflowing);
      syncFirstPaintRightScrollButton(shell, scroller, overflowing);
    });
  }

  function primeFirstPaintPlayerTableFade() {
    const scroller = document.querySelector("#progressionPage .playerTableScroller");
    const shell = scroller instanceof HTMLElement ? scroller.closest("#progressionPage .tableShell") : null;
    if (!(scroller instanceof HTMLElement) || !(shell instanceof HTMLElement)) return;

    const canRender = FIRST_PAINT_HORIZONTAL_MEDIA.matches && scroller.getClientRects().length > 0;
    const maxScroll = canRender ? Math.max(0, scroller.scrollWidth - scroller.clientWidth) : 0;
    const scrollLeft = canRender ? Math.min(maxScroll, Math.max(0, scroller.scrollLeft)) : 0;
    const overflowing = maxScroll > FIRST_PAINT_OVERFLOW_EPSILON;
    shell.classList.toggle(FIRST_PAINT_PLAYER_TABLE_FADE_LEFT_CLASS, overflowing && scrollLeft > FIRST_PAINT_OVERFLOW_EPSILON);
    shell.classList.toggle(FIRST_PAINT_PLAYER_TABLE_FADE_RIGHT_CLASS, overflowing && maxScroll - scrollLeft > FIRST_PAINT_OVERFLOW_EPSILON);
  }

  function primeFirstPaintEvaluationTableFade() {
    const shell = document.querySelector("#evaluationPage .evaluationTableShell");
    if (!(shell instanceof HTMLElement)) return;
    const routeState = firstPaintEvaluationRouteState();
    const selectedEvaluation = routeState.evaluationRoute && !routeState.plain;
    const head = shell.querySelector(".evaluationTable thead");
    if (head instanceof HTMLTableSectionElement && head.getClientRects().length > 0) {
      const shellRect = shell.getBoundingClientRect();
      const headRect = head.getBoundingClientRect();
      shell.style.setProperty("--mfl-evaluation-table-body-top", `${Math.max(0, headRect.bottom - shellRect.top)}px`);
    }
    shell.classList.remove(FIRST_PAINT_PLAYER_TABLE_FADE_LEFT_CLASS);
    shell.classList.toggle(
      FIRST_PAINT_PLAYER_TABLE_FADE_RIGHT_CLASS,
      FIRST_PAINT_PHONE_TABLE_MEDIA.matches && selectedEvaluation,
    );
  }

  function firstPaintTableColumns(page, view) {
    const normalizedPage = String(page || "").toLowerCase();
    const normalizedView = String(view || "").toLowerCase();
    const viewColumns = normalizedView === "contracts" ? FIRST_PAINT_CONTRACT_COLUMNS : FIRST_PAINT_STAT_COLUMNS;
    const agentColumn = FIRST_PAINT_AGENT_PAGES.has(normalizedPage) ? "owned_since" : "wallet_name";
    return [...FIRST_PAINT_BASE_COLUMNS, ...viewColumns, agentColumn];
  }

  function firstPaintTableColumnClass(column) {
    if (column === "overall") return "col-stat col-overall";
    if (FIRST_PAINT_STAT_COLUMNS.includes(column)) return "col-stat";
    return FIRST_PAINT_COLUMN_CLASSES[column] || "";
  }

  function firstPaintTableColumnLabel(page, column) {
    const normalizedPage = String(page || "").toLowerCase();
    const fullLabel = String(FIRST_PAINT_COLUMN_LABELS[column] || "");
    const compactLabel = String(FIRST_PAINT_COMPACT_COLUMN_LABELS[column] || fullLabel);
    const agentColumn = FIRST_PAINT_AGENT_PAGES.has(normalizedPage) ? "owned_since" : "wallet_name";
    if (!FIRST_PAINT_HORIZONTAL_MEDIA.matches) {
      return column === agentColumn && normalizedPage === "mfl" ? "" : fullLabel;
    }
    if (column === "listing_price" || (column === agentColumn && normalizedPage === "mfl")) return "";
    return compactLabel;
  }

  function firstPaintTableSortState(page, view) {
  const normalizedPage = String(page || "").toLowerCase();
  void view;
  if (normalizedPage === "club") return { sortKey: "positions", sortDirection: "asc" };
  return { sortKey: "overall", sortDirection: "desc" };
}

  function firstPaintTableHeaderSignature(page, view) {
    const normalizedPage = String(page || "").toLowerCase();
    const normalizedView = String(view || "").toLowerCase();
    const columns = firstPaintTableColumns(normalizedPage, normalizedView);
    const sort = firstPaintTableSortState(normalizedPage, normalizedView);
    return [normalizedPage, normalizedView, columns.join(","), sort.sortKey, sort.sortDirection].join("|");
  }

  function neutralizeFirstPaintSelectionHeader(head) {
    const input = head.querySelector("#selectVisiblePlayersInput");
    if (!(input instanceof HTMLInputElement)) return false;
    input.checked = false;
    input.indeterminate = false;
    input.disabled = true;
    if (document.activeElement === input) input.blur();
    return true;
  }

  function primeInitialTableStructure(page, view) {
    const colGroup = document.getElementById("tableColGroup");
    const head = document.getElementById("tableHead");
    if (!(colGroup instanceof HTMLTableColElement) && !(colGroup instanceof HTMLElement)) return 0;
    if (!(head instanceof HTMLTableSectionElement)) return 0;

    const normalizedPage = String(page || "").toLowerCase();
    const normalizedView = String(view || "").toLowerCase();
    const columns = firstPaintTableColumns(normalizedPage, normalizedView);
    const sort = firstPaintTableSortState(normalizedPage, normalizedView);
    const signature = [normalizedPage, normalizedView, columns.join(","), sort.sortKey, sort.sortDirection].join("|");
    if (head.rows[0] && head.dataset.mflStaticHeader === "true" && head.dataset.mflHeaderSignature === signature) {
      neutralizeFirstPaintSelectionHeader(head);
      return head.rows[0].cells.length;
    }

    const targetClasses = ["col-select", "col-actions", ...columns.map((column) => firstPaintTableColumnClass(column))];
    const existingCols = Array.from(colGroup.children);
    const alreadyCanonical = existingCols.length === targetClasses.length
      && existingCols.every((col, index) => col.className === targetClasses[index]);
    if (!alreadyCanonical) {
      const colFragment = document.createDocumentFragment();
      targetClasses.forEach((className) => {
        const col = document.createElement("col");
        if (className) col.className = className;
        colFragment.appendChild(col);
      });
      colGroup.replaceChildren(colFragment);
    }

    const row = document.createElement("tr");
    const selectionHeader = document.createElement("th");
    selectionHeader.className = "selectionCell";
    const selectionInput = document.createElement("input");
    selectionInput.id = "selectVisiblePlayersInput";
    selectionInput.type = "checkbox";
    selectionInput.checked = false;
    selectionInput.indeterminate = false;
    selectionInput.disabled = true;
    selectionInput.setAttribute("aria-label", "Select visible players");
    selectionHeader.appendChild(selectionInput);
    row.appendChild(selectionHeader);

    const actionsHeader = document.createElement("th");
    actionsHeader.className = "rowActionsCell";
    actionsHeader.setAttribute("aria-label", "Player actions");
    row.appendChild(actionsHeader);

    columns.forEach((column) => {
      const header = document.createElement("th");
      const className = firstPaintTableColumnClass(column);
      if (className) header.classList.add(...className.split(" "));
      header.dataset.tableColumn = column;
      const label = document.createElement("span");
      const fullLabel = String(FIRST_PAINT_COLUMN_LABELS[column] || "");
      const compactLabel = String(FIRST_PAINT_COMPACT_COLUMN_LABELS[column] || fullLabel);
      label.dataset.mflFullTableLabel = fullLabel;
      label.dataset.mflCompactTableLabel = compactLabel;
      label.textContent = firstPaintTableColumnLabel(normalizedPage, column);
      header.appendChild(label);
      if (FIRST_PAINT_SORTABLE_COLUMNS.has(column)) {
        header.classList.add("sortable");
        if (sort.sortKey === column) {
          const arrow = document.createElement("span");
          arrow.className = `sortArrow ${sort.sortDirection}`;
          arrow.setAttribute("aria-hidden", "true");
          header.appendChild(arrow);
        }
      }
      row.appendChild(header);
    });

    head.replaceChildren(row);
    head.dataset.mflHeaderSignature = signature;
    head.dataset.mflStaticHeader = "true";
    return row.cells.length;
  }

  Reflect.set(window, "__mflPrimeTableHeaderSignature", firstPaintTableHeaderSignature);
  Reflect.set(window, "__mflPrimeTableStructure", primeInitialTableStructure);

  function primeInitialTableRows(replaceExisting = false) {
    const body = document.getElementById("tableBody");
    const colGroup = document.getElementById("tableColGroup");
    if (!(body instanceof HTMLTableSectionElement)) return;
    if (!replaceExisting && body.rows.length) return;

    const renderedColumns = Array.from(colGroup?.children || []);
    const columnCount = Math.max(1, renderedColumns.length || document.getElementById("tableHead")?.querySelector("tr")?.cells.length || 1);
    const nameColumnIndex = renderedColumns.findIndex((column) => column.classList.contains("col-name"));
    const opacities = [0.82, 0.62, 0.44, 0.27, 0.13];
    const fragment = document.createDocumentFragment();
    opacities.forEach((opacity, index) => {
      const row = document.createElement("tr");
      row.className = "mflTableLoadingRow";
      row.dataset.loadingRow = String(index + 1);
      row.setAttribute("aria-hidden", "true");
      row.style.opacity = String(opacity);
      for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
        const cell = document.createElement("td");
        if (columnIndex === nameColumnIndex) {
          const nameCell = document.createElement("span");
          nameCell.className = "playerNameCell";
          nameCell.textContent = BLANK_TABLE_LOADING_TEXT;
          cell.appendChild(nameCell);
        } else {
          cell.textContent = BLANK_TABLE_LOADING_TEXT;
        }
        row.appendChild(cell);
      }
      fragment.appendChild(row);
    });
    body.replaceChildren(fragment);
    body.dataset.staticLoading = "true";
    const emptyState = document.getElementById("emptyState");
    if (emptyState instanceof HTMLElement) emptyState.hidden = true;
    const pager = document.querySelector("#progressionPage nav.pager");
    if (pager instanceof HTMLElement) pager.hidden = true;
  }

  Reflect.set(window, "__mflPrimeTableRows", primeInitialTableRows);

  function primeStaticButtonGroup(containerId, options, className, activeValue) {
    const container = document.getElementById(containerId);
    if (!(container instanceof HTMLElement)) return;
    const existing = Array.from(container.children).filter((child) => child instanceof HTMLButtonElement);
    const matches = existing.length === options.length && options.every(([value, label], index) => {
      const button = existing[index];
      return button instanceof HTMLButtonElement
        && button.dataset.staticValue === value
        && button.textContent === label;
    });
    const buttons = matches ? existing : options.map(([value, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = className;
      button.dataset.staticValue = value;
      button.textContent = label;
      return button;
    });
    if (!matches) container.replaceChildren(...buttons);
    buttons.forEach((button, index) => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.className = className;
      button.classList.toggle("active", options[index][0] === activeValue);
    });
  }

  function primeMflStatsControls() {
    primeStaticButtonGroup("mflStatsOverallFilters", MFL_STATS_FILTER_LABELS, "mflStatsFilterButton", "all");
  }

  function primeSettingsEmailEditAction() {
    const input = document.getElementById("settingsEmailAddressInput");
    if (!(input instanceof HTMLInputElement)) return;
    const row = input.closest(".settingsEmailAddressRow");
    if (!(row instanceof HTMLElement)) return;

    const existingEdit = row.querySelector("[data-settings-email-edit]");
    const edit = existingEdit instanceof HTMLButtonElement ? existingEdit : document.createElement("button");
    if (!(existingEdit instanceof HTMLButtonElement)) {
      edit.type = "button";
      edit.dataset.settingsEmailEdit = "true";
      input.insertAdjacentElement("afterend", edit);
    }
    edit.className = "settingsEmailActionButton primary";
    edit.textContent = "Edit";
    edit.disabled = true;
    edit.setAttribute("aria-label", "Edit email address");
    edit.setAttribute("aria-pressed", "false");
  }

  function primeSettingsActions() {
    const panel = document.querySelector("#settingsPage .settingsPanel");
    const discard = document.getElementById("settingsEmailDiscardButton");
    const save = document.getElementById("settingsEmailSaveButton");
    if (!(panel instanceof HTMLElement) || !(discard instanceof HTMLButtonElement) || !(save instanceof HTMLButtonElement)) return;

    const existingActions = panel.querySelector("[data-settings-page-actions]");
    const actions = existingActions instanceof HTMLElement ? existingActions : document.createElement("div");
    if (!(existingActions instanceof HTMLElement)) {
      actions.className = "settingsEmailAddressRow";
      actions.setAttribute("data-settings-page-actions", "true");
      actions.setAttribute("aria-label", "Settings actions");
    }

    discard.disabled = true;
    save.disabled = true;
    discard.classList.remove("active");
    save.classList.remove("active");
    actions.append(discard, save);
    panel.appendChild(actions);
  }

  Reflect.set(window, "__mflPrimeSettingsActions", primeSettingsActions);

  function primeSettingsControls() {
    setLoadingValue("settingsAgentName");
    setLoadingValue("settingsWalletAddress");
    primeStaticButtonGroup("settingsDateFormatOptions", SETTINGS_DATE_FORMAT_LABELS, "settingsToggleButton", "DMY");
    primeStaticButtonGroup("settingsTimeFormatOptions", SETTINGS_TIME_FORMAT_LABELS, "settingsToggleButton", "24h");
    primeSettingsEmailEditAction();
    primeSettingsActions();
  }

  function resetStatsShell(target) {
    if (target.id === "databaseStatsPage") {
      ["databaseStatsTotalPlayers", "databaseStatsRetiringThree", "databaseStatsRetiringTwo", "databaseStatsRetiringOne", "databaseStatsRetired"]
        .forEach(setLoadingValue);
      document.getElementById("databaseStatsDistribution")?.replaceChildren();
      return;
    }
    if (target.id === "mflStatsPage") {
      primeMflStatsControls();
      ["mflStatsTotalPlayers", "mflStatsPackablePlayers", "mflStatsAgedPlayers", "mflStatsOtherPlayers"]
        .forEach(setLoadingValue);
      document.getElementById("mflStatsAgeDistribution")?.replaceChildren();
    }
  }

  function playerLoadingViewButtons() {
    return [
      ["attributes", "Attributes"],
      ["training", "Training"],
      ["next", "Next Overall"],
      ["current", "Current Season"],
      ["all", "All Time"],
    ].map(([view, label], index) => (
      `<button class="playerAttributeViewButton${index === 0 ? " active" : ""}" type="button" data-view="${view}" disabled>${label}</button>`
    )).join("");
  }

  function primePlayerSkeleton() {
    const playerDetail = document.getElementById("playerDetail");
    if (!(playerDetail instanceof HTMLElement)) return;
    const optedIn = root.dataset.storedWalletOptIn === "true";
    const watchlistAction = optedIn
      ? '<button class="playerWatchlistButton" type="button" disabled>Watchlist</button>'
      : "";
    const notesPanel = optedIn
      ? `<div class="playerPanel playerNotesPanel"><h3>Notes</h3><div class="playerNotesInputWrap"><textarea class="playerNotesInput" style="visibility:hidden" aria-hidden="true" disabled></textarea><span class="playerNotesCount" style="visibility:hidden">0/100</span></div></div>`
      : "";
    const infoCards = Array.from({ length: 8 }, () => `<div><span>&nbsp;</span><strong>${LOADING_VALUE_TEXT}</strong></div>`).join("");
    const attributeCards = Array.from({ length: 7 }, (_, index) => (
      `<div class="playerAttributeCard${index === 0 ? " featured fullWidth" : ""}"><span>&nbsp;</span><strong>${LOADING_VALUE_TEXT}</strong></div>`
    )).join("");

    playerDetail.dataset.loadingShell = "true";
    playerDetail.innerHTML = `
      <section class="playerHero" aria-hidden="true">
        <div>
          <button class="playerEyebrow playerIdText" style="visibility:hidden" type="button" disabled>ID #000000</button>
          <h2 class="tablePageTitle playerTitle"><span class="playerTitleName">&nbsp;</span></h2>
          <p>&nbsp;</p>
        </div>
        <div class="playerHeroActions" style="visibility:hidden">
          <button class="playerEvaluateButton" type="button" disabled>Evaluate</button>
          ${watchlistAction}
          <a class="playerExternalButton" tabindex="-1" aria-hidden="true">Open link</a>
        </div>
      </section>
      <section class="playerGrid" aria-hidden="true">
        <div class="playerStack">
          <div class="playerPanel playerInfoPanel"><h3>Profile</h3><div class="detailGrid">${infoCards}</div></div>
          <div class="playerPanel attributesPanel"><div class="playerPanelHeader"><h3>Attributes</h3><div class="playerAttributeViews" style="visibility:hidden">${playerLoadingViewButtons()}</div></div><div class="attributeGrid">${attributeCards}</div></div>
          ${notesPanel}
        </div>
        <div class="playerPanel pitchPanel"><h3>Positions</h3><div class="pitch"></div></div>
      </section>`;
  }

  function primeRouteSkeleton(target) {
    if (!(target instanceof HTMLElement)) return;
    if (target.id === "homePage") {
      setLoadingValue("homePlayers");
      setLoadingValue("homeWallets");
      return;
    }
    if (target.id === "playerPage") {
      primePlayerSkeleton();
      return;
    }
    if (target.id === "evaluationPage") {
      const panel = document.getElementById("evaluationPanel");
      if (panel instanceof HTMLElement) panel.hidden = true;
      const results = document.getElementById("evaluationSearchResults");
      if (results instanceof HTMLElement) results.hidden = true;
      const searchInput = document.getElementById("evaluationSearchInput");
      const evaluationRouteState = firstPaintEvaluationRouteState();
      const initialPlayerName = firstPaintEvaluationPlayerName();
      if (searchInput instanceof HTMLInputElement && initialPlayerName) searchInput.value = initialPlayerName;
      setLoadingValue("evaluationDiscountRate");
      const buttons = document.getElementById("evaluationButtons");
      const loadButton = document.getElementById("evaluationLoadButton");
      const plainEvaluation = evaluationRouteState.plain;
      const canLoad = plainEvaluation;
      if (buttons instanceof HTMLElement && canLoad) buttons.hidden = false;
      if (loadButton instanceof HTMLElement) loadButton.hidden = !canLoad;
      return;
    }
    if (target.id === "settingsPage") {
      primeSettingsControls();
      return;
    }
    resetStatsShell(target);
  }

  Reflect.set(window, "__mflPrimeRouteSkeleton", primeRouteSkeleton);

  function primeInitialShell() {
    setLoadingValue("totalPlayers");
    setLoadingValue("totalWallets");

    const target = initialShellTarget();
    if (!(target instanceof HTMLElement)) return;
    const tablePage = String(root.dataset.initialTablePage || "").toLowerCase();
    if (target.id === "progressionPage" && tablePage) {
      const view = primeTableChrome(tablePage, window.location.href);
      primeInitialTableStructure(tablePage, view);
      primeInitialTableRows();
    } else {
      primeRouteSkeleton(target);
    }

    document.querySelectorAll("main > .pageView").forEach((page) => {
      if (page instanceof HTMLElement) page.hidden = page !== target;
    });
    if (target.id === "progressionPage") primeFirstPaintHorizontalOverflow();
    if (target.id === "progressionPage") primeFirstPaintPlayerTableFade();
    if (target.id === "evaluationPage") primeFirstPaintEvaluationTableFade();

    const initialPage = tablePage || (String(root.dataset.initialPage || "home").startsWith("players/") ? "player" : String(root.dataset.initialPage || "home").split("/")[0]);
    document.querySelectorAll("#sidebar .navButton[data-page]").forEach((candidate) => {
      if (!(candidate instanceof HTMLElement)) return;
      candidate.classList.toggle("active", String(candidate.dataset.page || "") === initialPage);
    });
  }

  primeInitialShell();

  const footerVersion = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
  if (footerVersion) footerVersion.textContent = `MFL Front Office v${STATIC_RELEASE_VERSION}`;

  const runtimeResourcePromises = new Map();

  function runtimeResourceUrl(path, options = {}) {
    const normalizedPath = String(path || "").trim();
    if (!normalizedPath) throw new Error("Runtime resource path is required.");
    const url = new URL(normalizedPath.replace(/^\/+/, ""), window.location.origin + "/");
    if (options.versioned) {
      const version = String(window.__mflReleaseVersion || STATIC_RELEASE_VERSION || "").trim();
      if (version) url.searchParams.set("mfl_core", version);
    }
    return url.href;
  }

  function loadRuntime(path, options = {}) {
    const href = runtimeResourceUrl(path, options);
    const existingPromise = runtimeResourcePromises.get(href);
    if (existingPromise) return existingPromise;

    /** @type {Promise<void>} */
    const loader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = href;
      script.async = false;
      script.dataset.mflRuntimeResource = String(path || "");
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener("error", () => {
        runtimeResourcePromises.delete(href);
        script.remove();
        reject(new Error("Could not load " + path + "."));
      }, { once: true });
      document.head.appendChild(script);
    });
    runtimeResourcePromises.set(href, loader);
    return loader;
  }

  async function loadRuntimeGroup(paths, options = {}) {
    await Promise.all(Array.from(new Set(paths)).map((path) => loadRuntime(path, options)));
  }

  function preloadRuntime(path, options = {}) {
    const href = runtimeResourceUrl(path, options);
    if (document.querySelector('link[data-mfl-runtime-resource-preload="' + href + '"]')) return;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "script";
    link.href = href;
    link.dataset.mflRuntimeResourcePreload = href;
    document.head.appendChild(link);
  }

  Reflect.set(window, "__mflRuntimeResources", Object.freeze({
    load: loadRuntime,
    loadGroup: loadRuntimeGroup,
    preload: preloadRuntime,
    url: runtimeResourceUrl,
  }));

  void (async () => {
    try {
      await Promise.all([
        loadRuntime("/route-core-loader-runtime.js"),
        loadRuntime("/dropdowns-runtime.js"),
        loadRuntime("/bootstrap-core.js"),
        loadRuntime("/document-title-runtime.js"),
      ]);
    } catch (error) {
      root.dataset.mflReady = "error";
      root.classList.remove("mflSingleRenderPending");
      root.classList.add("mflInitialRouteResolved");
      console.error("Could not initialize MFL Front Office.", error);
    }
  })();
})();