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
  splitter,
  routeLoader,
  routeNormalizer,
  buildCore,
  appEntry,
  bootstrapCore,
  tableLoading,
  watchlistRouteRuntime,
] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-watchlist-route-chunk.js"),
  read("./route-core-loader-runtime.js"),
  read("./modules/app-core-route-runtime-normalizer.js"),
  read("./build-app-core.mjs"),
  read("./modules/app-entry.js"),
  read("./bootstrap-core.js"),
  read("./table-loading-runtime.js"),
  read("./watchlist-myplayers-route-runtime.js"),
]);

const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const sharedCore = String(artifacts.core || "");
const tableCore = String(artifacts.routeChunks?.table || "");
const watchlistCore = String(artifacts.routeChunks?.watchlist || "");

invariant(sharedCore.length > 300_000, "The shared application core became unexpectedly small after the Watchlist split.");
invariant(tableCore.length > 20_000, "The Table core must remain available before Watchlist ownership.");
invariant(watchlistCore.length > 3_000, "The Watchlist route core is too small to represent switcher ownership.");
new Function(sharedCore);
new Function(tableCore);
new Function(watchlistCore);

includes(splitter, '"Watchlist switcher and dropdown owner"', "The Watchlist splitter must extract switcher ownership.");
includes(splitter, "routeChunks: Object.freeze({ ...routeChunks, watchlist:", "The artifact map must expose the Watchlist chunk.");

includes(sharedCore, "let __mflWatchlistRenderSwitcherOwner = null;", "Shared core must retain a stable Watchlist switcher facade.");
includes(sharedCore, "function renderWatchlistSwitcher() {", "Shared core must retain the Watchlist switcher facade name.");
includes(sharedCore, "function closeWatchlistDropdown() {", "Shared core must retain a safe dropdown-close facade for global Escape/pointer handling.");
includes(sharedCore, "function toggleWatchlistDropdown() {", "Shared core must retain the switcher-button facade.");
includes(sharedCore, "async function ensureWatchlistRoute(", "Watchlist route selection must remain shared for setPage orchestration.");
includes(sharedCore, "function switchWatchlist(", "Watchlist switching must retain its existing shared API for post-core wrappers.");
includes(sharedCore, "function playerIsInAnyWatchlist(playerId) {", "Cross-route Player watchlist state must remain shared.");
includes(sharedCore, "function normalizeWatchlists(watchlists, legacyIds = []) {", "Watchlist persistence normalization must remain shared.");
excludes(sharedCore, "watchlistDropdown.replaceChildren();", "Watchlist dropdown DOM construction must not remain universal.");
excludes(sharedCore, "function watchlistRenderSwitcherOwner() {", "Watchlist route UI owner must not remain shared.");

includes(watchlistCore, "function watchlistRenderSwitcherOwner() {", "Watchlist chunk must own switcher rendering.");
includes(watchlistCore, "function openWatchlistDropdown() {", "Watchlist chunk must own dropdown opening.");
includes(watchlistCore, "function watchlistCloseDropdownOwner() {", "Watchlist chunk must own dropdown closing.");
includes(watchlistCore, "function watchlistToggleDropdownOwner() {", "Watchlist chunk must own dropdown toggling.");
includes(watchlistCore, "watchlistDropdown.replaceChildren();", "Watchlist chunk must own dropdown DOM construction.");
includes(watchlistCore, "__mflWatchlistToggleDropdownOwner = watchlistToggleDropdownOwner;", "Watchlist chunk must publish the shared UI facade owners.");
excludes(watchlistCore, "async function ensureWatchlistRoute(", "Watchlist route selection must not be duplicated in the UI chunk.");
excludes(watchlistCore, "function switchWatchlist(", "Watchlist switching must not be duplicated in the UI chunk.");
excludes(watchlistCore, "function selectedPlayerIdsArray() {", "Cross-route selection actions must not become Watchlist-only.");
excludes(watchlistCore, "function normalizeWatchlists(watchlists, legacyIds = []) {", "Watchlist persistence normalization must not become route-only.");

