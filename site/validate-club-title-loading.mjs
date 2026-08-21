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
  "const loadedClubTitle = clubTitleIdentityFromRows(activeClubId);",
  "Loaded Club rows must become the authoritative hydrated title identity.",
);
excludes(
  clubCore,
  "const resolvedClubTitle = await clubTitleReady;",
  "Roster completion must not wait for title lookup.",
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

console.log("Club filter-free refresh checks passed: shared public entry, no first-paint filter chrome, no saved-filter restore, no pre-reset filter render, one final Club-owned roster render.");
