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

/**
 * Make every Club shell entry use the same public Club navigation gate.
 * The route chunk is preloaded for a direct Club URL, but owning startup there still
 * creates a second entry workflow. Shared showHomeShell is the stable caller for both
 * startup and later shell navigation, so Club delegates from there instead.
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

  const normalizedCore = replaceRequired(
    core,
    GENERIC_HOME_SHELL,
    SHARED_CLUB_HOME_SHELL,
    "shared Club entry through public navigation gate",
  );

  const normalizedClub = replaceRequired(
    club,
    LATE_CLUB_HOME_SHELL_GATE,
    "",
    "remove late Club startup interception",
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
