(() => {
  "use strict";

  const STYLE_ID = "mflStaticRouteChromeStyles";
  const PENDING_PAGE_ATTRIBUTE = "data-mfl-pending-table-page";
  const VIEW_BY_SLUG = Object.freeze({
    attributes: "attributes",
    squad: "attributes",
    stats: "stats",
    "next-overall": "next",
    contracts: "contracts",
    "current-season": "current",
    "all-time": "all",
  });

  window.__mflStaticUiRuntime?.destroy?.();

  let destroyed = false;
  let bodyPageObserver = null;

  function tableViewConfig() {
    const configured = window.__mflTableViewConfig;
    return configured && typeof configured === "object" ? configured : {};
  }

  function routeState(urlLike = window.location.href) {
    let url;
    try {
      url = new URL(String(urlLike || window.location.href), window.location.href);
    } catch {
      url = new URL(window.location.href);
    }

    const parts = url.pathname.split("/").filter(Boolean);
    const first = String(parts[0] || "").toLowerCase();
    const page = first === "my-players"
      ? "myplayers"
      : first === "clubs" || first === "club"
        ? "club"
        : ["database", "mfl", "progression", "watchlist", "agents"].includes(first)
          ? first
          : first === "players"
            ? "player"
            : first || "home";
    const requestedView = VIEW_BY_SLUG[String(parts.at(-1) || "").toLowerCase()] || "";
    const config = tableViewConfig()[page];
    const view = config && Array.isArray(config.order) && config.order.includes(requestedView)
      ? requestedView
      : String(config?.fallback || requestedView || "");
    return { page, view };
  }

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const config = tableViewConfig();
    const rules = [];

    Object.entries(config).forEach(([page, entry]) => {
      if (!entry || !Array.isArray(entry.order) || !entry.order.length) return;
      const selectors = [
        `body[data-page="${page}"]`,
        `html[${PENDING_PAGE_ATTRIBUTE}="${page}"] body`,
      ];
      selectors.forEach((scope) => {
        rules.push(`${scope} #progressionPage .views > .viewButton { display: none !important; }`);
        entry.order.forEach((view, index) => {
          rules.push(`${scope} #progressionPage .views > .viewButton[data-view="${view}"]:not([hidden]) { display: inline-flex !important; order: ${index + 1} !important; }`);
        });
      });
    });

    rules.push(
      `html[data-stored-progression-access="false"] body[data-page="watchlist"] #progressionPage .views > .viewButton:is([data-view="current"], [data-view="all"]), html[data-stored-progression-access="false"][${PENDING_PAGE_ATTRIBUTE}="watchlist"] #progressionPage .views > .viewButton:is([data-view="current"], [data-view="all"]) { display: none !important; }`,
      `body[data-page="club"] #progressionPage .views > .viewButton[data-view="attributes"], html[${PENDING_PAGE_ATTRIBUTE}="club"] #progressionPage .views > .viewButton[data-view="attributes"] { font-size: 0 !important; }`,
      `body[data-page="club"] #progressionPage .views > .viewButton[data-view="attributes"]::after, html[${PENDING_PAGE_ATTRIBUTE}="club"] #progressionPage .views > .viewButton[data-view="attributes"]::after { content: "Squad"; font-size: 14px; }`,
    );

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = rules.join("\n");
    document.head.appendChild(style);
  }

  function syncFooter() {
    const version = String(window.__mflReleaseVersion || window.__mflRelease?.version || "").trim();
    if (!/^\d+\.\d+\.\d+$/.test(version)) return;
    const footer = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
    if (footer instanceof HTMLElement) footer.textContent = `MFL Front Office v${version}`;
    document.querySelectorAll("[data-app-version]").forEach((element) => {
      if (element instanceof HTMLElement) element.textContent = `v${version}`;
    });
  }

  function setActiveNavigation(page) {
    document.querySelectorAll("#sidebar .navButton[data-page]").forEach((button) => {
      const buttonPage = String(button.dataset.page || "").toLowerCase();
      button.classList.toggle("active", buttonPage === page || (page === "myplayers" && buttonPage === "myplayers"));
    });
  }

  function setActiveView(container, view) {
    if (!(container instanceof Element) || !view) return;
    container.querySelectorAll(".viewButton[data-view]").forEach((button) => {
      button.classList.toggle("active", String(button.dataset.view || "") === view);
    });
  }

  function syncSharedViewSet(page, view) {
    const config = tableViewConfig()[page];
    if (!config || !Array.isArray(config.order)) return;
    const container = document.querySelector("#progressionPage .views");
    if (!(container instanceof Element)) return;
    const allowed = new Set(config.order);
    container.querySelectorAll(":scope > .viewButton[data-view]").forEach((button) => {
      const buttonView = String(button.dataset.view || "");
      button.hidden = !allowed.has(buttonView);
      if (allowed.has(buttonView)) button.style.order = String(config.order.indexOf(buttonView) + 1);
    });
    const activeView = allowed.has(view) ? view : String(config.fallback || config.order[0] || "");
    setActiveView(container, activeView);
  }

  function syncStatsViews(page, view) {
    if (page === "database" && view === "stats") {
      setActiveView(document.querySelector("#databaseStatsPage .views"), "stats");
    }
    if (page === "mfl" && view === "stats") {
      setActiveView(document.querySelector("#mflStatsPage .views"), "stats");
    }
  }

  function routeNeedsLockedShell(page) {
    return document.documentElement.dataset.storedWalletOptIn !== "true"
      && ["watchlist", "myplayers", "settings"].includes(page);
  }

  function shellForRoute(state) {
    if (routeNeedsLockedShell(state.page)) return document.getElementById("myPlayersLockedPage");
    if (state.page === "database" && state.view === "stats") return document.getElementById("databaseStatsPage");
    if (state.page === "mfl" && state.view === "stats") return document.getElementById("mflStatsPage");
    if (tableViewConfig()[state.page]) return document.getElementById("progressionPage");
    if (state.page === "evaluation") return document.getElementById("evaluationPage");
    if (state.page === "player") return document.getElementById("playerPage");
    if (state.page === "settings") return document.getElementById("settingsPage");
    if (state.page === "changelog") return document.getElementById("changelogPage");
    return document.getElementById("homePage");
  }

  function showRouteShell(state, { loading = false } = {}) {
    const target = shellForRoute(state);
    if (!(target instanceof HTMLElement)) return;
    document.querySelectorAll("main > .pageView").forEach((page) => {
      if (page instanceof HTMLElement) page.hidden = page !== target;
    });
    if (loading && target.id === "progressionPage") {
      window.__mflTableLoadingRuntime?.show?.({ replaceExisting: true, forceRoute: true });
    }
  }

  function syncRouteChrome(urlLike = window.location.href, { pending = false } = {}) {
    const state = routeState(urlLike);
    syncFooter();
    setActiveNavigation(state.page);
    syncSharedViewSet(state.page, state.view);
    syncStatsViews(state.page, state.view);
    if (pending && tableViewConfig()[state.page]) {
      document.documentElement.setAttribute(PENDING_PAGE_ATTRIBUTE, state.page);
    } else if (!pending) {
      document.documentElement.removeAttribute(PENDING_PAGE_ATTRIBUTE);
    }
    showRouteShell(state, {
      loading: pending || document.documentElement.classList.contains("mflSingleRenderPending"),
    });
    return state;
  }

  function routeUrlFromElement(element) {
    if (!(element instanceof Element)) return "";
    const href = element.getAttribute("href");
    return href ? new URL(href, window.location.href).href : "";
  }

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const nav = target?.closest?.("#sidebar .navButton[data-page]");
    if (nav instanceof HTMLElement) {
      const href = routeUrlFromElement(nav);
      if (href) syncRouteChrome(href, { pending: true });
      return;
    }

    const viewButton = target?.closest?.("main .views .viewButton[data-view]");
    if (!(viewButton instanceof HTMLButtonElement)) return;
    const container = viewButton.closest(".views");
    const view = String(viewButton.dataset.view || "");
    if (container) setActiveView(container, view);

    const page = String(viewButton.dataset.page || routeState().page || "");
    if (container?.matches("#progressionPage .views")) {
      syncSharedViewSet(page, view);
    }
    if (tableViewConfig()[page]) document.documentElement.setAttribute(PENDING_PAGE_ATTRIBUTE, page);
    showRouteShell({ page, view }, { loading: true });
  }

  function onKeyDown(event) {
    if (event.key !== "Escape") return;
    queueMicrotask(() => {
      if (destroyed) return;
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) active.blur();
      const selection = window.getSelection?.();
      if (selection && !selection.isCollapsed) selection.removeAllRanges();
    });
  }

  function onPopState() {
    syncRouteChrome(window.location.href, { pending: true });
  }

  function onBodyPageChange() {
    const pendingPage = document.documentElement.getAttribute(PENDING_PAGE_ATTRIBUTE);
    const bodyPage = String(document.body?.dataset.page || "");
    if (pendingPage && bodyPage === pendingPage) {
      document.documentElement.removeAttribute(PENDING_PAGE_ATTRIBUTE);
    }
  }

  function sync() {
    installStyles();
    syncRouteChrome(window.location.href);
  }

  function destroy() {
    destroyed = true;
    bodyPageObserver?.disconnect();
    bodyPageObserver = null;
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("popstate", onPopState);
    document.documentElement.removeAttribute(PENDING_PAGE_ATTRIBUTE);
    document.getElementById(STYLE_ID)?.remove();
  }

  installStyles();
  syncRouteChrome(window.location.href);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("popstate", onPopState);
  if (document.body) {
    bodyPageObserver = new MutationObserver(onBodyPageChange);
    bodyPageObserver.observe(document.body, { attributes: true, attributeFilter: ["data-page"] });
  }

  window.__mflStaticUiRuntime = Object.freeze({ sync, destroy });
})();
