import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [bootstrap, bootstrapCore, controlInteractions, appCoreSource] = await Promise.all([
  read("./bootstrap.js"),
  read("./bootstrap-core.js"),
  read("./control-interactions-runtime.js"),
  read("./modules/app-core.js"),
]);

includes(
  bootstrap,
  'root.classList.add("mflSingleRenderPending");',
  "bootstrap.js must synchronously own first-paint loading state.",
);
includes(
  bootstrap,
  'root.classList.remove("mflInitialRouteResolved");',
  "First-paint route state must remain distinct until the visible route settles.",
);
includes(
  bootstrap,
  'const LOADING_VALUE_TEXT = "-";',
  "All first-paint data boxes must share the global dash loading placeholder.",
);
includes(
  bootstrap,
  'Reflect.set(window, "__mflLoadingValueText", LOADING_VALUE_TEXT);',
  "The loading-value placeholder must be published for route runtimes to reuse.",
);
includes(
  bootstrap,
  'Reflect.set(window, "__mflSetLoadingValue", setLoadingValue);',
  "Data-box loading state must have one shared setter instead of page-specific blank values.",
);
includes(
  bootstrap,
  'const BLANK_TABLE_LOADING_TEXT = "\\u00a0";',
  "Table-row loading skeletons must remain separate from data-box placeholders.",
);
includes(
  bootstrap,
  "cell.textContent = BLANK_TABLE_LOADING_TEXT;",
  "Table-row skeletons must keep their dedicated blank placeholder.",
);
excludes(
  bootstrap,
  "function setBlankLoadingValue(",
  "Bootstrap must not retain a competing blank data-box loading owner.",
);
includes(
  bootstrap,
  '<strong>${LOADING_VALUE_TEXT}</strong>',
  "Player loading cards must show the same global dash placeholder while data resolves.",
);
includes(
  bootstrap,
  "function primeInitialShell() {",
  "bootstrap.js must immediately select the destination shell.",
);
includes(
  bootstrap,
  "function primeTableChrome(page, urlLike = window.location.href, options = {}) {",
  "bootstrap.js must synchronously prime route-authoritative table title, view, quickfilters, and explicit page-reset state.",
);
includes(
  bootstrap,
  "function tableViewFromUrl(page, urlLike = window.location.href) {",
  "Bootstrap table chrome must derive the active view from the destination URL.",
);
includes(
  bootstrap,
  "function primeViewButtons(page, view) {",
  "First-paint view buttons must be updated directly in the DOM.",
);
includes(
  bootstrap,
  "container.insertBefore(button, switcher instanceof HTMLElement ? switcher : null);",
  "View order must be represented by DOM order instead of CSS order overrides.",
);
includes(
  bootstrap,
  'candidate.textContent = page === "club" ? "Squad" : "Attributes";',
  "Club Squad must use real button text instead of generated pseudo-content.",
);
includes(
  bootstrap,
  'Reflect.set(window, "__mflPrimeTableChrome", primeTableChrome);',
  "Runtime navigation must reuse the bootstrap-owned route-authoritative table chrome primer.",
);
includes(
  bootstrap,
  'Reflect.set(window, "__mflTableTitleForPageFallback", firstPaintTableTitle);',
  "Player-only startup must retain a shared table-title fallback.",
);
includes(
  bootstrap,
  "function primeInitialTableRows(replaceExisting = false) {",
  "bootstrap.js must seed table routes with five rows before data arrives.",
);
includes(
  bootstrap,
  "const opacities = [0.82, 0.62, 0.44, 0.27, 0.13];",
  "Initial table loading must retain exactly five blank rows.",
);
includes(
  bootstrap,
  "function primeRouteSkeleton(target) {",
  "Non-table routes must have an immediate static skeleton owner.",
);
includes(
  bootstrap,
  "function primePlayerSkeleton() {",
  "Player navigation must reveal structural boxes before player data resolves.",
);
includes(
  bootstrap,
  "function resetStatsShell(target) {",
  "Stats navigation must reset destination boxes before data resolves.",
);
includes(
  bootstrap,
  "function primeStaticButtonGroup(containerId, options, className, activeValue) {",
  "Deterministic route controls must have a reusable first-paint renderer.",
);
includes(
  bootstrap,
  'primeStaticButtonGroup("mflStatsOverallFilters", MFL_STATS_FILTER_LABELS, "mflStatsFilterButton", "all");',
  "MFL Stats overall filters must exist at their final size before its lazy runtime loads.",
);
includes(
  bootstrap,
  'primeStaticButtonGroup("settingsDateFormatOptions", SETTINGS_DATE_FORMAT_LABELS, "settingsToggleButton", "DMY");',
  "Settings date-format controls must exist before Settings data loads.",
);
includes(
  bootstrap,
  'primeStaticButtonGroup("settingsTimeFormatOptions", SETTINGS_TIME_FORMAT_LABELS, "settingsToggleButton", "24h");',
  "Settings time-format controls must exist before Settings data loads.",
);
includes(
  bootstrap,
  'if (target.id === "settingsPage") {',
  "Settings must participate in the same deterministic route-shell priming used by other pages.",
);
const mflStatsResetStart = bootstrap.indexOf('if (target.id === "mflStatsPage") {');
const mflStatsPrime = bootstrap.indexOf("primeMflStatsControls();", mflStatsResetStart);
const mflStatsValues = bootstrap.indexOf('["mflStatsTotalPlayers", "mflStatsPackablePlayers", "mflStatsAgedPlayers", "mflStatsOtherPlayers"]', mflStatsResetStart);
invariant(
  mflStatsResetStart >= 0 && mflStatsPrime > mflStatsResetStart && mflStatsValues > mflStatsPrime,
  "MFL Stats fixed controls must be committed before its loading values are reset.",
);
excludes(
  bootstrap,
  'document.createElement("style")',
  "First-paint bootstrap must not patch layout through injected styles.",
);
excludes(
  bootstrap,
  "!important",
  "First-paint bootstrap must not use CSS overrides.",
);

