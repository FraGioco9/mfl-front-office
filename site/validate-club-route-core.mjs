import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [
  coreSource,
  routeChunksSource,
  routeLoader,
  appEntry,
  buildCore,
  dataHandler,
  dataPage,
  dataQuery,
  appConfig,
] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-route-chunks.js"),
  read("./route-core-loader-runtime.js"),
  read("./modules/app-entry.js"),
  read("./build-app-core.mjs"),
  read("./api/data.js"),
  read("./api/_data-page.js"),
  read("./api/_data-query.js"),
  read("./modules/app-config.js"),
]);

const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const sharedCore = String(artifacts.core || "");
const tableCore = String(artifacts.routeChunks?.table || "");
const clubCore = String(artifacts.routeChunks?.club || "");

invariant(sharedCore.length > 300_000, "The shared application core became unexpectedly small after the Club split.");
invariant(clubCore.length > 10_000, "The Club core chunk is too small to represent the route owner.");
new Function(sharedCore);
new Function(clubCore);

includes(routeChunksSource, '"Club route owner"', "The build-time splitter must extract the Club route owner.");
excludes(sharedCore, 'const CLUB_PAGE = "club";', "The Club route owner must not remain in the shared core.");
includes(sharedCore, 'if (pageName === "club") {', "The incremental router must have an explicit Club route branch.");
includes(sharedCore, 'const requestedClubId = String(options.clubId || clubTarget?.clubId || "").trim();', "Club data routing must preserve the explicit Club ID.");
includes(sharedCore, 'scope: "club",', "Club data routing must use the dedicated Club API scope.");
includes(sharedCore, 'access: "public",', "Club data routing must remain public entity data.");
includes(sharedCore, "function activateViewButton(button) {", "Club view switching must use shared view activation.");
includes(sharedCore, 'window.__mflAppConfig?.routes?.clubPath?.(clubTarget.clubId, viewName)', "Club view switching must use canonical URL construction.");
includes(tableCore, 'else if (pageName !== "club") {', "Shared Table rendering must not overwrite the Club title.");

includes(clubCore, 'const CLUB_PAGE = "club";', "The Club chunk must own Club route state.");
includes(clubCore, "async function openClubPage(clubId", "The Club chunk must own Club hydration.");
includes(clubCore, "function applyClubPresentation()", "The Club chunk must own Club presentation.");
includes(clubCore, "let activeClubTitle = null;", "The Club chunk must retain stable title identity.");
includes(clubCore, 'window.__mflAppConfig?.routes?.clubRoute?.(pathname)', "Club refresh parsing must use canonical route config.");
includes(clubCore, 'window.__mflAppConfig?.routes?.clubPath?.(clubId, view)', "Club refresh canonicalization must use canonical route config.");
includes(clubCore, 'window.__mflShowRouteMessage?.("Club not found"', "Missing Clubs must render the shared Club-not-found state.");
excludes(clubCore, 'window.location.replace("/")', "Club routing must never redirect malformed or missing Club routes to Home.");
excludes(clubCore, 'history.replaceState({}, "", "/")', "Club routing must never rewrite malformed or missing Club routes to Home.");
includes(clubCore, "window.mflLoadIncrementalRoutePage(CLUB_PAGE, {", "Club hydration must use the canonical incremental loader.");
includes(clubCore, "clubId: activeClubId,", "Club hydration must carry the explicit Club ID.");
includes(clubCore, "ignoreCurrentClubRoute: true,", "Club hydration must use explicit route identity.");
excludes(clubCore, "await withInteractionBusy(loadClubData);", "Club must not retain a second private data loader.");
excludes(clubCore, "runViewTransition(CLUB_PAGE, nextView", "Club views must not retain a private transition owner.");
includes(clubCore, 'state.dataAccess = "public";', "Club final state must preserve public access.");

includes(appConfig, "export const CLUB_VIEW_SLUGS", "Canonical app config must own Club view-to-slug mapping.");
includes(appConfig, 'const match = path.match(/^\\\\/(clubs|club)\\\\/([^/]+)(?:\\\\/([^/]+))?$/i);', "Canonical Club parsing must accept legacy singular links and optional views.");
includes(appConfig, 'const view = normalizeClubView(requestedView || "attributes");', "Missing or invalid Club views must normalize to Squad.");
includes(appConfig, 'return { pageName: "notfound", options: {} };', "Unrecognized routes must use the not-found state.");
excludes(appConfig, 'location.replace("/")', "Canonical app config must not contain the retired malformed-Club Home redirect.");
excludes(appConfig, 'initialClubLikePath', "Canonical app config must not retain the retired Club redirect branch.");
includes(appConfig, 'attributes: "squad"', "Canonical Club Squad must map Attributes to /squad.");
includes(appConfig, 'current: "current-season"', "Canonical Club Current Season must map to /current-season.");
includes(appConfig, 'all: "all-time"', "Canonical Club All Time must map to /all-time.");

includes(routeLoader, "function installClubRouteGate()", "The route-core loader must publish a stable Club navigation gate.");
includes(routeLoader, 'if (page === "club") return ["table", "club"];', "Club navigation must load Table before Club.");
includes(routeLoader, 'path: clubRoutePath(normalizedClubId, view)', "Club navigation must use canonical app-config URLs.");
includes(routeLoader, "await Promise.all([routeCorePromise, routeRuntimePromise]);", "Club navigation must wait for both route owners.");
excludes(routeLoader, "window.history.pushState", "The lazy Club gate must not own history directly.");

includes(appEntry, "function installClubRouteRuntimeGate()", "The fallback Club gate must remain compatible with lazy route-runtime loading.");
includes(appEntry, 'return runTransition("club", true, {', "The fallback Club gate must use the global transition.");
excludes(appEntry, 'const slugByView = new Map([', "Fallback Club navigation must not duplicate canonical slug mapping.");

includes(dataHandler, '["agent", "club"].includes(scope)', "The API must keep Club progression views public entity data.");
includes(dataHandler, '["current", "all"].includes(view)', "The API must recognize Club progression views.");
includes(dataPage, 'active_contract_club_id = ?', "Club rows must be selected by active contract Club ID.");
includes(dataPage, '["player", "players", "evaluation", "club", "mflstats"].includes(scope)', "Club API requests must return complete rosters.");
excludes(dataQuery, '"database", "progression", "mfl", "agent", "myplayers", "watchlist", "club"', "Club rosters must stay outside generic hidden-MFL exclusions.");

includes(buildCore, 'const clubRuntimePath = resolve(siteRoot, "modules/app-core-club-runtime.js");', "The build must emit a generated Club runtime.");
includes(buildCore, "artifacts.routeChunks?.club", "The build must consume the Club artifact.");

console.log("Club route-core validation passed with canonical repair, missing-resource not-found handling, and no Home redirect owner.");
