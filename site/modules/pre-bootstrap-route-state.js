// @ts-check

import { replaceRequired, replaceRequiredFunction } from "./app-core-splitter-utils.js";

const APP_CONFIG_EXPORTS = `  window.__mflAppConfig = appConfig;
  window.__mflReleaseVersion = data.release.version;
  window.__mflTableViewConfig = data.routes.tableViews;

  const initialClubPath = String(location.pathname || "/");`;

const APP_CONFIG_EXPORTS_WITH_INITIAL_ROUTE = `  window.__mflAppConfig = appConfig;
  window.__mflReleaseVersion = data.release.version;
  window.__mflTableViewConfig = data.routes.tableViews;

  const initialRoute = routes.initialRequest(location.pathname);
  if (typeof document !== "undefined" && document.body) document.body.dataset.page = initialRoute.pageName;
  const initialCanonicalPath = String(initialRoute.options?.replaceUrl || initialRoute.options?.path || "");
  if (initialCanonicalPath && location.pathname !== initialCanonicalPath) {
    history.replaceState({}, "", initialCanonicalPath + location.search + location.hash);
  }

  const initialClubPath = String(location.pathname || "/");`;

const CANONICAL_INITIAL_REQUEST = `function initialRequest(pathname = location.pathname) {
    const path = String(pathname || "/").split("?")[0].replace(/\\/+$/, "") || "/";
    if (!path.startsWith("/")) return { pageName: "notfound", options: {} };
    if (path === "/") return { pageName: "home", options: {} };

    const segments = path.split("/");
    const pageSegment = String(segments[1] || "").toLowerCase();
    const viewSlugs = {
      attributes: "attributes",
      next: "next-overall",
      contracts: "contracts",
      current: "current-season",
      all: "all-time",
      stats: "stats",
    };
    const tableTarget = (pageName, basePath) => {
      if (segments.length > 3) return null;
      const config = data.routes.tableViews[pageName];
      const requestedView = data.routes.viewBySlug[String(segments[2] || "").toLowerCase()] || "";
      const view = config.order.includes(requestedView) ? requestedView : config.fallback;
      const canonicalPath = basePath + "/" + viewSlugs[view];
      return { pageName, options: { view, ...(path !== canonicalPath ? { replaceUrl: canonicalPath } : {}) } };
    };

    if (pageSegment === "evaluation" && segments.length === 2) return { pageName: "evaluation", options: {} };
    if (pageSegment === "changelog" && segments.length === 2) return { pageName: "changelog", options: {} };
    if (pageSegment === "settings" && segments.length === 2) return { pageName: "settings", options: {} };
    if (pageSegment === "players" && segments.length === 3 && segments[2]) {
      return { pageName: "player", options: { playerId: decodedRoutePart(segments[2]) } };
    }

    if (["database", "mfl", "progression", "my-players"].includes(pageSegment)) {
      const pageName = pageSegment === "my-players" ? "myplayers" : pageSegment;
      return tableTarget(pageName, pageSegment === "my-players" ? "/my-players" : "/" + pageSegment)
        || { pageName: "notfound", options: {} };
    }

    if (pageSegment === "watchlist" && segments.length <= 4) {
      const first = decodedRoutePart(segments[2] || "");
      const second = decodedRoutePart(segments[3] || "");
      const firstView = data.routes.viewBySlug[first.toLowerCase()] || "";
      const watchlistId = firstView ? "" : first;
      const requestedView = firstView || data.routes.viewBySlug[second.toLowerCase()] || "";
      const config = data.routes.tableViews.watchlist;
      const view = config.order.includes(requestedView) ? requestedView : config.fallback;
      const canonicalPath = watchlistId
        ? "/watchlist/" + encodeURIComponent(watchlistId) + "/" + viewSlugs[view]
        : "/watchlist/" + viewSlugs[view];
      return {
        pageName: "watchlist",
        options: { watchlistId, view, ...(path !== canonicalPath ? { replaceUrl: canonicalPath } : {}) },
      };
    }

    if (pageSegment === "agents" && segments.length >= 3 && segments.length <= 4 && segments[2]) {
      const walletAddress = decodedRoutePart(segments[2]);
      const requestedView = data.routes.viewBySlug[String(segments[3] || "").toLowerCase()] || "";
      const config = data.routes.tableViews.agents;
      const view = config.order.includes(requestedView) ? requestedView : config.fallback;
      const canonicalPath = "/agents/" + encodeURIComponent(walletAddress.startsWith("0x") ? walletAddress : "0x" + walletAddress) + "/" + viewSlugs[view];
      return {
        pageName: "agents",
        options: { walletAddress, view, ...(path !== canonicalPath ? { replaceUrl: canonicalPath } : {}) },
      };
    }

    if ((pageSegment === "clubs" || pageSegment === "club") && segments.length >= 3 && segments.length <= 4 && segments[2]) {
      const clubId = decodedRoutePart(segments[2]);
      const requestedView = data.routes.viewBySlug[String(segments[3] || "").toLowerCase()] || "";
      const view = data.routes.tableViews.club.order.includes(requestedView)
        ? requestedView
        : data.routes.tableViews.club.fallback;
      const canonicalPath = clubPath(clubId, view);
      return {
        pageName: "club",
        options: { clubId, view, path: canonicalPath, ...(path !== canonicalPath ? { replaceUrl: canonicalPath } : {}) },
      };
    }

    return { pageName: "notfound", options: {} };
  }`;

const LEGACY_INITIAL_CLUB_REDIRECT = `  const initialClubPath = String(location.pathname || "/");
  const initialClubLikePath = /^\\/(?:clubs|club)(?:\\/|$)/i.test(initialClubPath);
  const initialClubRoute = routes.clubRoute(initialClubPath);
  if (initialClubLikePath && !initialClubRoute) {
    location.replace("/");
  } else if (initialClubRoute && initialClubPath !== initialClubRoute.path) {
    history.replaceState({}, "", initialClubRoute.path + location.search + location.hash);
  }`;

const CANONICAL_INITIAL_CLUB_STATE = `  const initialClubPath = String(location.pathname || "/");
  const initialClubRoute = routes.clubRoute(initialClubPath);`;

/**
 * Commit and canonicalize the real initial route in the parser-blocking runtime.
 * Recognizable malformed routes are repaired before first paint; unknown routes
 * keep their URL and enter the shared not-found state instead of redirecting Home.
 * @param {string} source
 */
export function normalizePreBootstrapRouteState(source) {
  let normalized = replaceRequiredFunction(
    String(source || ""),
    "initialRequest",
    CANONICAL_INITIAL_REQUEST,
    "canonical pre-bootstrap route policy",
  );
  normalized = replaceRequired(
    normalized,
    APP_CONFIG_EXPORTS,
    APP_CONFIG_EXPORTS_WITH_INITIAL_ROUTE,
    "pre-bootstrap runtime commits the initial body route before bootstrap hydration",
  );
  return replaceRequired(
    normalized,
    LEGACY_INITIAL_CLUB_REDIRECT,
    CANONICAL_INITIAL_CLUB_STATE,
    "remove legacy malformed-Club redirect to Home",
  );
}