includes(coreSource, 'const visible = state.currentPage === "watchlist" && hasWalletOptIn();', "The Watchlist switcher must remain visible only on the Watchlist page.");
includes(appEntry, "const WATCHLIST_UI_POST_CORE_RUNTIME_SCRIPTS = Object.freeze([", "Watchlist-only UI behavior must have its own runtime group.");
includes(appEntry, "const WATCHLIST_MYPLAYERS_POST_CORE_RUNTIME_SCRIPTS = Object.freeze([", "Watchlist/My Players route coordination must remain shared between both pages.");
includes(appEntry, 'if (page === "watchlist") scripts.push(...WATCHLIST_UI_POST_CORE_RUNTIME_SCRIPTS);', "Only the Watchlist page may load the rename-tooltip UI runtime.");
includes(appEntry, "if (routeNeedsWatchlist(page)) scripts.push(...WATCHLIST_MYPLAYERS_POST_CORE_RUNTIME_SCRIPTS);", "Watchlist/My Players route coordination must still load on both pages.");
excludes(appEntry, "WATCHLIST_POST_CORE_RUNTIME_SCRIPTS", "My Players must not inherit the Watchlist-only UI runtime through a combined group.");

includes(routeLoader, 'watchlist: "/modules/app-core-watchlist-runtime.js"', "Route loader must map the Watchlist core.");
includes(routeLoader, 'if (page === "watchlist") return ["table", "watchlist"];', "Watchlist routes must load Table before Watchlist UI ownership.");
includes(routeNormalizer, "const directWatchlistRoute =", "Direct startup must identify Watchlist routes separately.");
includes(routeNormalizer, 'await window.__mflEnsureRouteCore("watchlist");', "Direct Watchlist startup must load Table and Watchlist ownership before startApp.");

includes(buildCore, 'const watchlistRuntimePath = resolve(siteRoot, "modules/app-core-watchlist-runtime.js");', "The build must emit a generated Watchlist runtime.");
includes(buildCore, "artifacts.routeChunks?.watchlist", "The build must consume the Watchlist artifact.");

includes(
  bootstrapCore,
  'const UNIFORM_LOADING_WORKFLOW_NAME = "Uniform Loading Workflow";',
  "Watchlist must use the canonical project-wide Uniform Loading Workflow rather than an unnamed page-specific loader.",
);
includes(
  bootstrapCore,
  "window.__mflUniformLoadingWorkflow = window.__mflInteractionBusy;",
  "The Uniform Loading Workflow must remain an alias of the sole global loading controller.",
);
includes(
  bootstrapCore,
  '"startup", "interaction-loading", "setPage", "setView", "switchWatchlist", "route-runtime",',
  "Watchlist page, view, direct list-switch, and lazy-route transitions must inherit the same global data-loading lifecycle as every other route.",
);
includes(
  bootstrapCore,
  '"setPage", "setView", "switchWatchlist", "ensureProgressionData", "requestIncrementalRoute"',
  "The global loading bridge must wrap direct Watchlist switches as well as page and view owners, so loading starts before the active-list mutation regardless of cache state.",
);
includes(
  bootstrapCore,
  'Object.defineProperty(wrapped, "__mflInteractionBusyOriginal", { value: original });',
  "Uniform Loading Workflow wrappers must expose their delegate so route runtimes can recognize an already-wrapped owner without wrapping it recursively.",
);
includes(
  bootstrapCore,
  "window.__mflTableLoadingRuntime?.sync?.();",
  "The Uniform Loading Workflow must synchronize table loading presentation at the same time as its loading token state changes.",
);
includes(
  tableLoading,
  'document.documentElement.classList.contains("mflDataLoading")',
  "Table loading must be driven only by the global data-loading state.",
);
includes(
  tableLoading,
  '["database", "mfl", "progression", "watchlist", "myplayers", "agents", "club"]',
  "Watchlist must participate in the canonical table-loading route classification.",
);

