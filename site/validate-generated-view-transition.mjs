import { readFile } from "node:fs/promises";

import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";

const source = await readFile(new URL("./modules/app-core.js", import.meta.url), "utf8");
const routeCoreLoader = await readFile(new URL("./route-core-loader-runtime.js", import.meta.url), "utf8");
const artifacts = normalizeBuiltApplicationCoreArtifacts(source);
const generatedSources = new Map([
  ["core", String(artifacts.core || "")],
  ...Object.entries(artifacts.routeChunks || {}).map(([name, value]) => [name, String(value || "")]),
]);

const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sourceContaining = (marker, label) => {
  const match = Array.from(generatedSources.entries()).find(([, text]) => text.includes(marker));
  invariant(match, `Could not locate generated ${label}.`);
  return { name: match[0], text: match[1] };
};

const section = (text, startMarker, endMarker, label) => {
  const start = text.indexOf(startMarker);
  const end = start >= 0 ? text.indexOf(endMarker, start + startMarker.length) : -1;
  invariant(start >= 0 && end > start, `Could not locate generated ${label}.`);
  return text.slice(start, end);
};

const pageTransitionOwner = sourceContaining("function commitPageTransition(pageName, updateHash = true, options = {}) {", "page transition owner");
const pageTransition = section(
  pageTransitionOwner.text,
  "function commitPageTransition(pageName, updateHash = true, options = {}) {",
  "function stageViewTransition",
  "page transition owner",
);
const pageState = pageTransition.indexOf("state.currentPage = statePageName;");
const pageUrl = pageTransition.indexOf('window.history[replaceRoute ? "replaceState" : "pushState"]');
const pageChrome = pageTransition.indexOf("window.__mflStaticUiRuntime?.sync?.();");
invariant(
  pageState >= 0 && pageUrl > pageState && pageChrome > pageUrl,
  "Generated page navigation must commit application state, URL, and route chrome in that order.",
);

const viewTransitionOwner = sourceContaining("function commitViewTransition(pageName, viewName, options = {}) {", "view transition owner");
const viewTransition = section(
  viewTransitionOwner.text,
  "function commitViewTransition(pageName, viewName, options = {}) {",
  "function commitPageTransition",
  "view transition owner",
);
const viewState = viewTransition.indexOf("state.view = nextView;");
const viewUrl = viewTransition.indexOf('window.history[options.replace ? "replaceState" : "pushState"]');
const viewButtons = viewTransition.indexOf("updateViewButtons();");
const viewShell = viewTransition.indexOf("window.__mflStaticUiRuntime?.sync?.();");
invariant(
  viewState >= 0 && viewUrl > viewState && viewButtons > viewUrl && viewShell > viewButtons,
  "Generated view navigation must commit state, URL, active button, and route shell in that order.",
);

const transitionRunnerOwner = sourceContaining("async function runPageTransition(pageName, updateHash = true, options = {}, loader = null) {", "global transition runners");
const pageRunner = section(
  transitionRunnerOwner.text,
  "async function runPageTransition(pageName, updateHash = true, options = {}, loader = null) {",
  "async function runViewTransition",
  "global page transition runner",
);
const pageRunnerCommit = pageRunner.indexOf("commitPageTransition(pageName, updateHash, options)");
const pageRunnerPaint = pageRunner.indexOf("await waitForViewTransitionPaint();", pageRunnerCommit);
const pageRunnerLoad = pageRunner.indexOf('typeof loader === "function" ? loader(transition)', pageRunnerPaint);
invariant(
  pageRunnerCommit >= 0 && pageRunnerPaint > pageRunnerCommit && pageRunnerLoad > pageRunnerPaint,
  "The global page transition runner must commit and paint before any loader callback starts.",
);

const viewRunner = section(
  transitionRunnerOwner.text,
  "async function runViewTransition(pageName, viewName, options = {}, loader = null) {",
  'Reflect.set(window, "__mflCommitViewTransition"',
  "global view transition runner",
);
const viewRunnerStage = viewRunner.indexOf("stageViewTransition(pageName, viewName, options)");
const viewRunnerPaint = viewRunner.indexOf("await waitForViewTransitionPaint();", viewRunnerStage);
const viewRunnerLoad = viewRunner.indexOf('typeof loader === "function"', viewRunnerPaint);
invariant(
  viewRunnerStage >= 0 && viewRunnerPaint > viewRunnerStage && viewRunnerLoad > viewRunnerPaint,
  "The global view transition runner must commit and paint before any loader callback starts.",
);

