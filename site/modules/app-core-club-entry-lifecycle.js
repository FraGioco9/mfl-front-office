// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const GENERIC_HOME_SHELL = `async function showHomeShell(pageName = "home", updateUrl = true, options = {}) {
  syncHomeLoginButton();
  updateAccountState();
  const result = await setPage(pageName, updateUrl, options);
  syncHomeLoginButton();
  updateMenuVisibility();
  return result;
}`;

const SHARED_CLUB_HOME_SHELL = `async function showHomeShell(pageName = "home", updateUrl = true, options = {}) {
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
}`;

const ROUTE_TARGET_PLAYER_ANCHOR = `  const playerMatch = cleanPath.match(/^\\/players\\/([^/]+)$/);

  if (cleanPath === "/mfl/stats") {`;

const ROUTE_TARGET_WITH_CLUB = `  const playerMatch = cleanPath.match(/^\\/players\\/([^/]+)$/);
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

  if (cleanPath === "/mfl/stats") {`;

const LATE_CLUB_HOME_SHELL_GATE = `  if (initialClubRoute && typeof showHomeShell === "function") {
    const originalShowHomeShell = showHomeShell;
    let initialClubHandled = false;
    showHomeShell = async function showHomeShellWithInitialClub(pageName, updateHistory, options) {
      if (!initialClubHandled) {
        initialClubHandled = true;
        const canonicalRoute = canonicalClubRoute(initialClubRoute.clubId, initialClubRoute.view);
        if (normalizedPath() !== canonicalRoute) window.history.replaceState({}, "", canonicalRoute);
        const navigateClub = window.mflOpenClubPage;
        if (typeof navigateClub !== "function") throw new Error("Club navigation gate is unavailable during startup.");
        await navigateClub(initialClubRoute.clubId, initialClubRoute.view);
        return;
      }
      return originalShowHomeShell.apply(this, arguments);
    };
  }`;

const CLUB_VIEW_BUTTON_REORDER = `  function hideClubPageControls() {
    const views = document.querySelector("#progressionPage .views");
    if (views) {
      const orderedViews = ["attributes", "contracts", "current", "all"];
      orderedViews.forEach((viewName) => {
        const button = views.querySelector(\`.viewButton[data-view="\${viewName}"]\`);
        if (button) views.appendChild(button);
      });
      views.querySelectorAll(".viewButton").forEach((button) => {
        button.hidden = !CLUB_VIEWS.has(button.dataset.view);
      });
    }

`;

const CLUB_VIEW_BUTTON_SHARED_OWNERSHIP = `  function hideClubPageControls() {
`;

/**
 * Make every Club shell entry use the same public Club navigation gate.
 * Direct Club URLs must first resolve as Club in the shared route parser; otherwise
 * startApp falls back to Home after the correct bootstrap paint. The route chunk
 * remains presentation/data ownership only and never owns a second startup workflow.
 * View-button visibility/order stays with the shared static UI owner so the verified
 * Club handoff cannot detach and reinsert an already-correct first-paint button row.
 * @param {{core?: string, routeChunks?: Record<string, string>}} routeArtifacts
 */
export function normalizeClubEntryLifecycle(routeArtifacts) {
  const artifacts = routeArtifacts && typeof routeArtifacts === "object" ? routeArtifacts : null;
  const routeChunks = artifacts?.routeChunks && typeof artifacts.routeChunks === "object"
    ? artifacts.routeChunks
    : null;
  const core = String(artifacts?.core || "");
  const club = String(routeChunks?.club || "");
  if (!core) throw new Error("Cannot normalize Club entry without a shared application core.");
  if (!club) throw new Error("Cannot normalize Club entry without a Club route core.");

  let normalizedCore = replaceRequired(
    core,
    ROUTE_TARGET_PLAYER_ANCHOR,
    ROUTE_TARGET_WITH_CLUB,
    "Club URL resolution in shared startup routing",
  );
  normalizedCore = replaceRequired(
    normalizedCore,
    GENERIC_HOME_SHELL,
    SHARED_CLUB_HOME_SHELL,
    "shared Club entry through public navigation gate",
  );

  let normalizedClub = replaceRequired(
    club,
    LATE_CLUB_HOME_SHELL_GATE,
    "",
    "remove late Club startup interception",
  );
  normalizedClub = replaceRequired(
    normalizedClub,
    CLUB_VIEW_BUTTON_REORDER,
    CLUB_VIEW_BUTTON_SHARED_OWNERSHIP,
    "remove Club-specific view-button reorder after shared first paint",
  );

  return Object.freeze({
    ...artifacts,
    core: normalizedCore,
    routeChunks: Object.freeze({
      ...routeChunks,
      club: normalizedClub,
    }),
  });
}
