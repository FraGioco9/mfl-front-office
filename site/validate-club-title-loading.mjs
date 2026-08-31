import { readFile } from "node:fs/promises";

import { readCanonicalCoreArtifacts } from "./validate-core-sources.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [
  coreSource,
  routeSplitter,
  buildNormalizer,
  bootstrap,
  loadingCss,
  generatedEagerCore,
  generatedClubCore,
  appEntry,
] = await Promise.all([
  Promise.all([
    read("./modules/core-sources/shared.js"),
    read("./modules/core-sources/evaluation.js"),
    read("./modules/core-sources/mfl-stats.js"),
    read("./modules/core-sources/club.js"),
    read("./modules/core-sources/settings.js"),
    read("./modules/core-sources/player.js"),
    read("./modules/core-sources/table.js"),
    read("./modules/core-sources/wallet.js"),
    read("./modules/core-sources/watchlist.js"),
  ]).then((parts) => parts.join("\n")),
  read("./modules/app-core-route-chunks.js"),
  read("./modules/app-core-build-normalizer.js"),
  read("./bootstrap.js"),
  read("./loading.css"),
  read("./modules/app-core-runtime.js"),
  read("./modules/app-core-club-runtime.js"),
  read("./modules/app-entry.js"),
]);

const artifacts = readCanonicalCoreArtifacts(coreSource);
const eagerCore = String(artifacts.core || "");
const clubCore = String(artifacts.routeChunks?.club || "");
new Function(eagerCore);
new Function(clubCore);

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
  appEntry,
  "function installClubRouteRuntimeGate()",
  "Club links and refresh must share the public Club route gate.",
);
includes(
  appEntry,
  'runtimeWindow.__mflEnsureRouteCore("club", { view })',
  "The public Club gate must ensure Club core readiness.",
);
includes(
  appEntry,
  'const routeRuntimePromise = ensureRouteRuntime("club", { view });',
  "The public Club gate must ensure Club runtime readiness.",
);
includes(
  appEntry,
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
  "Club ownership must be committed before the payload is handed back to the Club route owner.",
);
includes(
  eagerCore,
  "if (!clubPage) originalApplyFilters.call(this, { save: false });",
  "Only non-Club incremental pages may render through the generic pre-route filter pipeline.",
);

const incrementalLoaderStart = eagerCore.indexOf("window.mflLoadIncrementalRoutePage = async function loadIncrementalRoutePage");
const incrementalLoaderEnd = eagerCore.indexOf("})();", incrementalLoaderStart);
const incrementalLoader = eagerCore.slice(incrementalLoaderStart, incrementalLoaderEnd);
invariant(incrementalLoaderStart >= 0 && incrementalLoaderEnd > incrementalLoaderStart, "Shared incremental route loader must exist.");
excludes(
  incrementalLoader,
  "if (clubPage) applyFilters(",
  "Club payload loading must not execute the generic filter pipeline before Club state is reset.",
);
excludes(
  incrementalLoader,
  'restoreSavedTableState("club"',
  "Club payload loading must never restore saved Club filter state.",
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

const rosterLoad = clubCore.indexOf("window.mflLoadIncrementalRoutePage");
const filterRulesReset = clubCore.indexOf("filterRules.replaceChildren();", rosterLoad);
const hideRetiredReset = clubCore.indexOf("hideRetiredInput.checked = false;", filterRulesReset);
const hideRetiringReset = clubCore.indexOf("hideRetiringInput.checked = false;", hideRetiredReset);
const hideMflReset = clubCore.indexOf("hideMflPlayersInput.checked = false;", hideRetiringReset);
const newMintsReset = clubCore.indexOf("newMintsInput.checked = false;", hideMflReset);
const finalFilterRender = clubCore.indexOf('applyFilters({ save: false, localOnly: true });', newMintsReset);
invariant(
  rosterLoad >= 0
    && filterRulesReset > rosterLoad
    && hideRetiredReset > filterRulesReset
    && hideRetiringReset > hideRetiredReset
    && hideMflReset > hideRetiringReset
    && newMintsReset > hideMflReset
    && finalFilterRender > newMintsReset,
  "Club must clear every generic filter control before the single final Table render.",
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
excludes(buildNormalizer, "normalizeClubStartupLifecycle", "Build composition must not rewrite source-owned Club startup behavior.");
excludes(buildNormalizer, "clubStartupArtifacts", "The obsolete Club startup build artifact must stay removed.");
excludes(loadingCss, "!important", "Club first-paint visibility must not use !important.");

const generatedEagerBanner = "// Generated by build-app-core.mjs from modules/core-sources/shared.js. Do not edit directly.\n";
invariant(
  generatedEagerCore.startsWith(generatedEagerBanner)
    && generatedEagerCore.slice(generatedEagerBanner.length).replace(/\s*$/, "") === eagerCore.replace(/\s*$/, ""),
  "The tracked shared runtime must exactly match the normalized eager core.",
);

const generatedClubBanner = "// Generated Club core from modules/core-sources/club.js. Do not edit directly.\n";
invariant(
  generatedClubCore.startsWith(generatedClubBanner)
    && generatedClubCore.slice(generatedClubBanner.length).replace(/\s*$/, "") === clubCore.replace(/\s*$/, ""),
  "The tracked Club runtime must exactly match the normalized Club artifact.",
);

console.log("Club filter-free refresh checks passed: shared public entry, guarded first-paint identity, no saved-filter restore, no pre-reset filter render, one final Club-owned roster render.");
