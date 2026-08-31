import { readFile } from "node:fs/promises";

import { readCanonicalCoreArtifacts } from "./validate-core-sources.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, appConfig, routeLoader, buildCore, appEntry, bootstrapCore, tableLoading, watchlistRouteRuntime, generatedWatchlist] = await Promise.all([
  Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
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

includes(buildCore, 'Object.freeze({ source: "watchlist.js", runtime: "app-core-watchlist-runtime.js"', "Core build must generate Watchlist directly from canonical source.");
excludes(buildCore, "app-core-watchlist-route-chunk.js", "Core build must not depend on the retired Watchlist splitter.");

includes(bootstrapCore, 'const UNIFORM_LOADING_WORKFLOW_NAME = "Uniform Loading Workflow";', "Watchlist must use the canonical Uniform Loading Workflow.");
includes(bootstrapCore, "window.__mflUniformLoadingWorkflow = window.__mflInteractionBusy;", "Uniform Loading Workflow must remain an alias of the sole loading controller.");
includes(bootstrapCore, 'const ROUTE_LOADING_REASON = "route-loading";', "Watchlist transitions must share canonical route-loading identity.");
excludes(bootstrapCore, '"switchWatchlist"', "Direct Watchlist switching must not retain a blanket route-loading alias.");
includes(tableLoading, "controller.subscribe(sync)", "Table loading must subscribe to the canonical loading-state owner.");
includes(tableLoading, '["database", "mfl", "progression", "watchlist", "myplayers", "agents", "club"]', "Watchlist must participate in canonical table-loading classification.");

includes(watchlistRouteRuntime, "function interactionBusyChainIncludes(candidate, target) {", "Watchlist/My Players coordination must recognize the loading wrapper chain.");
includes(watchlistRouteRuntime, "const delegatedSetPage = candidate;", "Watchlist setPage wrapper must capture an immutable delegate.");
includes(watchlistRouteRuntime, "await delegatedSetPage.call(this, pageName, updateHash, nextOptions);", "Watchlist route coordination must delegate through its captured shared setPage owner.");
includes(watchlistRouteRuntime, "if (watchlistNavigation && walletPreferencesSyncActive()) await waitForWalletPreferencesSettled();", "Watchlist navigation must wait for required wallet-preference synchronization.");
includes(watchlistRouteRuntime, "const delegatedSwitchWatchlist = candidate;", "Direct Watchlist switch wrapper must capture an immutable delegate.");
for (const forbidden of ['classList.add("mflDataLoading"', 'classList.remove("mflDataLoading"', "nav.pager", "__mflTableLoadingRuntime", "window.eval"]) {
  excludes(watchlistRouteRuntime, forbidden, `Watchlist route coordination must not own loading presentation or eval (${forbidden}).`);
}

const watchlistBanner = "// Generated Watchlist core from modules/core-sources/watchlist.js. Do not edit directly.\n";
invariant(generatedWatchlist.startsWith(watchlistBanner), "Generated Watchlist runtime must carry the build ownership banner.");
invariant(generatedWatchlist.slice(watchlistBanner.length).replace(/\s*$/, "") === watchlistCore.replace(/\s*$/, ""), "Generated Watchlist runtime must exactly match canonical Watchlist source.");

console.log("Watchlist route-core ownership, stable delegates, loading coordination, and deterministic generated output validation passed.");
