function playerIdFromUrl() {
  const match = window.location.pathname.match(/^\/players\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
}

function evaluationPlayerIdFromUrl() {
  if (window.location.pathname !== "/evaluation") {
    return null;
  }

  return new URLSearchParams(window.location.search).get("player");
}

function syncEvaluationPlayerUrl(playerId) {
  if (window.location.pathname !== "/evaluation") {
    return;
  }

  const targetPath = playerId ? pagePath("evaluation", { playerId }) : "/evaluation";
  if (`${window.location.pathname}${window.location.search}` !== targetPath) {
    window.history.replaceState({}, "", targetPath);
  }
}

function evaluationShareIdFromUrl() {
  if (window.location.pathname !== "/evaluation") {
    return "";
  }

  return new URLSearchParams(window.location.search).get("share") || "";
}

function evaluationSavedIdFromUrl() {
  if (window.location.pathname !== "/evaluation") {
    return "";
  }

  return new URLSearchParams(window.location.search).get("saved") || "";
}

function isPlainEvaluationUrl() {
  if (window.location.pathname !== "/evaluation") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  return !params.get("player") && !params.get("share") && !params.get("saved");
}

function shouldShowEvaluationRecentResults() {
  return isPlainEvaluationUrl() || document.activeElement === evaluationSearchInput;
}

function basicEvaluationPathForPlayer(playerId = "") {
  const id = String(playerId || "").trim();
  return id ? `/evaluation?player=${encodeURIComponent(id)}` : "/evaluation";
}

function replaceEvaluationUrlWithBasicPlayer(playerId = state.evaluationPlayerId) {
  if (window.location.pathname !== "/evaluation") {
    return;
  }

  const targetPath = basicEvaluationPathForPlayer(playerId);
  if (`${window.location.pathname}${window.location.search}` !== targetPath) {
    window.history.replaceState({}, "", targetPath);
  }
}



function resetEvaluationToDefaultForPlayer(playerId = state.evaluationPlayerId) {
  const id = String(playerId || "").trim();

  state.evaluationShareId = "";
  state.evaluationSavedId = "";
  state.evaluationIgnoreDiscountRate = false;
  state.evaluationIgnoreFirstSeason = false;

  if (id) {
    delete state.evaluationOverallRows[id];
    delete state.evaluationSummaryPositions[id];
    state.evaluationPlayerId = id;
    replaceEvaluationUrlWithBasicPlayer(id);
  } else {
    state.evaluationPlayerId = null;
    replaceEvaluationUrlWithBasicPlayer("");
  }

  renderEvaluationMflPerUsdControl(false);
  renderEvaluationPage();
}

function redirectSavedEvaluationLinkToBasicEvaluation() {
  if (window.location.pathname !== "/evaluation" || !evaluationSavedIdFromUrl()) {
    return false;
  }

  const playerId = String(evaluationPlayerIdFromUrl() || state.evaluationPlayerId || "").trim();
  state.evaluationSavedId = "";
  state.evaluationShareId = "";
  state.evaluationPlayerId = playerId || null;
  window.history.replaceState({}, "", basicEvaluationPathForPlayer(playerId));
  return true;
}



let evaluationLoadFloatingTooltip = null;
let evaluationLoadTooltipHideTimer = null;

function hideEvaluationLoadActionTooltip() {
  if (evaluationLoadTooltipHideTimer) {
    window.clearTimeout(evaluationLoadTooltipHideTimer);
    evaluationLoadTooltipHideTimer = null;
  }
  if (!evaluationLoadFloatingTooltip) return;
  const tooltip = evaluationLoadFloatingTooltip;
  evaluationLoadFloatingTooltip = null;
  tooltip.classList.remove("visible");
  tooltip.classList.add("tooltipHiding");
  evaluationLoadTooltipHideTimer = window.setTimeout(() => {
    tooltip.remove();
    evaluationLoadTooltipHideTimer = null;
  }, 170);
}

let __mflOpenSavedEvaluationsModalOwner = null;

async function openSavedEvaluationsModal() {
  evaluationSearchInput.blur();
  if (document.activeElement === evaluationLoadButton) evaluationLoadButton.blur();
  const activeWallet = String(state.linkedWalletAddress || "").trim().toLowerCase();
  const cached = typeof __mflOpenSavedEvaluationsModalOwner === "function"
    && activeWallet
    && String(window.__mflSavedEvaluationsSessionCacheWallet || "") === activeWallet
    && Array.isArray(window.__mflSavedEvaluationsSessionCache);
  const busyToken = cached ? "" : (window.__mflInteractionBusy?.begin?.("evaluation-load") || "");
  try {
    if (typeof __mflOpenSavedEvaluationsModalOwner !== "function" && typeof window.__mflEnsureRouteCore === "function") {
      await window.__mflEnsureRouteCore("evaluation");
    }
    if (typeof __mflOpenSavedEvaluationsModalOwner !== "function") {
      throw new Error("Evaluation route core is not loaded.");
    }
    return await __mflOpenSavedEvaluationsModalOwner.apply(this, arguments);
  } finally {
    if (busyToken) window.__mflInteractionBusy?.end?.(busyToken);
  }
}

function normalizedPageName(pageName) {
  if (pageName === "my-players") return "myplayers";
  if (pageName === "myclubs") return "my-clubs";
  return pageName;
}

const PROTECTED_OPTED_OUT_PATHS = Object.freeze({
  myplayers: "/my-players/opted-out",
  "my-clubs": "/my-clubs/opted-out",
  watchlist: "/watchlist/opted-out",
  settings: "/settings/opted-out",
});

function optedOutPathForPage(pageName) {
  return PROTECTED_OPTED_OUT_PATHS[normalizedPageName(pageName)] || "";
}

function optedOutPageFromPath(pathName = window.location.pathname) {
  const cleanPath = String(pathName || "").split("?")[0];
  return Object.entries(PROTECTED_OPTED_OUT_PATHS)
    .find(([, optedOutPath]) => cleanPath === optedOutPath)?.[0] || "";
}

function defaultProtectedRoutePath(pageName) {
  const normalizedPage = normalizedPageName(pageName);
  if (normalizedPage === "my-clubs") return "/my-clubs";
  if (normalizedPage === "settings") return "/settings";
  if (normalizedPage === "watchlist") {
    const viewName = normalizeViewForPage("", "watchlist");
    return `/watchlist/${viewSlug(viewName)}`;
  }
  if (normalizedPage === "myplayers") {
    const viewName = normalizeViewForPage("", "myplayers");
    return `/my-players/${viewSlug(viewName)}`;
  }
  return "";
}

function pageFromUrl() {
  return pageTargetFromPath(`${window.location.pathname}${window.location.search}`).pageName;
}

function watchlistTargetFromUrl(pathName = window.location.pathname) {
  if (optedOutPageFromPath(pathName) === "watchlist") {
    return { watchlistId: "", view: "" };
  }

  const match = String(pathName || "").match(/^\/watchlist(?:\/([^/]+))?(?:\/([^/]+))?$/);

  if (!match) {
    return { watchlistId: "", view: "" };
  }

  const firstSegment = decodeURIComponent(match[1] || "");
  const secondSegment = decodeURIComponent(match[2] || "");
  const firstView = viewFromSlug(firstSegment);

  if (firstView) {
    return { watchlistId: "", view: firstView };
  }

  return {
    watchlistId: firstSegment,
    view: viewFromSlug(secondSegment),
  };
}

function watchlistIdFromUrl() {
  return watchlistTargetFromUrl().watchlistId;
}

function agentTargetFromUrl(pathName = window.location.pathname) {
  const match = String(pathName || "").match(/^\/agents\/([^/]+)(?:\/([^/]+))?$/);

  if (!match) {
    return { walletAddress: "", view: "" };
  }

  return {
    walletAddress: normalizeWalletAddress(decodeURIComponent(match[1])).toLowerCase(),
    view: viewFromSlug(decodeURIComponent(match[2] || "")),
  };
}

function agentWalletAddressFromUrl() {
  return agentTargetFromUrl().walletAddress;
}

function tablePageTarget(pageName, cleanPath, basePath, requestedSearch = "") {
  const match = cleanPath.match(new RegExp(`^${basePath}(?:/([^/]+))?$`));

  if (!match) {
    return null;
  }

  const view = viewFromSlug(decodeURIComponent(match[1] || ""));
  const normalizedView = normalizeViewForPage(view, pageName);
  const canonicalPath = `${basePath}/${viewSlug(normalizedView)}`;

  const canonicalTarget = `${canonicalPath}${requestedSearch}`;
  return {
    pageName,
    options: {
      view: normalizedView,
      ...(cleanPath !== canonicalPath
        ? { replaceUrl: canonicalTarget }
        : requestedSearch
          ? { path: canonicalTarget }
          : {}),
    },
  };
}

function pageTargetFromPath(path) {
  const requestedPath = String(path || "");
  const routeQueryIndex = requestedPath.indexOf("?");
  const requestedSearch = routeQueryIndex >= 0 ? requestedPath.slice(routeQueryIndex) : "";
  const cleanPath = routeQueryIndex >= 0 ? requestedPath.slice(0, routeQueryIndex) : requestedPath;
  const optedOutPage = optedOutPageFromPath(cleanPath);

  if (optedOutPage) {
    if (!hasWalletOptIn()) {
      return { pageName: optedOutPage, options: {} };
    }

    const defaultPath = defaultProtectedRoutePath(optedOutPage);
    const signedInTarget = pageTargetFromPath(defaultPath);
    return {
      pageName: signedInTarget.pageName,
      options: {
        ...(signedInTarget.options || {}),
        replaceUrl: signedInTarget.options?.replaceUrl || defaultPath,
      },
    };
  }

  if (cleanPath === "/evaluation") {
    const queryIndex = requestedPath.indexOf("?");
    const search = queryIndex >= 0 ? requestedPath.slice(queryIndex + 1) : "";
    const params = new URLSearchParams(search);
    const playerId = String(params.get("player") || "").trim();
    const savedId = String(params.get("saved") || "").trim();
    const shareId = String(params.get("share") || "").trim();
    const queryKeys = Array.from(params.keys());
    const validQueryKeys = queryKeys.every((key) => key === "player" || key === "saved" || key === "share");
    const hasEvaluationSelection = Boolean(playerId || savedId || shareId);

    if (search && (!validQueryKeys || !hasEvaluationSelection)) {
      return {
        pageName: "evaluation",
        options: {
          plain: true,
          replaceUrl: "/evaluation",
        },
      };
    }

    return {
      pageName: "evaluation",
      options: {
        path: search ? `/evaluation?${search}` : "/evaluation",
        ...(playerId ? { playerId } : {}),
        ...(savedId ? { savedId } : {}),
        ...(shareId ? { shareId } : {}),
      },
    };
  }

  const plannerMatch = cleanPath.match(/^\/planner(?:\/([^/]+))?$/);
  if (plannerMatch) {
    const planId = String(plannerMatch[1] ? decodeURIComponent(plannerMatch[1]) : "").trim();
    const params = new URLSearchParams(requestedSearch.replace(/^\?/, ""));
    const clubId = planId ? "" : String(params.get("club") || "").trim();
    const canonicalPath = planId
      ? `/planner/${encodeURIComponent(planId)}`
      : clubId
        ? `/planner?club=${encodeURIComponent(clubId)}`
        : "/planner";
    return {
      pageName: "planner",
      options: {
        ...(planId ? { planId } : {}),
        ...(clubId ? { clubId } : {}),
        path: canonicalPath,
        ...(requestedPath !== canonicalPath ? { replaceUrl: canonicalPath } : {}),
      },
    };
  }

  if (cleanPath === "/my-clubs" || cleanPath === "/myclubs") {
    if (!hasWalletOptIn()) {
      return {
        pageName: "my-clubs",
        options: { replaceUrl: optedOutPathForPage("my-clubs") },
      };
    }
    return {
      pageName: "my-clubs",
      options: cleanPath === "/myclubs" ? { replaceUrl: "/my-clubs" } : {},
    };
  }

  if (!hasWalletOptIn()) {
    if (/^\/my-players(?:\/[^/]+)?$/.test(cleanPath)) {
      return {
        pageName: "myplayers",
        options: { replaceUrl: optedOutPathForPage("myplayers") },
      };
    }

    if (/^\/watchlist(?:\/[^/]+)?(?:\/[^/]+)?$/.test(cleanPath)) {
      return {
        pageName: "watchlist",
        options: { replaceUrl: optedOutPathForPage("watchlist") },
      };
    }

    if (cleanPath === "/settings") {
      return {
        pageName: "settings",
        options: { replaceUrl: optedOutPathForPage("settings") },
      };
    }
  }
  if (cleanPath === "/players" || cleanPath === "/agents") {
    return {
      pageName: "home",
      options: { replaceUrl: "/" },
    };
  }

  const playerMatch = cleanPath.match(/^\/players\/([^/]+)$/);
  const clubRoute = window.__mflAppConfig?.routes?.clubRoute?.(cleanPath);

  if (clubRoute) {
    return {
      pageName: "club",
      options: {
        clubId: clubRoute.clubId,
        view: clubRoute.view,
        path: clubRoute.path,
      },
    };
  }

  if (cleanPath === "/mfl/stats") {
    return {
      pageName: "mfl",
      options: { view: "stats" },
    };
  }

  if (playerMatch) {
    return {
      pageName: "player",
      options: { playerId: decodeURIComponent(playerMatch[1]) },
    };
  }

  for (const [pageName, basePath] of [["database", "/database"], ["mfl", "/mfl"], ["progression", "/progression"], ["myplayers", "/my-players"]]) {
    const target = tablePageTarget(pageName, cleanPath, basePath, requestedSearch);
    if (target) {
      return target;
    }
  }

  const watchlistMatch = cleanPath.match(/^\/watchlist(?:\/[^/]+)?(?:\/[^/]+)?$/);

  if (watchlistMatch) {
    const target = watchlistTargetFromUrl(cleanPath);
    const normalizedView = normalizeViewForPage(target.view, "watchlist");
    const canonicalPath = target.watchlistId
      ? `/watchlist/${encodeURIComponent(target.watchlistId)}/${viewSlug(normalizedView)}`
      : `/watchlist/${viewSlug(normalizedView)}`;
    return {
      pageName: "watchlist",
      options: {
        watchlistId: target.watchlistId,
        view: normalizedView,
        ...(cleanPath !== canonicalPath
          ? { replaceUrl: `${canonicalPath}${requestedSearch}` }
          : requestedSearch
            ? { path: `${canonicalPath}${requestedSearch}` }
            : {}),
      },
    };
  }

  const agentMatch = cleanPath.match(/^\/agents\/([^/]+)(?:\/([^/]+))?$/);

  if (agentMatch) {
    const walletAddress = normalizeWalletAddress(decodeURIComponent(agentMatch[1])).toLowerCase();
    const normalizedView = normalizeViewForPage(viewFromSlug(decodeURIComponent(agentMatch[2] || "")), "agents");
    if (walletAddress === mflWalletAddress) {
      const canonicalPath = `/mfl/${viewSlug(normalizeViewForPage(normalizedView, "mfl"))}`;
      return {
        pageName: "mfl",
        options: { view: normalizeViewForPage(normalizedView, "mfl"), replaceUrl: `${canonicalPath}${requestedSearch}` },
      };
    }

    const canonicalPath = `/agents/${encodeURIComponent(walletAddress)}/${viewSlug(normalizedView)}`;
    return {
      pageName: "agents",
      options: {
        walletAddress,
        view: normalizedView,
        ...(cleanPath !== canonicalPath
          ? { replaceUrl: `${canonicalPath}${requestedSearch}` }
          : requestedSearch
            ? { path: `${canonicalPath}${requestedSearch}` }
            : {}),
      },
    };
  }

  const pageName = normalizedPageName(cleanPath.replace(/^\//, "") || "home");
  return {
    pageName: ["home", "evaluation", "settings", "changelog", "privacy"].includes(pageName) ? pageName : "home",
    options: {},
  };
}

function pagePath(pageName, options = {}) {
  if (pageName === "club") {
    const routeConfig = window.__mflAppConfig?.routes;
    const currentClubRoute = routeConfig?.clubRoute?.(window.location.pathname);
    const clubId = String(options.clubId || currentClubRoute?.clubId || "").trim();
    const clubView = String(options.view || currentClubRoute?.view || state.view || "attributes").trim().toLowerCase();
    const clubPath = clubId ? routeConfig?.clubPath?.(clubId, clubView) : "";
    return clubPath || window.location.pathname;
  }
  if (pageName === "planner") {
    const planId = String(options.planId || "").trim();
    if (planId) return `/planner/${encodeURIComponent(planId)}`;
    const clubId = String(options.clubId || "").trim();
    if (clubId) return `/planner?club=${encodeURIComponent(clubId)}`;
    const explicitPath = String(options.path || "").trim();
    if (explicitPath === "/planner" || explicitPath.startsWith("/planner?")) return explicitPath;
    return "/planner";
  }
  if (pageName === "player") {
    const playerId = options.playerId || playerIdFromUrl();
    return playerId ? `/players/${encodeURIComponent(playerId)}` : window.location.pathname;
  }

  if (pageName === "evaluation") {
    if (options.plain) {
      return "/evaluation";
    }

    const explicitPath = String(options.path || "");
    if (explicitPath === "/evaluation" || explicitPath.startsWith("/evaluation?")) {
      return explicitPath;
    }

    const playerId = options.playerId || evaluationPlayerIdFromUrl();
    return playerId ? `/evaluation?player=${encodeURIComponent(playerId)}` : "/evaluation";
  }

  if (pageName === "mflstats") {
    return "/mfl/stats";
  }

  if (!hasWalletOptIn()) {
    const optedOutPath = optedOutPathForPage(pageName);
    if (optedOutPath) return optedOutPath;
  }

  if (tablePages.has(pageName)) {
    const viewName = normalizeViewForPage(options.view || (pageName === state.currentPage ? state.view : defaultViewForPage(pageName)), pageName);
    const slug = viewSlug(viewName);

    if (pageName === "watchlist") {
      const watchlistId = options.watchlistId || state.currentWatchlistId || watchlistIdFromUrl();
      return watchlistId ? `/watchlist/${encodeURIComponent(watchlistId)}/${slug}` : `/watchlist/${slug}`;
    }

    if (pageName === "agents") {
      const walletAddress = normalizeWalletAddress(options.walletAddress || state.currentAgentWalletAddress || agentWalletAddressFromUrl()).toLowerCase();
      if (walletAddress === mflWalletAddress) {
        return `/mfl/${viewSlug(normalizeViewForPage(viewName, "mfl"))}`;
      }
      return walletAddress ? `/agents/${encodeURIComponent(walletAddress)}/${slug}` : "/";
    }

    if (pageName === "myplayers") {
      return `/my-players/${slug}`;
    }

    return `/${pageName}/${slug}`;
  }

  return pageName === "home" ? "/" : `/${pageName}`;
}

function updatePageUrl(pageName, options = {}) {
  if (state.currentPage === "club" && pageName !== "club") {
    return;
  }
  if (!options.updateUrl) {
    return;
  }

  const targetPath = pagePath(pageName, options);
  if (`${window.location.pathname}${window.location.search}` !== targetPath) {
    window.history.pushState({}, "", targetPath);
  }
}
let pendingViewTransition = null;
let navigationTransitionSequence = 0;