excludes(
  bootstrapCore,
  'document.documentElement.classList.add("mflSingleRenderPending", "mflInitialRouteResolved");',
  "bootstrap-core.js must not duplicate bootstrap.js first-paint ownership.",
);
includes(
  bootstrapCore,
  'document.documentElement.classList.remove("mflSingleRenderPending");',
  "bootstrap-core.js must release first-paint loading state when the visible route is ready.",
);
includes(
  bootstrapCore,
  'document.documentElement.classList.add("mflInitialRouteResolved");',
  "Runtime route ownership must begin only after the initial visible route settles.",
);
includes(
  bootstrapCore,
  "if (initialRouteFinished) return;",
  "Initial route cleanup must be idempotent across success and error paths.",
);
includes(
  bootstrapCore,
  'window.addEventListener("mfl:route-ready", finishInitialRoute, { once: true });',
  "Visible route readiness must be the primary initial loading release signal.",
);
includes(
  bootstrapCore,
  'if (document.documentElement.dataset.mflReady === "error")',
  "The bootstrap busy controller must observe actual startup failures.",
);
includes(
  bootstrapCore,
  "const recoverCompletedApplicationStartup = async () => {",
  "Post-core errors must be classified against the application startup promise.",
);
includes(
  bootstrapCore,
  "await appStartPromise;",
  "A post-core error must keep loading active until the application promise settles.",
);
excludes(
  bootstrapCore,
  "Promise.race([",
  "Post-core recovery must not use a short timeout that can misclassify slow successful loading.",
);
includes(
  bootstrapCore,
  'document.getElementById("mflStartupError")?.remove();',
  "A recovered post-core error must remove its false fatal message.",
);
includes(
  bootstrapCore,
  'const UNIFORM_LOADING_WORKFLOW_NAME = "Uniform Loading Workflow";',
  "The project-wide loading contract must have the canonical name Uniform Loading Workflow.",
);
includes(
  bootstrapCore,
  "window.__mflUniformLoadingWorkflow = window.__mflInteractionBusy;",
  "The canonical Uniform Loading Workflow name must point at the global loading controller rather than creating a competing owner.",
);
includes(
  bootstrapCore,
  'const ROUTE_LOADING_REASON = "route-loading";',
  "Refresh and in-app navigation must share one route-loading identity.",
);
includes(
  bootstrapCore,
  "const ROUTE_LOADING_ALIASES = new Set([",
  "Legacy route/data reasons must normalize into the same route-loading lifecycle.",
);
for (const reason of [
  "startup",
  "setPage",
  "route-runtime",
  "databaseStatsData",
  "mflStatsData",
  "evaluationRouteLoading",
]) {
  includes(
    bootstrapCore,
    `"${reason}"`,
    `Legacy loading reason ${reason} must remain classified as route loading.`,
  );
}
includes(
  bootstrapCore,
  "return ROUTE_LOADING_ALIASES.has(normalizedReason) ? ROUTE_LOADING_REASON : normalizedReason;",
  "All legacy route reasons must publish the canonical route-loading reason.",
);
for (const name of ["switchWatchlist", "ensureProgressionData"]) {
  excludes(
    bootstrapCore,
    `"${name}"`,
    `${name} must not retain a bootstrap blanket route-loading alias or wrapper after Step 3 consolidation.`,
  );
}
includes(
  bootstrapCore,
  "function routeDestinationReady(pageName, options = {}) {",
  "The Uniform Loading Workflow must own one full destination-readiness predicate.",
);
includes(
  bootstrapCore,
  "wrapRoutePageGlobal();",
  "Page transitions must install the readiness-aware setPage loading owner.",
);
includes(
  bootstrapCore,
  "if (routeDestinationReady(pageName, options) || routeLoadingActive()) {",
  "Fully ready page destinations and nested page transitions must bypass duplicate route loading.",
);
includes(
  appCoreSource,
  "function switchWatchlist(watchlistId) {",
  "Direct Watchlist switching must remain source-owned after blanket loading removal.",
);
includes(
  appCoreSource,
  "const loaded = await ensureProgressionData();",
  "The legacy full-data fallback must remain enclosed by canonical setPage ownership.",
);
excludes(
  bootstrapCore,
  '"requestIncrementalRoute",',
  "Incremental route requests must not receive a blanket outer route-loading wrapper.",
);
excludes(
  bootstrapCore,
  '"setView",',
  "View transitions must not receive a blanket outer route-loading wrapper.",
);
includes(
  bootstrapCore,
  "const wrappedWithInteractionBusy = (callback, reason = ROUTE_LOADING_REASON) => {",
  "Legacy uncached route/data loads must default to the non-blocking route-loading lifecycle.",
);
includes(
  bootstrapCore,
  'window.__mflWithInteractionBusy = (callback) => run(callback, "interaction-loading");',
  "The explicit operation-busy helper must retain exclusive interaction-loading ownership.",
);
includes(
  bootstrapCore,
  "if (normalizedReason === ROUTE_LOADING_REASON && routeLoadingActive()) return callback();",
  "Nested canonical route-loading owners must reuse the active page-transition lifecycle instead of stacking tokens.",
);
includes(
  bootstrapCore,
  "return run(callback, normalizedReason);",
  "Non-duplicate explicit loading reasons must still enter the shared busy controller.",
);
includes(
  appCoreSource,
  "if (incrementalRouteIsCached(route, 1)) return loadAndRender();",
  "Cached incremental route requests must bypass the busy boundary.",
);
includes(
  appCoreSource,
  'return withInteractionBusy(loadAndRender, Reflect.get(window, "__mflInteractionBusy")?.reason);',
  "Uncached incremental route requests and table view transitions must enter the controller-owned route-loading reason.",
);
includes(
  appCoreSource,
  "if (!dataRoute || incrementalRouteIsCached(dataRoute, 1)) {",
  "Cached Club view transitions must bypass route loading.",
);
includes(
  appCoreSource,
  'await withInteractionBusy(loadClubData, Reflect.get(window, "__mflInteractionBusy")?.reason);',
  "Uncached Club view transitions must enter the controller-owned route-loading reason.",
);
includes(
  bootstrapCore,
  "if (normalizedReason === ROUTE_LOADING_REASON) await waitForRoutePaint();",
  "Route loading must remain active until the destination has crossed the shared final-paint boundary.",
);
includes(
  bootstrapCore,
  'Object.defineProperty(wrapped, "__mflInteractionBusyOriginal", { value: original });',
  "Uniform Loading Workflow wrappers must expose their immutable delegate so route-specific runtimes can detect an already-wrapped owner without recursively wrapping it.",
);
includes(
  bootstrapCore,
  "const subscribers = new Set();",
  "Uniform Loading Workflow must publish state directly to loading consumers.",
);
includes(
  bootstrapCore,
  "function subscribe(callback, options = {}) {",
  "Loading consumers must subscribe to the controller instead of observing DOM state.",
);
includes(
  bootstrapCore,
  'window.dispatchEvent(new CustomEvent("mfl:loading-state", { detail: snapshot }));',
  "Uniform Loading Workflow must expose one explicit loading-state event for decoupled consumers.",
);
includes(
  bootstrapCore,
  "snapshot: () => currentSnapshot,",
  "Loading consumers must be able to read the canonical immutable state snapshot.",
);
excludes(
  bootstrapCore,
  'document.createElement("style")',
  "The loading controller must not inject runtime CSS.",
);
excludes(
  bootstrapCore,
  "window.__mflTableLoadingRuntime?.sync?.();",
  "The loading controller must notify subscribers rather than directly repairing table presentation.",
);
excludes(
  bootstrapCore,
  "!important",
  "The bootstrap busy controller must not depend on CSS priority overrides.",
);

