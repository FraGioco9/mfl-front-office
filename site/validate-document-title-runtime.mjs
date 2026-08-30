import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [indexHtml, bootstrap, appEntry, runtime] = await Promise.all([
  read("./index.html"),
  read("./bootstrap.js"),
  read("./modules/app-entry.js"),
  read("./document-title-runtime.js"),
]);

includes(indexHtml, "<title>MFL Front Office</title>", "The static document title must remain the Home fallback.");
includes(bootstrap, 'loadRuntime("/document-title-runtime.js")', "Document-title ownership must load from the guaranteed bootstrap runtime group.");
excludes(appEntry, '"/document-title-runtime.js",', "Document-title ownership must not also load from the later application-entry runtime group.");
includes(runtime, 'const APP_NAME = "MFL Front Office";', "Document titles must have one application-name owner.");
includes(runtime, 'window.__mflAppConfig?.routes?.canonicalRequest', "Document titles must derive the active page from the canonical SPA route owner.");
includes(runtime, 'canonicalRequest(window.location.pathname)', "Document titles must classify the current browser URL instead of startup-only page state.");
includes(runtime, 'if (document.body?.dataset.page === "notfound") return "notfound";', "The fallback classifier must retain typed not-found state before app config is available.");
excludes(runtime, 'document.body?.dataset.page || document.documentElement.dataset.initialPage', "Document titles must not use startup page metadata as the active SPA route owner.");
includes(runtime, 'database: "Database"', "Database must expose a route-aware browser title.");
includes(runtime, 'mfl: "MFL"', "MFL must expose a route-aware browser title.");
includes(runtime, 'progression: "Progression"', "Progression must expose a route-aware browser title.");
includes(runtime, 'myplayers: "My Players"', "My Players must expose a route-aware browser title.");
includes(runtime, 'settings: "Settings"', "Settings must expose a route-aware browser title.");
includes(runtime, 'changelog: "Changelog"', "Changelog must expose a route-aware browser title.");
includes(runtime, 'textFrom("#playerDetail .playerTitleName")', "Player browser titles must reuse the rendered Player name.");
includes(runtime, 'return withAppName(playerName);', "Player browser titles must include the MFL Front Office suffix.");
includes(runtime, 'document.getElementById("evaluationSearchInput")', "Evaluation browser titles must reuse the full selected Player identity kept in the Evaluation search input.");
includes(runtime, 'searchInput instanceof HTMLInputElement ? cleanText(searchInput.value) : "";', "Evaluation browser titles must read the full selected Player name rather than the abbreviated table label.");
excludes(runtime, 'textFrom("#evaluationSummaryBody tr td:first-child")', "Evaluation browser titles must not derive identity from the abbreviated N. Surname table cell.");
includes(runtime, 'return `Evaluation - ${playerName}`;', "Selected Evaluation titles must stay in the Evaluation - Name Surname format.");
includes(runtime, 'textFrom("#tablePageTitle")', "Club, Agent, and Watchlist browser titles must reuse canonical page-title identity.");
includes(runtime, 'textFrom("#notFoundTitle")', "Typed not-found pages must reuse the canonical not-found label.");
includes(runtime, 'document.documentElement.dataset.interactionBusy === "true"', "Entity titles must follow the shared route-loading lifecycle.");
includes(runtime, 'function routeIdentityForRequest(request)', "Document titles must distinguish route identity from the selected view.");
includes(runtime, 'if (pageName === "club") return `club:${cleanText(options.clubId)}`;', "Club route identity must stay stable across Squad, Contracts, Current Season, and All Time views.");
includes(runtime, 'if (pageName === "agents") return `agents:${cleanText(options.walletAddress).toLowerCase()}`;', "Agent route identity must stay stable across Agent views.");
includes(runtime, 'if (pageName === "watchlist") return `watchlist:${cleanText(options.watchlistId)}`;', "Named Watchlist route identity must stay stable across Watchlist views.");
includes(runtime, 'const preserveResolvedTitle = busy && routeIdentity === stableRouteIdentity && stableTitle;', "A same-entity view switch must keep the already-resolved browser title while loading.");
includes(runtime, 'stableRouteIdentity = routeIdentity;', "Resolved browser titles must remember which route entity they belong to.");
includes(runtime, 'stableTitle = nextTitle;', "Resolved browser titles must remain available throughout a same-entity view switch.");
includes(runtime, 'window.addEventListener("mfl:route-ready", scheduleSync);', "Document titles must resync after SPA route readiness.");
includes(runtime, 'window.addEventListener("mfl:loading-state", scheduleSync);', "Document titles must follow the shared loading lifecycle.");
includes(runtime, "new MutationObserver(scheduleSync)", "Document titles must react when already-loaded entity identity is rendered.");
includes(runtime, "document.title = nextTitle", "The browser title must be committed through the native document-title API.");
excludes(runtime, "fetch(", "Browser-title ownership must never request data separately from the destination page.");
excludes(runtime, "XMLHttpRequest", "Browser-title ownership must never own a second network transport.");

console.log("Document-title runtime validation passed: canonical SPA routes drive browser titles without separate data loading or same-entity view-switch flicker.");
