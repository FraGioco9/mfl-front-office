import { invariant, includes } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";
import vm from "node:vm";

import { browserConfigRuntimeSource } from "./modules/app-config.js";
import { readCanonicalCoreArtifacts } from "./validate-core-sources.mjs";
import { normalizePreBootstrapRouteState } from "./modules/pre-bootstrap-route-state.js";

const read = (path) => readValidationText(path, import.meta.url);
const occurrences = (source, value) => source.split(value).length - 1;

const [indexHtml, stylesBase, bootstrapRuntime, staticUiRuntime, coreSource, releaseJson] = await Promise.all([
  read("./index.html"),
  read("./styles-base.css"),
  read("./bootstrap.js"),
  read("./static-ui-runtime.js"),
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
  read("./release.json"),
]);
const release = JSON.parse(releaseJson);
const preBootstrap = normalizePreBootstrapRouteState(browserConfigRuntimeSource(release));
const eagerCore = String(readCanonicalCoreArtifacts(coreSource).core || "");

for (const required of [
  "let summaryLoadPromise = null;",
  "let summaryLoaded = false;",
  "let summarySnapshot = null;",
  "function homeSummaryCacheReady() {",
  'Reflect.set(globalThis, "__mflHomeSummaryCache", Object.freeze({',
  "function routeDataCacheReady(pageName, options = {}) {",
  'Reflect.set(globalThis, "__mflRouteDataCache", Object.freeze({',
  'if (pageName === "home") void loadSummary();',
]) {
  includes(coreSource, required, `Canonical app-core must own Home summary/cache lifecycle through ${required}`);
}
for (const retiredOwner of [
  "normalizeHomeSummaryLifecycle",
  "homeSummaryArtifacts",
  "normalizeGlobalSearchOpenLifecycle",
  "globalSearchArtifacts",
  "normalizeEvaluationRecentReadiness",
  "evaluationRecentArtifacts",
  "normalizeEvaluationLoadLifecycle",
  "evaluationLoadArtifacts",
  "normalizeEvaluationSavedValuationCache",
  "app-core-build-normalizer",
]) {
  invariant(!coreSource.includes(retiredOwner), `Canonical Home summary source must not depend on retired build ownership: ${retiredOwner}`);
}

includes(indexHtml, '<span id="totalPlayers">-</span>', "Header Players must exist statically with '-' before summary data loads.");
includes(indexHtml, '<span id="totalWallets">-</span>', "Header Wallets must exist statically with '-' before summary data loads.");
includes(indexHtml, '<span id="homePlayers">-</span>', "Home Players tracked must exist statically with '-' before summary data loads.");
includes(indexHtml, '<span id="homeWallets">-</span>', "Home Wallets tracked must exist statically with '-' before summary data loads.");
includes(stylesBase, 'body[data-page="home"] .topbar .stats', "The canonical header summary visibility rule must remain Home-owned.");
includes(preBootstrap, "const initialRoute = routes.initialRequest(location.pathname);", "Pre-bootstrap runtime must resolve the real initial route before hydration.");
includes(preBootstrap, 'if (typeof document !== "undefined" && document.body) document.body.dataset.page = initialRoute.pageName;', "Pre-bootstrap runtime must commit the real initial route to body[data-page] when a DOM is available.");
invariant(
  preBootstrap.indexOf("document.body.dataset.page = initialRoute.pageName;")
    < preBootstrap.indexOf('const initialPath = String(location.pathname || "/").split(/[?#]/, 1)[0] || "/";'),
  "Initial body route state must be committed before canonical URL replacement or route-specific bootstrap work.",
);
includes(indexHtml, 'html:not(.mflInitialRouteResolved):not([data-initial-page="home"]) #homePage,', "Every non-Home direct URL must suppress the default Home boxes before route hydration.");
includes(indexHtml, 'body[data-page="notfound"] main > .pageView:not(#notFoundPage)', "A typed not-found route must suppress every previously primed application page.");
includes(indexHtml, 'root.dataset.initialEntityRoute = initialEntityRoute;', "Direct entity URLs must publish an early first-paint identity guard.");
includes(indexHtml, 'data-initial-entity-route="club"]:not([data-initial-entity-verified="club"]) #progressionPage', "A direct Club URL must not reveal the table shell before the Club identity is confirmed.");
includes(indexHtml, 'data-initial-entity-route="player"]:not([data-initial-entity-verified="player"]) #playerPage', "A direct Player URL must not reveal the Player shell before the Player identity is confirmed.");

