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
] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-route-chunks.js"),
  read("./route-core-loader-runtime.js"),
  read("./modules/app-entry.js"),
  read("./build-app-core.mjs"),
  read("./api/data.js"),
  read("./api/_data-page.js"),
  read("./api/_data-query.js"),
]);
const appConfig = await read("./modules/app-config.js");
const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const sharedCore = String(artifacts.core || "");
const tableCore = String(artifacts.routeChunks?.table || "");
const clubCore = String(artifacts.routeChunks?.club || "");

invariant(sharedCore.length > 300_000, "The shared application core became unexpectedly small after the Club split.");
invariant(clubCore.length > 10_000, "The Club core chunk is too small to represent the route owner.");
new Function(sharedCore);
new Function(clubCore);

includes(routeChunksSource, '"Club route owner"', "The build-time splitter must extract the Club route owner.");
includes(routeChunksSource, "Universal Club search compatibility bridge", "The shared core must retain a Club-search compatibility bridge.");
includes(routeChunksSource, "routeChunks: Object.freeze({ evaluation, mflstats, club })", "The artifact map must expose the Club chunk.");

excludes(sharedCore, 'const CLUB_PAGE = "club";', "The Club route owner must not remain in the shared core.");
excludes(sharedCore, "const clubViewRenderCache = new Map();", "Club view caching must not execute on unrelated routes.");
excludes(sharedCore, "async function openClubPage(clubId", "Club route hydration must not remain in the shared core.");
excludes(sharedCore, "function applyClubPresentation()", "Club-only presentation work must not remain in the shared core.");
includes(sharedCore, "renderSearchResultsNowWithUniversalClubs", "Club search must remain available before the Club chunk is loaded.");
includes(sharedCore, 'void window.mflOpenClubPage(clubId, "attributes")', "Shared Club search must navigate through the lazy public gate.");
includes(
  sharedCore,
  'const route = window.__mflAppConfig?.routes?.clubRoute?.(window.location.pathname);',
  "Shared Club route identity must be parsed by the canonical route config.",
);
excludes(sharedCore, 'routeView === "squad" ? "attributes"', "Shared core must not duplicate the Club view-slug parser.");
includes(sharedCore, 'if (pageName === "club") {', "The incremental router must have an explicit Club route branch.");
includes(sharedCore, 'const requestedClubId = String(options.clubId || clubTarget?.clubId || "").trim();', "Club data routing must prefer the explicit Club ID.");
includes(sharedCore, 'scope: "club",', "Club data routing must request the dedicated Club API scope.");
includes(sharedCore, 'clubId: requestedClubId,', "Club data routing must carry the requested Club ID into the API route.");
includes(sharedCore, 'access: "public",', "Club data routing must use the public entity-data contract.");
excludes(
  sharedCore,
  'clubTarget && ["club", "database", "progression"].includes(pageName)',
  "Club URLs must not hijack Database or Progression incremental data routing.",
);

includes(sharedCore, "function activateViewButton(button) {", "Club view switching must use the shared table view-button activation owner.");
excludes(sharedCore, 'if (pageName === "club") return;', "Shared view activation must never discard Club view buttons.");
includes(sharedCore, 'const clubTarget = pageName === "club" ? clubRouteTargetFromPath() : null;', "Shared Club view switching must resolve the current Club identity from the canonical route.");
includes(sharedCore, 'window.__mflAppConfig?.routes?.clubPath?.(clubTarget.clubId, viewName)', "Shared Club view switching must build the destination URL from canonical route config.");
includes(sharedCore, '...(clubTarget?.clubId ? { clubId: clubTarget.clubId } : {})', "The shared incremental view route must carry the Club ID explicitly.");
excludes(sharedCore, 'viewName === "attributes" ? "squad" : viewSlug(viewName)', "Shared Club switching must not duplicate Club slug mapping.");
excludes(sharedCore, 'if (!state.incrementalMode || state.currentPage === "club")', "Club must not bypass the shared incremental setView owner.");
includes(sharedCore, "setView = async function setIncrementalView(viewName) {", "Club must share the incremental setView owner with all table pages.");
includes(tableCore, 'else if (pageName !== "club") {', "The shared Table view renderer must not rewrite the Club title during a view switch.");
excludes(sharedCore, 'tablePageTitle.textContent = club?.name || "Club";', "Incremental Club payloads must not replace the loaded Club title.");

