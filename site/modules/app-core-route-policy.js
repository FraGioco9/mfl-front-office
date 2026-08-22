// @ts-check

import {
  insertBeforeRequiredMarker,
  replaceRequired,
  replaceRequiredFunction,
} from "./app-core-splitter-utils.js";

const ROUTE_MESSAGE_HELPERS = `function showRouteMessagePage(title, message, options = {}) {
  const pageName = String(options.pageName || "notfound");
  const activeNavPage = String(options.activeNavPage || "");
  state.currentPage = pageName;
  document.body.dataset.page = pageName;

  document.querySelectorAll("main > .pageView").forEach((page) => {
    if (page instanceof HTMLElement) page.hidden = page !== myPlayersLockedPage;
  });

  const titleElement = document.getElementById("optInLockedTitle");
  const messageElement = document.getElementById("optInLockedMessage");
  const optInButton = document.getElementById("myPlayersOptInButton");
  if (titleElement) titleElement.textContent = String(title || "Page not found");
  if (messageElement) messageElement.textContent = String(message || "The requested page could not be found.");
  if (optInButton) optInButton.hidden = !options.showOptIn;

  let homeButton = document.getElementById("routeMessageHomeButton");
  if (!homeButton) {
    homeButton = document.createElement("button");
    homeButton.id = "routeMessageHomeButton";
    homeButton.className = "homeOptInButton";
    homeButton.type = "button";
    homeButton.textContent = "Home";
    homeButton.addEventListener("click", () => setPage("home", true));
    document.querySelector("#myPlayersLockedPage .myPlayersLockedContent")?.appendChild(homeButton);
  }
  homeButton.hidden = options.showHome === false;

  navButtons.forEach((button) => {
    button.classList.toggle("active", Boolean(activeNavPage) && button.dataset.page === activeNavPage);
  });
  syncHomeLoginButton();
  updateMenuVisibility();
  return true;
}

window.__mflShowRouteMessage = showRouteMessagePage;

function showProgressionAccessRequired() {
  const optedIn = hasWalletOptIn();
  return showRouteMessagePage(
    "Progression unavailable",
    optedIn
      ? "Your linked wallet is not authorised to view Progression."
      : "Opt in to request access to Progression.",
    {
      pageName: "progression",
      activeNavPage: "progression",
      showOptIn: !optedIn,
      showHome: false,
    },
  );
}`;

const CANONICAL_PAGE_TARGET = `function pageTargetFromPath(path) {
  const requestedPath = String(path || "");
  const cleanPath = (requestedPath.split("?")[0].replace(/\\/+$/, "") || "/");

  if (cleanPath === "/") return { pageName: "home", options: {} };

  if (cleanPath === "/evaluation") {
    const queryIndex = requestedPath.indexOf("?");
    const search = queryIndex >= 0 ? requestedPath.slice(queryIndex + 1) : "";
    const params = new URLSearchParams(search);
    const playerId = String(params.get("player") || "").trim();
    const savedId = String(params.get("saved") || "").trim();
    const shareId = String(params.get("share") || "").trim();
    return {
      pageName: "evaluation",
      options: {
        path: search ? \`/evaluation?\${search}\` : "/evaluation",
        ...(playerId ? { playerId } : {}),
        ...(savedId ? { savedId } : {}),
        ...(shareId ? { shareId } : {}),
      },
    };
  }

  if (cleanPath === "/settings") return { pageName: "settings", options: {} };
  if (cleanPath === "/changelog") return { pageName: "changelog", options: {} };
  if (cleanPath === "/mfl/stats") return { pageName: "mfl", options: { view: "stats" } };

  const playerMatch = cleanPath.match(/^\\/players\\/([^/]+)$/);
  if (playerMatch) {
    return {
      pageName: "player",
      options: { playerId: decodeURIComponent(playerMatch[1]) },
    };
  }

  const clubMatch = cleanPath.match(/^\\/(clubs|club)\\/([^/]+)(?:\\/([^/]+))?$/i);
  if (clubMatch) {
    const clubId = decodeURIComponent(clubMatch[2]);
    const routeConfig = window.__mflAppConfig?.routes;
    const requestedView = viewFromSlug(decodeURIComponent(clubMatch[3] || ""));
    const view = routeConfig?.normalizeClubView?.(requestedView || "attributes") || "attributes";
    const canonicalPath = routeConfig?.clubPath?.(clubId, view) || "/clubs/" + encodeURIComponent(clubId) + "/squad";
    return {
      pageName: "club",
      options: {
        clubId,
        view,
        path: canonicalPath,
        ...(cleanPath !== canonicalPath ? { replaceUrl: canonicalPath } : {}),
      },
    };
  }

  for (const [pageName, basePath] of [["database", "/database"], ["mfl", "/mfl"], ["progression", "/progression"], ["myplayers", "/my-players"]]) {
    const target = tablePageTarget(pageName, cleanPath, basePath);
    if (target) return target;
  }

  if (/^\\/watchlist(?:\\/[^/]+)?(?:\\/[^/]+)?$/.test(cleanPath)) {
    const target = watchlistTargetFromUrl(cleanPath);
    const normalizedView = normalizeViewForPage(target.view, "watchlist");
    const canonicalPath = target.watchlistId
      ? "/watchlist/" + encodeURIComponent(target.watchlistId) + "/" + viewSlug(normalizedView)
      : "/watchlist/" + viewSlug(normalizedView);
    return {
      pageName: "watchlist",
      options: {
        watchlistId: target.watchlistId,
        view: normalizedView,
        ...(cleanPath !== canonicalPath ? { replaceUrl: canonicalPath } : {}),
      },
    };
  }

  const agentMatch = cleanPath.match(/^\\/agents\\/([^/]+)(?:\\/([^/]+))?$/);
  if (agentMatch) {
    const walletAddress = normalizeWalletAddress(decodeURIComponent(agentMatch[1])).toLowerCase();
    const normalizedView = normalizeViewForPage(viewFromSlug(decodeURIComponent(agentMatch[2] || "")), "agents");
    if (walletAddress === mflWalletAddress) {
      const mflView = normalizeViewForPage(normalizedView, "mfl");
      return {
        pageName: "mfl",
        options: { view: mflView, replaceUrl: "/mfl/" + viewSlug(mflView) },
      };
    }

    const canonicalPath = "/agents/" + encodeURIComponent(walletAddress) + "/" + viewSlug(normalizedView);
    return {
      pageName: "agents",
      options: {
        walletAddress,
        view: normalizedView,
        ...(cleanPath !== canonicalPath ? { replaceUrl: canonicalPath } : {}),
      },
    };
  }

  return {
    pageName: "notfound",
    options: {
      title: "Page not found",
      message: "The requested page could not be found.",
    },
  };
}`;

