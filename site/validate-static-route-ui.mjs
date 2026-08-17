import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [indexHtml, bootstrap, staticUi, tableView, tableLoading, controlInteractions, databaseStatsState, entry, buildNormalizer, styles, dropdowns] = await Promise.all([
  read("./index.html"),
  read("./bootstrap.js"),
  read("./static-ui-runtime.js"),
  read("./table-view-runtime.js"),
  read("./table-loading-runtime.js"),
  read("./control-interactions-runtime.js"),
  read("./database-stats-state-runtime.js"),
  read("./modules/app-entry.js"),
  read("./modules/app-core-build-normalizer.js"),
  read("./styles.css"),
  read("./dropdowns.css"),
]);

includes(indexHtml, "window.__mflTableViewConfig = TABLE_VIEW_CONFIG;", "First-paint table view configuration must be exposed to runtime chrome ownership.");
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
includes(staticUi, "window.__mflTableViewConfig", "Runtime route chrome must reuse first-paint view configuration.");
includes(staticUi, 'footer.textContent = `MFL Front Office v${version}`;', "Static route chrome must keep the footer synchronized.");
includes(staticUi, 'button.classList.toggle("active", buttonPage === page);', "Sidebar destination state must switch when the canonical transition commits.");
includes(staticUi, 'button.classList.toggle("active", String(button.dataset.view || "") === view);', "View destination state must switch when the canonical transition commits.");
includes(staticUi, "container.insertBefore(button, switcher instanceof HTMLElement ? switcher : null);", "View buttons must be reordered directly instead of through CSS order overrides.");
includes(staticUi, 'button.textContent = page === "club" ? "Squad" : "Attributes";', "Club Squad must use real button text.");
includes(staticUi, "function syncTableViews(page, view) {", "First paint and loaded application state must share one view-button owner.");
includes(staticUi, "Object.freeze({ sync, syncTableViews, destroy })", "The loaded application core must be able to reuse canonical route chrome ownership.");
includes(staticUi, "function showRouteShell(state) {", "Static route chrome must render the route already committed by the canonical transition.");
includes(staticUi, 'if (target.id === "progressionPage") syncDestinationTableChrome(state);', "Committed table routes must synchronize their view chrome before page reveal.");
includes(staticUi, 'page.hidden = page !== target;', "Committed page state must reveal the destination shell immediately.");
excludes(staticUi, 'document.addEventListener("click", onClick, true);', "Static route chrome must not own a second page-navigation click flow.");
excludes(staticUi, "function sameOriginRouteFromLink", "Static route chrome must not derive or stage page navigation independently of setPage.");
excludes(staticUi, "function primeDestinationSkeleton", "Static route chrome must not start a separate pre-navigation loading flow.");
excludes(staticUi, "syncRouteChrome(href", "Internal links must be committed only by the canonical application transition.");
excludes(staticUi, "{ loading: true", "Static route chrome must not own loading state.");
includes(staticUi, 'if (event.key !== "Escape") return;', "Escape must have a global focus cleanup owner.");
includes(staticUi, "active.blur();", "Escape must remove the active element focus ring.");
includes(staticUi, "selection.removeAllRanges();", "Escape must clear highlighted page text.");
excludes(staticUi, 'document.createElement("style")', "Static route chrome must not inject CSS repair layers.");
excludes(staticUi, "!important", "Static route chrome must not use CSS priority overrides.");
excludes(staticUi, "MutationObserver", "Static route chrome must not observe and repair rendered DOM.");
excludes(staticUi, ".style.order", "View order must be represented in DOM order rather than inline style overrides.");

