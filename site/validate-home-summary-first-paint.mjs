import { readFile } from "node:fs/promises";
import vm from "node:vm";

import { browserConfigRuntimeSource } from "./modules/app-config.js";
import { normalizeBuiltApplicationCoreArtifacts } from "./modules/app-core-build-normalizer.js";
import { normalizePreBootstrapRouteState } from "./modules/pre-bootstrap-route-state.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);
const occurrences = (source, value) => source.split(value).length - 1;

const [indexHtml, stylesBase, bootstrapRuntime, staticUiRuntime, loadingToastRuntime, coreSource, releaseJson] = await Promise.all([
  read("./index.html"),
  read("./styles-base.css"),
  read("./bootstrap.js"),
  read("./static-ui-runtime.js"),
  read("./loading-toast-runtime.js"),
  read("./modules/app-core.js"),
  read("./release.json"),
]);
const release = JSON.parse(releaseJson);
const preBootstrap = normalizePreBootstrapRouteState(browserConfigRuntimeSource(release));
const artifacts = normalizeBuiltApplicationCoreArtifacts(coreSource);
const eagerCore = String(artifacts.core || "");
const homeCore = String(artifacts.routeChunks?.home || "");
new Function(eagerCore);
new Function(homeCore);

for (const placeholder of [
  '<span id="totalPlayers">-</span>',
  '<span id="totalWallets">-</span>',
  '<span id="homePlayers">-</span>',
  '<span id="homeWallets">-</span>',
]) {
  includes(indexHtml, placeholder, `Home/header summary placeholder must remain static: ${placeholder}`);
}

includes(stylesBase, 'body[data-page="home"] .topbar .stats', "The canonical header summary visibility rule must remain Home-owned.");
includes(preBootstrap, "const initialRoute = routes.initialRequest(location.pathname);", "Pre-bootstrap runtime must resolve the real initial route before hydration.");
includes(preBootstrap, 'if (typeof document !== "undefined" && document.body) document.body.dataset.page = initialRoute.pageName;', "Pre-bootstrap runtime must commit the real initial route to body[data-page].");
invariant(
  preBootstrap.indexOf("document.body.dataset.page = initialRoute.pageName;")
    < preBootstrap.indexOf('const initialPath = String(location.pathname || "/").split(/[?#]/, 1)[0] || "/";'),
  "Initial body route state must be committed before canonical URL replacement or route-specific bootstrap work.",
);
includes(indexHtml, 'html:not(.mflInitialRouteResolved):not([data-initial-page="home"]) #homePage,', "Every non-Home direct URL must suppress default Home boxes before hydration.");
includes(indexHtml, 'body[data-page="notfound"] main > .pageView:not(#notFoundPage)', "Typed not-found routes must suppress previously primed pages.");
includes(indexHtml, 'root.dataset.initialEntityRoute = initialEntityRoute;', "Direct entity URLs must publish an early identity guard.");
includes(indexHtml, 'data-initial-entity-route="club"]:not([data-initial-entity-verified="club"]) #progressionPage', "Direct Club URLs must hide the table shell until identity verification.");
includes(indexHtml, 'data-initial-entity-route="player"]:not([data-initial-entity-verified="player"]) #playerPage', "Direct Player URLs must hide the Player shell until identity verification.");

includes(bootstrapRuntime, 'setLoadingValue("homePlayers");', "Home priming must retain the Players tracked loading placeholder.");
includes(bootstrapRuntime, 'setLoadingValue("homeWallets");', "Home priming must retain the Wallets tracked loading placeholder.");
includes(staticUiRuntime, 'const prime = Reflect.get(window, "__mflPrimeRouteSkeleton");', "Shared navigation must keep using the canonical route-skeleton primer.");
includes(staticUiRuntime, 'if (typeof prime === "function") prime(target);', "Home navigation must prime its destination shell before data ownership resumes.");

for (const value of [
  "let summaryLoadPromise = null;",
  "let summaryLoaded = false;",
  "let summarySnapshot = null;",
  "function homeSummaryCacheReadyOwner() {",
  "async function homeLoadSummaryOwner() {",
  "if (summaryLoaded && summarySnapshot) {",
  "updateSummaryCounts(summarySnapshot.playerCount, summarySnapshot.walletCount);",
  "if (summaryLoadPromise) return summaryLoadPromise;",
]) {
  includes(homeCore, value, `Home summary lazy core is missing ${value}`);
  excludes(eagerCore, value, `Home summary implementation must not remain eager: ${value}`);
}
includes(homeCore, "function updateSummaryCounts(playerCount, walletCount) {", "Home count rendering must live with the lazy Home summary owner.");
invariant(occurrences(homeCore, 'fetch("/api/data?mode=bootstrap"') === 1, "The Home chunk must keep exactly one database-summary fetch owner.");
invariant(occurrences(eagerCore, 'fetch("/api/data?mode=bootstrap"') === 0, "The eager core must not fetch Home summary data directly.");