const CANONICAL_HOME_SHELL = `async function showHomeShell(pageName = "home", updateUrl = true, options = {}) {
  syncHomeLoginButton();
  updateAccountState();

  let result;
  if (pageName === "notfound") {
    result = showRouteMessagePage(
      options.title || "Page not found",
      options.message || "The requested page could not be found.",
      { pageName: "notfound", showOptIn: false },
    );
  } else if (pageName === "club") {
    const route = window.__mflAppConfig?.routes?.clubRoute?.(window.location.pathname);
    const clubId = String(options?.clubId || route?.clubId || "").trim();
    const view = String(options?.view || route?.view || "attributes");
    const navigateClub = window.mflOpenClubPage;
    if (!clubId || typeof navigateClub !== "function") {
      result = showRouteMessagePage("Club not found", "The requested club could not be found.", { pageName: "club" });
    } else {
      result = await navigateClub(clubId, view);
    }
  } else {
    result = await setPage(pageName, updateUrl, options);
  }

  syncHomeLoginButton();
  updateMenuVisibility();
  return result;
}`;

export function normalizeRoutePolicy(artifacts) {
  const routeChunks = { ...(artifacts?.routeChunks || {}) };
  let core = String(artifacts?.core || "");
  if (!core) throw new Error("Cannot normalize route policy without the shared application core.");

  core = insertBeforeRequiredMarker(
    core,
    "function pageTargetFromPath(path) {",
    ROUTE_MESSAGE_HELPERS,
    "global route message surface",
  );
  core = replaceRequiredFunction(core, "pageTargetFromPath", CANONICAL_PAGE_TARGET, "canonical broken-route parser");
  core = replaceRequired(
    core,
    `async function showUnauthorizedProgressionRedirect() {
  showToast("Not authorised.");
  history.replaceState({}, "", "/");
  return setPage("home", false);
}`,
    "",
    "remove legacy Progression home redirect",
  );
  core = replaceRequired(
    core,
    "    return showUnauthorizedProgressionRedirect();",
    "    return showProgressionAccessRequired();",
    "Progression keeps its requested route when access is missing",
  );
  core = replaceRequired(
    core,
    `async function showHomeShell(pageName = "home", updateUrl = true, options = {}) {
  syncHomeLoginButton();
  updateAccountState();

  let result;
  if (pageName === "club") {
    const route = window.__mflAppConfig?.routes?.clubRoute?.(window.location.pathname);
    const clubId = String(options?.clubId || route?.clubId || "").trim();
    const view = String(options?.view || route?.view || "attributes");
    const navigateClub = window.mflOpenClubPage;
    if (!clubId || typeof navigateClub !== "function") {
      throw new Error("Club navigation gate is unavailable during startup.");
    }
    result = await navigateClub(clubId, view);
  } else {
    result = await setPage(pageName, updateUrl, options);
  }

  syncHomeLoginButton();
  updateMenuVisibility();
  return result;
}`,
    CANONICAL_HOME_SHELL,
    "route-state shell owns unknown routes",
  );
  core = replaceRequired(
    core,
    `    if (optInLockedMessage) {
      optInLockedMessage.textContent = pageName === "watchlist"
        ? "In order to use the watchlist, you need to opt in."
        : pageName === "settings"
          ? "In order to view settings, you need to opt in."
          : "In order to see your players, you need to opt in.";
    }
    navButtons.forEach((button) => {`,
    `    if (optInLockedMessage) {
      optInLockedMessage.textContent = pageName === "watchlist"
        ? "In order to use the watchlist, you need to opt in."
        : pageName === "settings"
          ? "In order to view settings, you need to opt in."
          : "In order to see your players, you need to opt in.";
    }
    const routeMessageHomeButton = document.getElementById("routeMessageHomeButton");
    if (routeMessageHomeButton) routeMessageHomeButton.hidden = true;
    const lockedOptInButton = document.getElementById("myPlayersOptInButton");
    if (lockedOptInButton) lockedOptInButton.hidden = false;
    navButtons.forEach((button) => {`,
    "normal opt-in shell clears route-message controls",
  );
  core = replaceRequired(
    core,
    `  async function renderLoadedIncrementalRoute(pageName, updateHash, options, route) {
    const payload = await requestIncrementalRoute(route, 1);
    if (!payload) return false;
    if (tablePages.has(pageName)) {`,
    `  async function renderLoadedIncrementalRoute(pageName, updateHash, options, route) {
    const payload = await requestIncrementalRoute(route, 1);
    if (!payload) return false;
    if (route.scope === "agent" && Number(payload.sourceRows || 0) === 0) {
      const agentName = await ensureAgentPageTitleName(route.walletAddress);
      if (!agentName) {
        showRouteMessagePage("Agent not found", "The requested agent could not be found.", { pageName: "agents" });
        return true;
      }
    }
    if (tablePages.has(pageName)) {`,
    "missing Agent renders route not-found state",
  );

  const player = String(routeChunks.player || "");
  if (!player) throw new Error("Cannot normalize route policy without the Player route chunk.");
  routeChunks.player = replaceRequired(
    player,
    `  if (!row) {
    playerDetail.innerHTML = \`<div class="emptyState">Player \${escapeHtml(playerId || "")} was not found.</div>\`;
    return;
  }`,
    `  if (!row) {
    window.__mflShowRouteMessage?.("Player not found", "The requested player could not be found.", { pageName: "player" });
    return;
  }`,
    "missing Player renders route not-found state",
  );

  let club = String(routeChunks.club || "");
  if (!club) throw new Error("Cannot normalize route policy without the Club route chunk.");
  club = replaceRequired(
    club,
    `      if (!dataLoaded) return;
      const loadedClubTitle = clubTitleIdentityFromRows(activeClubId);
      if (loadedClubTitle) activeClubTitle = saveClubTitleIdentity(loadedClubTitle);`,
    `      if (!dataLoaded) return;
      const loadedClubTitle = clubTitleIdentityFromRows(activeClubId);
      if (loadedClubTitle) {
        activeClubTitle = saveClubTitleIdentity(loadedClubTitle);
      } else {
        const resolvedClubTitle = await clubTitleReady;
        if (!resolvedClubTitle) {
          window.__mflShowRouteMessage?.("Club not found", "The requested club could not be found.", { pageName: "club" });
          return;
        }
        activeClubTitle = resolvedClubTitle;
      }`,
    "missing Club renders route not-found state",
  );
  club = replaceRequired(
    club,
    `  window.addEventListener("popstate", () => {
    const path = normalizedPath();
    const route = clubRoute(path);
    if (/^\\/(?:clubs|club)(?:\\/|$)/i.test(path) && !route) {
      window.location.replace("/");
      return;
    }
    if (route) void openClubPage(route.clubId, route.view, false);
  });`,
    `  window.addEventListener("popstate", () => {
    const route = clubRoute(normalizedPath());
    if (route) void openClubPage(route.clubId, route.view, false);
  });`,
    "remove legacy Club popstate home redirect",
  );
  club = replaceRequired(
    club,
    `    function bootClubRoute() {
    const path = normalizedPath();
    const route = clubRoute(path);
    if (/^\\/(?:clubs|club)(?:\\/|$)/i.test(path) && !route) {
      window.location.replace("/");
      return;
    }
    if (!route || initialClubRoute) return;`,
    `    function bootClubRoute() {
    const path = normalizedPath();
    const route = clubRoute(path);
    if (!route || initialClubRoute) return;`,
    "remove legacy Club startup home redirect",
  );
  routeChunks.club = club;

  return Object.freeze({
    ...artifacts,
    core,
    routeChunks: Object.freeze(routeChunks),
  });
}
