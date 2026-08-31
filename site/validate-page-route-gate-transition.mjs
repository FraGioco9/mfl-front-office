import assert from "node:assert/strict";
import fs from "node:fs";

const appCoreSource = [
  "modules/core-sources/shared.js",
  "modules/core-sources/evaluation.js",
  "modules/core-sources/mfl-stats.js",
  "modules/core-sources/club.js",
  "modules/core-sources/settings.js",
  "modules/core-sources/player.js",
  "modules/core-sources/table.js",
  "modules/core-sources/wallet.js",
  "modules/core-sources/watchlist.js",
].map((path) => fs.readFileSync(path, "utf8")).join("\n");
const routeSetPageAssignmentIndex = appCoreSource.indexOf("setPage = routeRuntimeSetPage;");
const routeSetPageSection = routeSetPageAssignmentIndex >= 0
  ? appCoreSource.slice(appCoreSource.lastIndexOf(";(() => {", routeSetPageAssignmentIndex), routeSetPageAssignmentIndex + "setPage = routeRuntimeSetPage;".length)
  : "";
assert.ok(routeSetPageAssignmentIndex >= 0, "Could not locate the lazy setPage route gate.");
assert.match(routeSetPageSection, /const stagedTransition = incomingOptions\.__mflNavigationTransition[\s\S]*?pendingViewTransition/, "Lazy route loads must retain an inherited page/view transition identity through runtime loading.");
assert.match(routeSetPageSection, /const loadCommittedRoute = async \(transition = stagedTransition\) => \{/, "The lazy route gate must receive the owning page/view transition.");
assert.match(routeSetPageSection, /__mflNavigationTransition: transition/, "The lazy route gate must forward the owning transition into downstream page renderers.");
const runtimeAwait = routeSetPageSection.indexOf("if (routeCorePromise) await routeCorePromise;");
const staleGuard = routeSetPageSection.indexOf("if (transition && !navigationTransitionIsCurrent(transition)) return null;", runtimeAwait);
const downstreamCommit = routeSetPageSection.indexOf("const committedOptions = {", staleGuard);
assert.ok(runtimeAwait >= 0 && staleGuard > runtimeAwait && downstreamCommit > staleGuard, "Lazy route runtime/core completion must be checked for staleness before any downstream renderer can run.");
assert.doesNotMatch(routeSetPageSection, /const busyToken = !routeReady && !routeLoadingActive/, "The lazy route gate must not acquire a second route-loading token.");
assert.doesNotMatch(routeSetPageSection, /waitForLoadingPaint/, "The global transition runner, not the lazy route gate, must own route-loading paint boundaries.");
assert.doesNotMatch(routeSetPageSection, /__mflCancelIncrementalRouteRequest/, "Incremental cancellation must remain at the global transition boundary, before destination commit.");

const pageRunnerStart = appCoreSource.indexOf("async function runPageTransition(pageName, updateHash = true, options = {}, loader = null) {");
const pageRunnerEnd = appCoreSource.indexOf("async function runViewTransition", pageRunnerStart);
const pageRunner = appCoreSource.slice(pageRunnerStart, pageRunnerEnd);
const pageCancel = pageRunner.indexOf("window.__mflCancelIncrementalRouteRequest?.();");
const pageCommit = pageRunner.indexOf("commitPageTransition(pageName, updateHash, options)");
const pageLoading = pageRunner.indexOf("loadingController?.beginRouteTransition?.(pageName, options)", pageCommit);
assert.ok(pageCancel >= 0 && pageCommit > pageCancel && pageLoading > pageCommit, "Page navigation must abort obsolete data before committing the destination, then replace route-loading ownership for that destination.");

const viewRunnerStart = appCoreSource.indexOf("async function runViewTransition(pageName, viewName, options = {}, loader = null) {");
const viewRunnerEnd = appCoreSource.indexOf('Reflect.set(window, "__mflCommitViewTransition"', viewRunnerStart);
const viewRunner = appCoreSource.slice(viewRunnerStart, viewRunnerEnd);
const viewCancel = viewRunner.indexOf("window.__mflCancelIncrementalRouteRequest?.();");
const viewCommit = viewRunner.indexOf("stageViewTransition(pageName, viewName, options)");
const viewLoading = viewRunner.indexOf("loadingController?.beginRouteTransition?.(pageName", viewCommit);
assert.ok(viewCancel >= 0 && viewCommit > viewCancel && viewLoading > viewCommit, "View navigation must abort obsolete data before committing the destination, then replace route-loading ownership for that destination.");


const baseSetPageStart = appCoreSource.indexOf("async function setPage(pageName, updateHash = true, options = {}) {");
const baseSetPageEnd = appCoreSource.indexOf("function updateStatusDate", baseSetPageStart);
const baseSetPage = appCoreSource.slice(baseSetPageStart, baseSetPageEnd);
assert.match(baseSetPage, /if \(!pageNavigationIsCurrent\(options\)\) return null;/, "Every page renderer must reject a stale owning navigation before mutating destination UI.");
const progressionAwait = baseSetPage.indexOf("const loaded = await ensureProgressionData();");
const progressionGuard = baseSetPage.indexOf("if (!pageNavigationIsCurrent(options)) return null;", progressionAwait);
const finalPageCommit = baseSetPage.indexOf("state.currentPage = pageName;", progressionGuard);
assert.ok(progressionAwait >= 0 && progressionGuard > progressionAwait && finalPageCommit > progressionGuard, "Table data completion must be rejected when a newer non-table navigation has won.");
const watchlistAwait = baseSetPage.indexOf("await ensureWatchlistRoute(options);");
const watchlistGuard = baseSetPage.indexOf("if (!pageNavigationIsCurrent(options)) return null;", watchlistAwait);
assert.ok(watchlistAwait >= 0 && watchlistGuard > watchlistAwait, "Watchlist route completion must be rejected after navigation supersession.");
const evaluationAwait = baseSetPage.indexOf("await renderEvaluationPage();");
const evaluationGuard = baseSetPage.indexOf("if (!pageNavigationIsCurrent(options)) return null;", evaluationAwait);
assert.ok(evaluationAwait >= 0 && evaluationGuard > evaluationAwait, "Non-table Evaluation completion must not reclaim UI after a table navigation wins.");
assert.doesNotMatch(appCoreSource, /setPageWithStableHome/, "Home must use the canonical page transition owner instead of a post-load wrapper that can reclaim stale UI.");
assert.doesNotMatch(appCoreSource, /requestAnimationFrame\(enforceHomePage\)/, "A completed stale Home load must never schedule a later page-shell reclaim.");

console.log("Lazy route gate stale-completion guard and latest-navigation loading supersession validation passed.");
