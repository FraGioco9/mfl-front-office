import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [coreSource, routeSplitter, clubStartupLifecycle, bootstrap, generatedClubCore, routeLoader] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-route-chunks.js"),
  read("./modules/app-core-club-startup-lifecycle.js"),
  read("./bootstrap.js"),
  read("./modules/app-core-club-runtime.js"),
  read("./route-core-loader-runtime.js"),
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
  routeLoader,
  "function installClubRouteGate()",
  "The route-core loader must expose the same public Club navigation gate used by in-site links.",
);
includes(
  routeLoader,
  'const routeCorePromise = ensure("club", { view });',
  "The public Club gate must ensure the ordered Table and Club core dependencies.",
);
includes(
  routeLoader,
  'runtimeWindow.__mflEnsureRouteRuntime("club", { view })',
  "The public Club gate must ensure the Club/Table runtime dependencies.",
);
includes(
  routeLoader,
  "await Promise.all([routeCorePromise, routeRuntimePromise]);",
  "The public Club gate must settle core and runtime ownership before invoking the Club route owner.",
);
includes(
  routeLoader,
  "const routeOwner = runtimeWindow.__mflOpenClubPageRoute;",
  "The public Club gate must delegate to the private Club route owner after readiness.",
);

includes(
  clubStartupLifecycle,
  "const navigateClub = window.mflOpenClubPage;",
  "Club refresh startup must use the same public Club navigation gate as an in-site Club click.",
);
includes(
  clubCore,
  "await navigateClub(initialClubRoute.clubId, initialClubRoute.view);",
  "Club refresh must enter the shared public Club navigation workflow.",
);
excludes(
  clubCore,
  'loadingController.begin("route-runtime")',
  "Club refresh must not create a second startup-only loading owner around the public gate.",
);
excludes(
  clubCore,
  'const ensureRouteRuntime = window.__mflEnsureRouteRuntime;',
  "Club refresh must not own a second startup-only route-runtime readiness path.",
);
excludes(
  clubCore,
  'await openClubPage(initialClubRoute.clubId, initialClubRoute.view, false);',
  "Club refresh must not bypass the public navigation gate by calling the private Club route owner directly.",
);

includes(
  eagerCore,
  'const clubPage = pageName === "club";',
  "The shared incremental payload renderer must identify Club payloads before restoring generic table state.",
);
includes(
  eagerCore,
  "if (tablePages.has(pageName) && !clubPage) {",
  "Club payloads must bypass generic saved-table state restoration after the roster response is applied.",
);
includes(
  eagerCore,
  'state.currentPage = "club";',
  "Club roster rendering must commit Club page ownership before local filtering.",
);
includes(
  eagerCore,
  "if (clubPage) applyFilters({ save: false, localOnly: true });",
  "Club roster rendering must flow through the live Club filter owner instead of the captured pre-Club filter function.",
);
includes(
  eagerCore,
  "else originalApplyFilters.call(this, { save: false });",
  "Non-Club table pages must retain the existing generic incremental render path.",
);

const incrementalLoader = eagerCore.indexOf("window.mflLoadIncrementalRoutePage = async function loadIncrementalRoutePage");
const clubPayloadOwner = eagerCore.indexOf('const clubPage = pageName === "club";', incrementalLoader);
const genericRestoreGuard = eagerCore.indexOf("if (tablePages.has(pageName) && !clubPage) {", clubPayloadOwner);
const clubPageCommit = eagerCore.indexOf('state.currentPage = "club";', genericRestoreGuard);
const clubLocalRender = eagerCore.indexOf("if (clubPage) applyFilters({ save: false, localOnly: true });", clubPageCommit);
invariant(
  incrementalLoader >= 0
    && clubPayloadOwner > incrementalLoader
    && genericRestoreGuard > clubPayloadOwner
    && clubPageCommit > genericRestoreGuard
    && clubLocalRender > clubPageCommit,
  "A returned Club roster must bypass generic table restore, commit Club ownership, and render through the Club-local filter path in that order.",
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
const canonicalRefreshPath = clubCore.indexOf("const canonicalRoute = canonicalClubRoute(initialClubRoute.clubId, initialClubRoute.view);", refreshHandoff);
const publicGateOwner = clubCore.indexOf("const navigateClub = window.mflOpenClubPage;", canonicalRefreshPath);
const refreshClubLoad = clubCore.indexOf("await navigateClub(initialClubRoute.clubId, initialClubRoute.view);", publicGateOwner);
invariant(
  refreshHandoff >= 0
    && canonicalRefreshPath > refreshHandoff
    && publicGateOwner > canonicalRefreshPath
    && refreshClubLoad > publicGateOwner,
  "Refreshed Club routes must canonicalize the URL and then enter the same public navigation gate used by in-site links.",
);

const startupClubLoads = clubCore.match(/await navigateClub\(initialClubRoute\.clubId, initialClubRoute\.view\);/g) || [];
invariant(
  startupClubLoads.length === 1,
  "Club refresh startup must trigger the shared public Club navigation gate exactly once.",
);

console.log("Club conflict regression checks passed: one Squad text owner, one public Club navigation workflow for click and refresh, Club-owned payload rendering, non-blocking title preflight, and roster-owned final identity.");
