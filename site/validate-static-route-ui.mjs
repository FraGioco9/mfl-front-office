import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [
  indexHtml,
  bootstrap,
  staticUi,
  tableLoading,
  controlInteractions,
  databaseStatsState,
  entry,
  coreSource,
  styles,
  dropdowns,
] = await Promise.all([
  read("./index.html"),
  read("./bootstrap.js"),
  read("./static-ui-runtime.js"),
  read("./table-loading-runtime.js"),
  read("./control-interactions-runtime.js"),
  read("./database-stats-state-runtime.js"),
  read("./modules/app-entry.js"),
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
  read("./styles.css"),
  read("./dropdowns.css"),
]);

includes(indexHtml, "window.__mflTableViewConfig = TABLE_VIEW_CONFIG;", "First-paint table view configuration must be exposed to runtime chrome ownership.");
includes(indexHtml, 'data-initial-table-page="agents"] #sidebar .navButton[data-page="agents"]', "Agents must expose its active sidebar state during table-route first paint.");
includes(indexHtml, 'data-initial-table-page="club"] #sidebar .navButton[data-page="club"]', "Club first paint must support active sidebar state when a matching navigation control exists.");
excludes(indexHtml, ') #sidebar .navButton[data-page]:not(:hover) {', "Table first paint must not neutralize sidebar controls with a selector more specific than the active-route selector.");
includes(indexHtml, 'html[data-initial-page="evaluation"]:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded) #evaluationPage', "Evaluation refresh-only visibility must stop as soon as a newer navigation owns the shell.");
includes(indexHtml, 'html[data-initial-page="evaluation"]:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded) #homePage', "Evaluation refresh-only Home hiding must stop with the same supersession boundary.");
includes(indexHtml, 'html[data-initial-page="database/stats"]:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded) #databaseStatsPage', "Database Stats first-paint visibility must relinquish the shell as soon as live navigation supersedes refresh startup.");
includes(indexHtml, 'html[data-initial-page="mfl/stats"]:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded) #mflStatsPage', "MFL Stats first-paint visibility must use the same supersession boundary as Database Stats.");
includes(indexHtml, ') #myPlayersLockedPage {\n        display: grid;\n        place-items: center;\n      }', "Opted-out protected routes must use the final centered locked-page grid at first paint.");
excludes(indexHtml, ') #myPlayersLockedPage {\n        display: block;', "Opted-out protected routes must never start in normal block flow before the locked-page grid takes ownership.");
includes(indexHtml, 'root.dataset.initialLockedPage = initialLockedPage;', "Opted-out first paint must preserve the requested protected-route identity before runtime hydration.");
includes(indexHtml, 'watchlist: ["Watchlist", "In order to use the watchlist, you need to opt in."]', "Watchlist must render Watchlist-specific opt-out copy at first paint.");
includes(indexHtml, 'settings: ["Settings", "In order to view settings, you need to opt in."]', "Settings must render Settings-specific opt-out copy at first paint.");
const setPageStart = coreSource.indexOf('async function setPage(pageName, updateHash = true, options = {}) {');
invariant(setPageStart >= 0, "Canonical setPage must exist for opted-out route validation.");
const lockedRouteDecision = coreSource.indexOf('const lockedOptOutRoute = (pageName === "myplayers" || pageName === "watchlist" || pageName === "settings") && !hasWalletOptIn();', setPageStart);
const lockedRouteGuard = coreSource.indexOf('if (lockedOptOutRoute) {', lockedRouteDecision);
const guardedReplace = coreSource.indexOf('if (!lockedOptOutRoute && options.replaceUrl', lockedRouteDecision);
const guardedUpdate = coreSource.indexOf('if (!lockedOptOutRoute) {\n    updatePageUrl(pageName', lockedRouteDecision);
invariant(lockedRouteDecision > setPageStart && lockedRouteGuard > lockedRouteDecision && guardedReplace > lockedRouteDecision && guardedUpdate > lockedRouteDecision, "Opted-out protected routes must preserve the requested refresh URL and reuse one scoped setPage lock decision.");
const optOutStart = coreSource.indexOf("function optOutWallet() {");
const optOutEnd = optOutStart >= 0 ? coreSource.indexOf("\nfunction ", optOutStart + "function optOutWallet".length) : -1;
invariant(optOutStart >= 0 && optOutEnd > optOutStart, "Wallet opt-out transition owner must remain in canonical app core.");
const optOutSource = coreSource.slice(optOutStart, optOutEnd);
includes(optOutSource, 'const routeAtOptOut = pageTargetFromPath(`${window.location.pathname}${window.location.search}`);', "Wallet opt-out must capture the live URL route before clearing wallet identity.");
includes(optOutSource, 'const protectedRouteAtOptOut = ["myplayers", "watchlist", "settings"].includes(routeAtOptOut.pageName)', "Protected-page opt-out must derive locked-page identity from the live route rather than stale page state.");
includes(optOutSource, 'setPage(lockedPage, false, { ...lockedOptions, preserveScroll: true });', "Protected-page opt-out must immediately render the locked shell for the routed page.");
excludes(optOutSource, 'pagePath("watchlist"', "Watchlist opt-out must not canonicalize to a default Watchlist view.");
excludes(optOutSource, 'window.history.replaceState({}, "", targetPath);', "Wallet opt-out must not rewrite the current protected URL.");
excludes(indexHtml, 'html[data-initial-page="database/stats"]:not(.mflInitialRouteResolved) #', "Database Stats must not keep refresh-only shell ownership after a newer navigation commits.");
excludes(indexHtml, 'html[data-initial-page="mfl/stats"]:not(.mflInitialRouteResolved) #', "MFL Stats must not keep refresh-only shell ownership after a newer navigation commits.");
for (const canonicalConfig of [
  'database: Object.freeze({ order: ["attributes", "contracts", "stats"], fallback: "attributes" })',
  'mfl: Object.freeze({ order: ["attributes", "stats"], fallback: "attributes" })',
  'progression: Object.freeze({ order: ["current", "all"], fallback: "current" })',
  'agents: Object.freeze({ order: ["attributes", "contracts", "next", "current", "all"], fallback: "attributes" })',
  'watchlist: Object.freeze({ order: ["attributes", "next", "contracts", "current", "all"], fallback: "current" })',
  'myplayers: Object.freeze({ order: ["attributes", "next", "contracts", "current", "all"], fallback: "attributes" })',
  'club: Object.freeze({ order: ["attributes", "contracts", "current", "all"], fallback: "attributes" })',
]) {
  includes(indexHtml, canonicalConfig, `First paint must retain canonical view configuration ${canonicalConfig}.`);
}

