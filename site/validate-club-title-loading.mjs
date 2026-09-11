import { invariant, includes, excludes } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

import { readCanonicalCoreArtifacts, readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const [coreSource, bootstrap, loadingCss, generatedEagerCore, generatedClubCore, appEntry] = await Promise.all([
  Promise.all([
    readCanonicalCoreSource("shared"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    Promise.resolve(readCanonicalCoreSource("table")),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./bootstrap.js"),
  read("./loading.css"),
  read("./modules/app-core-runtime.js"),
  read("./modules/app-core-club-runtime.js"),
  read("./modules/app-entry.js"),
]);

const artifacts = readCanonicalCoreArtifacts(coreSource);
const eagerCore = String(artifacts.core || "");
const clubCore = String(artifacts.routeChunks?.club || "");
const tableCore = String(artifacts.routeChunks?.table || "");
new Function(eagerCore);
new Function(clubCore);
new Function(tableCore);

includes(clubCore, 'const CLUB_DISPLAY_DATA_STORAGE_KEY = "mfl-club-display-data-v1";', "The canonical Club core must own the persistent Club title cache.");
includes(clubCore, "const rowIdentity = clubTitleIdentityFromRows(normalizedClubId);", "Loaded Club rows must remain the first title-identity source.");
includes(clubCore, 'type: "recent",\n          clubIds: normalizedClubId,', "Unknown Club titles must use the exact local Club lookup.");
includes(bootstrap, "function firstPaintClubIdentity(urlLike = window.location.href) {", "Club refresh must resolve cached title identity during first paint.");
includes(bootstrap, 'if (page === "club") document.getElementById("mflInitialTableViewFirstPaint")?.remove();', "Bootstrap must remain the sole owner of the temporary Squad first-paint handoff.");
excludes(clubCore, 'document.getElementById("mflInitialTableViewFirstPaint")?.remove();', "Club runtime must not compete with bootstrap for Squad first-paint ownership.");

includes(appEntry, "function installClubRouteRuntimeGate()", "Club links and refresh must share the public Club route gate.");
includes(appEntry, 'runtimeWindow.__mflEnsureRouteCore("club", { view })', "The public Club gate must ensure Club core readiness.");
includes(appEntry, 'const routeRuntimePromise = ensureRouteRuntime("club", { view });', "The public Club gate must ensure Club runtime readiness.");
includes(appEntry, "await Promise.all([routeCorePromise, routeRuntimePromise]);", "Club core and runtime ownership must settle together before rendering.");
includes(eagerCore, "result = await navigateClub(clubId, view);", "Direct Club refresh must enter the same public navigation gate as an in-site click from the shared shell.");
excludes(clubCore, "showHomeShellWithInitialClub", "The Club route core must not retain a startup-only shell interceptor.");
excludes(clubCore, 'await openClubPage(initialClubRoute.clubId, initialClubRoute.view, false);', "Direct Club refresh must not bypass the public gate.");

includes(loadingCss, 'html:not(.mflInitialRouteResolved)[data-initial-table-page="club"] #progressionPage :is(.quickFilters, .controlsBar, nav.pager)', "Raw Club first paint must hide generic table filter chrome before application hydration.");
includes(loadingCss, 'body[data-page="club"] #progressionPage :is(.quickFilters, .controlsBar, nav.pager)', "Hydrated Club pages must keep generic filter chrome absent for the entire route lifetime.");

includes(eagerCore, 'if (route.scope !== "club") globalThis.syncQuickFilterLabels?.();', "Club loading must not initialize generic quick-filter labels.");
includes(eagerCore, 'const clubPage = pageName === "club";', "The shared incremental loader must identify Club payloads explicitly.");
includes(eagerCore, "if (tablePages.has(pageName) && !clubPage) {", "Club payloads must bypass generic saved-table filter restoration.");
includes(eagerCore, 'state.currentPage = "club";', "Club ownership must be committed before the payload is handed back to the Club route owner.");
includes(eagerCore, "if (!clubPage) applyFilters.call(this, { save: false });", "Only non-Club incremental pages may render through the stable shared Table filter facade.");

const incrementalLoaderStart = eagerCore.indexOf("const loadIncrementalRoutePage = async function loadIncrementalRoutePage");
const incrementalLoaderEnd = eagerCore.indexOf("window.mflLoadIncrementalRoutePage = loadIncrementalRoutePage;", incrementalLoaderStart);
const incrementalLoader = eagerCore.slice(incrementalLoaderStart, incrementalLoaderEnd);
invariant(incrementalLoaderStart >= 0 && incrementalLoaderEnd > incrementalLoaderStart, "Shared incremental route loader must exist.");
excludes(incrementalLoader, "if (clubPage) applyFilters(", "Club payload loading must not execute the generic filter pipeline before Club state is reset.");
excludes(incrementalLoader, 'restoreSavedTableState("club"', "Club payload loading must never restore saved Club filter state.");

excludes(clubCore, "applyFilters = function applyFiltersWithClubRows", "Club must not replace the canonical shared Table filter facade.");
excludes(clubCore, "const originalApplyFilters = applyFilters;", "Club must not capture a second Table filter owner.");

const rosterLoad = clubCore.indexOf("window.mflLoadIncrementalRoutePage");
const finalClubRender = clubCore.indexOf('applyFilters({ save: false, localOnly: true });', rosterLoad);
invariant(
  rosterLoad >= 0 && finalClubRender > rosterLoad,
  "Club must render its loaded roster once without entering the generic saved-filter lifecycle.",
);
for (const forbidden of [
  "filterRules.replaceChildren();",
  "hideRetiredInput.checked = false;",
  "hideRetiringInput.checked = false;",
  "hideMflPlayersInput.checked = false;",
  "packablePlayersInput.checked = false;",
  "newMintsInput.checked = false;",
]) {
  excludes(clubCore, forbidden, `Club route ownership must not mutate shared filter control state through ${forbidden}`);
}

const clubApplyStart = tableCore.indexOf("function tableApplyFiltersOwner(options = {}) {");
const clubApplyEnd = tableCore.indexOf("\n  const rules = readFilterRules();", clubApplyStart);
const clubApplyBranch = tableCore.slice(clubApplyStart, clubApplyEnd);
invariant(clubApplyStart >= 0 && clubApplyEnd > clubApplyStart, "Canonical Table core must expose a dedicated Club render branch.");
includes(clubApplyBranch, "state.filteredRows = [...state.rows];", "Club rendering must use the complete loaded roster.");
includes(clubApplyBranch, "state.filteredRows.sort(compareRows);", "Club rendering must preserve canonical Club ordering.");
for (const forbidden of [
  "filterRules",
  "hideRetiredInput",
  "hideRetiringInput",
  "hideMflPlayersInput",
  "packablePlayersInput",
  "newMintsInput",
  "filterSummary",
  "pendingTableControlRestore",
]) {
  excludes(clubApplyBranch, forbidden, `Club rendering must not read or mutate generic filter state through ${forbidden}`);
}

includes(eagerCore, 'if (pageKey && pageName !== "club") {', "Club view switches must not persist generic table-filter state.");
includes(eagerCore, 'if (tablePages.has(pageName) && pageName !== "club") {', "Club incremental rendering must not restore saved table-filter state.");
includes(eagerCore, 'delete state.tablePageStates.club;', "Persisted legacy Club filter state must be purged from shared table preferences.");

includes(clubCore, "void clubTitleReady.then((resolvedTitle) => {", "Club title preflight must remain non-blocking while roster data loads.");
includes(clubCore, 'document.documentElement.dataset.initialEntityVerified = "club";', "A confirmed Club identity must release the guarded first-paint Club shell.");
includes(clubCore, "const loadedClubTitle = clubTitleIdentityFromRows(activeClubId);", "Loaded Club rows must become the authoritative hydrated title identity.");
const emptyRosterIdentityGuard = clubCore.indexOf("if (!loadedClubTitle && clubRows().length === 0) {");
const deferredEmptyRosterTitle = clubCore.indexOf("const resolvedClubTitle = await clubTitleReady;", emptyRosterIdentityGuard);
invariant(emptyRosterIdentityGuard >= 0 && deferredEmptyRosterTitle > emptyRosterIdentityGuard, "Only an empty Club roster may wait for title identity before deciding that the Club is missing.");

excludes(clubCore, "!important", "Club route ownership must not add CSS priority overrides.");
excludes(loadingCss, "!important", "Club first-paint visibility must not use !important.");

const generatedEagerBanner = "// Generated Shared core by build-app-core.mjs from the canonical source manifest. Do not edit directly.\n";
invariant(
  generatedEagerCore.startsWith(generatedEagerBanner) && generatedEagerCore.slice(generatedEagerBanner.length).replace(/\s*$/, "") === eagerCore.replace(/\s*$/, ""),
  "The tracked shared runtime must exactly match the canonical shared core.",
);

const generatedClubBanner = "// Generated Club core from modules/core-sources/club.js. Do not edit directly.\n";
invariant(
  generatedClubCore.startsWith(generatedClubBanner) && generatedClubCore.slice(generatedClubBanner.length).replace(/\s*$/, "") === clubCore.replace(/\s*$/, ""),
  "The tracked Club runtime must exactly match the canonical Club source.",
);

console.log("Club filter-free checks passed: Club views hide generic controls without mutating or persisting filter state, and render the complete roster directly.");
