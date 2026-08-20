// @ts-check

import {
  extractRequiredSection,
  extractRequiredFunctions,
  finalizeSplitArtifacts,
  insertBeforeRequiredMarker,
  normalizeSplitterInput,
  renameRequiredFunctionOwner,
} from "./app-core-splitter-utils.js";

const WATCHLIST_ROUTE_ONLY_FUNCTIONS = [
  "openRenameWatchlistModal",
  "openDeleteWatchlistModal",
];

const WATCHLIST_ROUTE_FACADE_BLOCK = `let __mflWatchlistRenderSwitcherOwner = null;
let __mflWatchlistCloseDropdownOwner = null;
let __mflWatchlistToggleDropdownOwner = null;

function renderWatchlistSwitcher() {
  if (typeof __mflWatchlistRenderSwitcherOwner === "function") {
    return __mflWatchlistRenderSwitcherOwner.apply(this, arguments);
  }
  updateWatchlistTitle();
  updateTablePlayerCount();
  return undefined;
}

function closeWatchlistDropdown() {
  if (typeof __mflWatchlistCloseDropdownOwner === "function") {
    return __mflWatchlistCloseDropdownOwner.apply(this, arguments);
  }
  if (watchlistDropdown) watchlistDropdown.hidden = true;
  if (watchlistButton) watchlistButton.setAttribute("aria-expanded", "false");
  return undefined;
}

function toggleWatchlistDropdown() {
  return typeof __mflWatchlistToggleDropdownOwner === "function"
    ? __mflWatchlistToggleDropdownOwner.apply(this, arguments)
    : undefined;
}`;

const WATCHLIST_ROUTE_OWNER_ASSIGNMENTS = `__mflWatchlistRenderSwitcherOwner = watchlistRenderSwitcherOwner;
__mflWatchlistCloseDropdownOwner = watchlistCloseDropdownOwner;
__mflWatchlistToggleDropdownOwner = watchlistToggleDropdownOwner;`;

export function splitWatchlistRouteApplicationCoreRuntime(artifacts) {
  const { alreadySplit, routeChunks, core: inputCore } = normalizeSplitterInput(
    artifacts,
    "watchlist",
    "Watchlist route ownership",
  );
  if (alreadySplit) return artifacts;

  const routeOnly = extractRequiredFunctions(inputCore, WATCHLIST_ROUTE_ONLY_FUNCTIONS, "Watchlist route-only helper");
  const switcher = extractRequiredSection(
    routeOnly.core,
    "function renderWatchlistSwitcher() {",
    "function showGenericToast(message) {",
    "Watchlist switcher and dropdown owner",
  );
  const core = insertBeforeRequiredMarker(
    switcher.core,
    "function showGenericToast(message) {",
    WATCHLIST_ROUTE_FACADE_BLOCK,
    "Watchlist route facade",
  );

  let watchlist = [switcher.chunk, ...routeOnly.chunks].join("\n\n").replace(/\s*$/, "");
  for (const [functionName, ownerName] of [
    ["renderWatchlistSwitcher", "watchlistRenderSwitcherOwner"],
    ["closeWatchlistDropdown", "watchlistCloseDropdownOwner"],
    ["toggleWatchlistDropdown", "watchlistToggleDropdownOwner"],
  ]) {
    watchlist = renameRequiredFunctionOwner(watchlist, functionName, ownerName, `Watchlist ${functionName}`);
  }
  watchlist = `${watchlist}\n\n${WATCHLIST_ROUTE_OWNER_ASSIGNMENTS}`;

  return finalizeSplitArtifacts(core, routeChunks, "watchlist", watchlist, "Watchlist route");
}