const pageLoaderOwner = sourceContaining("setPage = async function setIncrementalPage(pageName, updateHash = true, options = {}) {", "incremental page loader");
const pageLoaderStart = pageLoaderOwner.text.indexOf("setPage = async function setIncrementalPage(pageName, updateHash = true, options = {}) {");
const pageLoader = pageLoaderOwner.text.slice(pageLoaderStart);
const pageRun = pageLoader.indexOf("await runPageTransition(pageName, navigationUpdatesHistory, options)");
const pageRoutePrepare = pageLoader.indexOf("prepareIncrementalRoute(pageName", pageRun);
const pageRequest = pageLoader.indexOf("requestIncrementalRoute(route, 1)", pageRun);
const firstPageLoad = [pageRoutePrepare, pageRequest].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? -1;
invariant(
  pageRun >= 0 && firstPageLoad > pageRun,
  "Generated page loading must begin only after the global page transition runner settles.",
);
invariant(
  pageLoader.indexOf("updateHash = false;", pageRun) > pageRun,
  "Generated page loader must suppress downstream duplicate history ownership after the global transition.",
);

const mflRouteOwner = sourceContaining(
  'if (pageName === "mfl") return { ...base, scope: view === "stats" ? "mflstats" : "mfl" };',
  "MFL incremental route owner",
);
invariant(
  mflRouteOwner.text.includes('["club", "mflstats"].includes(route.scope)'),
  "MFL Stats must use the complete shared incremental page size instead of the normal paginated MFL table size.",
);
const mflStatsBranch = pageLoader.indexOf('if (pageName === "mfl" && requestedMflView === "stats") {');
const mflStatsPrepare = pageLoader.indexOf("prepareIncrementalRoute(pageName", mflStatsBranch);
const mflStatsRequest = pageLoader.indexOf("requestIncrementalRoute(route, 1)", mflStatsPrepare);
const mflStatsFinalRender = pageLoader.indexOf('originalSetPage.call(this, "mflstats"', mflStatsRequest);
invariant(
  mflStatsBranch >= 0 && mflStatsPrepare > mflStatsBranch && mflStatsRequest > mflStatsPrepare && mflStatsFinalRender > mflStatsRequest,
  "MFL Stats must use the same incremental route preparation and request pipeline before its final renderer runs.",
);

const activationOwner = sourceContaining("function activateViewButton(button) {", "view-button activation owner");
const activation = section(
  activationOwner.text,
  "function activateViewButton(button) {",
  "function clearPointerCommittedViewButton() {",
  "view-button activation owner",
);
const activeViewNoOp = activation.indexOf('if (pageName === activePageName && viewName === activeViewName) return;');
const firstViewTransition = activation.indexOf("runViewTransition(");
invariant(
  activeViewNoOp >= 0 && firstViewTransition > activeViewNoOp,
  "Every shared active view button must return before any transition or loader starts, matching active page buttons.",
);
invariant(
  !activation.includes('setPage("mflstats"'),
  "MFL Stats view activation must stay on the canonical MFL page/view navigation path.",
);
for (const [transitionMarker, loaderMarker, label] of [
  ['runViewTransition("mfl", "stats"', 'setPage("mfl", false, { view: "stats"', "MFL Stats"],
  ['runViewTransition("database", "stats"', 'setPage("database", false, { view: "stats"', "Database Stats"],
  ["await runViewTransition(pageName, viewName", "await setView(viewName);", "shared table view"],
]) {
  const transitionIndex = activation.indexOf(transitionMarker);
  const loaderIndex = activation.indexOf(loaderMarker, transitionIndex);
  invariant(
    transitionIndex >= 0 && loaderIndex > transitionIndex,
    `${label} activation must enter the global view transition before its loader.`,
  );
}

