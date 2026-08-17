import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (source, value, message) => invariant(source.includes(value), message);
const excludes = (source, value, message) => invariant(!source.includes(value), message);

const [indexHtml, bootstrap, staticUi, tableLoading, entry, buildNormalizer, styles, dropdowns] = await Promise.all([
  read("./index.html"),
  read("./bootstrap.js"),
  read("./static-ui-runtime.js"),
  read("./table-loading-runtime.js"),
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
includes(staticUi, 'document.addEventListener("click", onClick, true);', "Page and view active state must update in the capture phase.");
includes(staticUi, 'button.classList.toggle("active", buttonPage === page);', "Sidebar destination state must switch immediately.");
includes(staticUi, 'button.classList.toggle("active", String(button.dataset.view || "") === view);', "View destination state must switch immediately.");
includes(staticUi, "container.insertBefore(button, switcher instanceof HTMLElement ? switcher : null);", "View buttons must be reordered directly instead of through CSS order overrides.");
includes(staticUi, 'button.textContent = page === "club" ? "Squad" : "Attributes";', "Club Squad must use real button text.");
includes(staticUi, "function syncTableViews(page, view) {", "First paint and loaded application state must share one view-button owner.");
includes(staticUi, "Object.freeze({ sync, syncTableViews, destroy })", "The loaded application core must be able to reuse canonical view-button ownership.");
includes(staticUi, "function showRouteShell(state, { loading = false } = {}) {", "Static route chrome must own the immediate destination shell.");
includes(staticUi, 'if (target.id === "progressionPage") syncDestinationTableChrome(state);', "Destination table chrome must synchronize before reveal.");
includes(staticUi, 'if (typeof primeRows === "function") primeRows(true);', "Page switches must synchronously install the five-row destination table skeleton.");
includes(staticUi, 'if (typeof primeRoute === "function") primeRoute(target, state);', "Non-table page switches must synchronously install destination boxes/skeletons.");
includes(staticUi, 'page.hidden = page !== target;', "A newly selected page shell must replace the previous page immediately.");
includes(staticUi, 'if (href) syncRouteChrome(href, { loading: true });', "Internal route links must prime their destination shell before asynchronous navigation.");
includes(staticUi, 'if (event.key !== "Escape") return;', "Escape must have a global focus cleanup owner.");
includes(staticUi, "active.blur();", "Escape must remove the active element focus ring.");
includes(staticUi, "selection.removeAllRanges();", "Escape must clear highlighted page text.");
excludes(staticUi, 'document.createElement("style")', "Static route chrome must not inject CSS repair layers.");
excludes(staticUi, "!important", "Static route chrome must not use CSS priority overrides.");
excludes(staticUi, "MutationObserver", "Static route chrome must not observe and repair rendered DOM.");
excludes(staticUi, ".style.order", "View order must be represented in DOM order rather than inline style overrides.");

includes(staticUi, 'tooltipPortal = document.createElement("div");', "Generic tooltips must use a body-level portal instead of page pseudo-elements.");
includes(staticUi, 'document.body.appendChild(tooltipPortal);', "Generic tooltips must escape page/sidebar stacking contexts.");
includes(styles, ".mflGlobalTooltip {", "The global tooltip portal must have canonical static styling.");
includes(styles, "z-index: 2147483647;", "Global tooltip portals must sit above every application layer.");

includes(bootstrap, 'Reflect.set(window, "__mflPrimeTableRows", primeInitialTableRows);', "Bootstrap must expose its five-row skeleton to navigation.");
includes(bootstrap, 'Reflect.set(window, "__mflPrimeRouteSkeleton", primeRouteSkeleton);', "Bootstrap must expose non-table route skeletons to navigation.");

includes(tableLoading, "function show({ replaceExisting = false, forceRoute = false } = {}) {", "Table loading must support explicit destination shells before URL navigation finishes.");
includes(tableLoading, 'if (destroyed || (!forceRoute && !tableRouteActive())) return false;', "Only explicit destination ownership may bypass passive route detection.");
includes(tableLoading, 'if (body.dataset.staticLoading === "true" && realRowsPresent)', "A final real render must not be overwritten while the busy token is unwinding.");
includes(tableLoading, "BLANK_ROW_OPACITIES.length", "The runtime loading shell must retain its fixed five-row structure.");

includes(buildNormalizer, 'Reflect.get(window, "__mflTableViewConfig")', "Loaded application views must consume the canonical first-paint view configuration.");
includes(buildNormalizer, 'window.__mflStaticUiRuntime?.syncTableViews?.(pageName, activeView);', "Loaded view-button rendering must delegate to the canonical static owner.");
const watchlistBlockStart = buildNormalizer.indexOf("function normalizeWatchlistShellFirstNavigation(source) {");
const watchlistBlockEnd = watchlistBlockStart >= 0 ? buildNormalizer.indexOf("\nfunction normalizeReleaseOwnership", watchlistBlockStart) : -1;
invariant(watchlistBlockStart >= 0 && watchlistBlockEnd > watchlistBlockStart, "Watchlist shell normalization block must exist.");
const watchlistBlock = buildNormalizer.slice(watchlistBlockStart, watchlistBlockEnd);
includes(watchlistBlock, 'if (typeof primeTableRows === "function") primeTableRows(true);', "Watchlist must display five blank rows before waiting on route data.");
const watchlistPrimeIndex = watchlistBlock.indexOf('if (typeof primeTableRows === "function") primeTableRows(true);');
const watchlistAwaitIndex = watchlistBlock.lastIndexOf("await ensureWatchlistRoute(options);");
invariant(watchlistPrimeIndex >= 0 && watchlistAwaitIndex > watchlistPrimeIndex, "Watchlist shell must be visible before its asynchronous route data is awaited.");

includes(styles, "--mfl-pager-block-padding: 12px;", "Pager spacing must have one global 12px setting.");
includes(styles, "padding-block: var(--mfl-pager-block-padding);", "All pagers must consume the global block-padding setting.");
includes(dropdowns, "width: 92px;", "Rows selector must retain its established 92px footprint.");
excludes(dropdowns, "92px !important", "Rows selector dimensions must not rely on priority overrides.");
includes(dropdowns, "overflow-x: hidden;", "Watchlist dropdown must not expose a horizontal scrollbar.");

console.log("Direct route shell, canonical view order, pager, Rows selector, dropdown overflow, tooltip portal, and first-paint validation passed.");