excludes(tableView, 'classList.toggle("active"', "The auxiliary table-view runtime must not override canonical active-view state.");
excludes(tableView, 'document.createElement("style")', "The auxiliary table-view runtime must not inject view-button CSS overrides.");
excludes(tableView, 'addEventListener("pointerdown"', "The auxiliary table-view runtime must not pre-commit view state before the canonical click owner.");
excludes(controlInteractions, "function onSharedViewButtonClick", "Control interaction helpers must not intercept shared Club view clicks.");
excludes(controlInteractions, "clubRouteActive", "Control interaction helpers must not own Club route/view state.");
excludes(controlInteractions, 'viewButtonsContainer?.addEventListener("click"', "Shared view buttons must not have a second Club click propagation owner.");

includes(staticUi, 'tooltipPortal = document.createElement("div");', "Generic tooltips must use a body-level portal instead of page pseudo-elements.");
includes(staticUi, 'document.body.appendChild(tooltipPortal);', "Generic tooltips must escape page/sidebar stacking contexts.");
includes(styles, ".mflGlobalTooltip {", "The global tooltip portal must have canonical static styling.");
includes(styles, "z-index: 2147483647;", "Global tooltip portals must sit above every application layer.");

includes(bootstrap, "const TABLE_VIEW_BY_SLUG = Object.freeze({", "Bootstrap table chrome must understand canonical route view slugs directly.");
includes(bootstrap, "function tableViewFromUrl(page, urlLike = window.location.href) {", "Bootstrap table chrome must resolve its view from the destination URL.");
includes(bootstrap, "const routeSlug = decodedRoutePart(parts[parts.length - 1]).toLowerCase();", "Destination table chrome must use the current route's final view slug.");
includes(bootstrap, "const requestedView = tableViewFromUrl(normalizedPage, urlLike);", "Table chrome must make the live destination URL authoritative over startup state.");
const primeTableChromeStart = bootstrap.indexOf("function primeTableChrome(page, urlLike = window.location.href) {");
const primeTableChromeEnd = primeTableChromeStart >= 0 ? bootstrap.indexOf('\n  Reflect.set(window, "__mflPrimeTableChrome"', primeTableChromeStart) : -1;
invariant(primeTableChromeStart >= 0 && primeTableChromeEnd > primeTableChromeStart, "Bootstrap table chrome owner must exist.");
const primeTableChrome = bootstrap.slice(primeTableChromeStart, primeTableChromeEnd);
excludes(primeTableChrome, "root.dataset.initialTableView", "SPA table navigation must never reuse the page-load-only initial view.");
includes(bootstrap, 'Reflect.set(window, "__mflPrimeTableChrome", primeTableChrome);', "Navigation must reuse the route-authoritative table chrome owner.");
includes(bootstrap, 'Reflect.set(window, "__mflPrimeTableRows", primeInitialTableRows);', "Bootstrap must retain its five-row first-paint skeleton owner.");
includes(bootstrap, 'Reflect.set(window, "__mflPrimeRouteSkeleton", primeRouteSkeleton);', "Bootstrap must retain non-table first-paint skeleton ownership.");

includes(tableLoading, "function show({ replaceExisting = false, forceRoute = false } = {}) {", "Table loading must retain explicit route loading support after the canonical transition paints.");
includes(tableLoading, 'if (destroyed || (!forceRoute && !tableRouteActive())) return false;', "Only explicit destination ownership may bypass passive route detection.");
includes(tableLoading, 'if (body.dataset.staticLoading === "true" && realRowsPresent)', "A final real render must not be overwritten while the busy token is unwinding.");
includes(tableLoading, "BLANK_ROW_OPACITIES.length", "The runtime loading shell must retain its fixed five-row structure.");

