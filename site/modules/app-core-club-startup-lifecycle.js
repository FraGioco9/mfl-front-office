// @ts-check

import { replaceRequired } from "./app-core-splitter-utils.js";

const DIRECT_INITIAL_CLUB_STARTUP = `  if (initialClubRoute && typeof showHomeShell === "function") {
    const originalShowHomeShell = showHomeShell;
    let initialClubHandled = false;
    showHomeShell = async function showHomeShellWithInitialClub(pageName, updateHistory, options) {
      if (!initialClubHandled) {
        initialClubHandled = true;
        await openClubPage(initialClubRoute.clubId, initialClubRoute.view, false);
        return;
      }
      return originalShowHomeShell.apply(this, arguments);
    };
  }`;

const UNIFORM_INITIAL_CLUB_STARTUP = `  if (initialClubRoute && typeof showHomeShell === "function") {
    const originalShowHomeShell = showHomeShell;
    let initialClubHandled = false;
    showHomeShell = async function showHomeShellWithInitialClub(pageName, updateHistory, options) {
      if (!initialClubHandled) {
        initialClubHandled = true;
        const canonicalRoute = canonicalClubRoute(initialClubRoute.clubId, initialClubRoute.view);
        if (normalizedPath() !== canonicalRoute) window.history.replaceState({}, "", canonicalRoute);
        const loadingController = window.__mflInteractionBusy;
        const loadingToken = typeof loadingController?.begin === "function" ? loadingController.begin("route-runtime") : "";
        try {
          await openClubPage(initialClubRoute.clubId, initialClubRoute.view, false);
        } finally {
          if (loadingToken) loadingController?.end?.(loadingToken);
        }
        return;
      }
      return originalShowHomeShell.apply(this, arguments);
    };
  }`;

const BLOCKING_TITLE_SETTLEMENT = `      if (!dataLoaded) return;
      const resolvedClubTitle = await clubTitleReady;
      if (resolvedClubTitle && String(activeClubId) === nextClubId) {
        activeClubTitle = resolvedClubTitle;
      }

      state.currentPage = CLUB_PAGE;`;

const ROSTER_OWNED_TITLE_SETTLEMENT = `      if (!dataLoaded) return;
      const loadedClubTitle = clubTitleIdentityFromRows(activeClubId);
      if (loadedClubTitle) activeClubTitle = saveClubTitleIdentity(loadedClubTitle);

      state.currentPage = CLUB_PAGE;`;

export function normalizeClubStartupLifecycle(routeArtifacts) {
  const artifacts = routeArtifacts && typeof routeArtifacts === "object" ? routeArtifacts : null;
  const routeChunks = artifacts?.routeChunks && typeof artifacts.routeChunks === "object"
    ? artifacts.routeChunks
    : null;
  const club = String(routeChunks?.club || "");
  if (!club) throw new Error("Cannot normalize an empty Club route artifact.");

  let normalizedClub = replaceRequired(
    club,
    DIRECT_INITIAL_CLUB_STARTUP,
    UNIFORM_INITIAL_CLUB_STARTUP,
    "single-path Club refresh loading lifecycle",
  );
  normalizedClub = replaceRequired(
    normalizedClub,
    BLOCKING_TITLE_SETTLEMENT,
    ROSTER_OWNED_TITLE_SETTLEMENT,
    "Club roster independent of title preflight",
  );

  return Object.freeze({
    ...artifacts,
    routeChunks: Object.freeze({
      ...routeChunks,
      club: normalizedClub,
    }),
  });
}
