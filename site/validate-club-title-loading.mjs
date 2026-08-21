import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, routeSplitter, clubStartupLifecycle, bootstrap, generatedClubCore] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-route-chunks.js"),
  read("./modules/app-core-club-startup-lifecycle.js"),
  read("./bootstrap.js"),
  read("./modules/app-core-club-runtime.js"),
]);

const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const eagerCore = String(artifacts.core || "");
const clubCore = String(artifacts.routeChunks?.club || "");
new Function(eagerCore);
new Function(clubCore);

includes(
  routeSplitter,
  'const CLUB_DISPLAY_DATA_STORAGE_KEY = "mfl-club-display-data-v1";',
  "The Club route core must own the persistent Club title identity cache.",
);
includes(
  clubCore,
  'async function ensureClubTitleIdentity(clubId) {',
  "Club loading must have an exact title-identity readiness resolver.",
);
includes(
  clubCore,
  "const rowIdentity = clubTitleIdentityFromRows(normalizedClubId);",
  "Club navigation must reuse identity already present in the loaded source rows before first paint.",
);
includes(
  clubCore,
  'type: "recent",\n          clubIds: normalizedClubId,',
  "Unknown Club titles must use the exact local SQLite search path for only that Club ID.",
);
includes(
  clubCore,
  'fetch("/api/data?" + parameters.toString()',
  "Club title resolution must use the local database API rather than an external roster source.",
);
includes(
  clubCore,
  "cachedClubTitleIdentity(normalizedClubId);",
  "A cached Club title identity must be checked before the fallback request.",
);
includes(
  clubCore,
  "saveClubTitleIdentity(resolvedTitle);",
  "Hydrated Club title data must be cached for future first paint.",
);
includes(
  clubCore,
  'divisionLabel.className = "clubPageTitleDivision";',
  "Hydrated Club titles must retain the canonical colored division element.",
);
includes(
  bootstrap,
  'const CLUB_DISPLAY_DATA_STORAGE_KEY = "mfl-club-display-data-v1";',
  "Bootstrap first paint must share the canonical Club title cache key.",
);
includes(
  bootstrap,
  "function firstPaintClubIdentity(urlLike = window.location.href) {",
  "Direct Club refresh must resolve its cached identity before application hydration.",
);
includes(
  bootstrap,
  'title.replaceChildren(document.createTextNode(`${identity.name} - `), divisionLabel);',
  "Cached Club first paint must render the full name and division title.",
);
includes(
  bootstrap,
  'divisionLabel.className = "clubPageTitleDivision";',
  "First paint must use the same division-title element as hydrated Club rendering.",
);
includes(
  bootstrap,
  'if (page === "club") document.getElementById("mflInitialTableViewFirstPaint")?.remove();',
  "Bootstrap must retire the synthetic Club Squad label before writing the real button label.",
);
excludes(
  clubStartupLifecycle,
  'document.getElementById("mflInitialTableViewFirstPaint")?.remove();',
  "Club startup must not compete with bootstrap for first-paint Squad label ownership.",
);
excludes(
  clubCore,
  'document.getElementById("mflInitialTableViewFirstPaint")?.remove();',
  "Generated Club runtime must leave first-paint Squad handoff exclusively to bootstrap.",
);
excludes(
  bootstrap,
  'if (page === "club") return "Club";',
  "Club first paint must not fall back unconditionally to a generic Club title.",
);

const bootstrapSquadStyleRetire = bootstrap.indexOf('if (page === "club") document.getElementById("mflInitialTableViewFirstPaint")?.remove();');
const bootstrapSquadText = bootstrap.indexOf('candidate.textContent = page === "club" ? "Squad" : "Attributes";', bootstrapSquadStyleRetire);
invariant(
  bootstrapSquadStyleRetire >= 0 && bootstrapSquadText > bootstrapSquadStyleRetire,
  "The synthetic Squad label must be removed in the same bootstrap task before the real Squad text becomes visible.",
);

const initialRouteCoreReady = eagerCore.indexOf("await window.__mflEnsureRouteCore(initialRouteTarget.pageName, initialRouteTarget.options || {});");
const startupBegins = eagerCore.indexOf("return startApp();", initialRouteCoreReady);
invariant(
  initialRouteCoreReady >= 0 && startupBegins > initialRouteCoreReady,
  "The existing application startup gate must load the initial Club route core before startApp begins.",
);

