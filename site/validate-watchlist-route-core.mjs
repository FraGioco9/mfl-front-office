import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, splitter, routeLoader, routeNormalizer, buildCore] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-watchlist-route-chunk.js"),
  read("./route-core-loader-runtime.js"),
  read("./modules/app-core-route-runtime-normalizer.js"),
  read("./build-app-core.mjs"),
]);

const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const sharedCore = String(artifacts.core || "");
const watchlistCore = String(artifacts.routeChunks?.watchlist || "");

invariant(sharedCore.length > 300_000, "The shared application core became unexpectedly small after the Watchlist split.");
invariant(watchlistCore.length > 3_000, "The Watchlist route core is too small to represent route ownership.");
new Function(sharedCore);
new Function(watchlistCore);

includes(splitter, '"Watchlist switcher and dropdown owner"', "The Watchlist splitter must extract switcher ownership.");
includes(splitter, '"Watchlist route selection and navigation owner"', "The Watchlist splitter must extract route navigation ownership.");
includes(splitter, "routeChunks: Object.freeze({ ...routeChunks, watchlist:", "The artifact map must expose the Watchlist chunk.");

includes(sharedCore, "let __mflWatchlistRenderSwitcherOwner = null;", "Shared core must retain a stable Watchlist switcher facade.");
includes(sharedCore, "function renderWatchlistSwitcher() {", "Shared core must retain the Watchlist switcher facade name.");
includes(sharedCore, "async function ensureWatchlistRoute() {", "Shared core must retain the Watchlist route facade.");
includes(sharedCore, "function switchWatchlist() {", "Shared core must retain the switchWatchlist facade for route-runtime wrappers.");
includes(sharedCore, "function playerIsInAnyWatchlist(playerId) {", "Cross-route Player watchlist state must remain shared.");
includes(sharedCore, "function selectedPlayerIdsArray() {", "Cross-route selection actions must remain shared.");
includes(sharedCore, "function normalizeWatchlists(watchlists, legacyIds = []) {", "Watchlist persistence normalization must remain shared.");
excludes(sharedCore, "watchlistDropdown.replaceChildren();", "Watchlist dropdown DOM construction must not remain universal.");
excludes(sharedCore, "function watchlistRenderSwitcherOwner() {", "Watchlist route owner must not remain shared.");
excludes(sharedCore, "function watchlistSwitchOwner(", "Watchlist switching implementation must not remain shared.");

includes(watchlistCore, "function watchlistRenderSwitcherOwner() {", "Watchlist chunk must own switcher rendering.");
includes(watchlistCore, "function watchlistCloseDropdownOwner() {", "Watchlist chunk must own dropdown closing.");
includes(watchlistCore, "function watchlistToggleDropdownOwner() {", "Watchlist chunk must own dropdown toggling.");
includes(watchlistCore, "function watchlistUpdateUrlOwner(", "Watchlist chunk must own route URL synchronization.");
includes(watchlistCore, "async function watchlistEnsureRouteOwner(", "Watchlist chunk must own route selection.");
includes(watchlistCore, "function watchlistSwitchOwner(", "Watchlist chunk must own watchlist switching.");
includes(watchlistCore, "watchlistDropdown.replaceChildren();", "Watchlist chunk must own dropdown DOM construction.");
includes(watchlistCore, "__mflWatchlistSwitchOwner = watchlistSwitchOwner;", "Watchlist chunk must publish the shared facade owner.");
excludes(watchlistCore, "function selectedPlayerIdsArray() {", "Cross-route selection actions must not become Watchlist-only.");
excludes(watchlistCore, "function normalizeWatchlists(watchlists, legacyIds = []) {", "Watchlist persistence normalization must not become route-only.");

includes(routeLoader, 'watchlist: "/modules/app-core-watchlist-runtime.js"', "Route loader must map the Watchlist core.");
includes(routeLoader, 'if (page === "watchlist") return ["table", "watchlist"];', "Watchlist routes must load Table before Watchlist ownership.");
includes(routeNormalizer, "const directWatchlistRoute =", "Direct startup must identify Watchlist routes separately.");
includes(routeNormalizer, 'await window.__mflEnsureRouteCore("watchlist");', "Direct Watchlist startup must load Watchlist ownership before startApp.");

includes(buildCore, 'const watchlistRuntimePath = resolve(siteRoot, "modules/app-core-watchlist-runtime.js");', "The build must emit a generated Watchlist runtime.");
includes(buildCore, "artifacts.routeChunks?.watchlist", "The build must consume the Watchlist artifact.");

const generatedWatchlist = await read("./modules/app-core-watchlist-runtime.js");
const watchlistBanner = "// Generated Watchlist core chunk from modules/app-core.js. Do not edit directly.\n";
invariant(generatedWatchlist.startsWith(watchlistBanner), "Generated Watchlist runtime must carry the build ownership banner.");
invariant(
  generatedWatchlist.slice(watchlistBanner.length).replace(/\s*$/, "") === watchlistCore.replace(/\s*$/, ""),
  "Generated Watchlist runtime must exactly match the Watchlist build artifact.",
);

console.log("Watchlist route-core splitting validation passed.");
