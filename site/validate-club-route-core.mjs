import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, routeChunksSource, routeLoader, routeNormalizer, buildCore] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-route-chunks.js"),
  read("./route-core-loader-runtime.js"),
  read("./modules/app-core-route-runtime-normalizer.js"),
  read("./build-app-core.mjs"),
]);
const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const sharedCore = String(artifacts.core || "");
const clubCore = String(artifacts.routeChunks?.club || "");

invariant(sharedCore.length > 300_000, "The shared application core became unexpectedly small after the Club split.");
invariant(clubCore.length > 10_000, "The Club core chunk is too small to represent the route owner.");
new Function(sharedCore);
new Function(clubCore);

includes(routeChunksSource, '"Club route owner"', "The build-time splitter must extract the Club route owner.");
includes(routeChunksSource, "Universal Club search compatibility bridge", "The shared core must retain a Club-search compatibility bridge.");
includes(routeChunksSource, "routeChunks: Object.freeze({ evaluation, mflstats, club })", "The artifact map must expose the Club chunk.");

excludes(sharedCore, 'const CLUB_PAGE = "club";', "The Club route owner must not remain in the shared core.");
excludes(sharedCore, "const clubViewRenderCache = new Map();", "Club view caching must not execute on unrelated routes.");
excludes(sharedCore, "async function openClubPage(clubId", "Club route hydration must not remain in the shared core.");
excludes(sharedCore, "function applyClubPresentation()", "Club-only presentation work must not remain in the shared core.");
includes(sharedCore, "renderSearchResultsNowWithUniversalClubs", "Club search must remain available before the Club chunk is loaded.");
includes(sharedCore, 'void window.mflOpenClubPage(clubId, "attributes")', "Shared Club search must navigate through the lazy public gate.");

includes(clubCore, 'const CLUB_PAGE = "club";', "The Club chunk must own Club route state.");
includes(clubCore, "const clubViewRenderCache = new Map();", "The Club chunk must own per-view render caching.");
includes(clubCore, "async function openClubPage(clubId", "The Club chunk must own Club route hydration.");
includes(clubCore, "function applyClubPresentation()", "The Club chunk must own Club presentation.");
includes(clubCore, "if (!dataPayload) return;", "Obsolete Club payloads must stop inside the Club route chunk before render commit.");
includes(clubCore, "window.__mflOpenClubPageRoute = openClubImmediately;", "The Club chunk must publish only the private route owner.");
excludes(clubCore, "window.mflOpenClubPage = openClubImmediately;", "The Club chunk must not replace the stable public lazy gate.");
excludes(clubCore, "function clubSearchEntries(query)", "The Club chunk must not own universal Club search.");
excludes(clubCore, "renderSearchResultsNowWithClubs", "The Club chunk must not patch Global Search after navigation.");

includes(routeLoader, 'club: "/modules/app-core-club-runtime.js"', "The route-core loader must map Club to its generated chunk.");
includes(routeLoader, "function installClubRouteGate()", "The route-core loader must publish a stable Club navigation gate before the chunk loads.");
includes(routeLoader, 'if (page === "club") return ["table", "club"];', "Club navigation must resolve Table before the Club route owner.");
includes(routeLoader, 'const routeCorePromise = ensure("club", { view });', "Club navigation must start its ordered route-core dependency request immediately.");
includes(routeLoader, 'runtimeWindow.__mflEnsureRouteRuntime("club", { view })', "Club navigation must overlap core and table-runtime loading.");
includes(routeLoader, "await Promise.all([routeCorePromise, routeRuntimePromise]);", "Club navigation must wait for both owners before invoking the route implementation.");
includes(routeLoader, "const routeOwner = runtimeWindow.__mflOpenClubPageRoute;", "The public gate must invoke the private Club route owner after loading.");
excludes(routeLoader, "window.history.pushState", "The lazy Club gate must not change the URL before the Club chunk executes.");

includes(routeNormalizer, 'await window.__mflEnsureRouteCore("club");', "Direct Club startup must load the Club route owner before startApp.");
includes(routeNormalizer, "return startApp();", "Application startup must begin only after an initial Club owner is ready.");

includes(buildCore, 'const clubRuntimePath = resolve(siteRoot, "modules/app-core-club-runtime.js");', "The build must emit a generated Club runtime.");
includes(buildCore, "artifacts.routeChunks?.club", "The build must consume the Club artifact.");

const generatedClub = await read("./modules/app-core-club-runtime.js");
const clubBanner = "// Generated Club core chunk from modules/app-core.js. Do not edit directly.\n";
invariant(generatedClub.startsWith(clubBanner), "Generated Club runtime must carry the build ownership banner.");
invariant(generatedClub.slice(clubBanner.length).replace(/\s*$/, "") === clubCore.replace(/\s*$/, ""), "Generated Club runtime must exactly match the Club build artifact.");

console.log("Club route-core splitting validation passed.");
