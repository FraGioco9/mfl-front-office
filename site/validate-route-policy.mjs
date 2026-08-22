import { readFile } from "node:fs/promises";

import { browserConfigRuntimeSource } from "./modules/app-config.js";
import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";
import { normalizePreBootstrapRouteState } from "./modules/pre-bootstrap-route-state.js";

const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [source, release] = await Promise.all([
  readFile(new URL("./modules/app-core.js", import.meta.url), "utf8"),
  readFile(new URL("./release.json", import.meta.url), "utf8").then(JSON.parse),
]);

const artifacts = normalizeBuiltApplicationCoreArtifacts(source);
const core = String(artifacts.core || "");
const player = String(artifacts.routeChunks?.player || "");
const club = String(artifacts.routeChunks?.club || "");
const evaluation = String(artifacts.routeChunks?.evaluation || "");
const watchlist = String(artifacts.routeChunks?.watchlist || "");
const preBootstrap = normalizePreBootstrapRouteState(browserConfigRuntimeSource(release));

const parserStart = core.indexOf("function pageTargetFromPath(path) {");
const parserEnd = core.indexOf("\n}\n\nfunction pagePath", parserStart);
invariant(parserStart >= 0 && parserEnd > parserStart, "The unified route parser must exist in the generated shared core.");
const parser = core.slice(parserStart, parserEnd);

includes(parser, 'pageName: "notfound",', "Unknown URLs must resolve to the shared not-found state.");
excludes(parser, 'pageName: ["home", "evaluation", "settings", "changelog"].includes(pageName) ? pageName : "home"', "Unknown URLs must not silently fall back to Home.");
includes(parser, '...(cleanPath !== canonicalPath ? { replaceUrl: canonicalPath } : {}),', "Recognizable malformed routes must repair themselves to a canonical path.");
includes(parser, 'const clubMatch = cleanPath.match(/^\\/(clubs|club)\\/([^/]+)(?:\\/([^/]+))?$/i);', "Legacy and canonical Club URLs must share one repair path.");
includes(parser, 'routeConfig?.normalizeClubView?.(requestedView || "attributes")', "Missing or invalid Club views must normalize to Squad.");
includes(parser, 'if (walletAddress === mflWalletAddress)', "The MFL agent alias must retain its canonical MFL redirect.");

includes(core, "function showRouteMessagePage(title, message, options = {})", "Missing resources and unknown pages must share one route-state surface.");
includes(core, 'return showProgressionAccessRequired();', "Progression without permission must keep its requested route and render access state.");
excludes(core, "showUnauthorizedProgressionRedirect", "The legacy Progression-to-Home redirect owner must be removed from generated code.");
excludes(core, 'history.replaceState({}, "", "/");\n  return setPage("home", false);', "Access denial must not rewrite the URL to Home.");
includes(core, 'showRouteMessagePage("Agent not found", "The requested agent could not be found."', "Missing agents must stay on their route and render Agent not found.");

includes(player, 'window.__mflShowRouteMessage?.("Player not found", "The requested player could not be found."', "Missing players must stay on their route and render Player not found.");
includes(club, 'window.__mflShowRouteMessage?.("Club not found", "The requested club could not be found."', "Missing clubs must stay on their route and render Club not found.");
excludes(club, 'window.location.replace("/")', "Club routing must not retain the legacy malformed-link Home redirect.");

includes(evaluation, 'window.history.replaceState({}, "", "/evaluation");', "Expired saved/shared Evaluations must continue returning to plain Evaluation.");
includes(watchlist, 'showToast("Watchlist not found.");', "Missing Watchlists must continue falling back with a not-found toast.");
includes(watchlist, "updateWatchlistUrl(true, true, options.view);", "Missing Watchlists must preserve the requested view when selecting the fallback list.");

includes(preBootstrap, 'return { pageName: "notfound", options: {} };', "Unknown deep links must be classified as not-found before first paint.");
includes(preBootstrap, "const initialCanonicalPath = String(initialRoute.options?.replaceUrl || initialRoute.options?.path || \"\");", "Recognizable malformed deep links must canonicalize before hydration.");
excludes(preBootstrap, 'location.replace("/")', "Pre-bootstrap routing must not redirect malformed Club links to Home.");

new Function(core);
new Function(player);
new Function(club);
console.log("Unified route policy validation passed: malformed routes repair, missing resources stay put, unknown pages render not-found, access denial stays in place, and temporary/private fallbacks remain canonical.");
