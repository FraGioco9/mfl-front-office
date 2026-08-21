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

const SHARED_INITIAL_CLUB_STARTUP = `  if (initialClubRoute && typeof showHomeShell === "function") {
    const originalShowHomeShell = showHomeShell;
    let initialClubHandled = false;
    showHomeShell = async function showHomeShellWithInitialClub(pageName, updateHistory, options) {
      if (!initialClubHandled) {
        initialClubHandled = true;
        const canonicalRoute = canonicalClubRoute(initialClubRoute.clubId, initialClubRoute.view);
        if (normalizedPath() !== canonicalRoute) {
          window.history.replaceState({}, "", canonicalRoute);
        }
        document.getElementById("mflInitialTableViewFirstPaint")?.remove();
        const loadingController = window.__mflInteractionBusy;
        const loadingToken = typeof loadingController?.begin === "function"
          ? loadingController.begin("route-runtime")
          : "";
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

export function normalizeClubStartupLifecycle(routeArtifacts) {
  const artifacts = routeArtifacts && typeof routeArtifacts === "object" ? routeArtifacts : null;
  const routeChunks = artifacts?.routeChunks && typeof artifacts.routeChunks === "object"
    ? artifacts.routeChunks
    : null;
  const club = String(routeChunks?.club || "");
  if (!club) throw new Error("Cannot normalize an empty Club route artifact.");

  const normalizedClub = replaceRequired(
    club,
    DIRECT_INITIAL_CLUB_STARTUP,
    SHARED_INITIAL_CLUB_STARTUP,
    "single-path Club refresh loading lifecycle",
  );

  return Object.freeze({
    ...artifacts,
    routeChunks: Object.freeze({
      ...routeChunks,
      club: normalizedClub,
    }),
  });
}