includes(clubCore, 'const CLUB_PAGE = "club";', "The Club chunk must own Club route data/render state.");
for (const retiredClubSnapshotOwner of [
  "const clubViewRenderCache = new Map();",
  "function clubViewRenderCacheKey(",
  "function cloneClubRows(",
  "function captureClubView(",
  "function restoreCachedClubView(",
]) {
  excludes(clubCore, retiredClubSnapshotOwner, `Club must not restore duplicate snapshot owner: ${retiredClubSnapshotOwner}`);
}
includes(clubCore, "async function openClubPage(clubId", "The Club chunk must own Club route hydration.");
includes(clubCore, "function applyClubPresentation()", "The Club chunk must own Club presentation.");
includes(clubCore, "let activeClubTitle = null;", "The Club chunk must retain the loaded Club title identity across view switches.");
includes(clubCore, "if (nextClubId !== activeClubId) activeClubTitle = null;", "The stable Club title must reset only when navigating to another Club.");
includes(clubCore, "activeClubTitle.clubId !== String(activeClubId)", "Club title rendering must reuse the same Club identity across views.");
includes(clubCore, 'window.__mflStaticUiRuntime?.showNotFound?.("Club");', "Invalid Club routes and missing Club entities must use the shared Club not-found surface.");
excludes(clubCore, 'window.location.replace("/");', "Invalid Club routes must preserve their URL instead of redirecting to Home.");
includes(clubCore, "if (!loadedClubTitle && clubRows().length === 0) {", "A syntactically valid missing Club must resolve to the Club not-found surface after roster loading.");
includes(clubCore, "if (!dataLoaded) return;", "Obsolete Club loads must stop inside the Club route chunk before render commit.");
includes(clubCore, "window.mflLoadIncrementalRoutePage(CLUB_PAGE, {", "Initial Club hydration must use the canonical incremental loader.");
includes(clubCore, "clubId: activeClubId,", "Initial Club hydration must carry the explicit Club ID into the canonical loader.");
includes(clubCore, "ignoreCurrentClubRoute: true,", "Initial Club hydration must use explicit route identity rather than reparsing the committed URL.");
excludes(clubCore, "await withInteractionBusy(loadClubData);", "Club must not retain a second private interaction-busy data loader.");
excludes(clubCore, "renderIncrementalLoadingState(CLUB_PAGE, dataRoute);", "Club must not render a second private loading state outside Uniform Loading.");
excludes(clubCore, "const loadClubData = async () => {", "Club must not retain a bespoke initial data request owner.");
includes(sharedCore, "const clubViewPayloadCache = new Map();", "Shared incremental core must retain the canonical Club payload cache.");
includes(sharedCore, "function rememberClubViewPayload(route, payload) {", "Shared incremental core must own Club payload cache writes.");
includes(sharedCore, "function cachedClubViewPayload(route) {", "Shared incremental core must own Club payload cache reads.");
includes(sharedCore, "rememberClubViewPayload(route, payload);", "Applying a Club payload must populate the canonical shared cache.");
includes(sharedCore, "const clubPayload = cachedClubViewPayload(route);", "Cached Club re-entry must consult the canonical shared cache.");
excludes(
  clubCore,
  'mflLoadIncrementalRoutePage("club", { view: nextView, clubId: activeClubId, ignoreCurrentClubRoute: true })',
  "Club view changes must not bypass shared setView with a private direct incremental loader.",
);
includes(clubCore, 'window.__mflAppConfig?.routes?.clubRoute?.(pathname)', "Club refresh parsing must use the canonical route config.");
includes(clubCore, 'window.__mflAppConfig?.routes?.clubPath?.(clubId, view)', "Club refresh canonicalization must use the same URL builder as view switching.");
excludes(clubCore, "const safeView = view ===", "Club chunk must not duplicate its own view-to-slug mapping.");
includes(clubCore, 'state.dataAccess = "public";', "Club final state must preserve its public entity-data access contract.");
includes(clubCore, "return openClubPage(clubId, view, true);", "The private Club route owner must return the complete Club loading/render promise.");
excludes(clubCore, "void openClubPage(clubId, view, true);", "The private Club route owner must not detach the Club renderer from Uniform Loading.");
includes(clubCore, "window.__mflOpenClubPageRoute = openClubImmediately;", "The Club chunk must publish only the private route renderer.");
excludes(clubCore, "window.mflOpenClubPage = openClubImmediately;", "The Club chunk must not replace the stable public lazy gate.");
includes(sharedCore, "const navigateClub = window.mflOpenClubPage;", "Direct Club startup must enter through the public navigation gate used by in-site links.");
includes(sharedCore, "result = await navigateClub(clubId, view);", "Direct Club startup must await the same public Club navigation workflow as an in-site click.");
excludes(clubCore, "showHomeShellWithInitialClub", "The Club chunk must not retain a separate startup shell workflow.");
excludes(clubCore, 'loadingController.begin("route-runtime")', "Direct Club startup must not create a second loading owner around the public gate.");
excludes(clubCore, 'await openClubPage(initialClubRoute.clubId, initialClubRoute.view, false);', "Direct Club startup must not bypass the public gate with a private route-owner call.");
excludes(clubCore, "function clubSearchEntries(query)", "The Club chunk must not own universal Club search.");
excludes(clubCore, "renderSearchResultsNowWithClubs", "The Club chunk must not patch Global Search after navigation.");
includes(clubCore, "runPageTransition(CLUB_PAGE, updateHistory", "Club page entry must use the global page transition runner.");
excludes(clubCore, "runViewTransition(CLUB_PAGE, nextView", "Club same-page views must not retain a private transition owner.");
excludes(clubCore, 'document.addEventListener("click", (event) => {\n    if (state.currentPage !== CLUB_PAGE) return;', "Club must not retain a capture-phase view-button listener.");
excludes(clubCore, "commitViewTransition(CLUB_PAGE", "Club must not retain a private direct view commit.");
excludes(clubCore, "setClubSwitching", "Club must not retain its retired private loading lifecycle.");
excludes(clubCore, "clubViewSwitching", "Club must never hide the destination page with its retired private loading class.");

