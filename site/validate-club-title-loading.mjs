import { invariant, includes, excludes } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

import { readCanonicalCoreArtifacts, readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const [coreSource, bootstrap, loadingCss, stylesBase, tabletCss, phoneCss, generatedEagerCore, generatedClubCore, appEntry] = await Promise.all([
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
  read("./styles-base.css"),
  read("./responsive-sources/tables-tablet.css.inc"),
  read("./responsive-sources/tables-phone.css.inc"),
  read("./modules/app-core-runtime.js"),
  read("./modules/app-core-club-runtime.js"),
  read("./modules/app-entry.js"),
]);

const artifacts = readCanonicalCoreArtifacts(coreSource);
const eagerCore = String(artifacts.core || "");
const clubCore = String(artifacts.routeChunks?.club || "");
new Function(eagerCore);
new Function(clubCore);

includes(clubCore, 'const CLUB_DISPLAY_DATA_STORAGE_KEY = "mfl-club-display-data-v1";', "The canonical Club core must own the persistent Club title cache.");
includes(clubCore, "const profileIdentity = clubProfileFromState(normalizedClubId);", "The embedded Club profile must be the first hydrated identity source.");
includes(clubCore, "if (!allowNetwork) return null;", "Normal Club loading must not make a redundant identity request before the embedded Club profile arrives.");
invariant(
  clubCore.indexOf("const cached = cachedClubTitleIdentity(normalizedClubId);")
    < clubCore.indexOf("const rowIdentity = clubTitleIdentityFromRows(normalizedClubId);"),
  "Already-loaded cached Club identity must outrank poorer row-derived identity during first paint.",
);
includes(clubCore, 'type: "recent",\n          clubIds: normalizedClubId,', "Unknown Club titles must use the exact local Club lookup.");
includes(bootstrap, "function firstPaintClubIdentity(urlLike = window.location.href) {", "Club refresh must resolve cached profile identity during first paint.");
includes(bootstrap, "function primeClubIdentityFirstPaint(urlLike = window.location.href) {", "Club refresh must paint the cached branded identity shell before hydration.");
includes(bootstrap, "function primeClubProfileLoading(view = \"attributes\") {", "Club identity loading must default to the canonical Squad view.");
includes(bootstrap, 'Reflect.set(window, "__mflPrimeClubProfileLoading", primeClubProfileLoading);', "SPA Club navigation must reuse the bootstrap-owned Club identity loading skeleton.");
includes(bootstrap, 'Reflect.set(window, "__mflCreateFlagSkeleton", createFlagSkeleton);', "Table, My Clubs, and individual Club loading must share one flag-silhouette skeleton renderer.");
includes(bootstrap, 'ownerName.replaceChildren(createTextSkeleton("Agent Name"));', "Club Owner loading must use the real Owner name element with representative text.");
includes(bootstrap, 'ownerWallet.replaceChildren(createTextSkeleton("0x1234567890abcdef"));', "Club Owner loading must use the real Owner wallet element with representative text.");
excludes(bootstrap, "clubInfoCard", "Bootstrap must not retain the retired Club Info-card skeleton.");
excludes(loadingCss, ".clubInfoCardLoading", "Loading styles must not retain a retired Club Info-card surface.");

includes(bootstrap, 'createFlagSkeleton("clubLocationFlag clubLocationFlagSkeleton")', "Individual Club first paint/loading must reuse the canonical table flag silhouette while inheriting Club identity flag dimensions.");
includes(clubCore, 'countryFlagElement(identity.nation, "clubLocationFlag")', "Hydrated Club identity must render the canonical country flag immediately before the city/location text.");
includes(stylesBase, ".clubIdentityLocation {", "Club identity must own explicit flag-plus-location row geometry.");
includes(stylesBase, ".clubIdentityLocation .clubLocationFlag {", "Club identity must size the location flag from the loaded row geometry.");
includes(stylesBase, "flex: 0 0 auto;\n  align-self: center;\n  width: 18px;\n  height: 18px;", "Loaded and loading Club identity flags must share the same flex alignment and footprint.");
includes(stylesBase, ".clubIdentityOwner {", "Owner must be part of the persistent Club identity geometry.");
includes(stylesBase, "grid-template-columns: minmax(0, 1fr) minmax(180px, auto);", "Desktop Club identity must reserve a right-side Owner column.");
includes(clubCore, "const ownerResolved = Boolean(loadedProfile || identity.ownerName || identity.ownerWalletAddress);", "Cached title-only Club identity must keep Owner unresolved until profile data arrives.");
includes(clubCore, 'const createTextSkeleton = Reflect.get(window, "__mflCreateTextSkeleton");', "Unresolved Owner must use the shared text-skeleton renderer immediately during Club-to-Club navigation.");
includes(clubCore, 'ownerName.replaceChildren(createTextSkeleton("Agent Name"));', "Unresolved Owner must replace any previous Club owner with the canonical name skeleton.");
includes(clubCore, 'ownerWallet.replaceChildren(createTextSkeleton("0x1234567890abcdef"));', "Unresolved Owner must replace any previous Club wallet with the canonical wallet skeleton.");
includes(clubCore, 'ownerName.textContent = ownerLabel;', "Hydrated Club identity must render Owner in the same permanent Owner name element used by loading.");
includes(clubCore, 'ownerWallet.textContent = identity.ownerName && identity.ownerWalletAddress ? identity.ownerWalletAddress : "";', "Hydrated Club identity must render the Owner wallet in the permanent wallet element.");
includes(clubCore, 'ownerName.setAttribute(\n            "href",', "A resolved Club Owner name must become a real link without making the surrounding Owner section interactive.");
includes(clubCore, 'const clubIdentityOwnerLink = document.getElementById("clubIdentityOwnerName");', "Club Owner navigation must bind only to the agent-name text link.");
includes(clubCore, 'openAgentPage(walletAddress, String(clubIdentityOwnerLink.dataset.agentName || "").trim());', "Club Owner clicks must reuse the canonical SPA Agent navigation.");
includes(stylesBase, ".agentTableLink:hover,\n.agentTableLink.tableInteractiveHovered {\n  color: var(--primary);\n  text-decoration: none;", "Club Owner and table Agent links must share one hover treatment.");
includes(stylesBase, ".clubIdentityOwnerName {", "Club Owner name must retain its own identity typography while sharing Agent hover behavior.");
includes(stylesBase, "font-size: 15px;\n  font-weight: 700;\n  line-height: 1.2;", "Club Owner name must preserve the original strong-text weight and geometry.");
invariant(
  stylesBase.indexOf(".agentTableLink {") < stylesBase.indexOf(".clubIdentityOwnerName {"),
  "Club Owner typography must be declared after the shared Agent link base so its original 700 weight wins without changing hover behavior.",
);
excludes(stylesBase, ".clubIdentityOwnerName[href]:hover", "Club Owner must not duplicate or override the canonical Agent hover rule.");
excludes(stylesBase, ".clubIdentityOwner[href]:hover", "The Owner section itself must never trigger the Agent hover treatment.");
excludes(coreSource, 'nextView === "info"', "Shared Club navigation must not retain a retired Info-view branch.");


includes(stylesBase, "grid-template-columns: 168px minmax(0, 1fr);", "Desktop Club identity must reserve the enlarged colour/logo column.");
includes(stylesBase, "min-height: 184px;", "Desktop Club identity must keep the enlarged profile height.");
includes(stylesBase, "max-width: 132px;", "Desktop Club identity logo must scale with the enlarged profile geometry.");
includes(stylesBase, "font-size: 34px;", "Desktop Club identity name must scale with the enlarged profile geometry.");
includes(stylesBase, "var(--club-primary, var(--surface-muted)) 0%", "Club identity must use the primary Club colour in its My Clubs-style gradient.");
includes(stylesBase, "var(--club-secondary, var(--surface-muted)) 100%", "Club identity must use the secondary Club colour in its My Clubs-style gradient.");
excludes(stylesBase, ".clubIdentityColorSwatch", "Club identity must not render separate colour swatches once the card itself owns both Club colours.");
excludes(bootstrap, "clubIdentityColorSwatch", "Club identity first paint/loading must not create separate colour swatches.");
excludes(clubCore, "clubIdentityColorSwatch", "Loaded Club identity must not create separate colour swatches.");
includes(tabletCss, "grid-template-columns: 140px minmax(0, 1fr);", "Tablet Club identity must scale the enlarged colour/logo geometry.");
includes(tabletCss, "min-height: 156px;", "Tablet Club identity must remain proportionally taller.");
includes(phoneCss, "grid-template-columns: 112px minmax(0, 1fr);", "Phone Club identity must scale the enlarged colour/logo geometry.");
includes(phoneCss, "min-height: 136px;", "Phone Club identity must remain proportionally taller.");
includes(tabletCss, "grid-template-columns: minmax(0, 1fr) minmax(140px, 30%);", "Tablet Club identity content must keep a bounded right-side Owner column.");
includes(phoneCss, "grid-template-columns: minmax(0, 1fr);", "Phone Club identity content must stack Owner below the primary identity.");
includes(phoneCss, "justify-items: start;", "Phone Club Owner must align with the left edge of the identity content.");

includes(bootstrap, 'if (page === "club") document.getElementById("mflInitialTableViewFirstPaint")?.remove();', "Bootstrap must remain the sole owner of the temporary Club view first-paint handoff.");
excludes(clubCore, 'document.getElementById("mflInitialTableViewFirstPaint")?.remove();', "Club runtime must not compete with bootstrap for Club first-paint ownership.");

includes(appEntry, "function installClubRouteRuntimeGate()", "Club links and refresh must share the public Club route gate.");
includes(appEntry, 'runtimeWindow.__mflEnsureRouteCore("club", { view })', "The public Club gate must ensure Club core readiness.");
includes(appEntry, 'const routeRuntimePromise = ensureRouteRuntime("club", { view });', "The public Club gate must ensure Club runtime readiness.");
includes(appEntry, "await Promise.all([routeCorePromise, routeRuntimePromise]);", "Club core and runtime ownership must settle together before rendering.");
includes(bootstrap, "function primeClubDestinationIdentity(clubId, view = \"attributes\") {", "Bootstrap must expose a destination Club identity primer for in-site navigation.");
includes(bootstrap, "logo.onerror = null;\n        if (logo.src !== nextLogoUrl) logo.src = identity.logoUrl;", "Destination Club first paint must clear stale logo error ownership and avoid reassigning an already-painted logo.");
includes(clubCore, "const resolvedLogoUrl = new URL(canonicalLogoUrl, window.location.href).href;", "Hydrated Club logo rendering must compare the resolved destination URL before replacing the visible image.");
includes(clubCore, "if (logo.src !== resolvedLogoUrl) logo.src = canonicalLogoUrl;", "Club hydration must retain an already-painted destination logo instead of forcing an image reload.");
includes(bootstrap, 'Reflect.set(window, "__mflPrimeClubDestinationIdentity", primeClubDestinationIdentity);', "The destination Club primer must be available before lazy Club runtime loading.");
const gateStart = appEntry.indexOf("function installClubRouteRuntimeGate() {");
const primeDestinationIndex = appEntry.indexOf("runtimeWindow.__mflPrimeClubDestinationIdentity?.(normalizedClubId, view);", gateStart);
const gateTransitionIndex = appEntry.indexOf('return runTransition("club", true, {', primeDestinationIndex);
invariant(
  gateStart >= 0 && primeDestinationIndex > gateStart && gateTransitionIndex > primeDestinationIndex,
  "The lazy Club gate must prime the destination identity before its outer page transition can reveal the shared Club shell.",
);
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
  "Every Club view must render its loaded roster through the canonical local table lifecycle.",
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
includes(eagerCore, 'if (pageKey && pageName !== "club") {', "Club view switches must not persist generic table-filter state.");
includes(eagerCore, 'if (tablePages.has(pageName) && pageName !== "club") {', "Club incremental rendering must not restore saved table-filter state.");
includes(eagerCore, 'delete state.tablePageStates.club;', "Persisted legacy Club filter state must be purged from shared table preferences.");

includes(
  eagerCore,
  'const viewLoadingRequestToken = (!incrementalRouteIsCached(route, 1) || window.__mflTableLoadingRuntime?.requestActive?.())',
  "Network-backed Club view switches must enter the canonical table skeleton lifecycle.",
);
includes(
  eagerCore,
  'window.__mflTableLoadingRuntime?.beginRequest?.(route.scope)',
  "Current Season and All Time Club views must use the shared table loading request owner rather than a Club-specific skeleton.",
);
includes(
  bootstrap,
  'primeInitialTableStructure(tablePage, view);\n      primeInitialTableRows();\n      if (tablePage === "club") {',
  "Direct refreshes of Squad, Contracts, Current Season, and All Time must use the canonical table-shaped skeleton before Club-specific identity loading.",
);

includes(clubCore, 'Reflect.get(window, "__mflPrimeClubProfileLoading")', "Club route loading must prime the shared Club profile skeleton before awaiting data.");
includes(clubCore, "let clubOpenSequence = 0;", "Club navigation must use latest-open sequencing instead of a blocking global lock.");
excludes(clubCore, "openingClub", "A stale in-flight Club must never block navigation to a newer Club.");
includes(clubCore, "const openSequence = ++clubOpenSequence;", "Each Club navigation must supersede every older in-flight Club.");
includes(clubCore, 'if (!dataLoaded || openSequence !== clubOpenSequence || String(activeClubId) !== nextClubId || state.currentPage !== CLUB_PAGE) return;', "Stale Club payload completions must be discarded after leaving the Club route or opening another Club.");

const clubOpenStart = clubCore.indexOf('async function openClubPage(clubId, view = "attributes", updateHistory = true) {');
const destinationIdentityRender = clubCore.indexOf("renderClubIdentity();", clubOpenStart);
const destinationIdentityPrime = clubCore.indexOf('primeClubProfileLoading(nextView);', destinationIdentityRender);
const destinationTransition = clubCore.indexOf("const transition = await runPageTransition(CLUB_PAGE, updateHistory, {", destinationIdentityPrime);
invariant(
  clubOpenStart >= 0
    && destinationIdentityRender > clubOpenStart
    && destinationIdentityPrime > destinationIdentityRender
    && destinationTransition > destinationIdentityPrime,
  "Destination Club identity and its skeletons must be prepared before the Club page transition can reveal the shell.",
);
includes(clubCore, "void clubTitleReady.then((resolvedTitle) => {", "Club title preflight must remain non-blocking while roster data loads.");
includes(clubCore, 'document.documentElement.dataset.initialEntityVerified = "club";', "A confirmed Club identity must release the guarded first-paint Club shell.");
includes(clubCore, "const loadedClubTitle = clubProfileFromState(activeClubId) || clubTitleIdentityFromRows(activeClubId);", "The embedded Club profile must become the authoritative hydrated identity before roster fallback.");
const emptyRosterIdentityGuard = clubCore.indexOf("if (!loadedClubTitle && (!Array.isArray(state.rows) || state.rows.length === 0)) {");
const deferredEmptyRosterTitle = clubCore.indexOf("const resolvedClubTitle = await ensureClubTitleIdentity(activeClubId, true);", emptyRosterIdentityGuard);
invariant(emptyRosterIdentityGuard >= 0 && deferredEmptyRosterTitle > emptyRosterIdentityGuard, "Only a payload with neither Club profile nor roster may fall back to the exact identity lookup before deciding that the Club is missing.");

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

console.log("Club loading checks passed: Owner and flag skeletons inherit identity geometry, Squad is the default view, and all Club roster views share the canonical table lifecycle.");
