import { invariant } from "./validation/assertions.mjs";
import { readFile } from "node:fs/promises";

import { readCanonicalCoreArtifacts } from "./validate-core-sources.mjs";

const source = await Promise.all([
    readFile(new URL("./modules/core-sources/shared.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/evaluation.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/mfl-stats.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/club.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/settings.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/player.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/table.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/wallet.js", import.meta.url), "utf8"),
    readFile(new URL("./modules/core-sources/watchlist.js", import.meta.url), "utf8"),
  ]).then((parts) => parts.join("\n"));
const appEntry = await readFile(new URL("./modules/app-entry.js", import.meta.url), "utf8");
const artifacts = readCanonicalCoreArtifacts(source);
const generatedSources = new Map([
  ["core", String(artifacts.core || "")],
  ...Object.entries(artifacts.routeChunks || {}).map(([name, value]) => [name, String(value || "")]),
]);


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
const pageRunnerNavigation = pageRunner.indexOf('navigation.beginLatest("page-transition")');
const pageRunnerCancel = pageRunner.indexOf("window.__mflCancelIncrementalRouteRequest?.();", pageRunnerNavigation);
const pageRunnerCommit = pageRunner.indexOf("commitPageTransition(pageName, updateHash, options)");
const pageRunnerSupersede = pageRunner.indexOf('document.documentElement.classList.add("mflInitialRouteSuperseded");', pageRunnerCommit);
const pageRunnerLoading = pageRunner.indexOf("loadingController?.beginRouteTransition?.(pageName, options)", pageRunnerSupersede);
const pageRunnerPaint = pageRunner.indexOf("await waitForViewTransitionPaint();", pageRunnerLoading);
const pageRunnerLoad = pageRunner.indexOf('const result = typeof loader === "function" ? await loader(transition)', pageRunnerPaint);
const pageRunnerCurrentAfterLoad = pageRunner.indexOf("if (!pageTransitionIsCurrent(transition)) return null;", pageRunnerLoad);
const pageRunnerRelease = pageRunner.indexOf("navigation?.end?.(navigationToken)", pageRunnerCurrentAfterLoad);
invariant(
  pageRunnerNavigation >= 0
    && pageRunnerCancel > pageRunnerNavigation
    && pageRunnerCommit > pageRunnerCancel
    && pageRunnerSupersede > pageRunnerCommit
    && pageRunnerLoading > pageRunnerSupersede
    && pageRunnerPaint > pageRunnerLoading
    && pageRunnerLoad > pageRunnerPaint
    && pageRunnerCurrentAfterLoad > pageRunnerLoad
    && pageRunnerRelease > pageRunnerCurrentAfterLoad,
  "The global page transition runner must abort obsolete route data before commit, then own navigation state through commit, paint, and its loader callback.",
);

