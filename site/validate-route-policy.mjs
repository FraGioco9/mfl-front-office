import { readFile } from "node:fs/promises";

import { browserConfigRuntimeSource } from "./modules/app-config.js";
import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";
import { normalizePreBootstrapRouteState } from "./modules/pre-bootstrap-route-state.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [source, release, trackedConfig, trackedCore, trackedClub, staticUi] = await Promise.all([
  read("./modules/app-core.js"),
  read("./release.json").then(JSON.parse),
  read("./table-width-runtime.js"),
  read("./modules/app-core-runtime.js"),
  read("./modules/app-core-club-runtime.js"),
  read("./static-ui-runtime.js"),
]);

const artifacts = normalizeBuiltApplicationCoreArtifacts(source);
const core = String(artifacts.core || "");
const player = String(artifacts.routeChunks?.player || "");
const club = String(artifacts.routeChunks?.club || "");
const evaluation = String(artifacts.routeChunks?.evaluation || "");
const generated = [core, ...Object.values(artifacts.routeChunks || {}).map(String)].join("\n");
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
includes(core, 'const routeMessagePage = document.getElementById("routeMessagePage");', "Missing-resource rendering must target the dedicated static route-message page.");
includes(core, 'return showProgressionAccessRequired();', "Progression without permission must keep its requested route and render access state.");
excludes(core, "showUnauthorizedProgressionRedirect", "The retired Progression-to-Home owner must not exist in generated code.");
excludes(core, 'history.replaceState({}, "", "/");\n  return setPage("home", false);', "Access denial must not rewrite the URL to Home.");
includes(core, 'showRouteMessagePage("Agent not found", "The requested agent could not be found."', "Missing agents must stay on their route and render Agent not found.");

includes(player, 'window.__mflShowRouteMessage?.("Player not found", "The requested player could not be found."', "Missing players must stay on their route and render Player not found.");
includes(club, 'window.__mflShowRouteMessage?.("Club not found", "The requested club could not be found."', "Missing clubs must stay on their route and render Club not found.");
excludes(club, 'window.location.replace("/")', "Club routing must not retain the retired malformed-link Home redirect.");

includes(evaluation, 'window.history.replaceState({}, "", "/evaluation");', "Expired saved/shared Evaluations must continue returning to plain Evaluation.");
includes(generated, 'showToast("Watchlist not found.");', "Missing Watchlists must continue falling back with a not-found toast.");
includes(generated, "updateWatchlistUrl(true, true, options.view);", "Missing Watchlists must preserve the requested view when selecting the fallback list.");

includes(preBootstrap, 'return { pageName: "notfound", options: {} };', "Unknown deep links must be classified as not-found before first paint.");
includes(preBootstrap, "const initialCanonicalPath = String(initialRoute.options?.replaceUrl || initialRoute.options?.path || \"\");", "Recognizable malformed deep links must canonicalize before hydration.");
excludes(preBootstrap, 'location.replace("/")', "Pre-bootstrap routing must not redirect malformed links to Home.");

// The tracked files are the code the browser actually receives. Keep this audit explicit so
// a green source normalization cannot coexist with stale generated redirect behavior again.
for (const [label, shipped] of [
  ["pre-bootstrap runtime", trackedConfig],
  ["shared application runtime", trackedCore],
  ["Club runtime", trackedClub],
]) {
  excludes(shipped, 'location.replace("/")', `${label} must not ship the retired Home redirect.`);
  excludes(shipped, "showUnauthorizedProgressionRedirect", `${label} must not ship the retired Progression redirect owner.`);
  excludes(shipped, "initialClubLikePath", `${label} must not ship the retired strict Club redirect gate.`);
}
excludes(trackedCore, 'pageName: ["home", "evaluation", "settings", "changelog"].includes(pageName) ? pageName : "home"', "Tracked shared runtime must not ship the unknown-route Home fallback.");
includes(trackedConfig, 'return { pageName: "notfound", options: {} };', "Tracked pre-bootstrap runtime must ship not-found classification.");
includes(trackedClub, 'window.__mflShowRouteMessage?.("Club not found"', "Tracked Club runtime must ship missing-resource handling.");

includes(staticUi, "const request = routeConfig.initialRequest(url.pathname);", "Static UI must consume canonical route classification.");
includes(staticUi, 'if (state.page === "notfound") return document.getElementById("routeMessagePage");', "Static UI must show the dedicated not-found shell before hydration.");
excludes(staticUi, 'if (state.page === "notfound") return document.getElementById("myPlayersLockedPage");', "Static UI must not reuse the opt-in shell for not-found routes.");
excludes(staticUi, "const VIEW_BY_SLUG = Object.freeze(", "Static UI must not retain its old duplicate route parser.");
excludes(staticUi, 'return document.getElementById("homePage");\n  }', "Static UI must not use Home as a generic route-shell fallback.");

new Function(core);
new Function(player);
new Function(club);
console.log("Unified route policy validation passed with shipped runtimes audited against every retired Home-redirect path and the dedicated not-found first-paint shell.");
