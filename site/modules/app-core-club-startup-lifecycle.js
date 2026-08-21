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
        const ensureRouteRuntime = window.__mflEnsureRouteRuntime;
        if (typeof ensureRouteRuntime !== "function") throw new Error("Club route runtime gate is unavailable during startup.");
        try {
          await ensureRouteRuntime("club", { view: initialClubRoute.view });
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

const GENERIC_INCREMENTAL_PAYLOAD_RENDER = `      if (tablePages.has(pageName)) {
        restoreSavedTableState(pageName, { view: route.view || options.view });
        syncRestoredTableControls(pageName);
      }
      state.incrementalApplying = true;
      try {
        updateViewButtons();
        buildHeader();
        originalApplyFilters.call(this, { save: false });
      } finally {
        state.incrementalApplying = false;
      }
      return true;`;

const CLUB_OWNED_INCREMENTAL_PAYLOAD_RENDER = `      const clubPage = pageName === "club";
      if (tablePages.has(pageName) && !clubPage) {
        restoreSavedTableState(pageName, { view: route.view || options.view });
        syncRestoredTableControls(pageName);
      }
      if (clubPage) {
        state.currentPage = "club";
      }
      state.incrementalApplying = true;
      try {
        updateViewButtons();
        buildHeader();
        if (clubPage) applyFilters({ save: false, localOnly: true });
        else originalApplyFilters.call(this, { save: false });
      } finally {
        state.incrementalApplying = false;
      }
      return true;`;

const CLUB_FINAL_RENDER = `      if (typeof updateViewButtons === "function") updateViewButtons();
      applyClubPresentation();
      captureClubView(nextView);`;

const CLUB_FINAL_ROSTER_RENDER = `      if (typeof updateViewButtons === "function") updateViewButtons();
      if (typeof buildHeader === "function") buildHeader();
      if (typeof applyFilters === "function") applyFilters({ save: false, localOnly: true });
      applyClubPresentation();
      captureClubView(nextView);`;

export function normalizeClubStartupLifecycle(routeArtifacts) {
  const artifacts = routeArtifacts && typeof routeArtifacts === "object" ? routeArtifacts : null;
  const routeChunks = artifacts?.routeChunks && typeof artifacts.routeChunks === "object"
    ? artifacts.routeChunks
    : null;
  const club = String(routeChunks?.club || "");
  const core = String(artifacts?.core || "");
  if (!club) throw new Error("Cannot normalize an empty Club route artifact.");
  if (!core) throw new Error("Cannot normalize an empty shared application core.");

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
  normalizedClub = replaceRequired(
    normalizedClub,
    CLUB_FINAL_RENDER,
    CLUB_FINAL_ROSTER_RENDER,
    "Club-owned final roster render",
  );
  const normalizedCore = replaceRequired(
    core,
    GENERIC_INCREMENTAL_PAYLOAD_RENDER,
    CLUB_OWNED_INCREMENTAL_PAYLOAD_RENDER,
    "Club-owned incremental roster render",
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
