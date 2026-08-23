import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [
  coreSource,
  routeSplitter,
  clubStartupLifecycle,
  bootstrap,
  loadingCss,
  generatedEagerCore,
  generatedClubCore,
  routeLoader,
] = await Promise.all([
  read("./modules/app-core.js"),
  read("./modules/app-core-route-chunks.js"),
  read("./modules/app-core-club-startup-lifecycle.js"),
  read("./bootstrap.js"),
  read("./loading.css"),
  read("./modules/app-core-runtime.js"),
  read("./modules/app-core-club-runtime.js"),
  read("./route-core-loader-runtime.js"),
]);

const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const eagerCore = String(artifacts.core || "");
const clubCore = String(artifacts.routeChunks?.club || "");
const tableCore = String(artifacts.routeChunks?.table || "");
new Function(eagerCore);
new Function(clubCore);
new Function(tableCore);

includes(
  routeSplitter,
  'const CLUB_DISPLAY_DATA_STORAGE_KEY = "mfl-club-display-data-v1";',
  "The Club route core must own the persistent Club title cache.",
);
includes(
  clubCore,
  "const rowIdentity = clubTitleIdentityFromRows(normalizedClubId);",
  "Loaded Club rows must remain the first title-identity source.",
);
includes(
  clubCore,
  'type: "recent",\n          clubIds: normalizedClubId,',
  "Unknown Club titles must use the exact local Club lookup.",
);
includes(
  bootstrap,
  "function firstPaintClubIdentity(urlLike = window.location.href) {",
  "Club refresh must resolve cached title identity during first paint.",
);
includes(
  bootstrap,
  'if (page === "club") document.getElementById("mflInitialTableViewFirstPaint")?.remove();',
  "Bootstrap must remain the sole owner of the temporary Squad first-paint handoff.",
);
excludes(
  clubCore,
  'document.getElementById("mflInitialTableViewFirstPaint")?.remove();',
  "Club runtime must not compete with bootstrap for Squad first-paint ownership.",
);

includes(
  routeLoader,
  "function installClubRouteGate()",
  "Club links and refresh must share the public Club route gate.",
);
includes(
  routeLoader,
  'const routeCorePromise = ensure("club", { view });',
  "The public Club gate must ensure Club core readiness.",
);
includes(
  routeLoader,
  'runtimeWindow.__mflEnsureRouteRuntime("club", { view })',
  "The public Club gate must ensure Club runtime readiness.",
);
includes(
  routeLoader,
  "await Promise.all([routeCorePromise, routeRuntimePromise]);",
  "Club core and runtime ownership must settle together before rendering.",
);
includes(
  eagerCore,
  "result = await navigateClub(clubId, view);",
  "Direct Club refresh must enter the same public navigation gate as an in-site click from the shared shell.",
);
excludes(
  clubCore,
  "showHomeShellWithInitialClub",
  "The Club route chunk must not retain a startup-only shell interceptor.",
);
excludes(
  clubCore,
  'await openClubPage(initialClubRoute.clubId, initialClubRoute.view, false);',
  "Direct Club refresh must not bypass the public gate.",
);

includes(
  loadingCss,
  'html:not(.mflInitialRouteResolved)[data-initial-table-page="club"] #progressionPage :is(.quickFilters, .controlsBar, nav.pager)',
  "Raw Club first paint must hide generic table filter chrome before application hydration.",
);
includes(
  loadingCss,
  'body[data-page="club"] #progressionPage :is(.quickFilters, .controlsBar, nav.pager)',
  "Hydrated Club pages must keep generic filter chrome absent for the entire route lifetime.",
);

includes(
  eagerCore,
  'if (route.scope !== "club") globalThis.syncQuickFilterLabels?.();',
  "Club loading must not initialize generic quick-filter labels.",
);
includes(
  eagerCore,
  'const clubPage = pageName === "club";',
  "The shared incremental loader must identify Club payloads explicitly.",
);
includes(
  eagerCore,
  "if (tablePages.has(pageName) && !clubPage) {",
  "Club payloads must bypass generic saved-table filter restoration.",
);
includes(
  eagerCore,
  'state.currentPage = "club";',
  "Club ownership must be committed before the shared Table render.",
);
includes(
  eagerCore,
  "state.pageSize = Math.max(100, state.rows.length || 100);",
  "Club must establish its full-roster page size before the shared Table render.",
);
includes(
  eagerCore,
  "originalApplyFilters.call(this, { save: false });",
  "Club and non-Club table payloads must render through the same shared Table pass.",
);