includes(buildNormalizer, 'Reflect.get(window, "__mflTableViewConfig")', "Loaded application views must consume the canonical first-paint view configuration.");
includes(buildNormalizer, 'window.__mflStaticUiRuntime?.syncTableViews?.(pageName, activeView);', "Loaded view-button rendering must delegate to the canonical static owner.");
includes(buildNormalizer, "function normalizeCanonicalViewTransitions(source) {", "One canonical build owner must normalize page and view transitions.");
includes(buildNormalizer, 'Reflect.set(window, "__mflCommitViewTransition", commitViewTransition);', "The canonical view transition must be reusable by specialized route renderers.");
includes(buildNormalizer, 'Reflect.set(window, "__mflCommitPageTransition", commitPageTransition);', "The canonical page transition must be shared by all setPage navigation.");
includes(buildNormalizer, 'Reflect.set(window, "__mflWaitForViewTransitionPaint", waitForViewTransitionPaint);', "All navigation loaders must be able to wait until committed chrome has painted.");
includes(buildNormalizer, "requestAnimationFrame(() => requestAnimationFrame(resolve));", "Navigation must cross a real render boundary before loading starts.");
includes(buildNormalizer, "function commitPageTransition(pageName, updateHash = true, options = {}) {", "Page navigation must have one canonical transition owner.");
includes(buildNormalizer, "commitViewTransition(pageName, nextView, {", "Shared table views must use the canonical transition.");
includes(buildNormalizer, 'commitViewTransition("mfl", "stats", { statePageName: "mflstats" });', "MFL Stats must commit through the canonical transition before its specialized renderer.");
includes(buildNormalizer, "commitViewTransition(CLUB_PAGE, nextView, {", "Club views must commit through the canonical transition before Club loading.");
excludes(buildNormalizer, "normalizeWatchlistShellFirstNavigation", "Watchlist must not retain a separate page-change shell flow.");

const pageTransitionStart = buildNormalizer.indexOf("function commitPageTransition(pageName, updateHash = true, options = {}) {");
const pageTransitionEnd = pageTransitionStart >= 0 ? buildNormalizer.indexOf("function stageViewTransition", pageTransitionStart) : -1;
invariant(pageTransitionStart >= 0 && pageTransitionEnd > pageTransitionStart, "Canonical page transition implementation must exist.");
const pageTransition = buildNormalizer.slice(pageTransitionStart, pageTransitionEnd);
const pageStateIndex = pageTransition.indexOf("state.currentPage = requestedPageName;");
const pageUrlIndex = pageTransition.indexOf("window.history.pushState");
const pageChromeIndex = pageTransition.indexOf("window.__mflStaticUiRuntime?.sync?.();");
invariant(pageStateIndex >= 0 && pageUrlIndex > pageStateIndex && pageChromeIndex > pageUrlIndex, "Page transitions must commit state, then URL, then sidebar/view/page chrome.");

const setPageTransitionIndex = buildNormalizer.indexOf("commitPageTransition(pageName, navigationUpdatesHistory, options);");
const setPagePaintIndex = buildNormalizer.indexOf("await waitForViewTransitionPaint();", setPageTransitionIndex);
const setPagePrepareIndex = buildNormalizer.indexOf("const requestedMflView = pageName === \"mfl\"", setPagePaintIndex);
invariant(setPageTransitionIndex >= 0 && setPagePaintIndex > setPageTransitionIndex && setPagePrepareIndex > setPagePaintIndex, "Every setPage path must paint committed route chrome before route-specific loading logic starts.");

const transitionOwnerStart = buildNormalizer.indexOf("function commitViewTransition(pageName, viewName, options = {}) {");
const transitionOwnerEnd = transitionOwnerStart >= 0 ? buildNormalizer.indexOf("function commitPageTransition", transitionOwnerStart) : -1;
invariant(transitionOwnerStart >= 0 && transitionOwnerEnd > transitionOwnerStart, "Canonical view transition implementation must exist.");
const transitionOwner = buildNormalizer.slice(transitionOwnerStart, transitionOwnerEnd);
const stateIndex = transitionOwner.indexOf("state.view = nextView;");
const urlIndex = transitionOwner.indexOf('window.history[options.replace ? "replaceState" : "pushState"]');
const buttonIndex = transitionOwner.indexOf("updateViewButtons();");
invariant(stateIndex >= 0 && urlIndex > stateIndex && buttonIndex > urlIndex, "View transitions must commit state, then URL, then active button in that order.");

