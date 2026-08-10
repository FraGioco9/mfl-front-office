(() => {
  "use strict";

  const STATIC_RELEASE_VERSION = "1.123.24";
  const LINKED_WALLET_STORAGE_KEY = "mfl-linked-wallet-v1";
  const LINKED_WALLET_PROOF_STORAGE_KEY = "mfl-linked-wallet-proof-v1";
  const WALLET_PERMISSION_CACHE_STORAGE_KEY = "mfl-wallet-permission-cache-v1";
  const WALLET_WATCHLIST_STORAGE_PREFIX = "mfl-wallet-watchlist-v1:";
  const TABLE_PAGE_IDS = new Set(["database", "mfl", "progression", "agents", "watchlist", "myplayers", "club"]);
  const OPT_IN_REQUIRED_PAGE_IDS = new Set(["myplayers", "watchlist", "settings"]);
  const VIEW_BY_SLUG = Object.freeze({
    attributes: "attributes",
    stats: "stats",
    "next-overall": "next",
    contracts: "contracts",
    "current-season": "current",
    "all-time": "all",
  });
  const ALLOWED_TABLE_VIEWS = Object.freeze({
    database: ["attributes", "contracts", "stats"],
    mfl: ["attributes", "stats"],
    progression: ["current", "all"],
    agents: ["attributes", "next", "contracts", "current", "all"],
    watchlist: ["attributes", "next", "contracts", "current", "all"],
    myplayers: ["attributes", "next", "contracts", "current", "all"],
    club: ["attributes", "next", "contracts", "current", "all"],
  });

  const STATIC_TABLE_BASE_COLUMNS = Object.freeze([
    "player_id",
    "nationality_flag",
    "name",
    "nationality",
    "age",
    "positions",
    "player_seasons",
  ]);
  const STATIC_TABLE_STAT_COLUMNS = Object.freeze([
    "overall",
    "pace",
    "shooting",
    "passing",
    "dribbling",
    "defense",
    "physical",
  ]);
  const STATIC_TABLE_VIEW_COLUMNS = Object.freeze({
    attributes: [...STATIC_TABLE_BASE_COLUMNS, ...STATIC_TABLE_STAT_COLUMNS, "wallet_name", "player_link"],
    current: [...STATIC_TABLE_BASE_COLUMNS, ...STATIC_TABLE_STAT_COLUMNS, "wallet_name", "player_link"],
    all: [...STATIC_TABLE_BASE_COLUMNS, ...STATIC_TABLE_STAT_COLUMNS, "wallet_name", "player_link"],
    next: [...STATIC_TABLE_BASE_COLUMNS, ...STATIC_TABLE_STAT_COLUMNS, "wallet_name", "player_link"],
    contracts: [
      ...STATIC_TABLE_BASE_COLUMNS,
      "overall",
      "active_contract_revenue_share",
      "active_contract_club_name",
      "active_contract_club_division",
      "wallet_name",
      "player_link",
    ],
  });
  const STATIC_TABLE_COLUMN_META = Object.freeze({
    player_id: { label: "ID", className: "col-id", width: 68.13 },
    nationality_flag: { label: "", className: "col-flag", width: 45.41 },
    name: { label: "Name", className: "col-name", width: 212.89 },
    nationality: { label: "Nationality", className: "col-nationality", width: 141.92 },
    age: { label: "Age", className: "col-age", width: 65.28 },
    positions: { label: "Positions", className: "col-positions", width: 119.22 },
    player_seasons: { label: "Seasons", className: "col-seasons", width: 82.31 },
    overall: { label: "Overall", className: "col-stat col-overall", width: 107.86 },
    pace: { label: "Pace", className: "col-stat", width: 107.86 },
    shooting: { label: "Shooting", className: "col-stat", width: 107.86 },
    passing: { label: "Passing", className: "col-stat", width: 107.86 },
    dribbling: { label: "Dribbling", className: "col-stat", width: 107.86 },
    defense: { label: "Defense", className: "col-stat", width: 107.86 },
    physical: { label: "Physical", className: "col-stat", width: 107.86 },
    wallet_name: { label: "Agent", className: "col-agent", width: 187.34 },
    owned_since: { label: "Joined Agency", className: "col-agent", width: 187.34 },
    active_contract_revenue_share: { label: "Rev. Share", className: "col-contract-revenue", width: 140 },
    active_contract_club_name: { label: "Club Name", className: "col-contract-club", width: 227.16 },
    active_contract_club_division: { label: "Division", className: "col-contract-division", width: 280 },
    player_link: { label: "", className: "col-link", width: 48.39 },
  });
  const STATIC_TABLE_COLUMN_PERCENTAGES = Object.freeze({
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
    "col-link": 3,
  });

  /** @type {Window & {
   * __mflInteractionBusy?: {
   *   begin: (reason?: string) => string,
   *   end: (token: string) => void,
   *   run: <T>(callback: () => T | Promise<T>, reason?: string) => Promise<T>,
   *   isBusy: () => boolean,
   *   installLegacyBridge: () => void,
   * },
   * __mflWithInteractionBusy?: (callback: () => unknown) => Promise<unknown>,
   * __mflWrapInteractionBusyFunction?: (callback: (...args: any[]) => any, reason: string) => (...args: any[]) => Promise<any>,
   * __mflSyncStoredAccessFlags?: () => { storedOptIn: boolean, storedAccess: boolean },
   * }} */
  const runtimeWindow = window;

  function normalizeStoredWalletAddress(value) {
    const address = String(value || "").trim().toLowerCase();
    return address ? (address.startsWith("0x") ? address : `0x${address}`) : "";
  }

  function storedWalletOptInAddress() {
    try {
      const linkedWallet = normalizeStoredWalletAddress(localStorage.getItem(LINKED_WALLET_STORAGE_KEY));
      if (!linkedWallet) return "";

      const proof = JSON.parse(localStorage.getItem(LINKED_WALLET_PROOF_STORAGE_KEY) || "null");
      const proofWallet = normalizeStoredWalletAddress(proof?.address);
      if (proofWallet !== linkedWallet || !proof?.message || !Array.isArray(proof?.signatures) || !proof.signatures.length) {
        return "";
      }
      return linkedWallet;
    } catch {
      return "";
    }
  }

  function hasStoredProgressionAccess() {
    try {
      const linkedWallet = storedWalletOptInAddress();
      if (!linkedWallet) return false;
      const permissionKey = `${WALLET_PERMISSION_CACHE_STORAGE_KEY}:${linkedWallet}`;
      const permission = JSON.parse(localStorage.getItem(permissionKey) || "null");
      return permission?.allowed === true;
    } catch {
      return false;
    }
  }

  function syncStoredAccessFlags() {
    const storedOptIn = Boolean(storedWalletOptInAddress());
    const storedAccess = hasStoredProgressionAccess();
    document.documentElement.dataset.storedWalletOptIn = storedOptIn ? "true" : "false";
    document.documentElement.dataset.storedProgressionAccess = storedAccess ? "true" : "false";
    return { storedOptIn, storedAccess };
  }

  function ensureDatabaseStatsStaticPage() {
    if (!/^\/database\/stats\/?$/i.test(window.location.pathname)) return null;
    const page = document.getElementById("databaseStatsPage");
    return page instanceof HTMLElement ? page : null;
  }

  function initialRoute(pathname) {
    const cleanPath = String(pathname || "/").replace(/\/+$/, "") || "/";
    const parts = cleanPath.split("/").filter(Boolean);
    const first = parts[0] || "";
    const last = parts.at(-1) || "";

    if (cleanPath === "/" || cleanPath === "/home") {
      return { pageName: "home", pageId: "homePage", title: "", view: "" };
    }
    if (cleanPath === "/evaluation" || first === "evaluation") {
      return { pageName: "evaluation", pageId: "evaluationPage", title: "Evaluation", view: "" };
    }
    if (cleanPath === "/settings") {
      return { pageName: "settings", pageId: "settingsPage", title: "Settings", view: "" };
    }
    if (cleanPath === "/changelog") {
      return { pageName: "changelog", pageId: "changelogPage", title: "Changelog", view: "" };
    }
    if (first === "players") {
      return { pageName: "player", pageId: "playerPage", title: "", view: "" };
    }
    if (first === "database" && last === "stats") {
      return { pageName: "databasestats", pageId: "databaseStatsPage", title: "Database", view: "stats", navPage: "database" };
    }
    if (first === "mfl" && last === "stats") {
      return { pageName: "mflstats", pageId: "mflStatsPage", title: "MFL Wallet", view: "stats", navPage: "mfl" };
    }

    let pageName = "home";
    let title = "";
    if (first === "database") {
      pageName = "database";
      title = "Database";
    } else if (first === "mfl") {
      pageName = "mfl";
      title = "MFL Wallet";
    } else if (first === "progression") {
      pageName = "progression";
      title = "Progression";
    } else if (first === "watchlist") {
      pageName = "watchlist";
      title = "Watchlist";
    } else if (first === "my-players") {
      pageName = "myplayers";
      title = "My Players";
    } else if (first === "agents") {
      pageName = "agents";
      title = "Agent";
    } else if (first === "clubs" || first === "club") {
      pageName = "club";
      title = "Club";
    }

    if (TABLE_PAGE_IDS.has(pageName)) {
      const fallbackView = pageName === "progression" || pageName === "watchlist" ? "current" : "attributes";
      return {
        pageName,
        pageId: "progressionPage",
        title,
        view: VIEW_BY_SLUG[last] || fallbackView,
        navPage: pageName,
      };
    }

    return { pageName: "home", pageId: "homePage", title: "", view: "", navPage: "home" };
  }

  function storedWatchlistTitle(pathname) {
    const linkedWallet = storedWalletOptInAddress();
    if (!linkedWallet) return "Watchlist";

    try {
      const match = String(pathname || "").match(/^\/watchlist(?:\/([^/]+))?/i);
      const firstSegment = decodeURIComponent(match?.[1] || "");
      const requestedId = VIEW_BY_SLUG[firstSegment] ? "" : firstSegment;
      const saved = JSON.parse(
        localStorage.getItem(`${WALLET_WATCHLIST_STORAGE_PREFIX}${linkedWallet}`) || "[]",
      );
      const watchlists = Array.isArray(saved)
        ? saved.filter((item) => item && typeof item === "object" && !Array.isArray(item))
        : [];
      const selected = watchlists.find((watchlist) => String(watchlist.id || "") === requestedId)
        || watchlists[0];
      const name = String(selected?.name || "Default").trim().replace(/\s+/g, " ").slice(0, 20) || "Default";
      return `Watchlist - ${name}`;
    } catch {
      return "Watchlist - Default";
    }
  }

  function staticTableColumnKey(column, pageName) {
    return column === "wallet_name" && ["myplayers", "agents", "mfl"].includes(pageName)
      ? "owned_since"
      : column;
  }

  function staticTableColumnPercentage(element) {
    if (!(element instanceof Element)) return null;
    const className = Object.keys(STATIC_TABLE_COLUMN_PERCENTAGES)
      .find((name) => element.classList.contains(name));
    return className ? STATIC_TABLE_COLUMN_PERCENTAGES[className] : null;
  }

  let staticScrollbarWidth = null;

  function staticBrowserScrollbarWidth() {
    if (staticScrollbarWidth !== null) return staticScrollbarWidth;
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll;";
    document.body.appendChild(probe);
    staticScrollbarWidth = Math.max(0, probe.offsetWidth - probe.clientWidth);
    probe.remove();
    return staticScrollbarWidth;
  }

  function staticTableContentWidth() {
    const main = document.querySelector("main");
    if (!(main instanceof HTMLElement)) return 0;
    const styles = getComputedStyle(main);
    const clientWidth = document.documentElement.clientWidth;
    const reservedViewportWidth = Math.max(0, window.innerWidth - staticBrowserScrollbarWidth());
    const viewportWidth = Math.min(clientWidth, reservedViewportWidth);
    const menuRail = document.getElementById("menuRail");
    const sidebarWidth = menuRail instanceof HTMLElement && !menuRail.hidden ? 190 : 0;
    const paddingLeft = parseFloat(styles.paddingLeft) || 0;
    const paddingRight = parseFloat(styles.paddingRight) || 0;
    return Math.max(0, viewportWidth - sidebarWidth - paddingLeft - paddingRight);
  }

  function applyStaticSharedTableWidths(table, tableColGroup, headerRow) {
    const contentWidth = staticTableContentWidth();
    if (!(contentWidth > 0)) return;
    const columns = Array.from(tableColGroup.children);
    const percentages = columns.map(staticTableColumnPercentage);
    if (!percentages.length || percentages.some((value) => !Number.isFinite(value))) return;

    const exactWidth = `${contentWidth.toFixed(4)}px`;
    document.querySelectorAll("#progressionPage .tableShell, #progressionPage .tableScroller").forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      element.style.setProperty("width", exactWidth, "important");
      element.style.setProperty("min-width", exactWidth, "important");
      element.style.setProperty("max-width", exactWidth, "important");
      element.style.setProperty("box-sizing", "border-box", "important");
      element.style.setProperty("overflow", "hidden", "important");
    });
    table.style.setProperty("table-layout", "fixed", "important");
    table.style.setProperty("width", exactWidth, "important");
    table.style.setProperty("min-width", exactWidth, "important");
    table.style.setProperty("max-width", exactWidth, "important");
    table.style.setProperty("box-sizing", "border-box", "important");
    table.style.setProperty("border-spacing", "0", "important");

    let assignedWidth = 0;
    columns.forEach((column, index) => {
      const pixelWidth = contentWidth * Number(percentages[index]) / 100;
      assignedWidth += pixelWidth;
      const width = `${pixelWidth.toFixed(4)}px`;
      column.style.setProperty("width", width, "important");
      column.style.setProperty("min-width", width, "important");
      column.style.setProperty("max-width", width, "important");
      column.style.setProperty("transition", "none", "important");
    });

    const fillerWidth = Math.max(0, contentWidth - assignedWidth);
    if (fillerWidth > 0.01) {
      const width = `${fillerWidth.toFixed(4)}px`;
      const fillerColumn = document.createElement("col");
      const fillerHeader = document.createElement("th");
      fillerColumn.className = "col-shared-width-filler";
      fillerHeader.className = "col-shared-width-filler";
      fillerHeader.setAttribute("aria-hidden", "true");
      [fillerColumn, fillerHeader].forEach((element) => {
        element.style.setProperty("width", width, "important");
        element.style.setProperty("min-width", width, "important");
        element.style.setProperty("max-width", width, "important");
      });
      tableColGroup.appendChild(fillerColumn);
      headerRow.appendChild(fillerHeader);
    }
    document.querySelector("#progressionPage .tableScroller")?.classList.add("tableWidthsReady");
  }

  function primeStaticTableHeader(route) {
    if (!route || route.pageId !== "progressionPage") return;
    const columns = STATIC_TABLE_VIEW_COLUMNS[route.view];
    const tableHead = document.querySelector("#tableHead");
    const tableColGroup = document.querySelector("#tableColGroup");
    if (!columns || !(tableHead instanceof HTMLTableSectionElement) || !(tableColGroup instanceof HTMLTableColElement)) {
      return;
    }

    const headerRow = document.createElement("tr");
    const selectionHeader = document.createElement("th");
    const selectionInput = document.createElement("input");
    const selectionCol = document.createElement("col");
    const colFragment = document.createDocumentFragment();

    selectionHeader.className = "selectionCell";
    selectionInput.id = "selectVisiblePlayersInput";
    selectionInput.type = "checkbox";
    selectionInput.setAttribute("aria-label", "Select visible players");
    selectionHeader.appendChild(selectionInput);
    headerRow.appendChild(selectionHeader);
    selectionCol.className = "col-select";
    colFragment.appendChild(selectionCol);

    columns.forEach((column) => {
      const key = staticTableColumnKey(column, route.pageName);
      const meta = STATIC_TABLE_COLUMN_META[key];
      if (!meta) return;
      const cell = document.createElement("th");
      const label = document.createElement("span");
      const col = document.createElement("col");
      if (meta.className) {
        cell.classList.add(...meta.className.split(" "));
        col.classList.add(...meta.className.split(" "));
      }
      label.textContent = meta.label;
      cell.appendChild(label);
      headerRow.appendChild(cell);
      colFragment.appendChild(col);
    });

    tableHead.replaceChildren(headerRow);
    tableHead.dataset.staticHeader = "true";
    tableColGroup.replaceChildren(colFragment);
    const table = tableHead.closest("table");
    if (table instanceof HTMLTableElement) {
      applyStaticSharedTableWidths(table, tableColGroup, headerRow);
    }
  }

  function primeStaticTableLoadingBody(route) {
    if (!route || route.pageId !== "progressionPage") return;
    const tableHead = document.querySelector("#tableHead");
    const tableBody = document.querySelector("#tableBody");
    const emptyState = document.querySelector("#emptyState");
    if (!(tableHead instanceof HTMLTableSectionElement) || !(tableBody instanceof HTMLTableSectionElement)) return;

    const row = document.createElement("tr");
    const cell = document.createElement("td");
    row.className = "staticTableLoadingRow";
    cell.className = "staticTableLoadingCell";
    cell.colSpan = Math.max(1, tableHead.rows[0]?.cells.length || 1);
    cell.textContent = "Loading players...";
    row.appendChild(cell);
    tableBody.replaceChildren(row);
    tableBody.dataset.staticLoading = "true";
    if (emptyState instanceof HTMLElement) emptyState.hidden = true;
  }

  function primeStaticShell() {
    ensureDatabaseStatsStaticPage();
    if (/^\/database\/?$/i.test(window.location.pathname)) {
      window.history.replaceState({}, "", "/database/attributes");
      document.documentElement.dataset.initialPage = "database/attributes";
    }
    const route = initialRoute(window.location.pathname);
    if (route.pageName === "watchlist") route.title = storedWatchlistTitle(window.location.pathname);
    const { storedOptIn, storedAccess } = syncStoredAccessFlags();
    const lockedRoute = !storedOptIn && OPT_IN_REQUIRED_PAGE_IDS.has(route.pageName);
    const initialPageId = lockedRoute ? "myPlayersLockedPage" : route.pageId;
    const appShell = document.querySelector("#appShell");
    const menuRail = document.querySelector("#menuRail");
    const menuButton = document.querySelector("#menuButton");
    const sidebar = document.querySelector("#sidebar");
    const footer = document.querySelector(".siteFooter");
    const footerVersionLink = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
    const homeOptInButton = document.querySelector("#homeOptInButton");
    const myPlayersOptInButton = document.querySelector("#myPlayersOptInButton");

    document.body.dataset.page = route.pageName;
    document.body.classList.toggle("guest", !storedAccess);
    document.body.classList.add("pinnedSidebarVisible");
    document.documentElement.dataset.staticPage = route.pageName;
    document.documentElement.dataset.storedWalletOptIn = storedOptIn ? "true" : "false";
    document.documentElement.dataset.storedProgressionAccess = storedAccess ? "true" : "false";

    if (homeOptInButton instanceof HTMLButtonElement) homeOptInButton.hidden = storedOptIn;
    if (myPlayersOptInButton instanceof HTMLButtonElement) myPlayersOptInButton.hidden = storedOptIn;
    if (appShell instanceof HTMLElement) appShell.classList.remove("menuClosed", "menuAnimating");
    if (menuRail instanceof HTMLElement) menuRail.hidden = false;
    if (menuButton instanceof HTMLButtonElement) {
      menuButton.hidden = false;
      menuButton.setAttribute("aria-expanded", "true");
    }
    if (sidebar instanceof HTMLElement) sidebar.hidden = false;
    if (footer instanceof HTMLElement) footer.hidden = false;
    if (footerVersionLink instanceof HTMLAnchorElement) {
      footerVersionLink.textContent = `MFL Front Office v${STATIC_RELEASE_VERSION}`;
      footerVersionLink.hidden = false;
    }

    document.querySelectorAll("main > .pageView").forEach((page) => {
      if (page instanceof HTMLElement) page.hidden = page.id !== initialPageId;
    });

    const navPage = route.navPage || route.pageName;
    document.querySelectorAll("#sidebar .navButton[data-page]").forEach((button) => {
      if (!(button instanceof HTMLElement)) return;
      button.classList.toggle("active", button.dataset.page === navPage);
    });

    if (lockedRoute) {
      const lockedTitle = document.querySelector("#optInLockedTitle");
      const lockedMessage = document.querySelector("#optInLockedMessage");
      if (lockedTitle instanceof HTMLElement) {
        lockedTitle.textContent = route.pageName === "watchlist"
          ? "Watchlist"
          : route.pageName === "settings"
            ? "Settings"
            : "My Players";
      }
      if (lockedMessage instanceof HTMLElement) {
        lockedMessage.textContent = route.pageName === "watchlist"
          ? "In order to use the watchlist, you need to opt in."
          : route.pageName === "settings"
            ? "In order to view settings, you need to opt in."
            : "In order to see your players, you need to opt in.";
      }
    }

    if (!lockedRoute && route.pageId === "progressionPage") {
      const title = document.querySelector("#tablePageTitle");
      if (title instanceof HTMLElement && route.title) title.textContent = route.title;

      const allowedViews = ALLOWED_TABLE_VIEWS[route.pageName] || [];
      const allowed = new Set(allowedViews);
      const views = document.querySelector("#progressionPage .views");
      document.querySelectorAll("#progressionPage .viewButton[data-view]").forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        const view = String(button.dataset.view || "");
        button.hidden = Boolean(allowed.size && !allowed.has(view));
        button.classList.toggle("active", view === route.view);
        button.setAttribute("aria-pressed", String(view === route.view));
      });
      if (views instanceof HTMLElement) {
        const switcher = document.getElementById("watchlistSwitcher");
        allowedViews.forEach((viewName) => {
          const button = views.querySelector(`.viewButton[data-view="${viewName}"]`);
          if (button) views.insertBefore(button, switcher || null);
        });
      }
      primeStaticTableHeader(route);
      primeStaticTableLoadingBody(route);
    }

    document.documentElement.classList.add("mflStaticShellReady", "mflInitialRouteResolved");
    return footerVersionLink;
  }

  function createInteractionBusyController() {
    const BUSY_CLASS = "mflInteractionBusy";
    const DATA_LOADING_CLASS = "mflDataLoading";
    const DATA_LOADING_REASONS = new Set(["startup", "interaction-loading", "ensureProgressionData", "requestIncrementalRoute", "databaseStatsData", "mflStatsData"]);
    const blockedEvents = [
      "pointerdown", "mousedown", "touchstart", "click", "dblclick", "auxclick", "contextmenu",
      "pointerover", "pointerenter", "pointermove", "mouseover", "mouseenter", "mousemove",
    ];
    const activeTokens = new Map();
    let tokenSequence = 0;

    const style = document.createElement("style");
    style.id = "mflInteractionBusyStyles";
    style.textContent = `
      html.${BUSY_CLASS},
      html.${BUSY_CLASS} body,
      html.${BUSY_CLASS} body *,
      html.${BUSY_CLASS} body *::before,
      html.${BUSY_CLASS} body *::after {
        cursor: wait !important;
      }

      html.${BUSY_CLASS} body * {
        pointer-events: none !important;
      }

      html.${BUSY_CLASS} body *,
      html.${BUSY_CLASS} body *::before,
      html.${BUSY_CLASS} body *::after {
        transition: none !important;
        animation: none !important;
      }

      #progressionPage nav.pager {
        padding-block: 12px !important;
      }

      #progressionPage #tableBody .staticTableLoadingCell {
        height: 54px;
        padding: 12px 16px;
        text-align: center;
        vertical-align: middle;
      }

      html.${DATA_LOADING_CLASS} #progressionPage nav.pager,
      html.${DATA_LOADING_CLASS} #progressionPage #watchlistPlayerCount {
        display: none !important;
      }
    `;
    document.head.appendChild(style);

    function applyState() {
      const busy = activeTokens.size > 0;
      const dataLoading = Array.from(activeTokens.values()).some((reason) => DATA_LOADING_REASONS.has(reason));
      document.documentElement.classList.toggle(BUSY_CLASS, busy);
      document.documentElement.classList.toggle(DATA_LOADING_CLASS, dataLoading);
      document.documentElement.dataset.interactionBusy = busy ? "true" : "false";
      document.body.setAttribute("aria-busy", busy ? "true" : "false");
    }

    function begin(reason = "loading") {
      const normalizedReason = String(reason || "loading");
      const token = `${normalizedReason}-${++tokenSequence}`;
      activeTokens.set(token, normalizedReason);
      applyState();
      return token;
    }

    function end(token) {
      if (!token || !activeTokens.delete(token)) return;
      applyState();
    }

    async function run(callback, reason = "loading") {
      const token = begin(reason);
      try {
        return await callback();
      } finally {
        end(token);
      }
    }

    /**
     * @param {Element | null} element
     * @param {string | null} pseudoElement
     */
    function elementHasWaitCursor(element, pseudoElement = null) {
      if (!(element instanceof Element)) return false;
      try {
        return getComputedStyle(element, pseudoElement).cursor === "wait";
      } catch {
        return false;
      }
    }

    function interactionShouldBeBlocked(event) {
      if (activeTokens.size) return true;
      const target = event.target instanceof Element ? event.target : null;
      return elementHasWaitCursor(target)
        || elementHasWaitCursor(document.documentElement)
        || elementHasWaitCursor(document.body)
        || elementHasWaitCursor(document.body, "::before")
        || elementHasWaitCursor(document.body, "::after");
    }

    function blockInteraction(event) {
      if (!interactionShouldBeBlocked(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    blockedEvents.forEach((eventName) => {
      document.addEventListener(eventName, blockInteraction, true);
    });

    /** @type {(callback: (...args: any[]) => any, reason: string) => (...args: any[]) => Promise<any>} */
    const wrapBusyFunction = (callback, reason) => (...args) => run(() => callback(...args), reason);

    function installLegacyBridge() {
      runtimeWindow.__mflWithInteractionBusy = (callback) => run(callback, "interaction-loading");
      runtimeWindow.__mflWrapInteractionBusyFunction = wrapBusyFunction;
      runtimeWindow.__mflSyncStoredAccessFlags = syncStoredAccessFlags;

      try {
        window.eval("withInteractionBusy = window.__mflWithInteractionBusy");
      } catch {
        // The app still works if a future core stops exposing this global binding.
      }

      try {
        window.eval(`(() => {
          if (typeof syncHomeLoginButton !== "function" || syncHomeLoginButton.__mflStoredAccessWrapped) return;
          const original = syncHomeLoginButton;
          const wrapped = function (...args) {
            const result = original.apply(this, args);
            window.__mflSyncStoredAccessFlags();
            return result;
          };
          Object.defineProperty(wrapped, "__mflStoredAccessWrapped", { value: true });
          syncHomeLoginButton = wrapped;
        })()`);
      } catch {
        // Future cores can update the storage-backed flags directly instead.
      }
      syncStoredAccessFlags();

      [
        "ensureProgressionData",
        "requestIncrementalRoute",
        "loadSharedEvaluation",
        "loadSavedEvaluation",
        "openSavedEvaluationsModal",
        "createSharedEvaluationFromPayload",
        "createSharedEvaluation",
        "createSavedEvaluation",
        "linkWallet",
      ].forEach((name) => {
        try {
          window.eval(`(() => {
            if (typeof ${name} !== "function" || ${name}.__mflInteractionBusyWrapped) return;
            const original = ${name};
            const wrapped = window.__mflWrapInteractionBusyFunction(original, ${JSON.stringify(name)});
            Object.defineProperty(wrapped, "__mflInteractionBusyWrapped", { value: true });
            ${name} = wrapped;
          })()`);
        } catch {
          // Some optional functions are not present on every route/build.
        }
      });
    }

    return Object.freeze({
      begin,
      end,
      run,
      isBusy: () => activeTokens.size > 0,
      installLegacyBridge,
    });
  }

  const footerVersionLink = primeStaticShell();
  const interactionBusy = createInteractionBusyController();
  runtimeWindow.__mflInteractionBusy = interactionBusy;
  const startupBusyToken = interactionBusy.begin("startup");

  function finishStartupBusy() {
    interactionBusy.end(startupBusyToken);
  }

  window.addEventListener("mfl:ready", finishStartupBusy, { once: true });
  const readinessObserver = new MutationObserver(() => {
    const readiness = document.documentElement.dataset.mflReady;
    if (readiness === "true" || readiness === "error") {
      readinessObserver.disconnect();
      finishStartupBusy();
    }
  });
  readinessObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mfl-ready"] });

  const changelogList = document.querySelector(".changelogList");
  if (changelogList instanceof HTMLElement) {
    changelogList.replaceChildren();
    changelogList.hidden = true;
    changelogList.dataset.historyLoading = "true";
  }

  void (async () => {
    let version = STATIC_RELEASE_VERSION;

    try {
      const response = await fetch("/release.json", { cache: "no-store" });
      if (response.ok) {
        const release = await response.json();
        if (release?.version) {
          version = String(release.version);
          if (footerVersionLink instanceof HTMLAnchorElement) {
            footerVersionLink.textContent = `MFL Front Office v${version}`;
          }
        }
      }
    } catch {
      // The static release keeps first paint stable even if metadata is unavailable.
    }

    const entryUrl = new URL("/modules/app-entry.js", window.location.origin);
    entryUrl.searchParams.set("v", version);

    try {
      await import(entryUrl.href);
    } catch (error) {
      document.documentElement.dataset.mflReady = "error";
      console.error("Could not import the MFL Front Office entry module.", error);
    }
  })();
})();