const incrementalLoaderStart = eagerCore.indexOf("window.mflLoadIncrementalRoutePage = async function loadIncrementalRoutePage");
const incrementalLoaderEnd = eagerCore.indexOf("})();", incrementalLoaderStart);
const incrementalLoader = eagerCore.slice(incrementalLoaderStart, incrementalLoaderEnd);
invariant(incrementalLoaderStart >= 0 && incrementalLoaderEnd > incrementalLoaderStart, "Shared incremental route loader must exist.");
includes(
  incrementalLoader,
  "originalApplyFilters.call(this, { save: false });",
  "The shared incremental loader must perform the single final Club table render.",
);
excludes(
  incrementalLoader,
  "if (!clubPage) originalApplyFilters.call(this, { save: false });",
  "Club must not be excluded from the shared final table render.",
);
excludes(
  incrementalLoader,
  'restoreSavedTableState("club"',
  "Club payload loading must never restore saved Club filter state.",
);

includes(
  tableCore,
  'if (state.currentPage === "club") {',
  "The canonical Table filter owner must retain the filter-free Club branch.",
);
includes(
  tableCore,
  "state.filteredRows = [...state.rows];",
  "The shared Table pass must render the loaded Club roster directly.",
);
excludes(
  clubCore,
  "applyFilters = function applyFiltersWithClubRows",
  "Club must not replace the canonical shared Table filter facade.",
);
excludes(
  clubCore,
  "const originalApplyFilters = applyFilters;",
  "Club must not capture a second Table filter owner.",
);

const openClubStart = clubCore.indexOf("async function openClubPage(clubId");
const openClubEnd = clubCore.indexOf('\n  if (typeof compareRows === "function")', openClubStart);
const openClubSource = clubCore.slice(openClubStart, openClubEnd);
invariant(openClubStart >= 0 && openClubEnd > openClubStart, "The Club route owner must contain openClubPage.");
excludes(
  openClubSource,
  'applyFilters({ save: false, localOnly: true });',
  "openClubPage must not paint the Club table a second time after the shared incremental render.",
);
excludes(
  openClubSource,
  'if (typeof buildHeader === "function") buildHeader();',
  "openClubPage must not rebuild the table header after the shared incremental render.",
);
includes(
  openClubSource,
  "applyClubPresentation();",
  "The Club route owner must still apply Club-only presentation after the shared table render.",
);
includes(
  openClubSource,
  "captureClubView(nextView);",
  "The Club route owner must still cache the completed shared render.",
);

includes(
  clubCore,
  "void clubTitleReady.then((resolvedTitle) => {",
  "Club title preflight must remain non-blocking while roster data loads.",
);
includes(
  clubCore,
  'document.documentElement.dataset.initialEntityVerified = "club";',
  "A confirmed Club identity must release the guarded first-paint Club shell.",
);
includes(
  clubCore,
  "const loadedClubTitle = clubTitleIdentityFromRows(activeClubId);",
  "Loaded Club rows must become the authoritative hydrated title identity.",
);
const emptyRosterIdentityGuard = clubCore.indexOf("if (!loadedClubTitle && clubRows().length === 0) {");
const deferredEmptyRosterTitle = clubCore.indexOf("const resolvedClubTitle = await clubTitleReady;", emptyRosterIdentityGuard);
invariant(
  emptyRosterIdentityGuard >= 0 && deferredEmptyRosterTitle > emptyRosterIdentityGuard,
  "Only an empty Club roster may wait for title identity before deciding that the Club is missing.",
);

excludes(routeSplitter, "!important", "Club route ownership must not add CSS priority overrides.");
excludes(clubStartupLifecycle, "!important", "Club startup ownership must not add CSS priority overrides.");
excludes(loadingCss, "!important", "Club first-paint visibility must not use !important.");

const generatedEagerBanner = "// Generated by build-app-core.mjs from modules/app-core.js. Do not edit directly.\n";
invariant(
  generatedEagerCore.startsWith(generatedEagerBanner)
    && generatedEagerCore.slice(generatedEagerBanner.length).replace(/\s*$/, "") === eagerCore.replace(/\s*$/, ""),
  "The tracked shared runtime must exactly match the normalized eager core.",
);

const generatedClubBanner = "// Generated Club core chunk from modules/app-core.js. Do not edit directly.\n";
invariant(
  generatedClubCore.startsWith(generatedClubBanner)
    && generatedClubCore.slice(generatedClubBanner.length).replace(/\s*$/, "") === clubCore.replace(/\s*$/, ""),
  "The tracked Club runtime must exactly match the normalized Club artifact.",
);

console.log("Club refresh checks passed: shared public entry, guarded first-paint identity, no saved-filter restore, and one shared table render with no Club-owned repaint.");
