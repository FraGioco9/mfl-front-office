import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [index, bootstrap, staticUi, appCoreSource] = await Promise.all([
  read("./index.html"),
  read("./bootstrap.js"),
  read("./static-ui-runtime.js"),
  read("./modules/app-core.js"),
]);
const artifacts = normalizeBuiltApplicationCoreArtifacts(appCoreSource);
const core = String(artifacts.core || "");
const club = String(artifacts.routeChunks?.club || "");

includes(index, 'root.dataset.initialPage = knownRouteShape', "The head must classify route shape before any page can paint.");
includes(index, ': "notfound";', "Unknown or structurally invalid routes must be marked notfound in the head.");
includes(index, 'id="routeMessagePage"', "Not-found rendering must have a dedicated static page.");
includes(index, 'id="routeMessageTitle">Page not found</h2>', "The static not-found title must exist before bootstrap.");
includes(index, 'id="routeMessageText">The requested page could not be found.</p>', "The static not-found message must exist before bootstrap.");
includes(index, 'id="routeMessageHomeButton"', "The Home action must exist statically before bootstrap.");
includes(index, 'html[data-initial-page="notfound"]:not(.mflInitialRouteResolved) #homePage', "Unknown-route first paint must explicitly hide Home.");
includes(index, 'html[data-initial-page="notfound"]:not(.mflInitialRouteResolved) #routeMessagePage', "Unknown-route first paint must explicitly show the not-found page.");

includes(bootstrap, 'if (initialPage === "notfound") return document.getElementById("routeMessagePage");', "Bootstrap must preserve the not-found shell instead of falling back to Home.");
includes(bootstrap, 'if (target.id === "routeMessagePage") {', "Bootstrap must prime the dedicated route-message shell.");
includes(staticUi, 'if (state.page === "notfound") return document.getElementById("routeMessagePage");', "Static UI must keep not-found routes on the dedicated shell.");
excludes(staticUi, 'if (state.page === "notfound") return document.getElementById("myPlayersLockedPage");', "Not-found rendering must not reuse the opt-in shell.");

includes(core, 'const routeMessagePage = document.getElementById("routeMessagePage");', "Hydrated route messages must use the dedicated static route-message page.");
includes(core, 'const targetPage = showOptIn ? myPlayersLockedPage : routeMessagePage;', "Only opt-in-required route messages may reuse the opt-in shell.");

includes(club, "async function fetchAuthoritativeClubTitleIdentity(clubId)", "A zero-roster Club must verify its ID against authoritative Club search data.");
includes(club, "void fetchAuthoritativeClubTitleIdentity(nextClubId).then((resolvedTitle) => {", "Missing Club detection must bypass stale cached title identities.");
includes(club, 'window.__mflShowRouteMessage?.("Club not found"', "An invalid Club ID must render Club not found.");

includes(appCoreSource, "const selectedWatchlist = await ensureWatchlistRoute(options);", "Watchlist navigation must retain the fallback selected by ensureWatchlistRoute.");
includes(appCoreSource, "options = { ...options, watchlistId: selectedWatchlist.id };", "The surviving Watchlist ID must replace a stale URL ID before the incremental request is built.");
includes(appCoreSource, "return firstWatchlist || null;", "A missing Watchlist route must return its surviving fallback to the caller.");

console.log("Route first-paint and resource fallback validation passed: static 404 shell, first-paint Home action, authoritative Club existence checks, and effective Watchlist fallback IDs are canonical.");
