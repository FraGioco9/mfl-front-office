(() => {
  "use strict";

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
    return { page, view, url: url.href };
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
      button.classList.toggle("active", buttonPage === page);
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
    if (!(container instanceof HTMLElement)) return;

    const buttons = new Map();
    container.querySelectorAll(":scope > .viewButton[data-view]").forEach((button) => {
      const buttonView = String(button.dataset.view || "");
      buttons.set(buttonView, button);
      button.hidden = !config.order.includes(buttonView);
      if (buttonView === "attributes" && button instanceof HTMLButtonElement) {
        button.textContent = page === "club" ? "Squad" : "Attributes";
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
    setActiveView(container, activeView);
  }

  function syncStatsViews(page, view) {
    if (page === "database" && view === "stats") setActiveView(document.querySelector("#databaseStatsPage .views"), "stats");
    if (page === "mfl" && view === "stats") setActiveView(document.querySelector("#mflStatsPage .views"), "stats");
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

  function syncDestinationTableChrome(state) {
    const prime = Reflect.get(window, "__mflPrimeTableChrome");
    if (typeof prime === "function") prime(state.page, state.url || window.location.href);
  }

  function primeDestinationSkeleton(target, state) {
    if (!(target instanceof HTMLElement)) return;
    if (target.id === "progressionPage") {
      const primeRows = Reflect.get(window, "__mflPrimeTableRows");
      if (typeof primeRows === "function") primeRows(true);
      window.__mflTableLoadingRuntime?.show?.({ replaceExisting: true, forceRoute: true });
      return;
    }
    const primeRoute = Reflect.get(window, "__mflPrimeRouteSkeleton");
    if (typeof primeRoute === "function") primeRoute(target, state);
  }

  function showRouteShell(state, { loading = false } = {}) {
    const target = shellForRoute(state);
    if (!(target instanceof HTMLElement)) return;
    if (target.id === "progressionPage") syncDestinationTableChrome(state);
    if (loading) primeDestinationSkeleton(target, state);

    document.querySelectorAll("main > .pageView").forEach((page) => {
      if (page instanceof HTMLElement) page.hidden = page !== target;
    });
  }

  function syncRouteChrome(urlLike = window.location.href, { loading = false } = {}) {
    const state = routeState(urlLike);
    syncFooter();
    setActiveNavigation(state.page);
    syncSharedViewSet(state.page, state.view);
    syncStatsViews(state.page, state.view);
    showRouteShell(state, { loading });
    return state;
  }

  function sameOriginRouteFromLink(element) {
    if (!(element instanceof HTMLAnchorElement)) return "";
    if (element.target && element.target !== "_self") return "";
    if (element.hasAttribute("download")) return "";
    const href = element.getAttribute("href");
    if (!href) return "";
    try {
      const url = new URL(href, window.location.href);
      return url.origin === window.location.origin ? url.href : "";
    } catch {
      return "";
    }
  }

  function onClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target : null;

    const viewButton = target?.closest?.("main .views .viewButton[data-view]");
    if (viewButton instanceof HTMLButtonElement) {
      const container = viewButton.closest(".views");
      const view = String(viewButton.dataset.view || "");
      if (container) setActiveView(container, view);

      const currentState = routeState();
      const page = String(viewButton.dataset.page || currentState.page || "");
      if (container?.matches("#progressionPage .views")) syncSharedViewSet(page, view);
      showRouteShell({ page, view, url: currentState.url }, { loading: true });
      return;
    }

    const link = target?.closest?.("a[href]");
    const href = sameOriginRouteFromLink(link);
    if (href) syncRouteChrome(href, { loading: true });
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
    syncRouteChrome(window.location.href, { loading: true });
  }

  function sync() {
    syncRouteChrome(window.location.href);
  }

  function destroy() {
    destroyed = true;
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("popstate", onPopState);
  }

  syncRouteChrome(window.location.href);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("popstate", onPopState);

  window.__mflStaticUiRuntime = Object.freeze({ sync, destroy });
})();
