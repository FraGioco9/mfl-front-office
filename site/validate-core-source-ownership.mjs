import { invariant } from "./validation/assertions.mjs";
import { access } from "node:fs/promises";

import { coreSourceManifest } from "./modules/core-source-manifest.js";
import { readValidationText } from "./validation-text.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const build = await read("./build-app-core.mjs");
invariant(build.includes('import { coreSourceManifest } from "./modules/core-source-manifest.js";'), "Application-core build must consume the canonical core source manifest.");
invariant(build.includes("for (const entry of coreSourceManifest)"), "Application-core build must generate every canonical source-fragment domain from the manifest.");
invariant(build.includes('resolve(siteRoot, "modules", "core-sources", sourceName)'), "Application-core build must resolve every ordered canonical source fragment from manifest entries.");
invariant(build.includes("sourceParts.join(\"\\n\\n\")"), "Application-core build must concatenate ordered source fragments without behavior transforms.");
invariant(!build.includes("app-core-build-normalizer"), "Application-core build must not depend on behavior-changing normalizers.");
invariant(!build.includes("replaceRequired"), "Application-core build must not perform source-string behavior rewrites.");
invariant(!build.includes("modules/app-core.js"), "Application-core build must not depend on the retired monolith.");
invariant(build.includes("entry.maxUniversalBytes !== null"), "Application-core build must enforce the universal shared-core ceiling when one is configured.");

const domains = new Set();
const ownedSources = new Set();
for (const entry of coreSourceManifest) {
  invariant(!domains.has(entry.domain), `Core source manifest domain must be unique: ${entry.domain}.`);
  domains.add(entry.domain);
  invariant(Array.isArray(entry.sources) && entry.sources.length > 0, `Core source ${entry.domain} must define at least one ordered canonical source fragment.`);
  invariant(Object.isFrozen(entry.sources), `Core source ${entry.domain} fragment order must be immutable.`);
  invariant(entry.source === entry.sources[0], `Core source ${entry.domain} compatibility source alias must reference its first ordered fragment.`);
  for (const sourceName of entry.sources) {
    invariant(typeof sourceName === "string" && sourceName.endsWith(".js"), `Core source ${entry.domain} has an invalid fragment name.`);
    invariant(!ownedSources.has(sourceName), `Canonical core source fragment must have one domain owner: ${sourceName}.`);
    ownedSources.add(sourceName);
  }
  invariant(
    entry.maxUniversalBytes === null || (Number.isInteger(entry.maxUniversalBytes) && entry.maxUniversalBytes > 0),
    `Core source ${entry.domain} must define either no byte ceiling or a positive universal ownership ceiling.`,
  );
  invariant(String(entry.banner || "").includes("Do not edit directly"), `Core source ${entry.domain} must define a generated ownership banner.`);
  if (entry.domain !== "shared") {
    invariant(entry.maxUniversalBytes === null, `Route/domain source ${entry.domain} must not use an arbitrary hard byte ceiling; ownership and lazy loading are the architectural boundary.`);
  }

  const sourceParts = await Promise.all(entry.sources.map((sourceName) => read(`./modules/core-sources/${sourceName}`)));
  const source = sourceParts.map((part) => part.replace(/\s*$/, "")).join("\n\n");
  const runtime = await read(`./modules/${entry.runtime}`);
  invariant(runtime.startsWith(entry.banner), `Generated ${entry.runtime} must carry the manifest-owned banner.`);
  invariant(
    runtime.slice(entry.banner.length).replace(/\s*$/, "") === source,
    `Generated ${entry.runtime} must exactly match the ordered canonical fragments: ${entry.sources.join(", ")}.`,
  );
  if (entry.maxUniversalBytes !== null) {
    invariant(
      Buffer.byteLength(source, "utf8") <= entry.maxUniversalBytes,
      `Canonical ${entry.domain} source fragments exceeded the universal ownership ceiling.`,
    );
  }
}

