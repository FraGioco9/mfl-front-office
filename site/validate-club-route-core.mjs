import { invariant, includes, excludes } from "./validation/assertions.mjs";
import { readFile } from "node:fs/promises";

import { coreSourceByDomain } from "./modules/core-source-manifest.js";
import { readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = async (path) => String(await readFile(new URL(path, import.meta.url), "utf8")).replace(/\r\n?/g, "\n");

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
  clubsApi,
  appConfig,
] = await Promise.all([
  Promise.resolve(readCanonicalCoreSource("shared")),
  Promise.resolve(readCanonicalCoreSource("table")),
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
  read("./api/_clubs.js"),
  read("./modules/app-config.js"),
]);

invariant(sharedCore.length > 300_000, "The canonical shared core became unexpectedly small.");
invariant(clubCore.length > 10_000, "The canonical Club core became unexpectedly small.");
new Function(sharedCore);
new Function(tableCore);
new Function(clubCore);

excludes(buildCore, "app-core-route-chunks", "The canonical build must not depend on the retired route splitter.");
excludes(buildCore, "app-core-build-normalizer", "The canonical build must not depend on the retired build normalizer.");
invariant(
  coreSourceByDomain.shared?.source === "shared-foundations.js"
    && coreSourceByDomain.shared?.sources?.length === 28
    && coreSourceByDomain.shared.sources[1] === "shared-session.js"
    && coreSourceByDomain.shared.sources[2] === "shared-routing.js"
    && coreSourceByDomain.shared.sources[3] === "shared-transitions.js"
    && coreSourceByDomain.shared.sources[4] === "shared-page-lifecycle.js"
    && coreSourceByDomain.shared.sources[5] === "shared-home-summary.js"
    && coreSourceByDomain.shared.sources[6] === "shared-table-state.js"
    && coreSourceByDomain.shared.sources[7] === "shared-toast-core.js"
    && coreSourceByDomain.shared.sources[8] === "shared-personal-state.js"
    && coreSourceByDomain.shared.sources[9] === "shared-data-search.js"
    && coreSourceByDomain.shared.sources[10] === "shared-evaluation-lifecycle.js"
    && coreSourceByDomain.shared.sources[11] === "shared-player-first-paint.js"
    && coreSourceByDomain.shared.sources[12] === "shared-watchlist-actions.js"
    && coreSourceByDomain.shared.sources[13] === "shared-player-display.js"
    && coreSourceByDomain.shared.sources[14] === "shared-player-actions.js"
    && coreSourceByDomain.shared.sources[15] === "shared-modal-lifecycle.js"
    && coreSourceByDomain.shared.sources[16] === "shared-global-search.js"
    && coreSourceByDomain.shared.sources[17] === "shared-wallet-row-classification.js"
    && coreSourceByDomain.shared.sources[18] === "shared-html-escaping.js"
    && coreSourceByDomain.shared.sources[19] === "shared-incremental-routing.js"
    && coreSourceByDomain.shared.sources[20] === "shared-interaction-bindings.js"
    && coreSourceByDomain.shared.sources[21] === "shared-startup-lifecycle.js"
    && coreSourceByDomain.shared.sources[22] === "shared-layout-center.js"
    && coreSourceByDomain.shared.sources[23] === "shared-incremental-navigation.js"
    && coreSourceByDomain.shared.sources[24] === "shared-route-runtime-gate.js"
    && coreSourceByDomain.shared.sources[25] === "shared-core-contracts.js"
    && coreSourceByDomain.shared.sources[26] === "shared-app-startup.js"
    && coreSourceByDomain.shared.sources[27] === "shared-shell-navigation.js"
    && coreSourceByDomain.shared?.runtime === "app-core-runtime.js",
  "The core manifest must generate the shared runtime from its ordered canonical fragments.",
);
invariant(
  coreSourceByDomain.table?.source === "table.js"
    && coreSourceByDomain.table?.sources?.length === 3
    && coreSourceByDomain.table.sources[0] === "table.js"
    && coreSourceByDomain.table.sources[1] === "table-render-lifecycle.js"
    && coreSourceByDomain.table.sources[2] === "table-interaction-bindings.js"
    && coreSourceByDomain.table?.runtime === "app-core-table-runtime.js",
  "The core manifest must generate Table runtime from its ordered canonical fragments.",
);
invariant(coreSourceByDomain.club?.source === "club.js" && coreSourceByDomain.club?.runtime === "app-core-club-runtime.js", "The core manifest must generate Club runtime directly from club.js.");

