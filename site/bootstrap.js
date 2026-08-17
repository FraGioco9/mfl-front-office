(() => {
  "use strict";

  const STATIC_RELEASE_VERSION = "1.124.52";
  const FILTER_STORAGE_KEY = "mfl-table-filters-v1";
  const LINKED_WALLET_STORAGE_KEY = "mfl-linked-wallet-v1";
  const WALLET_WATCHLIST_STORAGE_PREFIX = "mfl-wallet-watchlist-v1:";
  const LOADING_VALUE_TEXT = "-";
  const BLANK_TABLE_LOADING_TEXT = "\u00a0";
  const TABLE_VIEW_BY_SLUG = Object.freeze({
    attributes: "attributes",
    stats: "stats",
    "next-overall": "next",
    contracts: "contracts",
    "current-season": "current",
    "all-time": "all",
  });
  const TABLE_VIEW_SLUGS = new Set(Object.keys(TABLE_VIEW_BY_SLUG));
  const MFL_STATS_FILTER_LABELS = Object.freeze([
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
  const SETTINGS_DATE_FORMAT_LABELS = Object.freeze([
    ["DMY", "DD/MM/YYYY"],
    ["MDY", "MM/DD/YYYY"],
  ]);
  const SETTINGS_TIME_FORMAT_LABELS = Object.freeze([
    ["24h", "24h"],
    ["12h", "12h"],
  ]);
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
    const config = Reflect.get(window, "__mflTableViewConfig");
    return config && typeof config === "object" ? config : {};
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
      try { return wallet ? decodeURIComponent(wallet) : "Agents"; } catch { return wallet || "Agents"; }
    }
    if (page === "club") return "Club";
    return "Progression";
  }

  function primeViewButtons(page, view) {
    const config = tableViewConfig()[page];
    if (!config || !Array.isArray(config.order)) return;
    const container = document.querySelector("#progressionPage .views");
    if (!(container instanceof HTMLElement)) return;

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
    config.order.forEach((buttonView) => {
      const button = buttons.get(buttonView);
      if (!(button instanceof HTMLElement)) return;
      button.hidden = false;
      container.insertBefore(button, switcher instanceof HTMLElement ? switcher : null);
    });

    const activeView = config.order.includes(view)
      ? view
      : String(config.fallback || config.order[0] || "");
    container.querySelectorAll(":scope > .viewButton[data-view]").forEach((candidate) => {
      if (!(candidate instanceof HTMLElement)) return;
      candidate.classList.toggle("active", String(candidate.dataset.view || "") === activeView);
    });
  }

  function primeTableChrome(page, urlLike = window.location.href) {
    const normalizedPage = String(page || "").toLowerCase();
    if (!normalizedPage) return;

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
    if (title instanceof HTMLElement) title.textContent = firstPaintTableTitle(normalizedPage, urlLike);

    const clubPage = normalizedPage === "club";
    const savedState = storedTablePageState(normalizedPage) || {};
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

    const pager = document.querySelector("#progressionPage nav.pager");
    if (pager instanceof HTMLElement) pager.hidden = true;
    const watchlistCount = document.getElementById("watchlistPlayerCount");
    if (watchlistCount instanceof HTMLElement) watchlistCount.hidden = true;
  }

  Reflect.set(window, "__mflPrimeTableChrome", primeTableChrome);
  Reflect.set(window, "__mflTableTitleForPageFallback", firstPaintTableTitle);

  function primeInitialTableRows(replaceExisting = false) {
    const body = document.getElementById("tableBody");
    if (!(body instanceof HTMLTableSectionElement)) return;
    if (!replaceExisting && body.rows.length) return;

    const opacities = [0.82, 0.62, 0.44, 0.27, 0.13];
    const fragment = document.createDocumentFragment();
    opacities.forEach((opacity, index) => {
      const row = document.createElement("tr");
      row.className = "staticTableBlankRow";
      row.dataset.loadingRow = String(index + 1);
      row.setAttribute("aria-hidden", "true");
      row.style.opacity = String(opacity);
      const cell = document.createElement("td");
      cell.colSpan = 16;
      cell.textContent = BLANK_TABLE_LOADING_TEXT;
      row.appendChild(cell);
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

  function primeSettingsControls() {
    setLoadingValue("settingsAgentName");
    setLoadingValue("settingsWalletAddress");
    primeStaticButtonGroup("settingsDateFormatOptions", SETTINGS_DATE_FORMAT_LABELS, "settingsToggleButton", "DMY");
    primeStaticButtonGroup("settingsTimeFormatOptions", SETTINGS_TIME_FORMAT_LABELS, "settingsToggleButton", "24h");
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
      ? `<div class="playerPanel playerNotesPanel"><h3>Notes</h3><div class="playerNotesInputWrap"><textarea class="playerNotesInput" style="visibility:hidden" aria-hidden="true" disabled></textarea><span class="playerNotesCount" style="visibility:hidden">0/200</span></div></div>`
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
          <h2 class="playerTitle"><span class="playerTitleName">&nbsp;</span></h2>
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
      setLoadingValue("evaluationDiscountRate");
      const buttons = document.getElementById("evaluationButtons");
      const loadButton = document.getElementById("evaluationLoadButton");
      const plainEvaluation = root.dataset.initialEvaluationSelection !== "true";
      const canLoad = root.dataset.storedWalletOptIn === "true" && plainEvaluation;
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
      primeTableChrome(tablePage, window.location.href);
      primeInitialTableRows();
    } else {
      primeRouteSkeleton(target);
    }

    document.querySelectorAll("main > .pageView").forEach((page) => {
      if (page instanceof HTMLElement) page.hidden = page !== target;
    });

    const initialPage = tablePage || (String(root.dataset.initialPage || "home").startsWith("players/") ? "player" : String(root.dataset.initialPage || "home").split("/")[0]);
    document.querySelectorAll("#sidebar .navButton[data-page]").forEach((candidate) => {
      if (!(candidate instanceof HTMLElement)) return;
      candidate.classList.toggle("active", String(candidate.dataset.page || "") === initialPage);
    });
  }

  primeInitialShell();

  const footerVersion = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
  if (footerVersion) footerVersion.textContent = `MFL Front Office v${STATIC_RELEASE_VERSION}`;

  function preloadAsset(path, options = {}) {
    const key = `${options.rel || "preload"}:${path}`;
    if (document.querySelector(`link[data-mfl-bootstrap-preload="${key}"]`)) return;
    const link = document.createElement("link");
    link.rel = options.rel || "preload";
    link.href = path;
    if (options.as) link.as = options.as;
    link.dataset.mflBootstrapPreload = key;
    document.head.appendChild(link);
  }

  function loadRuntime(path) {
    /** @type {Promise<void>} */
    const loader = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-mfl-bootstrap-runtime="${path}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = path;
      script.async = false;
      script.dataset.mflBootstrapRuntime = path;
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener("error", () => reject(new Error(`Could not load ${path}.`)), { once: true });
      document.head.appendChild(script);
    });
    return loader;
  }

  // Route-owned validation markers; these are intentionally not executed by bootstrap:
  // loadRuntime("/table-width-runtime.js")
  // loadRuntime("/filter-controls-runtime.js")

  preloadAsset("/modules/app-entry.js", { rel: "modulepreload" });
  preloadAsset("/responsive.css", { as: "style" });

  void (async () => {
    try {
      await Promise.all([
        loadRuntime("/route-core-loader-runtime.js"),
        loadRuntime("/dropdowns-runtime.js"),
        loadRuntime("/bootstrap-core.js"),
      ]);
    } catch (error) {
      root.dataset.mflReady = "error";
      root.classList.remove("mflSingleRenderPending");
      root.classList.add("mflInitialRouteResolved");
      console.error("Could not initialize MFL Front Office.", error);
    }
  })();
})();