includes(
  clubStartupLifecycle,
  'loadingController.begin("route-runtime")',
  "Club refresh must use the same route-runtime busy reason as in-site Club navigation.",
);
includes(
  clubStartupLifecycle,
  'const ensureRouteRuntime = window.__mflEnsureRouteRuntime;',
  "Club refresh must use the shared route-runtime readiness owner before loading players.",
);
includes(
  clubCore,
  'await ensureRouteRuntime("club", { view: initialClubRoute.view });',
  "Club refresh must settle the Club/Table route runtime before starting roster hydration.",
);
includes(
  clubCore,
  'await openClubPage(initialClubRoute.clubId, initialClubRoute.view, false);',
  "Club refresh must execute one canonical Club route-owner load without adding history.",
);
includes(
  clubCore,
  'if (loadingToken) loadingController?.end?.(loadingToken);',
  "Club refresh must release its route-runtime loading token after the Club route owner settles.",
);
excludes(
  clubCore,
  'await navigateClub(initialClubRoute.clubId, initialClubRoute.view);',
  "Club refresh must not stack a second public page transition around its route-owner load.",
);

includes(
  clubCore,
  "void clubTitleReady.then((resolvedTitle) => {",
  "Club title preflight must remain non-blocking while the roster loads.",
);
includes(
  clubCore,
  "const loadedClubTitle = clubTitleIdentityFromRows(activeClubId);",
  "The loaded Club roster must become the authoritative title identity after hydration.",
);
includes(
  clubCore,
  "if (loadedClubTitle) activeClubTitle = saveClubTitleIdentity(loadedClubTitle);",
  "Roster-owned Club identity must be cached without delaying player rendering.",
);
excludes(
  clubCore,
  "const resolvedClubTitle = await clubTitleReady;",
  "Club roster completion must never wait for the separate title lookup.",
);
excludes(
  clubCore,
  "leaderboards/users/global",
  "Club title loading must not fetch an external leaderboard or unrelated global dataset.",
);
excludes(routeSplitter, "!important", "Club title loading must not add CSS priority overrides.");
excludes(clubStartupLifecycle, "!important", "Club refresh loading must not add CSS priority overrides.");

const generatedBanner = "// Generated Club core chunk from modules/app-core.js. Do not edit directly.\n";
invariant(
  generatedClubCore.startsWith(generatedBanner)
    && generatedClubCore.slice(generatedBanner.length).replace(/\s*$/, "") === clubCore.replace(/\s*$/, ""),
  "The tracked generated Club runtime must exactly match the canonical Club loading artifact.",
);

const readinessStart = clubCore.indexOf("const clubTitleReady = ensureClubTitleIdentity(activeClubId);");
const pageTransition = clubCore.indexOf("runPageTransition(CLUB_PAGE", readinessStart);
const earlyRender = clubCore.indexOf("renderClubTitle();", readinessStart);
const rosterLoad = clubCore.indexOf("window.mflLoadIncrementalRoutePage", earlyRender);
const loadedIdentity = clubCore.indexOf("const loadedClubTitle = clubTitleIdentityFromRows(activeClubId);", rosterLoad);
const finalPresentation = clubCore.indexOf("applyClubPresentation();", loadedIdentity);
invariant(
  readinessStart >= 0
    && pageTransition > readinessStart
    && earlyRender > pageTransition
    && rosterLoad > earlyRender
    && loadedIdentity > rosterLoad
    && finalPresentation > loadedIdentity,
  "Club title preflight must start early, while roster hydration remains the independent path to final presentation.",
);

const rowIdentityRead = clubCore.indexOf("const rowIdentity = clubTitleIdentityFromRows(normalizedClubId);");
const cacheRead = clubCore.indexOf("const cached = cachedClubTitleIdentity(normalizedClubId);");
const exactLookup = clubCore.indexOf('fetch("/api/data?" + parameters.toString()', cacheRead);
invariant(
  rowIdentityRead >= 0 && cacheRead > rowIdentityRead && exactLookup > cacheRead,
  "Loaded Club row identity must be persisted synchronously before cache fallback and the exact lookup.",
);

const refreshHandoff = clubCore.indexOf("showHomeShellWithInitialClub");
const loadingStart = clubCore.indexOf('loadingController.begin("route-runtime")', refreshHandoff);
const routeRuntimeReady = clubCore.indexOf('await ensureRouteRuntime("club", { view: initialClubRoute.view });', loadingStart);
const refreshClubLoad = clubCore.indexOf('await openClubPage(initialClubRoute.clubId, initialClubRoute.view, false);', routeRuntimeReady);
const loadingEnd = clubCore.indexOf('loadingController?.end?.(loadingToken)', refreshClubLoad);
invariant(
  refreshHandoff >= 0
    && loadingStart > refreshHandoff
    && routeRuntimeReady > loadingStart
    && refreshClubLoad > routeRuntimeReady
    && loadingEnd > refreshClubLoad,
  "Refreshed Club routes must start shared loading, settle route runtime ownership, load the roster once, and release loading afterward.",
);

const startupClubLoads = clubCore.match(/await openClubPage\(initialClubRoute\.clubId, initialClubRoute\.view, false\);/g) || [];
invariant(
  startupClubLoads.length === 1,
  "Club refresh startup must trigger exactly one canonical Club route-owner load.",
);

console.log("Club conflict regression checks passed: one Squad text owner, route-runtime-ready player loading, non-blocking title preflight, single-path refresh loading, and roster-owned final identity.");
