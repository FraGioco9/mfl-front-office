import assert from "node:assert/strict";
import fs from "node:fs";

const appCoreSource = fs.readFileSync("modules/app-core.js", "utf8");
const routeSetPageAssignmentIndex = appCoreSource.indexOf("setPage = routeRuntimeSetPage;");
const routeSetPageSection = routeSetPageAssignmentIndex >= 0
  ? appCoreSource.slice(appCoreSource.lastIndexOf(";(() => {", routeSetPageAssignmentIndex), routeSetPageAssignmentIndex + "setPage = routeRuntimeSetPage;".length)
  : "";
assert.ok(routeSetPageAssignmentIndex >= 0, "Could not locate the lazy setPage route gate.");
assert.match(routeSetPageSection, /const stagedTransition = incomingOptions\.skipNavigationTransition === true[\s\S]*?pendingViewTransition/, "Skip-transition view loads must retain their staged transition identity through lazy runtime loading.");
assert.match(routeSetPageSection, /const loadCommittedRoute = async \(transition = stagedTransition\) => \{/, "The lazy route gate must receive the owning page/view transition.");
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

console.log("Lazy route gate stale-completion guard and latest-navigation loading supersession validation passed.");
