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
    start,
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
let __mflWatchlistUpdateUrlOwner = null;
let __mflWatchlistEnsureRouteOwner = null;
let __mflWatchlistSwitchOwner = null;

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
}

function updateWatchlistUrl() {
  if (typeof __mflWatchlistUpdateUrlOwner === "function") {
    return __mflWatchlistUpdateUrlOwner.apply(this, arguments);
  }
  return undefined;
}

async function ensureWatchlistRoute() {
  if (typeof __mflWatchlistEnsureRouteOwner !== "function" && typeof window.__mflEnsureRouteCore === "function") {
    await window.__mflEnsureRouteCore("watchlist");
  }
  if (typeof __mflWatchlistEnsureRouteOwner !== "function") {
    throw new Error("Watchlist route core is not loaded.");
  }
  return __mflWatchlistEnsureRouteOwner.apply(this, arguments);
}

function switchWatchlist() {
  if (typeof __mflWatchlistSwitchOwner !== "function") {
    throw new Error("Watchlist route core is not loaded.");
  }
  return __mflWatchlistSwitchOwner.apply(this, arguments);
}`;

const WATCHLIST_ROUTE_OWNER_ASSIGNMENTS = `__mflWatchlistRenderSwitcherOwner = watchlistRenderSwitcherOwner;
__mflWatchlistCloseDropdownOwner = watchlistCloseDropdownOwner;
__mflWatchlistToggleDropdownOwner = watchlistToggleDropdownOwner;
__mflWatchlistUpdateUrlOwner = watchlistUpdateUrlOwner;
__mflWatchlistEnsureRouteOwner = watchlistEnsureRouteOwner;
__mflWatchlistSwitchOwner = watchlistSwitchOwner;`;

export function splitWatchlistRouteApplicationCoreRuntime(artifacts) {
  const input = artifacts && typeof artifacts === "object" ? artifacts : {};
  const routeChunks = input.routeChunks && typeof input.routeChunks === "object" ? input.routeChunks : {};
  if (String(routeChunks.watchlist || "").trim()) return artifacts;

  let core = String(input.core || "").replace(/\r\n?/g, "\n");
  if (!core.trim()) {
    throw new Error("Cannot split Watchlist route ownership from an empty application core.");
  }

  const watchlistParts = [];
  const switcher = extractRequiredWatchlistRouteSection(
    core,
    "function renderWatchlistSwitcher() {",
    "function showGenericToast(message) {",
    "Watchlist switcher and dropdown owner",
  );
  core = switcher.core;
  watchlistParts.push(switcher.chunk);

  const route = extractRequiredWatchlistRouteSection(
    core,
    "function updateWatchlistUrl(replace = false, force = false) {",
    "function selectedPlayerIdsArray() {",
    "Watchlist route selection and navigation owner",
  );
  core = route.core;
  watchlistParts.push(route.chunk);

  const facadeMarker = "function showGenericToast(message) {";
  const facadeIndex = core.indexOf(facadeMarker);
  if (facadeIndex < 0) {
    throw new Error("Could not locate the Watchlist route facade insertion point.");
  }
  core = `${core.slice(0, facadeIndex)}${WATCHLIST_ROUTE_FACADE_BLOCK}\n\n${core.slice(facadeIndex)}`;

  let watchlist = watchlistParts.join("\n\n").replace(/\s*$/, "");
  watchlist = renameRequiredWatchlistRouteOwner(watchlist, "renderWatchlistSwitcher", "watchlistRenderSwitcherOwner");
  watchlist = renameRequiredWatchlistRouteOwner(watchlist, "closeWatchlistDropdown", "watchlistCloseDropdownOwner");
  watchlist = renameRequiredWatchlistRouteOwner(watchlist, "toggleWatchlistDropdown", "watchlistToggleDropdownOwner");
  watchlist = renameRequiredWatchlistRouteOwner(watchlist, "updateWatchlistUrl", "watchlistUpdateUrlOwner");
  watchlist = renameRequiredWatchlistRouteOwner(watchlist, "ensureWatchlistRoute", "watchlistEnsureRouteOwner");
  watchlist = renameRequiredWatchlistRouteOwner(watchlist, "switchWatchlist", "watchlistSwitchOwner");
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