const viewRunner = section(
  transitionRunnerOwner.text,
  "async function runViewTransition(pageName, viewName, options = {}, loader = null) {",
  'Reflect.set(window, "__mflCommitViewTransition"',
  "global view transition runner",
);
const viewRunnerNavigation = viewRunner.indexOf('navigation.beginLatest("view-transition")');
const viewRunnerCancel = viewRunner.indexOf("window.__mflCancelIncrementalRouteRequest?.();", viewRunnerNavigation);
const viewRunnerStage = viewRunner.indexOf("stageViewTransition(pageName, viewName, options)");
const viewRunnerSupersede = viewRunner.indexOf('document.documentElement.classList.add("mflInitialRouteSuperseded");', viewRunnerStage);
const viewRunnerLoading = viewRunner.indexOf("loadingController?.beginRouteTransition?.(pageName", viewRunnerSupersede);
const viewRunnerPaint = viewRunner.indexOf("await waitForViewTransitionPaint();", viewRunnerLoading);
const viewRunnerLoad = viewRunner.indexOf('typeof loader === "function"', viewRunnerPaint);
const viewRunnerLoaderCall = viewRunner.indexOf("const result = await loader(transition);", viewRunnerLoad);
const viewRunnerCurrentAfterLoad = viewRunner.indexOf("if (!stagedViewTransitionIsCurrent(transition)) return null;", viewRunnerLoaderCall);
const viewRunnerPendingCleanup = viewRunner.indexOf("if (pendingViewTransition === transition) pendingViewTransition = null;", viewRunnerCurrentAfterLoad);
const viewRunnerRelease = viewRunner.indexOf("navigation?.end?.(navigationToken)", viewRunnerPendingCleanup);
invariant(
  viewRunnerNavigation >= 0
    && viewRunnerCancel > viewRunnerNavigation
    && viewRunnerStage > viewRunnerCancel
    && viewRunnerSupersede > viewRunnerStage
    && viewRunnerLoading > viewRunnerSupersede
    && viewRunnerPaint > viewRunnerLoading
    && viewRunnerLoad > viewRunnerPaint
    && viewRunnerLoaderCall > viewRunnerLoad
    && viewRunnerCurrentAfterLoad > viewRunnerLoaderCall
    && viewRunnerPendingCleanup > viewRunnerCurrentAfterLoad
    && viewRunnerRelease > viewRunnerPendingCleanup
    && !viewRunner.includes("refreshLoadingToken")
    && !viewRunner.includes("mflInitialRouteResolved"),
  "Shared view navigation must keep its proven click lifecycle unchanged, with no refresh-only loading branch.",
);

