import assert from "node:assert/strict";

import { readCombinedCanonicalCoreSource } from "./validate-core-sources.mjs";

const appCoreSource = readCombinedCanonicalCoreSource();
const routeSetPageStart = appCoreSource.indexOf("async function setPageWithRouteRuntime(pageName, updateHash = true, options = {}) {");
const routeSetPageEnd = appCoreSource.indexOf('Reflect.set(window, "__mflSetPageRouteOwner", setPageWithRouteRuntime);', routeSetPageStart);
const routeSetPageSection = routeSetPageStart >= 0 && routeSetPageEnd > routeSetPageStart
  ? appCoreSource.slice(routeSetPageStart, routeSetPageEnd)
  : "";
assert.ok(routeSetPageStart >= 0 && routeSetPageEnd > routeSetPageStart, "Could not locate the named lazy setPage route gate.");
assert.doesNotMatch(appCoreSource, /setPage = routeRuntimeSetPage/, "The lazy route gate must not replace the stable public setPage function.");
assert.match(routeSetPageSection, /const featureOwnerBeforeRuntime = Reflect\.get\(window, "__mflSetPageFeatureOwner"\);[\s\S]*?const featureOwnerAfterRuntime = Reflect\.get\(window, "__mflSetPageFeatureOwner"\);/, "Lazy route loading must detect a feature owner installed during runtime hydration without replacing setPage.");
assert.match(routeSetPageSection, /featureOwnerAfterRuntime\.call\(this, pageName, updateHash,[\s\S]*?__mflRouteRuntimeReady: true/, "A feature owner installed during lazy loading must receive the in-flight navigation exactly through the runtime-ready handoff.");
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


const baseSetPageStart = appCoreSource.indexOf("async function renderPage(pageName, updateHash = true, options = {}) {");
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
const agentTitleAwait = baseSetPage.indexOf("await agentTitleReady;");
const agentTitleGuard = baseSetPage.indexOf("if (!pageNavigationIsCurrent(options)) return null;", agentTitleAwait);
assert.ok(agentTitleAwait >= 0 && agentTitleGuard > agentTitleAwait, "A superseded Agent title lookup must not resume destination rendering.");
const settingsPaintAwait = baseSetPage.indexOf("await waitForViewTransitionPaint();");
const settingsPaintGuard = baseSetPage.indexOf("if (!pageNavigationIsCurrent(options)) return null;", settingsPaintAwait);
const settingsPrepareAwait = baseSetPage.indexOf("await settingsPrepareCommittedForEntry();");
const settingsPrepareGuard = baseSetPage.indexOf("if (!pageNavigationIsCurrent(options)) return null;", settingsPrepareAwait);
assert.ok(settingsPaintAwait >= 0 && settingsPaintGuard > settingsPaintAwait && settingsPrepareAwait > settingsPaintGuard && settingsPrepareGuard > settingsPrepareAwait, "Settings must re-check navigation ownership after both async entry handoffs.");
const mflStatsRender = baseSetPage.indexOf("renderMflStatsPage();");
const mflStatsLoadingAwait = baseSetPage.indexOf("await finishLoading();", mflStatsRender);
const mflStatsLoadingGuard = baseSetPage.indexOf("if (!pageNavigationIsCurrent(options)) return null;", mflStatsLoadingAwait);
assert.ok(mflStatsRender >= 0 && mflStatsLoadingAwait > mflStatsRender && mflStatsLoadingGuard > mflStatsLoadingAwait, "MFL Stats must not finalize after a newer page navigation wins during loading completion.");
const incrementalRendererStart = appCoreSource.indexOf("async function renderLoadedIncrementalRoute(pageName, updateHash, options, route, requestOptions = {})");
const incrementalRendererOwnerCheck = appCoreSource.indexOf("return pageNavigationIsCurrent(options) ? result : false;", incrementalRendererStart);
assert.ok(incrementalRendererStart >= 0 && incrementalRendererOwnerCheck > incrementalRendererStart, "Incremental rendering must verify navigation ownership again after the base page renderer settles.");

const incrementalSetPageStart = appCoreSource.indexOf("const setIncrementalPage = async function setIncrementalPage(pageName, updateHash = true, options = {}) {");
const incrementalSetPageEnd = appCoreSource.indexOf("const loadIncrementalRoutePage = async function loadIncrementalRoutePage", incrementalSetPageStart);
const incrementalSetPage = appCoreSource.slice(incrementalSetPageStart, incrementalSetPageEnd);
assert.match(incrementalSetPage, /return runPageTransition\(pageName, navigationUpdatesHistory, options, \(navigationTransition\) => setPage\(pageName, false, \{/, "Incremental page loading must remain inside the winning route transition until its async load settles.");
assert.match(incrementalSetPage, /skipNavigationTransition: true,[\s\S]*?__mflNavigationTransition: navigationTransition,[\s\S]*?__mflNavigationUpdatesHistory: navigationUpdatesHistory/, "The recursive incremental load must retain transition identity and original history ownership without starting another transition.");
assert.match(incrementalSetPage, /const navigationTransition = options\.__mflNavigationTransition \|\| null;/, "Incremental page navigation must retain its owning transition identity.");
assert.match(incrementalSetPage, /const navigationOptions = navigationTransition[\s\S]*?__mflNavigationTransition: navigationTransition/, "Incremental page navigation must propagate its owning transition to downstream renderers.");
assert.match(incrementalSetPage, /renderLoadedIncrementalRoute\.call\(this, pageName, updateHash, navigationOptions, route,/, "Incremental route completion must render with the current navigation identity.");
const incrementalRequestStart = appCoreSource.indexOf("async function requestIncrementalRoute(route, page = 1, options = {}) {");
const incrementalRequestEnd = appCoreSource.indexOf("async function withInteractionBusy", incrementalRequestStart);
const incrementalRequest = appCoreSource.slice(incrementalRequestStart, incrementalRequestEnd);
assert.match(incrementalRequest, /const navigationRequestIsCurrent = \(\) => !navigationTransition \|\| navigationTransitionIsCurrent\(navigationTransition\);/, "Incremental payload application must understand page/view transition supersession.");
assert.match(incrementalRequest, /!incrementalRouteRequestIsCurrent\(generation\) \|\| !navigationRequestIsCurrent\(\)/, "A stale navigation must be rejected before cached or network payload application.");
assert.doesNotMatch(appCoreSource, /setPageWithStableHome/, "Home must use the canonical page transition owner instead of a post-load wrapper that can reclaim stale UI.");
assert.doesNotMatch(appCoreSource, /requestAnimationFrame\(enforceHomePage\)/, "A completed stale Home load must never schedule a later page-shell reclaim.");

console.log("Lazy route gate stale-completion guard and latest-navigation loading supersession validation passed.");