includes(dataHandler, '["agent", "club"].includes(scope)', "The API must keep Club progression views public entity data.");
includes(dataHandler, '["current", "all"].includes(view)', "The API must recognize both Club progression views.");
includes(dataPage, 'active_contract_club_id = ?', "Club API rows must be selected by active contract Club ID.");
includes(dataPage, '["player", "players", "evaluation", "club", "mflstats"].includes(scope)', "Club API requests must return the complete roster without table pagination.");
excludes(
  dataQuery,
  '"database", "progression", "mfl", "agent", "myplayers", "watchlist", "club"',
  "Club rosters must remain outside the generic hidden-MFL table exclusion scope.",
);

includes(appConfig, "export const CLUB_VIEW_SLUGS", "Canonical app config must own Club view-to-slug mapping.");
includes(appConfig, 'attributes: "squad"', "Canonical Club Squad must map internal Attributes to /squad.");
includes(appConfig, 'contracts: "contracts"', "Canonical Club Contracts must map to /contracts.");
includes(appConfig, 'current: "current-season"', "Canonical Club Current Season must map to /current-season.");
includes(appConfig, 'all: "all-time"', "Canonical Club All Time must map to /all-time.");
includes(appConfig, 'notFoundRequest(path, "Club")', "Invalid Club URLs must classify as typed Club not-found routes.");
excludes(appConfig, "initialClubLikePath", "Startup must not retain a Club-only redirect owner.");
includes(appConfig, 'club: "/modules/app-core-club-runtime.js"', "The route config must map Club to its generated chunk.");

includes(appConfig, "function routeDependencyPlan(pageName, options = {})", "Canonical app config must own route dependency composition.");
includes(appConfig, 'core.push("table", "club");', "Club navigation must resolve Table before the Club route owner.");
includes(routeLoader, "const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;", "The route-core loader must consume canonical Club dependencies.");
excludes(routeLoader, "function routeCoreDependencies", "The route-core loader must not retain dependency composition ownership.");
excludes(routeLoader, "function installClubRouteGate()", "The route-core loader must not own a Club navigation gate.");
excludes(routeLoader, "__mflRunPageTransition", "The route-core loader must not know about page-transition ownership.");
excludes(routeLoader, "__mflOpenClubPageRoute", "The route-core loader must not invoke route implementations.");
excludes(routeLoader, "__mflEnsureRouteRuntime", "The route-core loader must not coordinate runtime-script loading.");

