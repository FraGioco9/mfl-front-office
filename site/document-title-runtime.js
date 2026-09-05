(() => {
  "use strict";

  window.__mflDocumentTitleRuntime?.destroy?.();

  const APP_NAME = "MFL Front Office";
  const GENERIC_PAGE_LABELS = Object.freeze({
    database: "Database",
    mfl: "MFL",
    progression: "Progression",
    evaluation: "Evaluation",
    watchlist: "Watchlist",
    myplayers: "My Players",
    player: "Player",
    club: "Club",
    agents: "Agent",
    settings: "Settings",
    changelog: "Changelog",
    privacy: "Privacy",
    notfound: "Page not found",
  });
  const GENERIC_TABLE_TITLES = new Set([
    "Database",
    "MFL Wallet",
    "Progression",
    "Watchlist",
    "My Players",
    "Agent",
    "Club",
  ]);

  let destroyed = false;
  let frame = 0;
  let observer = null;
  let stableRouteIdentity = "";
  let stableTitle = "";

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function withAppName(label) {
    const text = cleanText(label);
    return text ? `${text} - ${APP_NAME}` : APP_NAME;
  }

  function normalizedPageName(value) {
    const page = cleanText(value).toLowerCase();
    if (page === "mflstats") return "mfl";
    if (page === "my-players") return "myplayers";
    return page || "home";
  }

  function fallbackRoutePageName() {
    if (document.body?.dataset.page === "notfound") return "notfound";
    const firstPart = String(window.location.pathname || "/").split("/").filter(Boolean)[0]?.toLowerCase() || "";
    if (!firstPart) return "home";
    if (firstPart === "my-players") return "myplayers";
    if (["club", "clubs"].includes(firstPart)) return "club";
    if (firstPart === "players") return "player";
    if (["database", "mfl", "progression", "evaluation", "watchlist", "agents", "settings", "changelog", "privacy"].includes(firstPart)) {
      return firstPart;
    }
    return "notfound";
  }

  function currentRouteRequest() {
    const canonicalRequest = window.__mflAppConfig?.routes?.canonicalRequest;
    if (typeof canonicalRequest === "function") return canonicalRequest(window.location.pathname);
    return { pageName: fallbackRoutePageName(), options: {} };
  }

  function routeIdentityForRequest(request) {
    const pageName = normalizedPageName(request?.pageName);
    const options = request?.options || {};
    if (pageName === "club") return `club:${cleanText(options.clubId)}`;
    if (pageName === "agents") return `agents:${cleanText(options.walletAddress).toLowerCase()}`;
    if (pageName === "watchlist") return `watchlist:${cleanText(options.watchlistId)}`;
    if (pageName === "player") return `player:${cleanText(options.playerId)}`;
    return pageName;
  }

  function routeBusy() {
    return document.documentElement.dataset.interactionBusy === "true";
  }

  function textFrom(selector) {
    const element = document.querySelector(selector);
    return element instanceof HTMLElement ? cleanText(element.textContent) : "";
  }

  function currentAgentAddress() {
    const match = String(window.location.pathname || "").match(/^\/agents\/([^/]+)/i);
    if (!match) return "";
    try {
      return decodeURIComponent(match[1]).trim().toLowerCase();
    } catch {
      return String(match[1] || "").trim().toLowerCase();
    }
  }

  function resolvedAgentTitle() {
    const address = currentAgentAddress();
    const tableTitle = routeBusy() ? "" : textFrom("#tablePageTitle");
    if (tableTitle && (!address || tableTitle.toLowerCase().includes(address))) return tableTitle;
    return address || withAppName("Agent");
  }

  function resolvedClubTitle() {
    if (routeBusy()) return withAppName("Club");
    const tableTitle = textFrom("#tablePageTitle");
    if (!tableTitle || GENERIC_TABLE_TITLES.has(tableTitle)) return withAppName("Club");
    return tableTitle;
  }

  function resolvedWatchlistTitle() {
    if (routeBusy()) return withAppName("Watchlist");
    const tableTitle = textFrom("#tablePageTitle");
    return /^Watchlist(?:\s+-\s+.+)?$/i.test(tableTitle) ? tableTitle : withAppName("Watchlist");
  }

  function resolvedPlayerTitle() {
    if (!routeBusy()) {
      const playerName = textFrom("#playerDetail .playerTitleName");
      if (playerName) return withAppName(playerName);
    }
    return withAppName("Player");
  }

  function resolvedEvaluationTitle() {
    if (!routeBusy()) {
      const panel = document.getElementById("evaluationPanel");
      if (panel instanceof HTMLElement && !panel.hidden) {
        const searchInput = document.getElementById("evaluationSearchInput");
        const playerName = searchInput instanceof HTMLInputElement ? cleanText(searchInput.value) : "";
        if (playerName) return `Evaluation - ${playerName}`;
      }
    }
    return withAppName("Evaluation");
  }

  function resolvedNotFoundTitle() {
    const notFoundTitle = textFrom("#notFoundTitle") || GENERIC_PAGE_LABELS.notfound;
    return withAppName(notFoundTitle);
  }

  function titleForCurrentRoute(request = currentRouteRequest()) {
    const pageName = normalizedPageName(request?.pageName);
    if (pageName === "home") return APP_NAME;
    if (pageName === "player") return resolvedPlayerTitle();
    if (pageName === "club") return resolvedClubTitle();
    if (pageName === "agents") return resolvedAgentTitle();
    if (pageName === "watchlist") return resolvedWatchlistTitle();
    if (pageName === "evaluation") return resolvedEvaluationTitle();
    if (pageName === "notfound") return resolvedNotFoundTitle();

    const label = GENERIC_PAGE_LABELS[pageName];
    return label ? withAppName(label) : APP_NAME;
  }

  function sync() {
    if (destroyed) return;
    const request = currentRouteRequest();
    const routeIdentity = routeIdentityForRequest(request);
    const busy = routeBusy();
    const preserveResolvedTitle = busy && routeIdentity === stableRouteIdentity && stableTitle;
    const nextTitle = preserveResolvedTitle ? stableTitle : titleForCurrentRoute(request);
    if (!busy && nextTitle) {
      stableRouteIdentity = routeIdentity;
      stableTitle = nextTitle;
    }
    if (nextTitle && document.title !== nextTitle) document.title = nextTitle;
  }

  function scheduleSync() {
    if (destroyed || frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      sync();
    });
  }

  function destroy() {
    destroyed = true;
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    observer?.disconnect();
    observer = null;
    window.removeEventListener("popstate", scheduleSync);
    window.removeEventListener("mfl:route-ready", scheduleSync);
    window.removeEventListener("mfl:ready", scheduleSync);
    window.removeEventListener("mfl:loading-state", scheduleSync);
  }

  observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["data-page", "data-interaction-busy", "hidden"],
  });

  window.addEventListener("popstate", scheduleSync);
  window.addEventListener("mfl:route-ready", scheduleSync);
  window.addEventListener("mfl:ready", scheduleSync);
  window.addEventListener("mfl:loading-state", scheduleSync);

  window.__mflDocumentTitleRuntime = Object.freeze({
    sync,
    titleForCurrentRoute,
    destroy,
  });

  sync();
})();
