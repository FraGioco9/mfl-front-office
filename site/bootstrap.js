(() => {
  "use strict";

  const STATIC_RELEASE_VERSION = "1.124.1";
  const LINKED_WALLET_STORAGE_KEY = "mfl-linked-wallet-v1";
  const LINKED_WALLET_PROOF_STORAGE_KEY = "mfl-linked-wallet-proof-v1";
  const WALLET_PERMISSION_CACHE_STORAGE_KEY = "mfl-wallet-permission-cache-v1";
  const WALLET_WATCHLIST_STORAGE_PREFIX = "mfl-wallet-watchlist-v1:";
  const FILTER_STORAGE_KEY = "mfl-table-filters-v1";
  const STATIC_MFL_STATS_FILTERS = Object.freeze([
    ["all", "All"],
    ["90-94", "90-94"],
    ["legendary", "Legendary"],
    ["85-89", "85-89"],
    ["80-84", "80-84"],
    ["rare", "Rare"],
    ["75-79", "75-79"],
    ["70-74", "70-74"],
    ["uncommon", "Uncommon"],
    ["65-69", "65-69"],
    ["60-64", "60-64"],
    ["limited", "Limited"],
    ["55-59", "55-59"],
    ["50-54", "50-54"],
    ["common", "Common"],
  ]);
  const TABLE_PAGE_IDS = new Set(["database", "mfl", "progression", "agents", "watchlist", "myplayers", "club"]);
  const MOBILE_LAYOUT_QUERY = "(max-width: 900px)";
  const MOBILE_TABLE_MIN_WIDTH = 1240;
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
   *   installCoreBridge: () => void,
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

  function storedWatchlistName(pathname) {
    const linkedWallet = storedWalletOptInAddress();
    if (!linkedWallet) return "";

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
        || (!requestedId ? watchlists[0] : null);
      return String(selected?.name || "").trim().replace(/\s+/g, " ").slice(0, 20);
    } catch {
      return "";
    }
  }

  function storedWatchlistTitle(pathname) {
    const linkedWallet = storedWalletOptInAddress();
    if (!linkedWallet) return "Watchlist";
    const name = storedWatchlistName(pathname) || "Default";
    return `Watchlist - ${name}`;
  }

  function storedQuickFilters(pageName) {
    const defaults = {
      hideRetired: true,
      hideRetiring: false,
      hideMflPlayers: pageName === "database",
      mflPackable: pageName === "mfl",
      newMints: false,
    };
    try {
      const saved = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || "null");
      const pageState = saved?.pages?.[pageName];
      return pageState && typeof pageState === "object"
        ? { ...defaults, ...pageState }
        : defaults;
    } catch {
      return defaults;
    }
  }

  function primeStaticMflStatsOverallFilters(route) {
    if (route?.pageName !== "mflstats") return;
    const container = document.getElementById("mflStatsOverallFilters");
    if (!(container instanceof HTMLElement)) return;

    const expectedIds = STATIC_MFL_STATS_FILTERS.map(([id]) => id);
    const currentButtons = Array.from(container.querySelectorAll(".mflStatsFilterButton"));
    const valid = currentButtons.length === expectedIds.length
      && currentButtons.every((button, index) => String(button.dataset.filter || "") === expectedIds[index]);
    if (!valid) {
      const fragment = document.createDocumentFragment();
      STATIC_MFL_STATS_FILTERS.forEach(([id, label], index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `mflStatsFilterButton${index === 0 ? " active" : ""}`;
        button.dataset.filter = id;
        button.dataset.mflStatsStatic = "true";
        button.setAttribute("aria-pressed", index === 0 ? "true" : "false");
        button.textContent = label;
        fragment.appendChild(button);
      });
      container.replaceChildren(fragment);
    }

    container.dataset.staticOverallFilters = "true";
    container.style.setProperty("display", "flex", "important");
    container.style.setProperty("flex-wrap", "nowrap", "important");
    container.style.setProperty("gap", "6px", "important");
    container.style.setProperty("width", "100%", "important");
    container.querySelectorAll(".mflStatsFilterButton").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.style.setProperty("flex", "1 1 0", "important");
      button.style.setProperty("width", "auto", "important");
      button.style.setProperty("min-width", "0", "important");
      button.style.setProperty("padding-left", "5px", "important");
      button.style.setProperty("padding-right", "5px", "important");
      button.style.setProperty("white-space", "nowrap", "important");
    });
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
    const mobile = window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
    const sidebarWidth = !mobile && menuRail instanceof HTMLElement && !menuRail.hidden ? 190 : 0;
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

    const mobile = window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
    const tableWidth = mobile ? Math.max(MOBILE_TABLE_MIN_WIDTH, contentWidth) : contentWidth;
    const visibleWidth = `${contentWidth.toFixed(4)}px`;
    const exactWidth = `${tableWidth.toFixed(4)}px`;
    const shell = document.querySelector("#progressionPage .tableShell");
    const scroller = document.querySelector("#progressionPage .tableScroller");
    [shell, scroller].forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      element.style.setProperty("width", visibleWidth, "important");
      element.style.setProperty("min-width", visibleWidth, "important");
      element.style.setProperty("max-width", visibleWidth, "important");
      element.style.setProperty("box-sizing", "border-box", "important");
    });
    if (shell instanceof HTMLElement) shell.style.setProperty("overflow", "hidden", "important");
    if (scroller instanceof HTMLElement) {
      if (mobile) {
        scroller.style.setProperty("overflow-x", "auto", "important");
        scroller.style.setProperty("overflow-y", "hidden", "important");
        scroller.style.setProperty("overscroll-behavior-x", "contain", "important");
        scroller.style.setProperty("touch-action", "pan-x pan-y", "important");
        scroller.style.setProperty("-webkit-overflow-scrolling", "touch");
        scroller.dataset.mobileTableScroll = "true";
      } else {
        scroller.style.setProperty("overflow", "hidden", "important");
        delete scroller.dataset.mobileTableScroll;
      }
    }
    table.style.setProperty("table-layout", "fixed", "important");
    table.style.setProperty("width", exactWidth, "important");
    table.style.setProperty("min-width", exactWidth, "important");
    table.style.setProperty("max-width", exactWidth, "important");
    table.style.setProperty("box-sizing", "border-box", "important");
    table.style.setProperty("border-spacing", "0", "important");

    let assignedWidth = 0;
    columns.forEach((column, index) => {
      const pixelWidth = tableWidth * Number(percentages[index]) / 100;
      assignedWidth += pixelWidth;
      const width = `${pixelWidth.toFixed(4)}px`;
      column.style.setProperty("width", width, "important");
      column.style.setProperty("min-width", width, "important");
      column.style.setProperty("max-width", width, "important");
      column.style.setProperty("transition", "none", "important");
    });

    const fillerWidth = Math.max(0, tableWidth - assignedWidth);
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

    const columnCount = Math.max(1, tableHead.rows[0]?.cells.length || 1);
    const rowPaints = [
      { background: 28, border: 85 },
      { background: 21, border: 65 },
      { background: 14, border: 45 },
      { background: 8, border: 28 },
      { background: 3, border: 12 },
    ];
    const fragment = document.createDocumentFragment();
    rowPaints.forEach(({ background, border }, index) => {
      const row = document.createElement("tr");
      row.className = "staticTableBlankRow";
      row.dataset.loadingRow = String(index + 1);
      row.setAttribute("aria-hidden", "true");
      row.style.setProperty("opacity", "1", "important");
      for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
        const cell = document.createElement("td");
        cell.style.height = "38px";
        cell.style.minHeight = "38px";
        cell.style.paddingTop = "0";
        cell.style.paddingBottom = "0";
        cell.style.setProperty("opacity", "1", "important");
        cell.style.setProperty("background", `color-mix(in srgb, var(--border-strong) ${background}%, transparent)`, "important");
        cell.style.setProperty("background-image", "none", "important");
        cell.style.setProperty("border-bottom-color", `color-mix(in srgb, var(--border-strong) ${border}%, transparent)`, "important");
        row.appendChild(cell);
      }
      fragment.appendChild(row);
    });
    tableBody.replaceChildren(fragment);
    tableBody.dataset.staticLoading = "true";
    if (emptyState instanceof HTMLElement) {
      emptyState.hidden = true;
      emptyState.textContent = "";
    }
  }

  function primeStaticShell() {
    ensureDatabaseStatsStaticPage();
    if (/^\/database\/?$/i.test(window.location.pathname)) {
      window.history.replaceState({}, "", "/database/attributes");
      document.documentElement.dataset.initialPage = "database/attributes";
    }
    const route = initialRoute(window.location.pathname);
    primeStaticMflStatsOverallFilters(route);
    if (route.pageName === "watchlist") route.title = storedWatchlistTitle(window.location.pathname);
    const { storedOptIn, storedAccess } = syncStoredAccessFlags();
    const lockedRoute = !storedOptIn && OPT_IN_REQUIRED_PAGE_IDS.has(route.pageName);
    const initialPageId = lockedRoute ? "myPlayersLockedPage" : route.pageId;
    const appShell = document.querySelector("#appShell");
    const menuRail = document.querySelector("#menuRail");
    const menuButton = document.querySelector("#menuButton");
    const sidebar = document.querySelector("#sidebar");
    const main = document.querySelector("main");
    const footer = document.querySelector(".siteFooter");
    const footerVersionLink = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
    const homeOptInButton = document.querySelector("#homeOptInButton");
    const myPlayersOptInButton = document.querySelector("#myPlayersOptInButton");
    const watchlistSwitcher = document.querySelector("#watchlistSwitcher");
    const watchlistButtonText = document.querySelector("#watchlistButtonText");
    const evaluationSearchInput = document.querySelector("#evaluationSearchInput");
    const evaluationButtons = document.querySelector("#evaluationButtons");
    const evaluationLoadButton = document.querySelector("#evaluationLoadButton");
    const hideRetiredInput = document.querySelector("#hideRetiredInput");
    const hideRetiringInput = document.querySelector("#hideRetiringInput");
    const hideMflPlayersFilter = document.querySelector("#hideMflPlayersFilter");
    const hideMflPlayersInput = document.querySelector("#hideMflPlayersInput");
    const packablePlayersFilter = document.querySelector("#packablePlayersFilter");
    const packablePlayersInput = document.querySelector("#packablePlayersInput");
    const newMintsInput = document.querySelector("#newMintsInput");

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
    if (watchlistSwitcher instanceof HTMLElement) {
      const showWatchlistSwitcher = !lockedRoute && route.pageName === "watchlist";
      watchlistSwitcher.hidden = !showWatchlistSwitcher;
      if (showWatchlistSwitcher && watchlistButtonText instanceof HTMLElement) {
        watchlistButtonText.textContent = storedWatchlistName(window.location.pathname) || "-";
      }
    }

    if (evaluationSearchInput instanceof HTMLInputElement) {
      const loadingEvaluation = !lockedRoute && route.pageName === "evaluation";
      evaluationSearchInput.inert = loadingEvaluation;
      if (loadingEvaluation) {
        evaluationSearchInput.blur();
        evaluationSearchInput.dataset.staticFocusGuard = "true";
      }
    }
    if (!lockedRoute && route.pageName === "evaluation") {
      const params = new URLSearchParams(window.location.search);
      const selectedEvaluation = Boolean(params.get("player") || params.get("saved") || params.get("share"));
      const showInitialLoad = storedOptIn && !selectedEvaluation;
      document.documentElement.classList.toggle("mflEvaluationInitialLoadVisible", showInitialLoad);
      if (evaluationButtons instanceof HTMLElement) evaluationButtons.hidden = !showInitialLoad;
      if (evaluationLoadButton instanceof HTMLButtonElement) evaluationLoadButton.hidden = !showInitialLoad;
      if (main instanceof HTMLElement) main.scrollTop = 0;
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
    }

    const quickFilters = storedQuickFilters(route.pageName);
    if (hideMflPlayersFilter instanceof HTMLElement) {
      hideMflPlayersFilter.hidden = lockedRoute || route.pageName !== "database";
    }
    if (packablePlayersFilter instanceof HTMLElement) {
      packablePlayersFilter.hidden = lockedRoute || route.pageName !== "mfl";
    }
    if (!lockedRoute && route.pageId === "progressionPage") {
      if (hideRetiredInput instanceof HTMLInputElement) hideRetiredInput.checked = quickFilters.hideRetired !== false;
      if (hideRetiringInput instanceof HTMLInputElement) hideRetiringInput.checked = Boolean(quickFilters.hideRetiring);
      if (hideMflPlayersInput instanceof HTMLInputElement) {
        hideMflPlayersInput.checked = route.pageName === "database" ? quickFilters.hideMflPlayers !== false : false;
      }
      if (packablePlayersInput instanceof HTMLInputElement) {
        packablePlayersInput.checked = route.pageName === "mfl" ? quickFilters.mflPackable !== false : false;
      }
      if (newMintsInput instanceof HTMLInputElement) newMintsInput.checked = Boolean(quickFilters.newMints);
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
    const DATA_LOADING_REASONS = new Set(["startup", "interaction-loading", "ensureProgressionData", "requestIncrementalRoute", "databaseStatsData", "mflStatsData", "evaluationRouteLoading", "loadSharedEvaluation", "loadSavedEvaluation", "openSavedEvaluationsModal"]);
    const blockedEvents = [
      "pointerdown", "mousedown", "touchstart", "click", "dblclick", "auxclick", "contextmenu",
      "pointerover", "pointerenter", "pointermove", "mouseover", "mouseenter", "mousemove",
    ];
    const scrollGestureEvents = new Set(["pointerdown", "mousedown", "touchstart", "pointermove", "mousemove"]);
    const busyScrollSurfaceSelector = [
      "main", ".tableScroller", ".sidebar", ".views", ".playerAttributeViews",
      ".advancedPlayerTableSection", ".mflStatsAgeDistribution", ".evaluationLoadList",
      ".searchBody", ".filterBuilder", ".advancedSettingsBody",
    ].join(", ");
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

      html.${BUSY_CLASS} body[data-page="mflstats"] #mflStatsPage,
      html.${BUSY_CLASS} body[data-page="mflstats"] #mflStatsPage *,
      html.${BUSY_CLASS} body[data-page="mflstats"] #mflStatsPage *::before,
      html.${BUSY_CLASS} body[data-page="mflstats"] #mflStatsPage *::after {
        pointer-events: none !important;
        transition: none !important;
        animation: none !important;
      }

      html.${BUSY_CLASS} body::after {
        content: "";
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        background: transparent;
        pointer-events: auto !important;
        cursor: wait !important;
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

    function interactionShouldBeBlocked() {
      return activeTokens.size > 0;
    }

    function eventTargetsBusyScrollSurface(event) {
      if (!scrollGestureEvents.has(event.type)) return false;
      const target = event.target instanceof Element ? event.target : null;
      return Boolean(target?.closest(busyScrollSurfaceSelector));
    }

    function blockInteraction(event) {
      if (!interactionShouldBeBlocked()) return;
      if (eventTargetsBusyScrollSurface(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    blockedEvents.forEach((eventName) => {
      document.addEventListener(eventName, blockInteraction, true);
    });

    /** @type {(callback: (...args: any[]) => any, reason: string) => (...args) => Promise<any>} */
    const wrapBusyFunction = (callback, reason) => (...args) => run(() => callback(...args), reason);

    function installCoreBridge() {
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
      installCoreBridge,
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

    window.__mflReleaseVersion = version;
    const entryUrl = new URL("/modules/app-entry.js", window.location.origin);

    try {
      await import(entryUrl.href);
    } catch (error) {
      document.documentElement.dataset.mflReady = "error";
      console.error("Could not import the MFL Front Office entry module.", error);
    }
  })();
})();