includes(bootstrapRuntime, 'setLoadingValue("homePlayers");', "Home route priming must retain the Players tracked loading placeholder.");
includes(bootstrapRuntime, 'setLoadingValue("homeWallets");', "Home route priming must retain the Wallets tracked loading placeholder.");
includes(staticUiRuntime, 'const prime = Reflect.get(window, "__mflPrimeRouteSkeleton");', "Shared navigation must continue using the canonical route-skeleton primer.");
includes(staticUiRuntime, 'if (typeof prime === "function") prime(target);', "Home navigation must still prime its destination shell before data ownership resumes.");

for (const required of [
  "let summaryLoadPromise = null;",
  "let summaryLoaded = false;",
  "let summarySnapshot = null;",
  "function homeSummaryCacheReady() {",
  'Reflect.set(globalThis, "__mflHomeSummaryCache", Object.freeze({',
  "isReady: homeSummaryCacheReady,",
  'Reflect.set(globalThis, "__mflRouteDataCache", Object.freeze({',
  "isCurrentRouteReady: currentRouteDataCacheReady,",
  'return route.scope === "empty" || incrementalRouteIsCached(route, 1);',
  "function databaseStatsDataCacheReady() {",
  "function settingsDataCacheReady() {",
  "if (summaryLoaded && summarySnapshot) {",
  "updateSummaryCounts(summarySnapshot.playerCount, summarySnapshot.walletCount);",
  "if (summaryLoadPromise) return summaryLoadPromise;",
  'if (pageName === "home") void loadSummary();',
  'brandLinks.forEach((link) => {',
  'setPage("home");',
]) {
  includes(eagerCore, required, `Canonical shared Home summary owner is missing ${required}`);
}
invariant(occurrences(eagerCore, 'fetch("/api/data?mode=bootstrap"') === 1, "The canonical shared core must keep exactly one database-summary fetch owner.");

const loaderStart = eagerCore.indexOf("let summaryLoadPromise = null;");
const loaderEnd = eagerCore.indexOf("\nfunction tablePageKey", loaderStart);
invariant(loaderStart >= 0 && loaderEnd > loaderStart, "Could not isolate the canonical Home summary loader for behavioral validation.");
const loaderSource = eagerCore.slice(loaderStart, loaderEnd);
let fetchCount = 0;
const updates = [];
const context = {
  fetch: async () => {
    fetchCount += 1;
    return {
      ok: true,
      json: async () => ({
        manifest: { version: "test" },
        summary: {
          playerCount: 321,
          walletCount: 87,
          generatedAt: "2026-08-21T12:00:00.000Z",
        },
      }),
    };
  },
  state: {},
  updateSummaryCounts: (players, wallets) => updates.push([players, wallets]),
  updateStatusDate: () => {},
  console: { error: () => {} },
};
vm.runInNewContext(`${loaderSource}\nthis.__loadSummary = loadSummary;`, context);
invariant(context.__mflHomeSummaryCache?.isReady?.() === false, "Home summary cache readiness must remain false before the first successful load.");
await context.__loadSummary();
invariant(fetchCount === 1, "Initial Home summary load must fetch exactly once.");
invariant(updates.length === 1 && updates[0][0] === 321 && updates[0][1] === 87, "Initial Home summary load must render the fetched Players/Wallets counts.");
invariant(context.__mflHomeSummaryCache?.isReady?.() === true, "Home summary cache readiness must become true after a successful load.");

updates.length = 0;
await context.__loadSummary();
invariant(fetchCount === 1, "Returning Home after a successful summary load must not fetch again.");
invariant(updates.length === 1 && updates[0][0] === 321 && updates[0][1] === 87, "Returning Home must repaint cached Players/Wallets counts after route priming reset them to '-'.");

console.log("Source-owned Home and deep-link first-paint validation passed: non-Home routes never expose Home boxes, entity shells wait for verification, and cached Home counts repaint without refetching.");
