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
        const navigateClub = window.mflOpenClubPage;
        if (typeof navigateClub !== "function" || Reflect.get(navigateClub, "__mflRouteRuntimeGate") !== true) {
          throw new Error("Shared Club navigation gate is unavailable during startup.");
        }
        await navigateClub(initialClubRoute.clubId, initialClubRoute.view);
        return;
      }
      return originalShowHomeShell.apply(this, arguments);
    };
  }`;

const INITIAL_ROUTE_RENDER = `  await showHomeShell(initialTarget.pageName, false, initialTarget.options);`;

const SYNCHRONIZED_INITIAL_ROUTE_RENDER = `  if (initialTarget.pageName === "club") {
    const ensureInitialClubRuntime = window.__mflEnsureRouteRuntime;
    if (typeof ensureInitialClubRuntime !== "function") {
      throw new Error("Initial Club route runtime loader is unavailable.");
    }
    await ensureInitialClubRuntime("club", initialTarget.options);
  }
  await showHomeShell(initialTarget.pageName, false, initialTarget.options);`;

export function normalizeClubStartupLifecycle(routeArtifacts) {
  const artifacts = routeArtifacts && typeof routeArtifacts === "object" ? routeArtifacts : null;
  const routeChunks = artifacts?.routeChunks && typeof artifacts.routeChunks === "object"
    ? artifacts.routeChunks
    : null;
  const club = String(routeChunks?.club || "");
  const core = String(artifacts?.core || "");
  if (!club) throw new Error("Cannot normalize an empty Club route artifact.");
  if (!core) throw new Error("Cannot normalize an empty application core for Club startup.");

  const normalizedClub = replaceRequired(
    club,
    DIRECT_INITIAL_CLUB_STARTUP,
    SHARED_INITIAL_CLUB_STARTUP,
    "shared Club refresh navigation lifecycle",
  );
  const normalizedCore = replaceRequired(
    core,
    INITIAL_ROUTE_RENDER,
    SYNCHRONIZED_INITIAL_ROUTE_RENDER,
    "initial Club route-runtime readiness barrier",
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