const sharedTransitionIndex = buildNormalizer.indexOf("commitViewTransition(pageName, nextView, {");
const sharedPaintIndex = buildNormalizer.indexOf("await waitForViewTransitionPaint();", sharedTransitionIndex);
invariant(sharedTransitionIndex >= 0 && sharedPaintIndex > sharedTransitionIndex, "Shared table loading must wait until the new URL and active button have painted.");
const mflStatsTransitionIndex = buildNormalizer.indexOf('commitViewTransition("mfl", "stats", { statePageName: "mflstats" });');
const mflStatsPaintIndex = buildNormalizer.indexOf("await waitForViewTransitionPaint();", mflStatsTransitionIndex);
const mflStatsLoadIndex = buildNormalizer.indexOf('await setPage("mflstats", false', mflStatsTransitionIndex);
invariant(mflStatsTransitionIndex >= 0 && mflStatsPaintIndex > mflStatsTransitionIndex && mflStatsLoadIndex > mflStatsPaintIndex, "MFL Stats must paint state, URL, and active view before its specialized loader starts.");
const clubTransitionIndex = buildNormalizer.indexOf("commitViewTransition(CLUB_PAGE, nextView, {");
const clubPaintIndex = buildNormalizer.indexOf("await waitForViewTransitionPaint();", clubTransitionIndex);
const clubLoadingIndex = buildNormalizer.indexOf("setClubSwitching(true);", clubTransitionIndex);
invariant(clubTransitionIndex >= 0 && clubPaintIndex > clubTransitionIndex && clubLoadingIndex > clubPaintIndex, "Club must paint state, URL, and active view before its loading state starts.");

includes(databaseStatsState, "function commitStatsTransition(updateUrl = false) {", "Database Stats must reuse the canonical transition instead of owning a second state workflow.");
includes(databaseStatsState, 'const commit = Reflect.get(window, "__mflCommitViewTransition");', "Database Stats must call the canonical transition owner.");
includes(databaseStatsState, 'const wait = Reflect.get(window, "__mflWaitForViewTransitionPaint");', "Database Stats must reuse the canonical transition paint boundary.");
const databaseStatsRenderStart = databaseStatsState.indexOf("async function renderStatsRoute(updateUrl = false) {");
const databaseStatsRenderEnd = databaseStatsRenderStart >= 0 ? databaseStatsState.indexOf("\n  function cloudDatabaseView", databaseStatsRenderStart) : -1;
invariant(databaseStatsRenderStart >= 0 && databaseStatsRenderEnd > databaseStatsRenderStart, "Database Stats render workflow must exist.");
const databaseStatsRender = databaseStatsState.slice(databaseStatsRenderStart, databaseStatsRenderEnd);
const databaseStatsCommitIndex = databaseStatsRender.indexOf("commitStatsTransition(updateUrl);");
const databaseStatsPaintIndex = databaseStatsRender.indexOf("await waitForStatsTransitionPaint();");
const databaseStatsBusyIndex = databaseStatsRender.indexOf('window.__mflInteractionBusy?.begin?.("route-runtime")');
invariant(databaseStatsCommitIndex >= 0 && databaseStatsPaintIndex > databaseStatsCommitIndex && databaseStatsBusyIndex > databaseStatsPaintIndex, "Database Stats must paint state, URL, and active button before loading begins.");

includes(styles, "--mfl-pager-block-padding: 12px;", "Pager spacing must have one global 12px setting.");
includes(styles, "padding-block: var(--mfl-pager-block-padding);", "All pagers must consume the global block-padding setting.");
includes(dropdowns, "width: 92px;", "Rows selector must retain its established 92px footprint.");
excludes(dropdowns, "92px !important", "Rows selector dimensions must not rely on priority overrides.");
includes(dropdowns, "overflow-x: hidden;", "Watchlist dropdown must not expose a horizontal scrollbar.");

console.log("Unified painted page/view transitions, route-authoritative chrome, canonical view order, pager, Rows selector, dropdown overflow, tooltip portal, and first-paint validation passed.");