includes(appEntry, "function installClubRouteRuntimeGate()", "app-entry must own the single stable Club lazy-navigation gate.");
includes(appEntry, "const runTransition = runtimeWindow.__mflRunPageTransition;", "The Club gate must reuse the global page transition runner.");
includes(appEntry, 'return runTransition("club", true, {', "The Club gate must commit through the global transition before its loader callback.");
includes(appEntry, 'Reflect.get(runtimeWindow, "__mflAppConfig")', "Club navigation must use canonical app config for URL construction.");
includes(appEntry, 'path: clubRoutePath(normalizedClubId, view)', "Club navigation must use the canonical app-config URL facade.");
includes(appEntry, 'return routeBuilder(clubId, view);', "The Club gate must delegate URL construction to canonical app config.");
includes(appEntry, 'const routeCorePromise = typeof runtimeWindow.__mflEnsureRouteCore === "function"', "Club loading must start its ordered route-core dependency request inside the global loader callback.");
includes(appEntry, 'runtimeWindow.__mflEnsureRouteCore("club", { view })', "Club loading must request the canonical Club core dependency graph.");
includes(appEntry, 'const routeRuntimePromise = ensureRouteRuntime("club", { view });', "Club loading must overlap core and table-runtime loading.");
includes(appEntry, "await Promise.all([routeCorePromise, routeRuntimePromise]);", "Club loading must wait for both owners before invoking the route implementation.");
includes(appEntry, "const routeOwner = runtimeWindow.__mflOpenClubPageRoute;", "The public gate must invoke the private Club route owner after loading.");
includes(appEntry, "return await routeOwner.call(runtimeWindow, normalizedClubId, view);", "The Club gate must keep Uniform Loading active until the route renderer settles.");
includes(appEntry, "runtimeWindow.__mflEnsureRouteRuntime = ensureRouteRuntime;", "The route-runtime gate API must exist before application startup.");
includes(appEntry, "runtimeWindow.__mflIsRouteRuntimeReady = routeRuntimeReady;", "The route-runtime readiness API must exist before application startup.");
const clubGateInstall = appEntry.indexOf("installClubRouteRuntimeGate();", appEntry.indexOf("runtimeWindow.__mflIsRouteRuntimeReady = routeRuntimeReady;"));
const appStartup = appEntry.indexOf("void start().catch(showStartupError);", clubGateInstall);
invariant(clubGateInstall >= 0 && appStartup > clubGateInstall, "The single Club gate must exist before application-core startup begins.");
excludes(appEntry, 'const slugByView = new Map([', "Club navigation must not duplicate Club view-to-slug mapping.");
const clubGateStart = appEntry.indexOf("function installClubRouteRuntimeGate() {");
const clubGateEnd = appEntry.indexOf("async function finalizeRouteRuntimeNow", clubGateStart);
const clubGate = appEntry.slice(clubGateStart, clubGateEnd);
excludes(clubGate, "history.pushState", "The Club gate must not own history directly.");
excludes(clubGate, "history.replaceState", "The Club gate must not own history directly.");

includes(coreSource, 'const initialRouteTarget = pageTargetFromPath(window.location.pathname);', "Direct startup must classify the initial Club route through the canonical parser.");
includes(coreSource, 'await window.__mflEnsureRouteCore(initialRouteTarget.pageName, initialRouteTarget.options || {});', "Direct Club startup must load its route owner through the canonical dependency gate before startApp.");
includes(coreSource, "return startApp();", "Application startup must begin only after an initial Club owner is ready.");

includes(buildCore, 'runtime: "app-core-club-runtime.js"', "The build must emit a generated Club runtime.");
includes(buildCore, 'source: "club.js"', "The build must consume the Club artifact.");

const generatedClub = await read("./modules/app-core-club-runtime.js");
const clubBanner = "// Generated Club core from modules/core-sources/club.js. Do not edit directly.\n";
invariant(generatedClub.startsWith(clubBanner), "Generated Club runtime must carry the build ownership banner.");
invariant(generatedClub.slice(clubBanner.length).replace(/\s*$/, "") === clubCore.replace(/\s*$/, ""), "Generated Club runtime must exactly match the Club build artifact.");

console.log("Club canonical view links, typed not-found handling, single lazy gate, shared switching, Uniform Loading, and API contract validation passed.");