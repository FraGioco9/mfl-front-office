import { readFile } from "node:fs/promises";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [
  sharedCore,
  tableCore,
  clubCore,
  generatedShared,
  generatedTable,
  generatedClub,
  routeLoader,
  appEntry,
  buildCore,
  dataHandler,
  dataPage,
  dataQuery,
  appConfig,
] = await Promise.all([
  read("./modules/core-sources/shared.js"),
  read("./modules/core-sources/table.js"),
  read("./modules/core-sources/club.js"),
  read("./modules/app-core-runtime.js"),
  read("./modules/app-core-table-runtime.js"),
  read("./modules/app-core-club-runtime.js"),
  read("./route-core-loader-runtime.js"),
  read("./modules/app-entry.js"),
  read("./build-app-core.mjs"),
  read("./api/data.js"),
  read("./api/_data-page.js"),
  read("./api/_data-query.js"),
  read("./modules/app-config.js"),
]);

invariant(sharedCore.length > 300_000, "The canonical shared core became unexpectedly small.");
invariant(clubCore.length > 10_000, "The canonical Club core became unexpectedly small.");
new Function(sharedCore);
new Function(tableCore);
new Function(clubCore);

excludes(buildCore, "app-core-route-chunks", "The canonical build must not depend on the retired route splitter.");
excludes(buildCore, "app-core-build-normalizer", "The canonical build must not depend on the retired build normalizer.");
includes(buildCore, 'Object.freeze({ source: "shared.js", runtime: "app-core-runtime.js"', "The build must generate shared runtime directly from shared.js.");
includes(buildCore, 'Object.freeze({ source: "table.js", runtime: "app-core-table-runtime.js"', "The build must generate Table runtime directly from table.js.");
includes(buildCore, 'Object.freeze({ source: "club.js", runtime: "app-core-club-runtime.js"', "The build must generate Club runtime directly from club.js.");

excludes(sharedCore, 'const CLUB_PAGE = "club";', "Club route implementation must not execute in shared core.");
excludes(sharedCore, "async function openClubPage(clubId", "Club route hydration must remain Club-owned.");
excludes(sharedCore, "function applyClubPresentation()", "Club presentation must remain Club-owned.");
includes(sharedCore, "renderSearchResultsNowWithUniversalClubs", "Universal Club search must remain available from shared core.");
includes(sharedCore, 'void window.mflOpenClubPage(clubId, "attributes")', "Universal Club search must navigate through the stable lazy Club gate.");
includes(sharedCore, 'const clubTarget = pageName === "club" ? clubRouteTargetFromPath() : null;', "Shared view switching must resolve Club identity canonically.");
includes(sharedCore, 'window.__mflAppConfig?.routes?.clubPath?.(clubTarget.clubId, viewName)', "Shared Club view switching must use canonical URL construction.");
includes(sharedCore, "setView = async function setIncrementalView(viewName) {", "Club views must share the canonical incremental view owner.");
includes(sharedCore, "const clubViewPayloadCache = new Map();", "Shared incremental routing must own the canonical Club payload cache.");
includes(sharedCore, "function rememberClubViewPayload(route, payload) {", "Shared incremental routing must own Club payload cache writes.");
includes(sharedCore, "function cachedClubViewPayload(route) {", "Shared incremental routing must own Club payload cache reads.");
includes(tableCore, 'else if (pageName !== "club") {', "Table rendering must preserve the Club title during view changes.");

includes(clubCore, 'const CLUB_PAGE = "club";', "Canonical Club source must own Club route state.");
includes(clubCore, "async function openClubPage(clubId", "Canonical Club source must own Club hydration.");
includes(clubCore, "function applyClubPresentation()", "Canonical Club source must own Club presentation.");
includes(clubCore, "let activeClubTitle = null;", "Canonical Club source must preserve loaded title identity across views.");
includes(clubCore, 'window.__mflStaticUiRuntime?.showNotFound?.("Club");', "Missing Clubs must use the shared typed not-found surface.");
includes(clubCore, "window.mflLoadIncrementalRoutePage(CLUB_PAGE, {", "Initial Club hydration must use the canonical incremental loader.");
includes(clubCore, "ignoreCurrentClubRoute: true,", "Initial Club hydration must retain explicit route identity.");
includes(clubCore, 'state.dataAccess = "public";', "Club state must retain public entity-data access.");
includes(clubCore, "window.__mflOpenClubPageRoute = openClubImmediately;", "Club source must publish only the private route implementation.");
excludes(clubCore, "window.mflOpenClubPage = openClubImmediately;", "Club source must not replace the stable public lazy gate.");
includes(clubCore, "runPageTransition(CLUB_PAGE, updateHistory", "Club page entry must use the global page transition owner.");
excludes(clubCore, "setClubSwitching", "Retired private Club loading ownership must stay removed.");
excludes(clubCore, "clubViewSwitching", "Retired private Club switching state must stay removed.");

includes(appConfig, "export const CLUB_VIEW_SLUGS", "Canonical app config must own Club view slugs.");
includes(appConfig, 'attributes: "squad"', "Attributes must map to the Squad Club URL.");
includes(appConfig, 'current: "current-season"', "Current Season must map canonically.");
includes(appConfig, 'all: "all-time"', "All Time must map canonically.");
includes(appConfig, 'club: "/modules/app-core-club-runtime.js"', "Canonical app config must map Club to its generated runtime.");
includes(appConfig, 'core.push("table", "club");', "Club route dependencies must load Table before Club.");
includes(routeLoader, "const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;", "Route loader must consume canonical dependency composition.");
excludes(routeLoader, "function installClubRouteGate()", "Route loader must not duplicate the Club lazy gate.");

includes(appEntry, "function installClubRouteRuntimeGate()", "app-entry must own the stable Club lazy gate.");
includes(appEntry, 'runtimeWindow.__mflEnsureRouteCore("club", { view })', "Club gate must request the canonical Club dependency graph.");
includes(appEntry, 'return runTransition("club", true, {', "Club gate must enter through the global transition owner.");

includes(dataHandler, '["agent", "club"].includes(scope)', "Club progression must remain public entity data.");
includes(dataHandler, '["current", "all"].includes(view)', "Club API must support both progression views.");
includes(dataPage, "active_contract_club_id = ?", "Club API rows must be selected by active Club contract ID.");
includes(dataPage, '["player", "players", "evaluation", "club", "mflstats"].includes(scope)', "Club requests must return the complete roster.");
excludes(dataQuery, '"database", "progression", "mfl", "agent", "myplayers", "watchlist", "club"', "Club rosters must stay outside generic hidden-MFL table filtering.");

const sharedBanner = "// Generated by build-app-core.mjs from modules/core-sources/shared.js. Do not edit directly.\n";
const tableBanner = "// Generated Table core from modules/core-sources/table.js. Do not edit directly.\n";
const clubBanner = "// Generated Club core from modules/core-sources/club.js. Do not edit directly.\n";
for (const [generated, banner, canonical, label] of [
  [generatedShared, sharedBanner, sharedCore, "shared"],
  [generatedTable, tableBanner, tableCore, "Table"],
  [generatedClub, clubBanner, clubCore, "Club"],
]) {
  invariant(generated.startsWith(banner), `Generated ${label} runtime must carry its canonical build banner.`);
  invariant(
    generated.slice(banner.length).replace(/\s*$/, "") === canonical.replace(/\s*$/, ""),
    `Generated ${label} runtime must exactly match its canonical source.`,
  );
}

console.log("Club canonical view links, typed not-found handling, stable lazy gate, shared switching, public API access, and generated-runtime equivalence validation passed.");