const sharedEntry = coreSourceManifest.find(({ domain }) => domain === "shared");
invariant(
  sharedEntry?.source === "shared-foundations.js"
    && sharedEntry?.sources?.length === 28
    && sharedEntry.sources[0] === "shared-foundations.js"
    && sharedEntry.sources[1] === "shared-session.js"
    && sharedEntry.sources[2] === "shared-routing.js"
    && sharedEntry.sources[3] === "shared-transitions.js"
    && sharedEntry.sources[4] === "shared-page-lifecycle.js"
    && sharedEntry.sources[5] === "shared-home-summary.js"
    && sharedEntry.sources[6] === "shared-table-state.js"
    && sharedEntry.sources[7] === "shared-toast-core.js"
    && sharedEntry.sources[8] === "shared-personal-state.js"
    && sharedEntry.sources[9] === "shared-data-search.js"
    && sharedEntry.sources[10] === "shared-evaluation-lifecycle.js"
    && sharedEntry.sources[11] === "shared-player-first-paint.js"
    && sharedEntry.sources[12] === "shared-watchlist-actions.js"
    && sharedEntry.sources[13] === "shared-player-display.js"
    && sharedEntry.sources[14] === "shared-player-actions.js"
    && sharedEntry.sources[15] === "shared-modal-lifecycle.js"
    && sharedEntry.sources[16] === "shared-global-search.js"
    && sharedEntry.sources[17] === "shared-wallet-row-classification.js"
    && sharedEntry.sources[18] === "shared-html-escaping.js"
    && sharedEntry.sources[19] === "shared-incremental-routing.js"
    && sharedEntry.sources[20] === "shared-interaction-bindings.js"
    && sharedEntry.sources[21] === "shared-startup-lifecycle.js"
    && sharedEntry.sources[22] === "shared-layout-center.js"
    && sharedEntry.sources[23] === "shared-incremental-navigation.js"
    && sharedEntry.sources[24] === "shared-route-runtime-gate.js"
    && sharedEntry.sources[25] === "shared-core-contracts.js"
    && sharedEntry.sources[26] === "shared-app-startup.js"
    && sharedEntry.sources[27] === "shared-shell-navigation.js"
    && sharedEntry.maxUniversalBytes === 355000,
  "Shared core must keep foundations before session before routing before transitions before page lifecycle before Home summary before table state before generic toast core before personal state before data/search before Evaluation lifecycle before Player first-paint/navigation before watchlist actions before Player display/calculation before Player action facades before generic modal lifecycle before Global Search lifecycle before linked-wallet/MFL row classification before universal HTML escaping before incremental routing/cache/request before global interaction bindings before Changelog/startup lifecycle before layout-centered feedback before incremental navigation orchestration before the stable route-runtime gate before explicit core contracts before application startup before shell navigation and retain the explicit 355000-byte universal no-growth ceiling.",
);
const sharedFoundations = await read("./modules/core-sources/shared-foundations.js");
const sharedSession = await read("./modules/core-sources/shared-session.js");
const sharedRouting = await read("./modules/core-sources/shared-routing.js");
const sharedTransitions = await read("./modules/core-sources/shared-transitions.js");
const sharedPageLifecycle = await read("./modules/core-sources/shared-page-lifecycle.js");
const sharedHomeSummary = await read("./modules/core-sources/shared-home-summary.js");
const sharedTableState = await read("./modules/core-sources/shared-table-state.js");
const sharedToastCore = await read("./modules/core-sources/shared-toast-core.js");
const sharedPersonalState = await read("./modules/core-sources/shared-personal-state.js");
const sharedDataSearch = await read("./modules/core-sources/shared-data-search.js");
const sharedEvaluationLifecycle = await read("./modules/core-sources/shared-evaluation-lifecycle.js");
const sharedPlayerFirstPaint = await read("./modules/core-sources/shared-player-first-paint.js");
const sharedWatchlistActions = await read("./modules/core-sources/shared-watchlist-actions.js");
const sharedPlayerDisplay = await read("./modules/core-sources/shared-player-display.js");
const sharedPlayerActions = await read("./modules/core-sources/shared-player-actions.js");
const sharedModalLifecycle = await read("./modules/core-sources/shared-modal-lifecycle.js");
const sharedGlobalSearch = await read("./modules/core-sources/shared-global-search.js");
const sharedWalletRowClassification = await read("./modules/core-sources/shared-wallet-row-classification.js");
const sharedHtmlEscaping = await read("./modules/core-sources/shared-html-escaping.js");
const sharedIncrementalRouting = await read("./modules/core-sources/shared-incremental-routing.js");
const sharedInteractionBindings = await read("./modules/core-sources/shared-interaction-bindings.js");
const sharedStartupLifecycle = await read("./modules/core-sources/shared-startup-lifecycle.js");
const sharedLayoutCenter = await read("./modules/core-sources/shared-layout-center.js");
const sharedIncrementalNavigation = await read("./modules/core-sources/shared-incremental-navigation.js");
const sharedRouteRuntimeGate = await read("./modules/core-sources/shared-route-runtime-gate.js");
const sharedCoreContracts = await read("./modules/core-sources/shared-core-contracts.js");
const sharedAppStartup = await read("./modules/core-sources/shared-app-startup.js");
const sharedShellNavigation = await read("./modules/core-sources/shared-shell-navigation.js");
invariant(
  sharedFoundations.replace(/\s*$/, "").endsWith('const openSelectedLinksButton = document.querySelector("#openSelectedLinksButton");'),
  "Shared foundations must end at the canonical DOM-binding boundary.",
);
invariant(
  sharedSession.startsWith('function normalizeSettingsTheme(value, fallback = "dark") {'),
  "Shared session must begin at the canonical behavior boundary.",
);
invariant(
  sharedSession.replace(/\s*$/, "").endsWith("function toggleMenu() {\n  updateMenuVisibility();\n}"),
  "Shared session must end at the canonical shell/session boundary.",
);
invariant(
  sharedRouting.startsWith("function playerIdFromUrl() {")
    && sharedRouting.replace(/\s*$/, "").endsWith("let navigationTransitionSequence = 0;"),
  "Shared routing must own URL parsing/path construction through the transition-state boundary.",
);
invariant(
  sharedTransitions.startsWith("function currentNavigationPath() {")
    && sharedTransitions.replace(/\s*$/, "").endsWith('Reflect.set(window, "__mflWaitForViewTransitionPaint", waitForViewTransitionPaint);'),
  "Shared transitions must own canonical transition execution through the published transition facade.",
);
invariant(
  sharedPageLifecycle.startsWith("function resetPageScroll() {")
    && sharedPageLifecycle.includes("async function renderPage(pageName, updateHash = true, options = {}) {")
    && sharedPageLifecycle.includes("function applyFilters(options = {}) {")
    && sharedPageLifecycle.includes("return setIncrementalView.apply(this, arguments);")
    && sharedPageLifecycle.includes('const featureOwner = Reflect.get(window, "__mflSetPageFeatureOwner");')
    && sharedPageLifecycle.replace(/\s*$/, "").endsWith("return setPageWithRouteRuntime.call(this, pageName, updateHash, options);\n}"),
  "Shared page lifecycle must own stable Table/page facades and the canonical base page renderer while dispatching setPage through explicit feature/route owners without replacing the public function.",
);
invariant(
  sharedHomeSummary.startsWith("function updateStatusDate(generatedAt) {")
    && sharedHomeSummary.replace(/\s*$/, "").endsWith("summaryLoadPromise = null;\n  return result;\n}"),
  "Shared Home summary must own status/count presentation through canonical summary loading.",
);
invariant(
  sharedTableState.startsWith("function tablePageKey(pageName = state.currentPage) {")
    && sharedTableState.replace(/\s*$/, "").endsWith("selectedPlayerIds: [],\n  };\n}"),
  "Shared table state must own table navigation/view/sort-session behavior through canonical default table-page state.",
);
invariant(
  sharedToastCore.startsWith("function scheduleToastHide(toast) {")
    && sharedToastCore.replace(/\s*$/, "").endsWith("scheduleToastHide(toast);\n  }\n}"),
  "Shared toast core must own generic toast lifecycle/presentation through canonical showToast().",
);
invariant(
  sharedPersonalState.startsWith("function showWatchlistToast(")
    && sharedPersonalState.replace(/\s*$/, "").endsWith("    return null;\n  }\n}"),
  "Shared personal state must own feature feedback and personal persistence through canonical saved-state restoration.",
);
invariant(
  sharedDataSearch.startsWith("function formatCount(value) {")
    && sharedDataSearch.replace(/\s*$/, "").endsWith("return primeGlobalSearchIndexes();\n}"),
  "Shared data/search must own generic row/value formatting through the canonical database-search index readiness boundary.",
);
invariant(
  sharedEvaluationLifecycle.startsWith("const DEFAULT_EVALUATION_MFL_PER_USD = 400;")
    && sharedEvaluationLifecycle.replace(/\s*$/, "").endsWith("return __mflEvaluationRenderPageOwner();\n}"),
  "Shared Evaluation lifecycle must own eager Evaluation settings/search/readiness through the canonical renderEvaluationPage facade.",
);
invariant(
  sharedPlayerFirstPaint.startsWith("function playerFirstPaintKnownValues(row) {")
    && sharedPlayerFirstPaint.replace(/\s*$/, "").endsWith('setPage("player", true, { playerId: key, __mflPlayerFirstPaintContext: pendingContext });\n}'),
  "Shared Player first-paint/navigation must own cached context construction through the canonical openPlayerPage facade.",
);
invariant(
  sharedWatchlistActions.startsWith("function removePlayerIdFromAllWatchlists(playerId) {")
    && sharedWatchlistActions.replace(/\s*$/, "").endsWith("    renderPlayerPage(key);\n  }\n}"),
  "Shared watchlist actions must own player watchlist mutation through the canonical toggleWatchlistPlayer action.",
);
invariant(
  sharedPlayerDisplay.trimStart().startsWith("function countryCodeForNationality(nationality) {")
    && sharedPlayerDisplay.replace(/\s*$/, "").endsWith('return "veryHard";\n}'),
  "Shared Player display/calculation must own nationality, position, rating, progression-value, and Next Overall display helpers.",
);
invariant(
  sharedPlayerActions.startsWith("async function copyPlayerId(id) {")
    && sharedPlayerActions.replace(/\s*$/, "").endsWith("  return owner(playerId);\n}"),
  "Shared Player action facades must own cross-route Player ID copying and the stable Player render delegate.",
);
invariant(
  sharedModalLifecycle.startsWith("function showModal(modal) {")
    && sharedModalLifecycle.replace(/\s*$/, "").endsWith("  pointerStartedOnBackdrop = false;\n  });\n}"),
  "Shared modal lifecycle must own generic show/hide transitions and drag-safe backdrop closing.",
);
invariant(
  sharedGlobalSearch.startsWith("async function openSearch() {")
    && sharedGlobalSearch.includes("function clubSearchResult(entry) {")
    && sharedGlobalSearch.includes("const clubResults = state.clubSearchIndex")
    && sharedGlobalSearch.includes('void window.mflOpenClubPage(entry.clubId, "attributes");')
    && sharedGlobalSearch.replace(/\s*$/, "").endsWith("  })();\n}"),
  "Shared Global Search must own open/close, Player/Club/Agent matching, mixed recents, navigation, clear state, and result rendering through renderSearchResults().",
);
invariant(
  sharedWalletRowClassification.startsWith("function linkedWalletAddressesForOwnedPlayers() {")
    && sharedWalletRowClassification.replace(/\s*$/, "").endsWith('return joinedDay !== null && [parseFilterDateDay("2025-10-09"), parseFilterDateDay("2025-10-10")].includes(joinedDay);\n}'),
  "Shared wallet-row classification must own linked-wallet ownership, MFL wallet detection, and the hidden Joined Agency-date rule.",
);
invariant(
  sharedHtmlEscaping.startsWith("function escapeHtml(value) {")
    && sharedHtmlEscaping.replace(/\s*$/, "").endsWith('.replaceAll("\'", "&#39;");\n}')
    && !sharedHtmlEscaping.includes("csvEscape"),
  "Shared HTML escaping must own the universal escapeHtml primitive without retaining the unused CSV helper.",
);
invariant(
  sharedIncrementalRouting.startsWith("function clubRouteTargetFromPath() {")
    && sharedIncrementalRouting.replace(/\s*$/, "").endsWith("window.mflReloadIncrementalPage = reloadIncrementalPage;")
    && !sharedIncrementalRouting.includes("function csvEscape")
    && !sharedIncrementalRouting.includes("function mflChunkFromPublicData")
    && !sharedIncrementalRouting.includes("function progressionDataColumns"),
  "Shared incremental routing must own canonical route targeting, cache/request coordination, incremental payload application, and reload through the published reload facade.",
);
invariant(
  sharedInteractionBindings.startsWith("let pendingViewButtonPointer = null;")
    && sharedInteractionBindings.includes("function activateViewButton(button) {")
    && sharedInteractionBindings.includes("viewButtons.forEach((button) => {")
    && sharedInteractionBindings.includes('document.addEventListener("keydown", (event) => {')
    && sharedInteractionBindings.includes("navButtons.forEach((button) => {")
    && sharedInteractionBindings.includes('window.addEventListener("popstate", () => {')
    && sharedInteractionBindings.replace(/\s*$/, "").endsWith('if (myPlayersOptInButton) {\n  myPlayersOptInButton.addEventListener("click", linkWallet);\n}'),
  "Shared interaction bindings must own eager view-button, global keyboard/dropdown, navigation, and account interaction wiring.",
);
invariant(
  sharedStartupLifecycle.startsWith("function setupChangelogSections() {")
    && sharedStartupLifecycle.includes("async function startApp() {")
    && sharedStartupLifecycle.includes("setupChangelogSections();")
    && sharedStartupLifecycle.includes("await initialRouteRuntimeReadyPromise;")
    && sharedStartupLifecycle.replace(/\s*$/, "").endsWith("});\n}"),
  "Shared startup lifecycle must own Changelog section setup and the canonical startApp definition through background startup convergence.",
);
invariant(
  sharedLayoutCenter.startsWith("function syncLayoutCenter() {")
    && sharedLayoutCenter.includes('window.addEventListener("resize", syncLayoutCenter, { passive: true });')
    && sharedLayoutCenter.includes("new MutationObserver(syncLayoutCenter).observe(document.body, {")
    && sharedLayoutCenter.replace(/\s*$/, "").endsWith("})();")
    && !sharedLayoutCenter.includes("setIncrementalPage"),
  "Shared layout centering must own page-content center synchronization and its resize/mutation bindings without absorbing incremental navigation orchestration.",
);
invariant(
  sharedIncrementalNavigation.startsWith("/* Session-cached incremental route data and destination-first loading */")
    && sharedIncrementalNavigation.includes("const setIncrementalView = async function setIncrementalView(viewName) {")
    && sharedIncrementalNavigation.includes("const setIncrementalPage = async function setIncrementalPage(pageName, updateHash = true, options = {}) {")
    && sharedIncrementalNavigation.includes("const loadIncrementalRoutePage = async function loadIncrementalRoutePage(pageName, options = {}) {")
    && sharedIncrementalNavigation.replace(/\s*$/, "").endsWith("window.mflLoadIncrementalRoutePage = loadIncrementalRoutePage;")
    && !sharedIncrementalNavigation.includes("const originalApplyFilters")
    && !sharedIncrementalNavigation.includes("const originalSetPage")
    && !sharedIncrementalNavigation.includes("const originalSetView")
    && !sharedIncrementalNavigation.includes("applyFilters = function")
    && !sharedIncrementalNavigation.includes("setView = async function")
    && !sharedIncrementalNavigation.includes("setPage = async function"),
  "Shared incremental navigation must own loading orchestration through stable facades/base rendering without replacing public function identities.",
);
invariant(
  sharedRouteRuntimeGate.startsWith("async function setPageWithRouteRuntime(pageName, updateHash = true, options = {}) {")
    && sharedRouteRuntimeGate.includes('Reflect.get(window, "__mflSetPageFeatureOwner")')
    && sharedRouteRuntimeGate.replace(/\s*$/, "").endsWith('Reflect.set(window, "__mflSetPageRouteOwner", setPageWithRouteRuntime);')
    && !sharedRouteRuntimeGate.includes("originalRouteRuntimeSetPage")
    && !sharedRouteRuntimeGate.includes("setPage = routeRuntimeSetPage")
    && !sharedRouteRuntimeGate.includes("__mflRouteRuntimeGate"),
  "Shared route-runtime gate must own lazy runtime/core preparation behind the stable setPage facade without replacing its identity.",
);
invariant(
  sharedCoreContracts.startsWith(";(() => {\n  function tableHeaderContext() {")
    && sharedCoreContracts.includes("function ensureCanonicalTableHeader() {")
    && sharedCoreContracts.includes("function installSearchMatching() {")
    && sharedCoreContracts.includes("function installEvaluationRecentStateOwnership() {")
    && sharedCoreContracts.includes("window.__mflCoreContracts = Object.freeze({")
    && sharedCoreContracts.replace(/\s*$/, "").endsWith("})();"),
  "Shared core contracts must own the explicit Table/Search/Evaluation bridge published through the frozen __mflCoreContracts facade.",
);
invariant(
  sharedAppStartup.startsWith("window.__mflMarkApplicationCoreLoaded?.();")
    && sharedAppStartup.includes("window.__mflAppStartPromise = (async () => {")
    && sharedAppStartup.includes("await window.__mflEnsureRouteCore(initialRouteTarget.pageName, initialRouteTarget.options || {});")
    && sharedAppStartup.replace(/\s*$/, "").endsWith("})();"),
  "Shared application startup must own core-loaded publication, initial route-core preload, and the canonical startApp promise handoff.",
);
invariant(
  sharedShellNavigation.startsWith(";(() => {\n  if (window.__mflFooterSpaNavigationBound) return;")
    && sharedShellNavigation.includes('.siteFooterDetails a[href="/changelog"]')
    && sharedShellNavigation.includes(".changelogMinorToggle")
    && sharedShellNavigation.includes('.brandLink[href="/"]')
    && !sharedShellNavigation.includes("__mflUniversalClubSearch")
    && !sharedShellNavigation.includes("renderSearchResultsNowV1500")
    && !sharedShellNavigation.includes("renderSearchResultsFromBootstrap")
    && !sharedShellNavigation.includes("mfl-recent-search-clubs")
    && !sharedShellNavigation.includes("function csvEscape")
    && !sharedShellNavigation.includes("function mflChunkFromPublicData")
    && !sharedShellNavigation.includes("function progressionDataColumns"),
  "Shared shell navigation must own footer Changelog navigation/toggling and brand Home navigation after application startup publication.",
);
invariant(
  !sharedFoundations.includes("function normalizeSettingsTheme")
    && !sharedSession.includes("function playerIdFromUrl")
    && !sharedRouting.includes("function currentNavigationPath")
    && !sharedTransitions.includes("function resetPageScroll")
    && !sharedPageLifecycle.includes("function updateStatusDate")
    && !sharedHomeSummary.includes("function tablePageKey")
    && !sharedTableState.includes("function scheduleToastHide")
    && !sharedToastCore.includes("function showWatchlistToast")
    && !sharedPersonalState.includes("function formatCount")
    && !sharedDataSearch.includes("const DEFAULT_EVALUATION_MFL_PER_USD")
    && !sharedEvaluationLifecycle.includes("function playerFirstPaintKnownValues")
    && !sharedPlayerFirstPaint.includes("function removePlayerIdFromAllWatchlists")
    && !sharedWatchlistActions.includes("function countryCodeForNationality")
    && !sharedPlayerDisplay.includes("async function copyPlayerId")
    && !sharedPlayerActions.includes("function showModal")
    && !sharedModalLifecycle.includes("async function openSearch")
    && !sharedGlobalSearch.includes("function linkedWalletAddressesForOwnedPlayers")
    && !sharedWalletRowClassification.includes("function escapeHtml")
    && !sharedHtmlEscaping.includes("function clubRouteTargetFromPath")
    && !sharedIncrementalRouting.includes("let pendingViewButtonPointer")
    && !sharedInteractionBindings.includes("function setupChangelogSections")
    && !sharedStartupLifecycle.includes("function syncLayoutCenter")
    && !sharedLayoutCenter.includes("setIncrementalPage")
    && !sharedIncrementalNavigation.includes("function setPageWithRouteRuntime")
    && !sharedRouteRuntimeGate.includes("function tableHeaderContext")
    && !sharedCoreContracts.includes("window.__mflMarkApplicationCoreLoaded")
    && !sharedAppStartup.includes("__mflFooterSpaNavigationBound"),
  "Shared foundations, session, routing, transitions, page lifecycle, Home summary, table state, generic toast core, personal state, data/search, Evaluation lifecycle, Player first-paint/navigation, watchlist actions, Player display/calculation, Player action facades, generic modal lifecycle, Global Search lifecycle, wallet-row classification, HTML escaping, incremental routing, global interaction bindings, startup lifecycle, layout centering, incremental navigation, the route-runtime gate, explicit core contracts, application startup, and shell navigation must keep explicit terminal ownership boundaries.",
);

const retiredFiles = [
  "app-core-build-normalizer.js",
  "app-core-splitter-utils.js",
  "app-core-route-chunks.js",
  "app-core-sidebar-lifecycle.js",
  "app-core-evaluation-chunk.js",
  "app-core-evaluation-snapshot-edit-route.js",
  "app-core-settings-chunk.js",
  "app-core-settings-email-reset.js",
  "app-core-player-chunk.js",
  "app-core-filter-control-state.js",
  "app-core-table-chunk.js",
  "app-core-mobile-table.js",
  "app-core-table-row-centering.js",
  "app-core-wallet-chunk.js",
  "app-core-watchlist-route-chunk.js",
  "app-core-stats-route-ownership.js",
];
for (const file of retiredFiles) {
  try {
    await access(new URL(`./modules/${file}`, import.meta.url));
    throw new Error(`Retired application-core implementation must stay deleted: modules/${file}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

console.log("Canonical application-core manifest, ordered source-fragment ownership, Shared foundations/session/navigation boundaries, generated equivalence, universal shared-core ceiling, domain ownership, and retired implementation cleanup validation passed.");
