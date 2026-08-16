(() => {
  "use strict";

  const STATIC_RELEASE_VERSION = "1.124.43";
  const FILTER_STORAGE_KEY = "mfl-table-filters-v1";
  const root = document.documentElement;
  window.__mflReleaseVersion = STATIC_RELEASE_VERSION;

  root.classList.add("mflSingleRenderPending");
  root.classList.remove("mflInitialRouteResolved");

  function routeParts(urlLike = window.location.href) {
    try {
      return new URL(String(urlLike || window.location.href), window.location.href).pathname.split("/").filter(Boolean);
    } catch {
      return window.location.pathname.split("/").filter(Boolean);
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

  function firstPaintTableTitle(page, urlLike = window.location.href) {
    const currentTitle = document.getElementById("tablePageTitle");
    const currentBodyPage = String(document.body?.dataset.page || "").toLowerCase();
    const currentText = String(currentTitle?.textContent || "").trim();
    if (["watchlist", "agents", "club"].includes(page) && currentBodyPage === page && currentText && currentText !== "Progression") {
      return currentText;
    }

    if (page === "database") return "Database";
    if (page === "mfl") return "MFL Wallet";
    if (page === "progression") return "Progression";
    if (page === "myplayers") return "My Players";
    if (page === "watchlist") {
      const watchlistName = String(document.getElementById("watchlistButtonText")?.textContent || "Default").trim() || "Default";
      return `Watchlist - ${watchlistName}`;
    }
    const parts = routeParts(urlLike);
    if (page === "agents") {
      const wallet = String(parts[1] || "").trim();
      try { return wallet ? decodeURIComponent(wallet) : "Agents"; } catch { return wallet || "Agents"; }
    }
    if (page === "club") return "Club";
    return "Progression";
  }

  function storedTablePageState(page) {
    try {
      const saved = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || "null");
      const pageState = saved?.pages?.[page];
      return pageState && typeof pageState === "object" && !Array.isArray(pageState) ? pageState : null;
    } catch {
      return null;
    }
  }

  function primeInitialTableChrome(page, urlLike = window.location.href) {
    const normalizedPage = String(page || "").toLowerCase();
    if (!normalizedPage) return;

    const title = document.getElementById("tablePageTitle");
    if (title instanceof HTMLElement) title.textContent = firstPaintTableTitle(normalizedPage, urlLike);

    const quickFilters = document.querySelector("#progressionPage .quickFilters");
    if (quickFilters instanceof HTMLElement) quickFilters.hidden = normalizedPage === "club";

    const hideMflPlayersFilter = document.getElementById("hideMflPlayersFilter");
    if (hideMflPlayersFilter instanceof HTMLElement) hideMflPlayersFilter.hidden = normalizedPage !== "database";

    const packablePlayersFilter = document.getElementById("packablePlayersFilter");
    if (packablePlayersFilter instanceof HTMLElement) packablePlayersFilter.hidden = normalizedPage !== "mfl";

    const newMintsLabel = document.getElementById("newMintsLabel");
    if (newMintsLabel instanceof HTMLElement) {
      newMintsLabel.textContent = normalizedPage === "mfl" ? "Only aged players" : "Only new mints";
    }

    const attributesView = document.querySelector('#progressionPage .views > .viewButton[data-view="attributes"]');
    if (attributesView instanceof HTMLButtonElement) {
      attributesView.textContent = normalizedPage === "club" ? "Squad" : "Attributes";
    }

    const savedState = storedTablePageState(normalizedPage) || {};
    const clubPage = normalizedPage === "club";
    const hideRetiredInput = document.getElementById("hideRetiredInput");
    if (hideRetiredInput instanceof HTMLInputElement) {
      hideRetiredInput.checked = clubPage ? false : savedState.hideRetired !== false;
    }
    const hideRetiringInput = document.getElementById("hideRetiringInput");
    if (hideRetiringInput instanceof HTMLInputElement) {
      hideRetiringInput.checked = clubPage ? false : Boolean(savedState.hideRetiring);
    }
    const hideMflPlayersInput = document.getElementById("hideMflPlayersInput");
    if (hideMflPlayersInput instanceof HTMLInputElement) {
      hideMflPlayersInput.checked = normalizedPage === "database"
        ? (savedState.hideMflPlayers !== undefined ? Boolean(savedState.hideMflPlayers) : true)
        : false;
    }
    const packablePlayersInput = document.getElementById("packablePlayersInput");
    if (packablePlayersInput instanceof HTMLInputElement) {
      packablePlayersInput.checked = normalizedPage === "mfl"
        ? (savedState.mflPackable !== undefined ? Boolean(savedState.mflPackable) : true)
        : false;
    }
    const newMintsInput = document.getElementById("newMintsInput");
    if (newMintsInput instanceof HTMLInputElement) {
      newMintsInput.checked = clubPage ? false : Boolean(savedState.newMints);
    }

    const pager = document.querySelector("#progressionPage nav.pager");
    if (pager instanceof HTMLElement) pager.hidden = true;
    const watchlistCount = document.getElementById("watchlistPlayerCount");
    if (watchlistCount instanceof HTMLElement) watchlistCount.hidden = true;
  }

  Reflect.set(window, "__mflPrimeTableChrome", primeInitialTableChrome);
  Reflect.set(window, "__mflTableTitleForPageFallback", firstPaintTableTitle);

  function primeInitialTableRows(replaceExisting = false) {
    const body = document.getElementById("tableBody");
    if (!(body instanceof HTMLTableSectionElement) || (body.rows.length && !replaceExisting)) return;
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
      cell.textContent = "\u00a0";
      row.appendChild(cell);
      fragment.appendChild(row);
    });
    body.replaceChildren(fragment);
    body.dataset.staticLoading = "true";
  }

  Reflect.set(window, "__mflPrimeTableRows", primeInitialTableRows);

  function primeRouteSkeleton(target) {
    if (!(target instanceof HTMLElement)) return;
    if (target.id === "playerPage") {
      const playerDetail = document.getElementById("playerDetail");
      if (playerDetail instanceof HTMLElement) {
        playerDetail.innerHTML = '<div class="emptyState">Loading player...</div>';
      }
      return;
    }
    if (target.id === "evaluationPage") {
      const evaluationPanel = document.getElementById("evaluationPanel");
      if (evaluationPanel instanceof HTMLElement) evaluationPanel.hidden = true;
      const evaluationSearchResults = document.getElementById("evaluationSearchResults");
      if (evaluationSearchResults instanceof HTMLElement) evaluationSearchResults.hidden = true;
    }
  }

  Reflect.set(window, "__mflPrimeRouteSkeleton", primeRouteSkeleton);

  function primeInitialShell() {
    const target = initialShellTarget();
    if (!(target instanceof HTMLElement)) return;
    const tablePage = String(root.dataset.initialTablePage || "").toLowerCase();
    if (target.id === "progressionPage" && tablePage) {
      primeInitialTableChrome(tablePage, window.location.href);
      primeInitialTableRows();
    } else {
      primeRouteSkeleton(target);
    }
    document.querySelectorAll("main > .pageView").forEach((page) => {
      if (page instanceof HTMLElement) page.hidden = page !== target;
    });
  }

  if (!document.getElementById("mflSingleRenderPendingStyles")) {
    const style = document.createElement("style");
    style.id = "mflSingleRenderPendingStyles";
    style.textContent = `
      html.mflSingleRenderPending #mflStartupError { display: none !important; }
      html.mflSingleRenderPending #progressionPage nav.pager { display: none !important; }
      html.mflSingleRenderPending[data-initial-page="evaluation"] #evaluationPage .evaluationTitleRow { align-items: center !important; }
      html.mflSingleRenderPending[data-initial-table-page="club"] #progressionPage .views > .viewButton[data-view="attributes"] { font-size: inherit !important; }
      html.mflSingleRenderPending[data-initial-table-page="club"] #progressionPage .views > .viewButton[data-view="attributes"]::after { content: none !important; display: none !important; }
      html.mflSingleRenderPending #tableBody > .staticTableBlankRow,
      html.mflSingleRenderPending #tableBody > .staticTableBlankRow > td {
        pointer-events: none !important;
        transition: none !important;
        animation: none !important;
      }
      html.mflSingleRenderPending #tableBody > .staticTableBlankRow > td {
        height: 39px !important;
        min-height: 39px !important;
        padding-top: 0 !important;
        padding-bottom: 0 !important;
        background: var(--surface-muted) !important;
        color: transparent !important;
        user-select: none !important;
      }
    `;
    document.head.appendChild(style);
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
      /* Keep only universal bootstrap ownership here. Route-specific table/filter
       * owners are requested by app-entry before the destination core render. */
      await Promise.all([
        loadRuntime("/route-core-loader-runtime.js"),
        loadRuntime("/dropdowns-runtime.js"),
        loadRuntime("/bootstrap-core.js"),
      ]);
    } catch (error) {
      root.dataset.mflReady = "error";
      root.classList.remove("mflSingleRenderPending");
      root.classList.add("mflInitialRouteResolved");
      document.getElementById("mflSingleRenderPendingStyles")?.remove();
      console.error("Could not initialize MFL Front Office.", error);
    }
  })();
})();
