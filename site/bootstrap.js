(() => {
  "use strict";

  const STATIC_RELEASE_VERSION = "1.124.44";
  const FILTER_STORAGE_KEY = "mfl-table-filters-v1";
  const root = document.documentElement;
  window.__mflReleaseVersion = STATIC_RELEASE_VERSION;

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

  function primeInitialTableChrome(page, urlLike = window.location.href) {
    const normalizedPage = String(page || "").toLowerCase();
    if (!normalizedPage) return;

    const config = tableViewConfig()[normalizedPage];
    const requestedView = String(root.dataset.initialTablePage || "") === normalizedPage
      ? String(root.dataset.initialTableView || "")
      : "";
    const view = config?.order?.includes(requestedView) ? requestedView : String(config?.fallback || requestedView || "");
    primeViewButtons(normalizedPage, view);

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

  Reflect.set(window, "__mflPrimeTableChrome", primeInitialTableChrome);
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
      cell.textContent = "\u00a0";
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

  function resetStatsShell(target) {
    if (target.id === "databaseStatsPage") {
      ["databaseStatsTotalPlayers", "databaseStatsRetiringThree", "databaseStatsRetiringTwo", "databaseStatsRetiringOne", "databaseStatsRetired"]
        .forEach((id) => {
          const element = document.getElementById(id);
          if (element instanceof HTMLElement) element.textContent = "-";
        });
      document.getElementById("databaseStatsDistribution")?.replaceChildren();
      return;
    }
    if (target.id === "mflStatsPage") {
      ["mflStatsTotalPlayers", "mflStatsPackablePlayers", "mflStatsAgedPlayers", "mflStatsOtherPlayers"]
        .forEach((id) => {
          const element = document.getElementById(id);
          if (element instanceof HTMLElement) element.textContent = "-";
        });
      document.getElementById("mflStatsAgeDistribution")?.replaceChildren();
    }
  }

  function primePlayerSkeleton() {
    const playerDetail = document.getElementById("playerDetail");
    if (!(playerDetail instanceof HTMLElement)) return;
    playerDetail.innerHTML = `
      <section class="playerHero" aria-hidden="true">
        <div><span class="playerEyebrow">Player</span><h2>-</h2><p>-</p></div>
      </section>
      <section class="playerGrid" aria-hidden="true">
        <section class="playerStack">
          <section class="playerPanel playerInfoPanel"><h3>Details</h3><div class="detailGrid">${Array.from({ length: 8 }, () => "<div><span>&nbsp;</span><strong>-</strong></div>").join("")}</div></section>
          <section class="playerPanel attributesPanel"><h3>Attributes</h3><div class="attributeGrid">${Array.from({ length: 6 }, () => "<div class=\"playerAttributeCard\"><span>&nbsp;</span><strong>-</strong></div>").join("")}</div></section>
        </section>
        <section class="playerPanel pitchPanel"><h3>Positions</h3><div class="emptyState">&nbsp;</div></section>
      </section>`;
  }

  function primeRouteSkeleton(target) {
    if (!(target instanceof HTMLElement)) return;
    if (target.id === "homePage") {
      const players = document.getElementById("homePlayers");
      const wallets = document.getElementById("homeWallets");
      if (players instanceof HTMLElement) players.textContent = "-";
      if (wallets instanceof HTMLElement) wallets.textContent = "-";
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
      const discountRate = document.getElementById("evaluationDiscountRate");
      if (discountRate instanceof HTMLElement) discountRate.textContent = "-";
      const buttons = document.getElementById("evaluationButtons");
      const loadButton = document.getElementById("evaluationLoadButton");
      const plainEvaluation = root.dataset.initialEvaluationSelection !== "true";
      const canLoad = root.dataset.storedWalletOptIn === "true" && plainEvaluation;
      if (buttons instanceof HTMLElement && canLoad) buttons.hidden = false;
      if (loadButton instanceof HTMLElement) loadButton.hidden = !canLoad;
      return;
    }
    resetStatsShell(target);
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