const incrementalOwner = sourceContaining("setView = async function setIncrementalView(viewName) {", "incremental view loader");
const incrementalView = section(
  incrementalOwner.text,
  "setView = async function setIncrementalView(viewName) {",
  "setPage = async function setIncrementalPage(pageName, updateHash = true, options = {}) {",
  "incremental view loader",
);
const stagedTake = incrementalView.indexOf("const stagedTransition = takeStagedViewTransition(pageName, nextView);");
const fallbackTransition = incrementalView.indexOf("await runViewTransition(pageName, nextView", stagedTake);
const request = incrementalView.indexOf("requestIncrementalRoute(route, 1)", stagedTake);
invariant(
  stagedTake >= 0 && fallbackTransition > stagedTake && request > fallbackTransition,
  "Programmatic generated view switches must use the global transition runner before requesting data.",
);

const databaseStatsBranch = pageLoader.indexOf('if (pageName === "database" && requestedDatabaseView === "stats") {');
const databaseStatsRuntime = pageLoader.indexOf('await window.__mflEnsureRouteRuntime("database", { view: "stats" });', databaseStatsBranch);
const databaseStatsRender = pageLoader.indexOf("statsOwner.render()", databaseStatsRuntime);
invariant(
  databaseStatsBranch >= 0 && databaseStatsRuntime > databaseStatsBranch && databaseStatsRender > databaseStatsRuntime,
  "Database Stats must perform only runtime/data work after the global page/view transition has settled.",
);

const playerOwner = sourceContaining("const nextView = button.dataset.playerAttributeView;", "Player view activation owner");
const playerActiveViewNoOp = playerOwner.text.indexOf("if (!nextView || nextView === state.playerAttributeView) return;");
const playerViewCommit = playerOwner.text.indexOf("state.playerAttributeView = nextView;", playerActiveViewNoOp);
invariant(
  playerActiveViewNoOp >= 0 && playerViewCommit > playerActiveViewNoOp,
  "Player active view buttons must return before state changes or rerendering, matching every other active view button.",
);

const clubOwner = sourceContaining("runPageTransition(CLUB_PAGE, updateHistory", "Club transition owner");
const clubPageTransition = clubOwner.text.indexOf("runPageTransition(CLUB_PAGE, updateHistory");
const clubPageLoading = clubOwner.text.indexOf("setClubSwitching(true);", clubPageTransition);
const clubViewTransition = clubOwner.text.indexOf("runViewTransition(CLUB_PAGE, nextView");
const clubViewLoading = clubOwner.text.indexOf("setClubSwitching(true);", clubViewTransition);
const clubActiveViewNoOp = clubOwner.text.indexOf("if (nextView === state.view) return;");
invariant(
  clubPageTransition >= 0 && clubPageLoading > clubPageTransition,
  "Generated Club page entry must use the global page transition before Club loading starts.",
);
invariant(
  clubActiveViewNoOp >= 0 && clubViewTransition > clubActiveViewNoOp,
  "Club active view buttons must keep the same no-op behavior as all shared active view buttons.",
);
invariant(
  clubViewTransition >= 0 && clubViewLoading > clubViewTransition,
  "Generated Club view switching must use the global view transition before Club loading starts.",
);
invariant(
  !clubOwner.text.includes("commitViewTransition(CLUB_PAGE"),
  "Club must not retain a private direct view-transition commit.",
);

const clubGateStart = routeCoreLoader.indexOf("const gated = async function mflOpenClubPageWithRouteCore");
const clubGateEnd = routeCoreLoader.indexOf("Object.defineProperty(gated", clubGateStart);
const clubGate = routeCoreLoader.slice(clubGateStart, clubGateEnd);
invariant(
  clubGate.includes('runTransition("club", true'),
  "The Club route-core gate must enter through the global page transition runner.",
);
invariant(
  clubGate.includes('runtimeWindow.__mflInteractionBusy?.begin?.("route-runtime")'),
  "The Club route-core gate must retain lazy route loading after transition ownership is committed.",
);
invariant(
  !clubGate.includes("history.pushState") && !clubGate.includes("history.replaceState"),
  "The Club route-core gate must not own history outside the global transition.",
);

invariant(
  !activation.includes("window.__mflTableLoadingRuntime?.show"),
  "The generated view-button owner must not contain a competing loading-shell trigger.",
);

console.log(
  `Generated global navigation validated across ${pageTransitionOwner.name}, ${pageLoaderOwner.name}, ${activationOwner.name}, ${incrementalOwner.name}, and ${clubOwner.name}: active views no-op uniformly, and MFL Stats uses the shared incremental loading pipeline before its renderer.`,
);
