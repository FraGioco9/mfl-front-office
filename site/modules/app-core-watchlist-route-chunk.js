// @ts-check

function extractRequiredWatchlistRouteSection(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = start >= 0 ? source.indexOf(endMarker, start + startMarker.length) : -1;
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(`Could not split Watchlist route application core section: ${label}.`);
  }

  return {
    core: `${source.slice(0, start)}${source.slice(end)}`,
    chunk: source.slice(start, end).replace(/^\s+|\s+$/g, ""),
  };
}

function renameRequiredWatchlistRouteOwner(source, functionName, ownerName) {
  const asyncMarker = `async function ${functionName}(`;
  const marker = `function ${functionName}(`;
  if (source.includes(asyncMarker)) {
    return source.replace(asyncMarker, `async function ${ownerName}(`);
  }
  if (source.includes(marker)) {
    return source.replace(marker, `function ${ownerName}(`);
  }
  throw new Error(`Could not delegate Watchlist route owner: ${functionName}.`);
}

const WATCHLIST_ROUTE_FACADE_BLOCK = `let __mflWatchlistRenderSwitcherOwner = null;
let __mflWatchlistCloseDropdownOwner = null;
let __mflWatchlistToggleDropdownOwner = null;

function renderWatchlistSwitcher() {
  if (typeof __mflWatchlistRenderSwitcherOwner === "function") {
    return __mflWatchlistRenderSwitcherOwner.apply(this, arguments);
  }
  if (watchlistSwitcher) watchlistSwitcher.hidden = true;
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
  const input = artifacts && typeof artifacts === "object" ? artifacts : {};
  const routeChunks = input.routeChunks && typeof input.routeChunks === "object" ? input.routeChunks : {};
  if (String(routeChunks.watchlist || "").trim()) return artifacts;

  let core = String(input.core || "").replace(/\r\n?/g, "\n");
  if (!core.trim()) {
    throw new Error("Cannot split Watchlist route ownership from an empty application core.");
  }

  const switcher = extractRequiredWatchlistRouteSection(
    core,
    "function renderWatchlistSwitcher() {",
    "function showGenericToast(message) {",
    "Watchlist switcher and dropdown owner",
  );
  core = switcher.core;

  const facadeMarker = "function showGenericToast(message) {";
  const facadeIndex = core.indexOf(facadeMarker);
  if (facadeIndex < 0) {
    throw new Error("Could not locate the Watchlist route facade insertion point.");
  }
  core = `${core.slice(0, facadeIndex)}${WATCHLIST_ROUTE_FACADE_BLOCK}\n\n${core.slice(facadeIndex)}`;

  let watchlist = switcher.chunk.replace(/\s*$/, "");
  watchlist = renameRequiredWatchlistRouteOwner(watchlist, "renderWatchlistSwitcher", "watchlistRenderSwitcherOwner");
  watchlist = renameRequiredWatchlistRouteOwner(watchlist, "closeWatchlistDropdown", "watchlistCloseDropdownOwner");
  watchlist = renameRequiredWatchlistRouteOwner(watchlist, "toggleWatchlistDropdown", "watchlistToggleDropdownOwner");
  watchlist = `${watchlist}\n\n${WATCHLIST_ROUTE_OWNER_ASSIGNMENTS}`;

  const normalizedCore = core.replace(/\s*$/, "");
  if (!watchlist.trim() || !normalizedCore) {
    throw new Error("Watchlist route application core split produced an empty artifact.");
  }

  return Object.freeze({
    core: normalizedCore,
    routeChunks: Object.freeze({ ...routeChunks, watchlist: watchlist.replace(/\s*$/, "") }),
  });
}