includes(
  bootstrapCore,
  'const UNIFORM_NAVIGATION_WORKFLOW_NAME = "Uniform Navigation Workflow";',
  "Navigation must have one named project-wide workflow.",
);
includes(
  bootstrapCore,
  "function createNavigationController() {",
  "bootstrap-core.js must own the navigation-intent state machine.",
);
includes(
  bootstrapCore,
  '"#sidebar .navButton[data-page]:not(.active)"',
  "The shared navigation owner must classify page-navigation controls.",
);
includes(
  bootstrapCore,
  '".viewButton[data-view]:not(.active)"',
  "The shared navigation owner must classify view-navigation controls.",
);
includes(
  bootstrapCore,
  'document.documentElement.classList.toggle(PENDING_CLASS, activeTokens.size > 0);',
  "Only the shared navigation owner may publish navigation-pending state.",
);
includes(
  bootstrapCore,
  "window.__mflNavigation = createNavigationController();",
  "The canonical navigation controller must be published before application runtimes execute.",
);
includes(
  bootstrapCore,
  "window.__mflUniformNavigationWorkflow = window.__mflNavigation;",
  "The canonical Uniform Navigation Workflow name must point at the shared navigation controller.",
);

includes(
  controlInteractions,
  "const controller = window.__mflNavigation;",
  "Control interactions must delegate navigation classification to the shared controller.",
);
includes(
  controlInteractions,
  'navigationController()?.beginIntent?.(target, "control-intent")',
  "Pointer/click intent must begin through the shared navigation controller.",
);
includes(
  controlInteractions,
  "navigationController()?.handoff?.(token);",
  "Control intent must hand off to the generated transition owner through the shared controller.",
);
excludes(
  controlInteractions,
  'const NAVIGATION_PENDING_CLASS = "mflNavigationPending";',
  "Control interactions must not own the navigation-pending class.",
);
excludes(
  controlInteractions,
  'document.documentElement.classList.add(NAVIGATION_PENDING_CLASS);',
  "Control interactions must not mutate navigation state directly.",
);
excludes(
  controlInteractions,
  'document.querySelectorAll("#progressionPage nav.pager")',
  "Control interactions must not own pager visibility or snapshot state.",
);
excludes(
  controlInteractions,
  '"#sidebar .navButton[data-page]:not(.active)"',
  "Control interactions must not duplicate shared navigation selectors.",
);

includes(
  appCoreSource,
  'navigation.begin("page-transition")',
  "Canonical page transitions must acquire the shared navigation lifecycle.",
);
includes(
  appCoreSource,
  'navigation.begin("view-transition")',
  "Canonical view transitions must acquire the shared navigation lifecycle.",
);
includes(
  appCoreSource,
  "return typeof loader === \"function\" ? await loader(transition) : transition;",
  "Page transition navigation state must remain active until its owned loader settles.",
);
includes(
  appCoreSource,
  "if (navigationToken) navigation?.end?.(navigationToken);",
  "Canonical transitions must release shared navigation state in finally blocks.",
);

console.log("Bootstrap first-paint shells, route-ready canonical loading state, and canonical navigation lifecycle ownership validation passed.");