includes(eagerCore, "function homeSummaryCacheReady() {", "The eager core must keep a small Home cache-readiness facade.");
includes(eagerCore, "async function loadSummary() {", "The eager core must keep the stable Home summary facade used by navigation.");
includes(eagerCore, 'await window.__mflEnsureRouteCore("home");', "The Home summary facade must lazy-load its canonical chunk.");
includes(eagerCore, 'Reflect.set(globalThis, "__mflHomeSummaryCache", Object.freeze({', "Shared runtimes must retain the Home summary readiness contract.");
includes(eagerCore, "isReady: homeSummaryCacheReady,", "The Home cache contract must expose readiness through the shared facade.");
includes(eagerCore, 'Reflect.set(globalThis, "__mflRouteDataCache", Object.freeze({', "All route data owners must expose one shared cache-readiness contract.");
includes(eagerCore, "isCurrentRouteReady: currentRouteDataCacheReady,", "Loading UI must be able to query whether the committed destination is cached.");
includes(eagerCore, 'return route.scope === "empty" || incrementalRouteIsCached(route, 1);', "Incremental routes must reuse the canonical payload-cache predicate.");
includes(eagerCore, "function databaseStatsDataCacheReady() {", "Database Stats must participate in route cache readiness.");
includes(eagerCore, "function settingsDataCacheReady() {", "Settings must participate in route cache readiness.");
includes(eagerCore, 'if (pageName === "home") void loadSummary();', "Every Home navigation must ensure its summary facade runs.");
includes(eagerCore, 'brandLinks.forEach((link) => {', "The brand link must continue using shared navigation.");
includes(eagerCore, 'setPage("home");', "The brand link must navigate through the Home owner.");

includes(loadingToastRuntime, 'const ROUTE_LOADING_REASON = "route-loading";', "Loading toast coordination must identify route-only loading snapshots.");
includes(loadingToastRuntime, 'const cache = Reflect.get(window, "__mflRouteDataCache");', "Loading toast must consume the shared route-data cache contract.");
includes(loadingToastRuntime, 'if (routeOnlySnapshot(snapshot) && currentRouteDataCacheReady()) {', "A fully cached destination must suppress the Loading toast.");
includes(loadingToastRuntime, "let remainingFrames = 3;", "Toast eligibility must be checked after route-specific state commits.");
excludes(loadingToastRuntime, "HOME_NAVIGATION_SELECTOR", "Cached-route toast suppression must not depend on Home-specific controls.");
excludes(loadingToastRuntime, "cachedHomeNavigationIntent", "Cached-route toast suppression must not retain the retired Home-only state.");

let fetchCount = 0;
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
  totalPlayers: { textContent: "-" },
  totalWallets: { textContent: "-" },
  homePlayers: { textContent: "-" },
  homeWallets: { textContent: "-" },
  formatCount: (value) => String(value),
  updateStatusDate: () => {},
  console: { error: () => {} },
};
vm.runInNewContext(
  `let __mflHomeSummaryCacheReadyOwner = null;\nlet __mflHomeLoadSummaryOwner = null;\n${homeCore}\nthis.__ready = __mflHomeSummaryCacheReadyOwner;\nthis.__load = __mflHomeLoadSummaryOwner;`,
  context,
);
invariant(context.__ready?.() === false, "Home summary cache readiness must be false before the first successful load.");
await context.__load();
invariant(fetchCount === 1, "Initial Home summary load must fetch exactly once.");
invariant(context.homePlayers.textContent === "321" && context.homeWallets.textContent === "87", "Initial Home summary load must render fetched counts.");
invariant(context.__ready?.() === true, "Home summary cache readiness must become true after a successful load.");

context.homePlayers.textContent = "-";
context.homeWallets.textContent = "-";
await context.__load();
invariant(fetchCount === 1, "Returning Home after a successful summary load must not fetch again.");
invariant(context.homePlayers.textContent === "321" && context.homeWallets.textContent === "87", "Returning Home must repaint cached counts after route priming resets placeholders.");

console.log("Home first-paint validation passed with summary fetch/cache/repaint behavior owned by the lazy Home core and stable readiness facades retained eagerly.");
