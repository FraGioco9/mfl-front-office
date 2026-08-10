(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "1.123.28");
  const FILTER_STORAGE_KEY = "mfl-table-filters-v1";
  const WAIT_HOVER_CLASS = "mflWaitHoverSuppressed";
  const VIEW_ORDER = Object.freeze({
    database: ["attributes", "contracts", "stats"],
    mfl: ["attributes", "stats"],
    progression: ["current", "all"],
    agents: ["attributes", "next", "contracts", "current", "all"],
    watchlist: ["attributes", "next", "contracts", "current", "all"],
    myplayers: ["attributes", "next", "contracts", "current", "all"],
    club: ["attributes", "next", "contracts", "current", "all"],
  });

  const previous = window.__mflDatabaseStaticFilterRuntime;
  previous?.destroy?.();

  let destroyed = false;
  let lastTablePage = "";
  let frame = 0;
  let observer = null;

  function normalizePageName(value) {
    const page = String(value || "").toLowerCase();
    if (page === "my-players") return "myplayers";
    if (page === "agent") return "agents";
    if (page === "clubs") return "club";
    return page;
  }

  function tablePageFromPath(pathname = window.location.pathname) {
    const parts = String(pathname || "/").split("/").filter(Boolean);
    const first = String(parts[0] || "").toLowerCase();
    if (first === "my-players") return "myplayers";
    if (first === "clubs" || first === "club") return "club";
    if (["database", "mfl", "progression", "watchlist", "agents"].includes(first)) return first;
    return "";
  }

  function currentTablePage() {
    const bodyPage = normalizePageName(document.body?.dataset.page);
    if (VIEW_ORDER[bodyPage]) return bodyPage;
    return tablePageFromPath();
  }

  function defaultQuickFilters(pageName) {
    return {
      hideRetired: true,
      hideRetiring: false,
      hideMflPlayers: pageName === "database",
      mflPackable: pageName === "mfl",
      newMints: false,
    };
  }

  function cachedQuickFilters(pageName) {
    const defaults = defaultQuickFilters(pageName);
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

  function syncQuickFilterLabels(pageName) {
    const hideMflPlayersFilter = document.getElementById("hideMflPlayersFilter");
    const packablePlayersFilter = document.getElementById("packablePlayersFilter");
    if (hideMflPlayersFilter instanceof HTMLElement) {
      hideMflPlayersFilter.hidden = pageName !== "database";
      hideMflPlayersFilter.toggleAttribute("aria-hidden", pageName !== "database");
    }
    if (packablePlayersFilter instanceof HTMLElement) {
      packablePlayersFilter.hidden = pageName !== "mfl";
      packablePlayersFilter.toggleAttribute("aria-hidden", pageName !== "mfl");
    }
  }

  function applyCachedQuickFilters(pageName) {
    if (!VIEW_ORDER[pageName]) return;
    const cached = cachedQuickFilters(pageName);
    const hideRetiredInput = document.getElementById("hideRetiredInput");
    const hideRetiringInput = document.getElementById("hideRetiringInput");
    const hideMflPlayersInput = document.getElementById("hideMflPlayersInput");
    const packablePlayersInput = document.getElementById("packablePlayersInput");
    const newMintsInput = document.getElementById("newMintsInput");

    if (hideRetiredInput instanceof HTMLInputElement) hideRetiredInput.checked = cached.hideRetired !== false;
    if (hideRetiringInput instanceof HTMLInputElement) hideRetiringInput.checked = Boolean(cached.hideRetiring);
    if (hideMflPlayersInput instanceof HTMLInputElement) {
      hideMflPlayersInput.checked = pageName === "database" ? cached.hideMflPlayers !== false : false;
    }
    if (packablePlayersInput instanceof HTMLInputElement) {
      packablePlayersInput.checked = pageName === "mfl" ? cached.mflPackable !== false : false;
    }
    if (newMintsInput instanceof HTMLInputElement) newMintsInput.checked = Boolean(cached.newMints);
  }

  function syncViewButtons(pageName) {
    const order = VIEW_ORDER[pageName];
    const views = document.querySelector("#progressionPage .views");
    if (!order || !(views instanceof HTMLElement)) return;

    const allowed = new Set(order);
    views.querySelectorAll(".viewButton[data-view]").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      button.hidden = !allowed.has(String(button.dataset.view || ""));
    });

    const switcher = document.getElementById("watchlistSwitcher");
    order.forEach((viewName) => {
      const button = views.querySelector(`.viewButton[data-view="${viewName}"]`);
      if (button) views.insertBefore(button, switcher || null);
    });
  }

  function primeTableChrome(pageName) {
    const normalized = normalizePageName(pageName);
    if (!VIEW_ORDER[normalized]) return;
    syncQuickFilterLabels(normalized);
    applyCachedQuickFilters(normalized);
    syncViewButtons(normalized);
    lastTablePage = normalized;
  }

  function syncTableChrome() {
    frame = 0;
    if (destroyed) return;
    const pageName = currentTablePage();
    if (!pageName) return;
    syncQuickFilterLabels(pageName);
    syncViewButtons(pageName);
    if (pageName !== lastTablePage) {
      applyCachedQuickFilters(pageName);
      lastTablePage = pageName;
    }
  }

  function scheduleTableChrome() {
    if (destroyed || frame) return;
    frame = requestAnimationFrame(syncTableChrome);
  }

  function elementHasWaitCursor(element, pseudoElement = null) {
    if (!(element instanceof Element)) return false;
    try {
      return getComputedStyle(element, pseudoElement).cursor === "wait";
    } catch {
      return false;
    }
  }

  function waitCursorActive(target = null) {
    return document.documentElement.classList.contains("mflInteractionBusy")
      || elementHasWaitCursor(target)
      || elementHasWaitCursor(document.documentElement)
      || elementHasWaitCursor(document.body)
      || elementHasWaitCursor(document.body, "::before");
  }

  function syncWaitHover(target = null) {
    if (destroyed) return;
    document.documentElement.classList.toggle(WAIT_HOVER_CLASS, waitCursorActive(target));
  }

  function installStyles() {
    if (document.getElementById("mflTableChromeRuntimeStyles")) return;
    const style = document.createElement("style");
    style.id = "mflTableChromeRuntimeStyles";
    style.textContent = `
      #mflStatsPage #mflStatsOverallFilters {
        display: flex !important;
        flex-wrap: nowrap !important;
        gap: 6px !important;
        width: 100% !important;
      }

      #mflStatsPage #mflStatsOverallFilters .mflStatsFilterButton {
        flex: 1 1 0 !important;
        width: auto !important;
        min-width: 0 !important;
        padding-left: 5px !important;
        padding-right: 5px !important;
        white-space: nowrap !important;
      }

      html.${WAIT_HOVER_CLASS} body,
      html.${WAIT_HOVER_CLASS} body *,
      html.${WAIT_HOVER_CLASS} body *::before,
      html.${WAIT_HOVER_CLASS} body *::after {
        cursor: wait !important;
      }

      html.${WAIT_HOVER_CLASS} body * {
        pointer-events: none !important;
      }

      html.${WAIT_HOVER_CLASS} body *,
      html.${WAIT_HOVER_CLASS} body *::before,
      html.${WAIT_HOVER_CLASS} body *::after {
        transition: none !important;
        animation: none !important;
      }

      html.${WAIT_HOVER_CLASS} body *:hover,
      html.${WAIT_HOVER_CLASS} body *:hover::before,
      html.${WAIT_HOVER_CLASS} body *:hover::after {
        transform: none !important;
      }

      html.${WAIT_HOVER_CLASS} body::after {
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
    `;
    document.head.appendChild(style);
  }

  function onPointerDown(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const nav = target.closest("#sidebar .navButton[data-page]");
    if (nav instanceof HTMLElement) {
      const destination = normalizePageName(nav.dataset.page);
      if (VIEW_ORDER[destination]) primeTableChrome(destination);
    }
    syncWaitHover(target);
  }

  function onPointerActivity(event) {
    const target = event.target instanceof Element ? event.target : null;
    syncWaitHover(target);
  }

  function onPopState() {
    primeTableChrome(tablePageFromPath());
    syncWaitHover();
  }

  installStyles();
  primeTableChrome(currentTablePage());
  syncWaitHover();

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointerover", onPointerActivity, true);
  document.addEventListener("pointermove", onPointerActivity, true);
  window.addEventListener("popstate", onPopState);

  observer = new MutationObserver(() => {
    scheduleTableChrome();
    syncWaitHover();
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "data-initial-page"],
  });
  if (document.body) {
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "style", "data-page"],
    });
  }

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    observer?.disconnect();
    observer = null;
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointerover", onPointerActivity, true);
    document.removeEventListener("pointermove", onPointerActivity, true);
    window.removeEventListener("popstate", onPopState);
    document.documentElement.classList.remove(WAIT_HOVER_CLASS);
  }

  window.__mflDatabaseStaticFilterRuntime = Object.freeze({
    version: VERSION,
    sync: syncTableChrome,
    prime: primeTableChrome,
    destroy,
  });
})();