includes(entry, '"/static-ui-runtime.js"', "Static route chrome must load universally before the application core.");
excludes(entry, "/table-view-runtime.js", "The retired table-view runtime must stay out of the browser runtime graph.");
includes(staticUi, "window.__mflTableViewConfig", "Runtime route chrome must reuse first-paint view configuration.");
includes(staticUi, 'footer.textContent = `MFL Front Office v${version}`;', "Static route chrome must keep the footer synchronized.");
includes(staticUi, 'button.classList.toggle("active", buttonPage === page);', "Sidebar destination state must be rendered by passive route chrome.");
invariant(
  !/navButtons\.forEach\(\(button\) => \{\s*button\.classList\.toggle\("active"/u.test(coreSource),
  "Application core must not compete with passive route chrome for sidebar active-state ownership.",
);
includes(staticUi, 'button.classList.toggle("active", String(button.dataset.view || "") === view);', "Active view state must be rendered by passive route chrome.");
includes(staticUi, "const insertionPoint = switcher instanceof HTMLElement && switcher.parentElement === container", "View ordering must preserve the Watchlist/scroll-cue insertion boundary.");
includes(staticUi, "container.insertBefore(button, insertionPoint);", "View order must be represented in DOM order.");
includes(staticUi, 'button.textContent = page === "club" ? "Squad" : "Attributes";', "Club Squad must use real button text.");
includes(staticUi, "function syncTableViews(page, view) {", "First paint and loaded application state must share one view-button renderer.");
includes(staticUi, "Object.freeze({ sync, syncTableViews, showNotFound, hideTooltips, destroy })", "The application core must reuse passive route chrome, shared not-found rendering, and its global tooltip cleanup API.");
includes(staticUi, 'const canonicalRequest = window.__mflAppConfig?.routes?.canonicalRequest;', "Static route chrome must consume the canonical route classifier for not-found state.");
includes(staticUi, 'if (state.page === "notfound") return ensureNotFoundPage(state.notFoundKind || "Page");', "Typed not-found routes must resolve to the shared not-found shell.");
includes(staticUi, 'page.id = "notFoundPage";', "Static route chrome must own one reusable not-found page shell.");
includes(staticUi, 'page.className = "pageView homePage";', "The not-found page must reuse the canonical centered Home page layout.");
includes(staticUi, '<h1 id="notFoundTitle">Page not found</h1>', "The not-found title must reuse the larger centered site heading instead of table-title alignment.");
includes(staticUi, 'class="homeOptInButton" type="button">Home</button>', "The Home action must reuse the canonical opt-in button visual language.");
excludes(staticUi, "homeStats", "The not-found page must not render statistic or 404 cards.");
excludes(staticUi, "notFoundMessage", "The not-found page must not render a secondary description.");
excludes(staticUi, "notFoundResource", "The not-found page must not render a resource card or label.");
includes(staticUi, 'window.location.assign("/");', "The not-found page must provide a direct homepage action.");
excludes(staticUi, "not-found.css", "The not-found page must not load a standalone stylesheet or cache-busting asset.");
includes(staticUi, "function showRouteShell(state, options = {}) {", "Static route chrome must reveal an already-committed route shell.");
includes(staticUi, 'if (target.id === "progressionPage") syncDestinationTableChrome(state, options);', "Committed table routes must synchronize view chrome before page reveal.");
includes(staticUi, 'page.hidden = page !== target;', "Committed page state must reveal the destination shell directly.");
includes(staticUi, 'Reflect.get(window, "__mflCoreContracts")', "Static table chrome must use the explicit application-core contract.");
includes(staticUi, "contracts.ensureCanonicalTableHeader", "Static table chrome must request canonical headers through the core contract.");
includes(staticUi, 'Reflect.get(window, "__mflPrimeTableHeaderSignature")', "Static table chrome must reuse the bootstrap header signature owner.");
includes(staticUi, 'Reflect.get(window, "__mflPrimeTableStructure")', "Static table chrome must reuse the bootstrap header renderer.");
excludes(staticUi, "STATIC_TABLE_", "Static route chrome must not duplicate bootstrap table schema ownership.");
excludes(staticUi, "window.eval", "Static route chrome must not inspect application-core lexical state through window.eval.");
excludes(staticUi, "eval(", "Static route chrome must not use string evaluation.");
for (const forbidden of [
  'document.addEventListener("click", onClick, true);',
  "function sameOriginRouteFromLink",
  "function primeDestinationSkeleton",
  "syncRouteChrome(href",
  "{ loading: true",
]) {
  excludes(staticUi, forbidden, `Static route chrome must not own navigation/loading via ${forbidden}.`);
}
includes(staticUi, 'if (event.key !== "Escape") return;', "Escape must retain global focus cleanup ownership.");
includes(staticUi, "active.blur();", "Escape must remove the active element focus ring.");
includes(staticUi, "selection.removeAllRanges();", "Escape must clear highlighted page text.");
for (const forbidden of ['document.createElement("style")', "!important", "MutationObserver", ".style.order"]) {
  excludes(staticUi, forbidden, `Static route chrome must not use repair ownership via ${forbidden}.`);
}

for (const forbidden of ["function onSharedViewButtonClick", "clubRouteActive", 'viewButtonsContainer?.addEventListener("click"']) {
  excludes(controlInteractions, forbidden, `Control interaction helpers must not own Club navigation via ${forbidden}.`);
}

includes(staticUi, 'tooltipPortal = document.createElement("div");', "Generic tooltips must use a body-level portal.");
includes(staticUi, "document.body.appendChild(tooltipPortal);", "Generic tooltips must escape page/sidebar stacking contexts.");
includes(styles, ".mflGlobalTooltip {", "The global tooltip portal must have canonical static styling.");
includes(styles, "z-index: var(--mfl-z-topmost);", "Global tooltip portals must consume the canonical topmost stacking level.");

includes(bootstrap, "const TABLE_VIEW_BY_SLUG = APP_CONFIG.routes.viewBySlug;", "Bootstrap table chrome must consume canonical route view slugs from the pre-bootstrap app config.");
includes(bootstrap, "function tableViewFromUrl(page, urlLike = window.location.href) {", "Bootstrap table chrome must resolve its view from the destination URL.");
includes(bootstrap, "const routeView = TABLE_VIEW_BY_SLUG[routeSlug] || \"\";", "Bootstrap table chrome must resolve destination slugs through the canonical route-view map.");
includes(bootstrap, "const requestedView = tableViewFromUrl(normalizedPage, urlLike);", "Table chrome must make the live route authoritative.");
const primeTableChromeStart = bootstrap.indexOf("function primeTableChrome(page, urlLike = window.location.href, options = {}) {");
const primeTableChromeEnd = primeTableChromeStart >= 0 ? bootstrap.indexOf('\n  Reflect.set(window, "__mflPrimeTableChrome"', primeTableChromeStart) : -1;
invariant(primeTableChromeStart >= 0 && primeTableChromeEnd > primeTableChromeStart, "Bootstrap table chrome owner must exist.");
const primeTableChrome = bootstrap.slice(primeTableChromeStart, primeTableChromeEnd);
excludes(primeTableChrome, "root.dataset.initialTableView", "SPA navigation must never reuse page-load-only initial view state.");
includes(bootstrap, 'Reflect.set(window, "__mflPrimeTableChrome", primeTableChrome);', "Navigation must reuse route-authoritative table chrome.");
includes(bootstrap, 'Reflect.set(window, "__mflPrimeTableHeaderSignature", firstPaintTableHeaderSignature);', "Bootstrap must own static table-header signatures.");
includes(bootstrap, 'Reflect.set(window, "__mflPrimeTableStructure", primeInitialTableStructure);', "Bootstrap must own static table-header rendering.");
includes(bootstrap, 'Reflect.set(window, "__mflPrimeTableRows", primeInitialTableRows);', "Bootstrap must retain its first-paint table skeleton owner.");
includes(bootstrap, 'Reflect.set(window, "__mflPrimeRouteSkeleton", primeRouteSkeleton);', "Bootstrap must retain non-table first-paint skeleton ownership.");

includes(tableLoading, "function show({", "Table loading must remain available only after navigation commits.");
includes(tableLoading, "function hidePager() {", "Post-commit Table loading must own pager hiding instead of static route chrome.");
includes(tableLoading, 'if (destroyed || (!forceRoute && !tableRouteActive())) return false;', "Passive route detection must guard table loading.");
includes(tableLoading, 'if (body.dataset.staticLoading === "true" && realRowsPresent)', "Final real rows must not be overwritten while busy state unwinds.");
includes(tableLoading, 'Reflect.get(window, "__mflPrimeTableRows")', "Table loading must reuse the bootstrap skeleton renderer.");
includes(tableLoading, "primeRows(true);", "Table loading must request the canonical bootstrap skeleton when replacing rows.");
excludes(tableLoading, "BLANK_ROW_OPACITIES", "Table loading must not duplicate bootstrap loading-row data.");

for (const marker of [
  'Reflect.set(window, "__mflCommitViewTransition", commitViewTransition);',
  'Reflect.set(window, "__mflCommitPageTransition", commitPageTransition);',
  'Reflect.set(window, "__mflRunViewTransition", runViewTransition);',
  'Reflect.set(window, "__mflRunPageTransition", runPageTransition);',
  'Reflect.set(window, "__mflWaitForViewTransitionPaint", waitForViewTransitionPaint);',
  "requestAnimationFrame(() => requestAnimationFrame(resolve));",
]) {
  includes(coreSource, marker, `Canonical navigation owner must retain ${marker}.`);
}
excludes(coreSource, "normalizeWatchlistShellFirstNavigation", "Watchlist must not retain a separate page-change shell flow.");

const pageTransitionStart = coreSource.indexOf("function commitPageTransition(pageName, updateHash = true, options = {}) {");
const pageTransitionEnd = pageTransitionStart >= 0 ? coreSource.indexOf("function stageViewTransition", pageTransitionStart) : -1;
invariant(pageTransitionStart >= 0 && pageTransitionEnd > pageTransitionStart, "Canonical page transition implementation must exist.");
const pageTransition = coreSource.slice(pageTransitionStart, pageTransitionEnd);
const pageStateIndex = pageTransition.indexOf("state.currentPage = statePageName;");
const pageUrlIndex = pageTransition.indexOf('window.history[replaceRoute ? "replaceState" : "pushState"]');
const pageChromeIndex = pageTransition.indexOf("window.__mflStaticUiRuntime?.sync?.();");
invariant(pageStateIndex >= 0 && pageUrlIndex > pageStateIndex && pageChromeIndex > pageUrlIndex, "Page transitions must commit state, then URL, then sidebar/view/page chrome.");

const viewTransitionStart = coreSource.indexOf("function commitViewTransition(pageName, viewName, options = {}) {");
const viewTransitionEnd = viewTransitionStart >= 0 ? coreSource.indexOf("function commitPageTransition", viewTransitionStart) : -1;
invariant(viewTransitionStart >= 0 && viewTransitionEnd > viewTransitionStart, "Canonical view transition implementation must exist.");
const viewTransition = coreSource.slice(viewTransitionStart, viewTransitionEnd);
const viewStateIndex = viewTransition.indexOf("state.view = nextView;");
const viewUrlIndex = viewTransition.indexOf('window.history[options.replace ? "replaceState" : "pushState"]');
const viewButtonIndex = viewTransition.indexOf("updateViewButtons();");
const viewShellIndex = viewTransition.indexOf("window.__mflStaticUiRuntime?.sync?.();");
invariant(viewStateIndex >= 0 && viewUrlIndex > viewStateIndex && viewButtonIndex > viewUrlIndex && viewShellIndex > viewButtonIndex, "View transitions must commit state, URL, active button, then destination shell.");

const pageRunnerStart = coreSource.indexOf("async function runPageTransition(pageName, updateHash = true, options = {}, loader = null) {");
const pageRunnerEnd = coreSource.indexOf("async function runViewTransition", pageRunnerStart);
const pageRunner = coreSource.slice(pageRunnerStart, pageRunnerEnd);
const pageCommitIndex = pageRunner.indexOf("commitPageTransition(pageName, updateHash, options)");
const pagePaintIndex = pageRunner.indexOf("await waitForViewTransitionPaint();");
const pageLoadIndex = pageRunner.indexOf('const result = typeof loader === "function" ? await loader(transition) : transition;');
invariant(
  pageCommitIndex >= 0 && pagePaintIndex > pageCommitIndex && pageLoadIndex > pagePaintIndex,
  "Global page transitions must commit, paint, then load.",
);

const viewRunnerStart = coreSource.indexOf("async function runViewTransition(pageName, viewName, options = {}, loader = null) {");
const viewRunnerEnd = coreSource.indexOf('Reflect.set(window, "__mflCommitViewTransition"', viewRunnerStart);
const viewRunner = coreSource.slice(viewRunnerStart, viewRunnerEnd);
invariant(
  viewRunner.indexOf("stageViewTransition(pageName, viewName, options)") >= 0
    && viewRunner.indexOf("await waitForViewTransitionPaint();") > viewRunner.indexOf("stageViewTransition(pageName, viewName, options)")
    && viewRunner.indexOf('typeof loader === "function"') > viewRunner.indexOf("await waitForViewTransitionPaint();"),
  "Global view transitions must commit, paint, then load.",
);

const setPageTransitionIndex = coreSource.indexOf("return runPageTransition(pageName, navigationUpdatesHistory, options, (navigationTransition) => setPage(pageName, false, {");
const setPageRecursiveGuardIndex = coreSource.indexOf("skipNavigationTransition: true", setPageTransitionIndex);
const setPagePrepareIndex = coreSource.indexOf('const requestedMflView = pageName === "mfl"', setPageRecursiveGuardIndex);
invariant(
  setPageTransitionIndex >= 0 && setPageRecursiveGuardIndex > setPageTransitionIndex && setPagePrepareIndex > setPageRecursiveGuardIndex,
  "Every setPage path must keep destination loading owned by the global transition while route-specific work runs in the guarded recursive pass.",
);

for (const [transitionMarker, loaderMarker, label] of [
  ['runViewTransition("mfl", "stats"', 'setPage("mfl", false, { view: "stats"', "MFL Stats"],
  ['runViewTransition("database", "stats"', 'setPage("database", false, { view: "stats"', "Database Stats"],
  ["void runViewTransition(pageName, viewName, {", "await setView(viewName);", "Club view"],
  ["const transition = await runPageTransition(CLUB_PAGE, updateHistory, {", "await window.mflLoadIncrementalRoutePage(CLUB_PAGE, {", "Club page"],
]) {
  const transitionIndex = coreSource.indexOf(transitionMarker);
  const loaderIndex = coreSource.indexOf(loaderMarker, transitionIndex);
  invariant(transitionIndex >= 0 && loaderIndex > transitionIndex, `${label} must enter the global transition runner before specialized loading starts.`);
}

for (const forbiddenOwner of [
  "commitStatsTransition",
  "__mflCommitViewTransition",
  "__mflWaitForViewTransitionPaint",
  "setPage =",
  "setView =",
  "showHomeShell =",
  "history.pushState",
  "history.replaceState",
]) {
  excludes(databaseStatsState, forbiddenOwner, `Database Stats state runtime must remain passive and must not own ${forbiddenOwner}.`);
}
includes(databaseStatsState, "async function renderStatsRoute() {", "Database Stats state runtime may retain passive rendering/persistence ownership only.");

const clubGateStart = entry.indexOf("function installClubRouteRuntimeGate() {");
const clubGateEnd = entry.indexOf("async function finalizeRouteRuntimeNow", clubGateStart);
const clubGate = entry.slice(clubGateStart, clubGateEnd);
includes(clubGate, 'runTransition("club", true', "Club lazy route loading must start through the global page transition runner.");
excludes(clubGate, "history.pushState", "Club navigation gate must not push history independently.");
excludes(clubGate, "history.replaceState", "Club navigation gate must not replace history independently.");

includes(styles, "--mfl-pager-block-padding: 12px;", "Pager spacing must have one global 12px setting.");
includes(styles, "padding-block: var(--mfl-pager-block-padding);", "All pagers must consume the global block-padding setting.");
includes(dropdowns, "width: 92px;", "Rows selector must retain its established footprint.");
excludes(dropdowns, "92px !important", "Rows selector dimensions must not rely on priority overrides.");
includes(dropdowns, "overflow-x: hidden;", "Watchlist dropdown must not expose a horizontal scrollbar.");

invariant(
  indexHtml.includes('html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page=')
    && !indexHtml.includes(') #sidebar .navButton[data-page]:not(:hover) {'),
  "Refresh-only table-page chrome must expose the active route directly and relinquish ownership on supersession without a higher-specificity neutral sidebar rule.",
);
invariant(
  indexHtml.includes('#progressionPage .views > .viewButton:not(:hover) { border-color: var(--border-strong); background: var(--surface); color: var(--text); }'),
  "Initial table-view neutral styling must not override normal hover presentation.",
);

console.log("Static route validation passed with bootstrap-owned table headers, passive route chrome, minimal centered not-found rendering, canonical loading rows, and explicit core contracts.");
