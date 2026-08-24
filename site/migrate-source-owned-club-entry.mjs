// Temporary one-shot migration; remove before merge.
import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const siteRoot = resolve(import.meta.dirname);
const read = async (path) => String(await readFile(resolve(siteRoot, path), "utf8")).replace(/\r\n?/g, "\n");
const replaceRequired = (source, before, after, label) => {
  if (!source.includes(before)) throw new Error(`Missing ${label}.`);
  return source.replace(before, after);
};

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

let appCore = await read("modules/app-core.js");
appCore = replaceRequired(appCore, ROUTE_TARGET_PLAYER_ANCHOR, ROUTE_TARGET_WITH_CLUB, "Club route parser source anchor");
appCore = replaceRequired(appCore, GENERIC_HOME_SHELL, SHARED_CLUB_HOME_SHELL, "shared Club shell entry source anchor");
appCore = replaceRequired(appCore, DIRECT_INITIAL_CLUB_STARTUP, "", "legacy direct initial Club startup interceptor");
appCore = replaceRequired(appCore, CLUB_VIEW_BUTTON_REORDER, "  function hideClubPageControls() {\n", "Club view-button reorder source block");
await writeFile(resolve(siteRoot, "modules/app-core.js"), appCore);

let clubStartup = await read("modules/app-core-club-startup-lifecycle.js");
const startupConstantsStart = clubStartup.indexOf('const DIRECT_INITIAL_CLUB_STARTUP = `');
const startupConstantsEnd = clubStartup.indexOf('const BLOCKING_TITLE_SETTLEMENT = `');
if (startupConstantsStart < 0 || startupConstantsEnd <= startupConstantsStart) throw new Error("Could not isolate obsolete Club startup gate constants.");
clubStartup = clubStartup.slice(0, startupConstantsStart) + clubStartup.slice(startupConstantsEnd);
const startupRewrite = `  let normalizedClub = replaceRequired(
    club,
    DIRECT_INITIAL_CLUB_STARTUP,
    PUBLIC_GATE_INITIAL_CLUB_STARTUP,
    "shared public Club navigation gate for refresh",
  );
  normalizedClub = replaceRequired(
    normalizedClub,
    CLUB_TITLE_READY_CALLBACK,`;
const sourceOwnedStartup = `  let normalizedClub = replaceRequired(
    club,
    CLUB_TITLE_READY_CALLBACK,`;
clubStartup = replaceRequired(clubStartup, startupRewrite, sourceOwnedStartup, "obsolete Club startup gate rewrite");
await writeFile(resolve(siteRoot, "modules/app-core-club-startup-lifecycle.js"), clubStartup);

let buildNormalizer = await read("modules/app-core-build-normalizer.js");
buildNormalizer = buildNormalizer.replace('import { normalizeClubEntryLifecycle } from "./app-core-club-entry-lifecycle.js";\n', "");
buildNormalizer = replaceRequired(
  buildNormalizer,
  `  const clubStartupArtifacts = normalizeClubStartupLifecycle(watchlistArtifacts);\n  const clubEntryArtifacts = normalizeClubEntryLifecycle(clubStartupArtifacts);\n  const clubSortArtifacts = normalizeClubSortLifecycle(clubEntryArtifacts);`,
  `  const clubStartupArtifacts = normalizeClubStartupLifecycle(watchlistArtifacts);\n  const clubSortArtifacts = normalizeClubSortLifecycle(clubStartupArtifacts);`,
  "Club entry build composition",
);
await writeFile(resolve(siteRoot, "modules/app-core-build-normalizer.js"), buildNormalizer);

await rm(resolve(siteRoot, "modules/app-core-club-entry-lifecycle.js"));
console.log("Canonical Club entry lifecycle migration applied.");