includes(
  watchlistRouteRuntime,
  "function interactionBusyChainIncludes(candidate, target) {",
  "Watchlist/My Players coordination must recognize the Uniform Loading Workflow wrapper chain instead of treating it as a new route owner.",
);
includes(
  watchlistRouteRuntime,
  "candidate === wrappedSetPage || interactionBusyChainIncludes(candidate, wrappedSetPage)",
  "Revisiting Watchlist or My Players must not install a second setPage wrapper around the existing Watchlist coordinator.",
);
includes(
  watchlistRouteRuntime,
  "const delegatedSetPage = candidate;",
  "Each Watchlist setPage wrapper must capture an immutable delegate rather than reading a mutable outer originalSetPage reference.",
);
includes(
  watchlistRouteRuntime,
  "await delegatedSetPage.call(this, pageName, updateHash, nextOptions);",
  "Watchlist route coordination must delegate its actual page transition through its immutable shared setPage owner.",
);
includes(
  watchlistRouteRuntime,
  "await reconcile(latestIntent, delegatedSetPage);",
  "Watchlist reconciliation must use the same immutable setPage delegate as the navigation that created the intent.",
);
includes(
  watchlistRouteRuntime,
  "if (watchlistNavigation && walletPreferencesSyncActive()) await waitForWalletPreferencesSettled();",
  "Watchlist navigation must not finish until its required wallet-preference synchronization has settled.",
);
includes(
  watchlistRouteRuntime,
  "candidate === wrappedSwitchWatchlist || interactionBusyChainIncludes(candidate, wrappedSwitchWatchlist)",
  "Direct Watchlist switching must also reject duplicate installation through an outer Uniform Loading Workflow wrapper.",
);
includes(
  watchlistRouteRuntime,
  "const delegatedSwitchWatchlist = candidate;",
  "The direct Watchlist switch wrapper must capture an immutable delegate and cannot be redirected into itself by a later install attempt.",
);
includes(
  watchlistRouteRuntime,
  "wrappedSwitchWatchlist = function switchWatchlistWithSingleLoad(...args) {",
  "Direct Watchlist changes may retain request deduping, but their final owner must be wrapped by the Uniform Loading Workflow.",
);
excludes(
  watchlistRouteRuntime,
  "await originalSetPage.call(this, pageName, updateHash, nextOptions);",
  "Watchlist setPage wrappers must not call a mutable originalSetPage reference that can be reassigned during a later route-runtime install.",
);
const watchlistRuntimeInstall = appEntry.indexOf("runtimeWindow.__mflWatchlistMyPlayersRouteRuntime?.install?.();");
const globalBridgeReinstall = appEntry.indexOf("installCoreBridges();", watchlistRuntimeInstall);
invariant(
  watchlistRuntimeInstall >= 0 && globalBridgeReinstall > watchlistRuntimeInstall,
  "After installing the Watchlist route wrapper, app-entry must re-install the global loading bridge so page and direct-list Watchlist operations remain inside the Uniform Loading Workflow.",
);
for (const forbidden of [
  'classList.add("mflDataLoading"',
  'classList.remove("mflDataLoading"',
  'classList.add("mflInteractionBusy"',
  'classList.remove("mflInteractionBusy"',
  "nav.pager",
  "__mflTableLoadingRuntime",
]) {
  excludes(
    watchlistRouteRuntime,
    forbidden,
    `Watchlist route coordination must not own loading presentation directly (${forbidden}); the Uniform Loading Workflow is the sole owner.`,
  );
}

const generatedWatchlist = await read("./modules/app-core-watchlist-runtime.js");
const watchlistBanner = "// Generated Watchlist core chunk from modules/app-core.js. Do not edit directly.\n";
invariant(generatedWatchlist.startsWith(watchlistBanner), "Generated Watchlist runtime must carry the build ownership banner.");
invariant(
  generatedWatchlist.slice(watchlistBanner.length).replace(/\s*$/, "") === watchlistCore.replace(/\s*$/, ""),
  "Generated Watchlist runtime must exactly match the Watchlist build artifact.",
);

console.log("Watchlist route-core splitting, stable route delegates, and canonical Uniform Loading Workflow ownership validation passed.");