excludes(sharedCore, 'const CLUB_PAGE = "club";', "Club route implementation must not execute in shared core.");
excludes(sharedCore, "async function openClubPage(clubId", "Club route hydration must remain Club-owned.");
excludes(sharedCore, "function applyClubPresentation()", "Club presentation must remain Club-owned.");
includes(sharedCore, "function clubSearchResult(entry) {", "Universal Club search must be owned directly by the canonical Global Search core.");
includes(sharedCore, 'void window.mflOpenClubPage(entry.clubId, "attributes")', "Universal Club search must navigate to the canonical Club Squad view through the stable lazy Club gate.");
excludes(sharedCore, "renderSearchResultsNowWithUniversalClubs", "Retired wrapper-based Club search ownership must stay removed.");
excludes(sharedCore, "renderSearchResultsNowV1500", "Retired release-era Global Search wrapper must stay removed.");
excludes(sharedCore, "renderSearchResultsFromBootstrap", "Retired bootstrap Club-result wrapper must stay removed.");
includes(sharedCore, 'const clubTarget = pageName === "club" ? clubRouteTargetFromPath() : null;', "Shared view switching must resolve Club identity canonically.");
includes(sharedCore, 'window.__mflAppConfig?.routes?.clubPath?.(clubTarget.clubId, viewName)', "Shared Club view switching must use canonical URL construction.");
includes(sharedCore, "const setIncrementalView = async function setIncrementalView(viewName) {", "Club views must share the canonical incremental view owner.");
includes(sharedCore, "const clubViewPayloadCache = new Map();", "Shared incremental routing must own the canonical Club payload cache.");
includes(sharedCore, "function rememberClubViewPayload(route, payload) {", "Shared incremental routing must own Club payload cache writes.");
includes(sharedCore, "function cachedClubViewPayload(route) {", "Shared incremental routing must own Club payload cache reads.");
includes(tableCore, 'else if (pageName !== "club") {', "Table rendering must preserve the Club title during view changes.");
includes(tableCore, 'window.mflOpenClubPage(clubLink.dataset.clubId || "", "attributes");', "Table Club links must open the canonical Squad/Attributes view directly.");
excludes(tableCore, 'window.mflOpenClubPage(clubLink.dataset.clubId || "", "info");', "Table Club links must not retain retired Info navigation.");


includes(clubCore, 'const CLUB_PAGE = "club";', "Canonical Club source must own Club route state.");
includes(clubCore, "async function openClubPage(clubId", "Canonical Club source must own Club hydration.");
includes(clubCore, "function applyClubPresentation()", "Canonical Club source must own Club presentation.");
includes(clubCore, "function renderClubIdentity()", "Club presentation must own the persistent branded identity header.");
excludes(clubCore, "function renderClubInfo()", "The retired Club Info view must not remain in Club presentation.");
includes(clubCore, 'document.getElementById("clubIdentityOwner")', "Club presentation must render Owner directly inside the persistent identity header.");
includes(clubCore, "window.__mflApplyClubPresentation = applyClubPresentation;", "Shared view switching must reuse the Club presentation owner.");
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
excludes(appConfig, 'info: "info"', "Retired Info view slugs must not remain in canonical Club routing.");
includes(appConfig, 'club: Object.freeze({ order: Object.freeze(["attributes", "contracts", "current", "all"]), fallback: "attributes" })', "Club view order and default must be Squad, Contracts, Current Season, All Time.");
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
includes(dataPage, 'const club = scope === "club" ? clubProfileData(query.clubId) : null;', "Club roster payload must embed the canonical Club profile without a second browser request.");
includes(clubsApi, 'function clubProfileRow(tableName, clubId) {', "Club profile lookup must support both runtime and canonical Club tables.");
includes(clubsApi, 'const canonical = needsCanonicalSupplement ? clubProfileRow("clubs", id) : null;', "Incomplete runtime Club metadata must be supplemented server-side without another browser request.");
includes(clubsApi, "logoUrl: clubLogoUrl(id, logoVersion)", "Individual Clubs and My Clubs must share the canonical logo URL owner.");
includes(dataPage, '...(scope === "club" ? { club } : {})', "Club profile metadata must ship beside roster rows.");
includes(dataPage, 'TABLE_CONTRACT_RESPONSE_COLUMNS.forEach((column) => selectedColumns.add(column));\n    STAT_COLUMNS.forEach((column) => selectedColumns.add(column));', "Club base payloads must include both Squad stats and Contracts fields for local Squad/Contracts switching.");
includes(dataPage, '["player", "players", "evaluation", "club", "mflstats"].includes(scope)', "Club requests must return the complete roster.");
excludes(dataQuery, '"database", "progression", "mfl", "agent", "myplayers", "watchlist", "club"', "Club rosters must stay outside generic hidden-MFL table filtering.");

const sharedBanner = String(coreSourceByDomain.shared?.banner || "");
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