const pageLoaderOwner = sourceContaining("setPage = async function setIncrementalPage(pageName, updateHash = true, options = {}) {", "incremental page loader");
const pageLoaderStart = pageLoaderOwner.text.indexOf("setPage = async function setIncrementalPage(pageName, updateHash = true, options = {}) {");
const pageLoader = pageLoaderOwner.text.slice(pageLoaderStart);
const pageRun = pageLoader.indexOf("return runPageTransition(pageName, navigationUpdatesHistory, options, (navigationTransition) => setPage(pageName, false, {");
const pageRoutePrepare = pageLoader.indexOf("prepareIncrementalRoute(pageName", pageRun);
const pageRequest = pageLoader.indexOf("requestIncrementalRoute(route, 1", pageRun);
const firstPageLoad = [pageRoutePrepare, pageRequest].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? -1;
invariant(
  pageRun >= 0 && firstPageLoad > pageRun,
  "Generated page loading must run inside the global page-transition loader so destination loading remains active until settlement.",
);
invariant(
  pageLoader.indexOf("skipNavigationTransition: true", pageRun) > pageRun
    && pageLoader.indexOf("__mflNavigationUpdatesHistory: navigationUpdatesHistory", pageRun) > pageRun,
  "Generated page loader must recurse without a second transition while preserving the original history intent.",
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
const mflStatsRequest = pageLoader.indexOf("requestIncrementalRoute(route, 1", mflStatsPrepare);
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
invariant(
  activation.includes('void runViewTransition(pageName, viewName, {')
    && activation.includes('}, async () => {\n    await setView(viewName);\n  });'),
  "Shared table view clicks must keep one transition open through destination loading instead of releasing navigation before setView begins.",
);
invariant(
  !activation.includes('if (pageName === "club") return;'),
  "Club view buttons must not be excluded from the shared view activation owner.",
);
invariant(
  activation.includes('const clubTarget = pageName === "club" ? clubRouteTargetFromPath() : null;')
    && activation.includes('window.__mflAppConfig?.routes?.clubPath?.(clubTarget.clubId, viewName)')
    && activation.includes("path: clubPath,"),
  "Shared Club view activation must preserve the current Club identity and use the canonical Club URL builder.",
);
invariant(
  !activation.includes('viewName === "attributes" ? "squad" : viewSlug(viewName)'),
  "Shared Club view activation must not duplicate the Club view-to-slug mapping.",
);
for (const [transitionMarker, loaderMarker, label] of [
  ['runViewTransition("mfl", "stats"', 'setPage("mfl", false, { view: "stats"', "MFL Stats"],
  ['runViewTransition("database", "stats"', 'setPage("database", false, { view: "stats"', "Database Stats"],
  ["void runViewTransition(pageName, viewName", "await setView(viewName);", "shared table view"],
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
const request = incrementalView.indexOf("requestIncrementalRoute(route, 1", stagedTake);
invariant(
  stagedTake >= 0 && fallbackTransition > stagedTake && request > fallbackTransition,
  "Programmatic generated view switches must use the global transition runner before requesting data.",
);
invariant(
  !incrementalView.includes('state.currentPage === "club"'),
  "Club must use the same incremental setView owner as the other table pages.",
);
invariant(
  incrementalView.includes('const clubTarget = pageName === "club" ? clubRouteTargetFromPath() : null;')
    && incrementalView.includes('...(clubTarget?.clubId ? { clubId: clubTarget.clubId } : {})'),
  "Shared incremental view loading must carry explicit Club identity into the data route.",
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
const clubPageLoading = clubOwner.text.indexOf("window.mflLoadIncrementalRoutePage(CLUB_PAGE", clubPageTransition);
invariant(
  clubPageTransition >= 0 && clubPageLoading > clubPageTransition,
  "Generated Club page entry must use the global page transition before canonical Club loading starts.",
);
invariant(
  !clubOwner.text.includes("runViewTransition(CLUB_PAGE, nextView"),
  "Club must not retain a private view-transition owner outside the shared view-button pipeline.",
);
invariant(
  !clubOwner.text.includes('document.addEventListener("click", (event) => {\n    if (state.currentPage !== CLUB_PAGE) return;'),
  "Club must not retain a capture-phase view-button listener outside the shared activation owner.",
);
invariant(
  !clubOwner.text.includes("commitViewTransition(CLUB_PAGE"),
  "Club must not retain a private direct view-transition commit.",
);
invariant(
  !clubOwner.text.includes("setClubSwitching") && !clubOwner.text.includes("clubViewSwitching"),
  "Club must not retain a private loading lifecycle outside Uniform Loading.",
);

const clubGateStart = appEntry.indexOf("function installClubRouteRuntimeGate() {");
const clubGateEnd = appEntry.indexOf("async function finalizeRouteRuntimeNow", clubGateStart);
const clubGate = appEntry.slice(clubGateStart, clubGateEnd);
invariant(
  clubGate.includes('runTransition("club", true'),
  "The Club app-entry gate must enter through the global page transition runner.",
);
invariant(
  !clubGate.includes("loadingController?.begin?.(loadingController.reason)")
    && clubGate.includes('const transitionIsCurrent = Reflect.get(runtimeWindow, "__mflNavigationTransitionIsCurrent");')
    && clubGate.includes('if (transition && typeof transitionIsCurrent === "function" && !transitionIsCurrent(transition)) return null;'),
  "The Club app-entry gate must inherit route loading from the global page transition and reject stale lazy-runtime completion before rendering.",
);
invariant(
  !clubGate.includes('begin?.("route-loading")')
    && !clubGate.includes('begin?.("route-runtime")'),
  "The Club app-entry gate must not duplicate lazy route-loading identities outside the controller.",
);
invariant(
  !clubGate.includes("history.pushState") && !clubGate.includes("history.replaceState"),
  "The Club app-entry gate must not own history outside the global transition.",
);

invariant(
  !activation.includes("window.__mflTableLoadingRuntime?.show"),
  "The generated view-button owner must not contain a competing loading-shell trigger.",
);

console.log(
  `Generated global navigation validated across ${pageTransitionOwner.name}, ${pageLoaderOwner.name}, ${activationOwner.name}, ${incrementalOwner.name}, and ${clubOwner.name}: Club and the other table pages share one view activation, transition, incremental loading, canonical controller-owned route loading, and active-view no-op pipeline.`,
);