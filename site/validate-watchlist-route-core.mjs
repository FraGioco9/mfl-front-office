import { invariant, includes, excludes } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";

import { coreSourceByDomain } from "./modules/core-source-manifest.js";
import { readCanonicalCoreArtifacts, readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const [coreSource, appConfig, routeLoader, buildCore, appEntry, bootstrapCore, tableLoading, watchlistRouteRuntime, generatedWatchlist] = await Promise.all([
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
  read("./modules/app-config.js"),
  read("./route-core-loader-runtime.js"),
  read("./build-app-core.mjs"),
  read("./modules/app-entry.js"),
  read("./bootstrap-core.js"),
  read("./table-loading-runtime.js"),
  read("./watchlist-myplayers-route-runtime.js"),
  read("./modules/app-core-watchlist-runtime.js"),
]);

const artifacts = readCanonicalCoreArtifacts(coreSource);
const sharedCore = String(artifacts.core || "");
const tableCore = String(artifacts.routeChunks?.table || "");
const watchlistCore = String(artifacts.routeChunks?.watchlist || "");

invariant(sharedCore.length > 300_000, "The shared application core became unexpectedly small after the Watchlist split.");
invariant(tableCore.length > 20_000, "The Table core must remain available before Watchlist ownership.");
invariant(watchlistCore.length > 3_000, "The Watchlist route core is too small to represent switcher ownership.");
new Function(sharedCore);
new Function(tableCore);
new Function(watchlistCore);

includes(sharedCore, "let __mflWatchlistRenderSwitcherOwner = null;", "Shared core must retain a stable Watchlist switcher facade.");
includes(sharedCore, "function renderWatchlistSwitcher() {", "Shared core must retain the Watchlist switcher facade name.");
includes(sharedCore, "function closeWatchlistDropdown() {", "Shared core must retain a safe dropdown-close facade for global Escape/pointer handling.");
includes(sharedCore, "async function ensureWatchlistRoute(", "Watchlist route selection must remain shared for setPage orchestration.");
includes(sharedCore, "function switchWatchlist(", "Watchlist switching must retain its shared API.");
includes(sharedCore, 'const targetUrl = `${targetPath}${window.location.search}`;', "Watchlist route canonicalization must preserve active table URL filters.");
includes(sharedCore, 'window.history[replace ? "replaceState" : "pushState"]({}, "", targetUrl);', "Watchlist route writes must use the query-preserving canonical target.");
includes(sharedCore, "const watchlistMatch = cleanPath.match(/^\\/watchlist(?:\\/[^/]+)?(?:\\/[^/]+)?$/);", "Canonical route parsing must recognize Watchlist id/view URLs directly.");
includes(sharedCore, "const target = watchlistTargetFromUrl(cleanPath);", "Canonical route parsing must resolve Watchlist URL identity once.");
includes(sharedCore, "const normalizedView = normalizeViewForPage(target.view, \"watchlist\");", "Canonical route parsing must normalize the Watchlist view before setPage receives it.");
includes(sharedCore, "watchlistId: target.watchlistId,", "Canonical Watchlist route options must carry the selected Watchlist id.");
includes(sharedCore, "view: normalizedView,", "Canonical Watchlist route options must carry the selected view.");
for (const retired of [
  "routeViewFromPath",
  "enforceWatchlistRouteView",
  "restoreSavedTableStateWithRoute",
  "setPageWithWatchlistRoute",
]) excludes(sharedCore, retired, `Legacy Watchlist route-view reparser must stay removed: ${retired}`);
includes(sharedCore, "watchlistViews: /** @type {Record<string, string>} */ ({}),", "Watchlist view memory must live in canonical shared state.");
includes(sharedCore, "state.watchlistViews[state.currentWatchlistId] = state.view;", "Canonical table-state serialization must capture the active Watchlist view.");
includes(sharedCore, "watchlistViews: { ...state.watchlistViews },", "Canonical table-state serialization must persist per-Watchlist views.");
includes(sharedCore, "const incomingWatchlistViews = mergedState.watchlistViews;", "Wallet table-state hydration must restore per-Watchlist views without a wrapper.");
includes(sharedCore, "Object.entries(incomingWatchlistViews).forEach(([watchlistId, view]) => {", "Wallet table-state hydration must merge validated per-Watchlist views into canonical state.");
excludes(sharedCore, "state.watchlistViews = {};", "Partial wallet table-state hydration must not clear newer in-session per-Watchlist view choices.");
includes(sharedCore, 'const savedView = String(state.watchlistViews[nextWatchlist.id] || "").trim();', "Watchlist switching must resolve its saved view before rendering the destination list.");
includes(tableCore, "state.watchlistViews[state.currentWatchlistId] = viewName;", "Canonical Table view switching must update Watchlist view memory directly.");
for (const retired of [
  "watchlistViewsKey",
  "currentTableStateWithWatchlistViews",
  "stripPersistentSortStateWithWatchlistViews",
  "applyWalletTableStateWithWatchlistViews",
  "setViewWithWatchlistSync",
  "switchWatchlistWithSavedView",
]) excludes(sharedCore, retired, `Legacy Watchlist view persistence wrapper must stay removed: ${retired}`);
includes(sharedCore, "function normalizeWatchlists(watchlists, legacyIds = []) {", "Watchlist persistence normalization must remain shared.");
excludes(sharedCore, "watchlistDropdown.replaceChildren();", "Watchlist dropdown DOM construction must not remain universal.");

includes(watchlistCore, "function watchlistRenderSwitcherOwner() {", "Watchlist core must own switcher rendering.");
includes(watchlistCore, "function openWatchlistDropdown() {", "Watchlist core must own dropdown opening.");
includes(watchlistCore, "function watchlistCloseDropdownOwner() {", "Watchlist core must own dropdown closing.");
includes(watchlistCore, "function watchlistToggleDropdownOwner() {", "Watchlist core must own dropdown toggling.");
includes(watchlistCore, "watchlistDropdown.replaceChildren();", "Watchlist core must own dropdown DOM construction.");
includes(watchlistCore, "__mflWatchlistToggleDropdownOwner = watchlistToggleDropdownOwner;", "Watchlist core must publish shared UI facade owners.");
excludes(watchlistCore, "async function ensureWatchlistRoute(", "Watchlist route selection must not be duplicated in the UI core.");
excludes(watchlistCore, "function switchWatchlist(", "Watchlist switching must not be duplicated in the UI core.");

includes(coreSource, 'const visible = state.currentPage === "watchlist" && hasWalletOptIn();', "The Watchlist switcher must remain visible only on the Watchlist page.");
includes(appConfig, "watchlistMyPlayersPost: Object.freeze([", "Watchlist/My Players coordination must remain a canonical dependency group.");
includes(appConfig, 'const watchlist = page === "watchlist" || page === "myplayers";', "Canonical route planning must classify Watchlist and My Players together.");
includes(appConfig, 'watchlist: "/modules/app-core-watchlist-runtime.js"', "Canonical app config must map the Watchlist core.");
includes(appConfig, 'core.push("table", "watchlist");', "Watchlist routes must load Table before Watchlist UI ownership.");
includes(routeLoader, "const dependencies = routeConfig.routeDependencyPlan(pageName, options).core;", "Route-core loader must consume canonical Watchlist dependencies.");
includes(appEntry, "await loadScriptGroup(plan.postCore);", "app-entry must consume canonical post-core Watchlist dependencies.");
excludes(appEntry, "/watchlist-ui-runtime.js", "Retired Watchlist compatibility runtime must stay removed.");

includes(buildCore, 'from "./modules/core-source-manifest.js"', "Core build must consume the canonical source manifest.");
includes(buildCore, "for (const entry of coreSourceManifest)", "Core build must generate Watchlist and other runtimes from the canonical manifest.");
invariant(
  coreSourceByDomain.watchlist?.source === "watchlist.js"
    && coreSourceByDomain.watchlist?.runtime === "app-core-watchlist-runtime.js",
  "Canonical manifest must map Watchlist source ownership to its generated runtime.",
);
excludes(buildCore, "app-core-watchlist-route-chunk.js", "Core build must not depend on the retired Watchlist splitter.");

includes(bootstrapCore, 'const UNIFORM_LOADING_WORKFLOW_NAME = "Uniform Loading Workflow";', "Watchlist must use the canonical Uniform Loading Workflow.");
includes(bootstrapCore, "window.__mflUniformLoadingWorkflow = window.__mflInteractionBusy;", "Uniform Loading Workflow must remain an alias of the sole loading controller.");
includes(bootstrapCore, 'const ROUTE_LOADING_REASON = "route-loading";', "Watchlist transitions must share canonical route-loading identity.");
excludes(bootstrapCore, '"switchWatchlist"', "Direct Watchlist switching must not retain a blanket route-loading alias.");
includes(tableLoading, "controller.subscribe(sync)", "Table loading must subscribe to the canonical loading-state owner.");
includes(tableLoading, '["database", "mfl", "progression", "watchlist", "myplayers", "agents", "club"]', "Watchlist must participate in canonical table-loading classification.");

includes(watchlistRouteRuntime, "function interactionBusyChainIncludes(candidate, target) {", "Watchlist/My Players coordination must recognize the loading wrapper chain.");
includes(watchlistRouteRuntime, 'const delegatedSetPage = globalFunction("__mflSetPageRouteOwner");', "Watchlist route coordination must capture the explicit immutable route owner.");
includes(watchlistRouteRuntime, "await delegatedSetPage.call(this, pageName, updateHash, nextOptions);", "Watchlist route coordination must delegate through its captured route owner.");
includes(watchlistRouteRuntime, 'Reflect.set(window, "__mflSetPageFeatureOwner", setPageFeatureOwner);', "Watchlist/My Players coordination must register through the stable setPage feature-owner slot.");
excludes(watchlistRouteRuntime, 'replaceGlobalFunction("setPage"', "Watchlist/My Players coordination must not replace the stable public setPage function.");
includes(watchlistRouteRuntime, "if (watchlistNavigation && walletPreferencesSyncActive()) await waitForWalletPreferencesSettled();", "Watchlist navigation must wait for required wallet-preference synchronization.");
includes(watchlistRouteRuntime, "const delegatedSwitchWatchlist = candidate;", "Direct Watchlist switch wrapper must capture an immutable delegate.");
for (const forbidden of ['classList.add("mflDataLoading"', 'classList.remove("mflDataLoading"', "nav.pager", "__mflTableLoadingRuntime", "window.eval"]) {
  excludes(watchlistRouteRuntime, forbidden, `Watchlist route coordination must not own loading presentation or eval (${forbidden}).`);
}

const watchlistBanner = String(coreSourceByDomain.watchlist?.banner || "");
invariant(watchlistBanner && generatedWatchlist.startsWith(watchlistBanner), "Generated Watchlist runtime must carry the manifest-owned build banner.");
invariant(generatedWatchlist.slice(watchlistBanner.length).replace(/\s*$/, "") === watchlistCore.replace(/\s*$/, ""), "Generated Watchlist runtime must exactly match canonical Watchlist source.");

console.log("Watchlist route-core ownership, stable delegates, loading coordination, and deterministic generated output validation passed.");