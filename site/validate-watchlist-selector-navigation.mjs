import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

const [controls, releaseProjection, mobileTable, generatedCore, index, bootstrap, sharedUi, splitter, watchlistCore] = await Promise.all([
  read("./control-interactions-runtime.js"),
  read("./sync-release-projections.mjs"),
  read("./modules/app-core-mobile-table.js"),
  read("./modules/app-core-runtime.js"),
  read("./index.html"),
  read("./bootstrap.js"),
  read("./shared-table-ui-runtime.js"),
  read("./modules/app-core-watchlist-route-chunk.js"),
  read("./modules/app-core-watchlist-runtime.js"),
]);

invariant(
  !controls.includes("primeInitialTableNavigationChrome")
    && !controls.includes("resetTableHorizontalScrollForNavigation")
    && !controls.includes("pendingTableScrollRestore"),
  "Mobile first-paint and page-transition behavior must not be owned by late pointer/click runtime hooks.",
);

invariant(
  controls.includes("function navigationIntentPage(target) {"),
  "Immediate Watchlist selector visibility must resolve the actual destination page for navigation intent.",
);
invariant(
  controls.includes('target.closest("#sidebar .navButton[data-page]")'),
  "Watchlist selector intent must continue supporting sidebar page navigation.",
);
invariant(
  controls.includes('target.closest("a[href]")'),
  "Watchlist selector intent must support internal entity links such as Watchlist-to-Club navigation.",
);
invariant(
  controls.includes('if (url.origin !== window.location.origin) return "";')
    && controls.includes("window.__mflAppConfig?.routes?.canonicalRequest"),
  "Internal link intent must ignore external URLs and reuse the canonical route classifier.",
);
invariant(
  controls.includes("function syncWatchlistSelectorNavigationIntent(event) {")
    && controls.includes("event.metaKey || event.ctrlKey || event.shiftKey || event.altKey"),
  "Immediate selector updates must run only for navigation that will replace the current page.",
);
invariant(
  controls.includes("const targetPage = navigationIntentPage(event.target);")
    && controls.includes('const show = targetPage === "watchlist"'),
  "The Watchlist selector must be synchronized from the destination route instead of the current page.",
);
invariant(
  controls.includes("switcher.hidden = !show;")
    && controls.includes('if (dropdown instanceof HTMLElement) dropdown.hidden = true;')
    && controls.includes('button.setAttribute("aria-expanded", "false")'),
  "Leaving Watchlist must hide the selector and close its dropdown synchronously.",
);
const selectorIntent = controls.indexOf("syncWatchlistSelectorNavigationIntent(event);");
const navigationHandoff = controls.indexOf("if (beginNavigationIntent(event.target)) handOffNavigationIntent();");
invariant(
  controls.includes('document.addEventListener("click", onClick, true);')
    && selectorIntent >= 0
    && navigationHandoff > selectorIntent,
  "Watchlist selector visibility must update in capture phase before asynchronous route handoff begins.",
);

invariant(
  releaseProjection.includes('#progressionPage .views > #openFiltersButton { order: -2; }')
    && releaseProjection.includes('#progressionPage .views > #viewControlsSeparator { order: -1; }'),
  "The zero-request mobile first-paint stylesheet must place Filters and its separator before every view button.",
);
invariant(
  releaseProjection.includes("function normalizeIndexMobileWatchlistFirstPaintProjection(source)")
    && releaseProjection.includes('root.dataset.initialTablePage !== "watchlist"')
    && releaseProjection.includes('root.dataset.storedWalletOptIn !== "true"')
    && releaseProjection.includes("switcher.hidden = false;")
    && releaseProjection.includes('views.insertAdjacentElement("afterend", switcher);'),
  "Direct mobile Watchlist visits must expose and move the selector outside the fading Views scroller during HTML parsing.",
);
invariant(
  index.includes("BEGIN GENERATED MOBILE WATCHLIST FIRST PAINT")
    && index.includes('views.insertAdjacentElement("afterend", switcher);'),
  "The generated index must contain the synchronous mobile Watchlist first-paint handoff.",
);
const watchlistFirstPaint = index.indexOf("BEGIN GENERATED MOBILE WATCHLIST FIRST PAINT");
const quickFilters = index.indexOf('<section class="quickFilters" aria-label="Quick filters">');
invariant(
  watchlistFirstPaint >= 0 && quickFilters > watchlistFirstPaint,
  "The Watchlist first-paint handoff must execute immediately after Views and before Quick Filters are parsed.",
);

invariant(
  mobileTable.includes("function syncMobileTablePageTransitionChrome(pageName)")
    && mobileTable.includes('if (!window.matchMedia("(max-width: 900px)").matches) return;'),
  "The mobile table build normalizer must inject canonical mobile-only page-transition chrome ownership.",
);
invariant(
  generatedCore.includes("function syncMobileTablePageTransitionChrome(pageName)")
    && generatedCore.includes('if (!window.matchMedia("(max-width: 900px)").matches) return;'),
  "The generated application core must contain the canonical mobile-only page-transition chrome helper.",
);
invariant(
  generatedCore.includes("if (targetPage && currentPage && targetPage !== currentPage) {")
    && generatedCore.includes('document.querySelector("#progressionPage .playerTableScroller")')
    && generatedCore.includes("scroller.scrollLeft = 0;"),
  "Only changing mobile pages must reset the player table to its left edge; same-page view changes must preserve lateral scroll.",
);
invariant(
  generatedCore.includes('const showWatchlistSelector = targetPage === "watchlist"')
    && generatedCore.includes('switcher.classList.add("mflMobileWatchlistSwitcher");')
    && generatedCore.includes('(shell || views).insertAdjacentElement("afterend", switcher);'),
  "Mobile Watchlist navigation must move its selector outside Views before the route becomes visible.",
);
const transitionStart = generatedCore.indexOf("async function runPageTransition(pageName, updateHash = true, options = {}, loader = null) {");
const transitionConfirm = generatedCore.indexOf("if (!settingsConfirmNavigation(pageName, updateHash)) return null;", transitionStart);
const transitionSync = generatedCore.indexOf("syncMobileTablePageTransitionChrome(pageName);", transitionStart);
const navigationLookup = generatedCore.indexOf('const navigation = Reflect.get(window, "__mflNavigation");', transitionStart);
invariant(
  transitionStart >= 0
    && transitionConfirm > transitionStart
    && transitionSync > transitionConfirm
    && navigationLookup > transitionSync,
  "Mobile table chrome must be synchronized after navigation permission and before page-transition fading/navigation ownership begins.",
);

invariant(
  sharedUi.includes('(shell || views).insertAdjacentElement("afterend", switcher);')
    && sharedUi.includes('switcher.classList.add("mflMobileWatchlistSwitcher");'),
  "Hydrated mobile Watchlist presentation must preserve the selector outside the Views scroller.",
);
invariant(
  !splitter.includes("if (watchlistSwitcher) watchlistSwitcher.hidden = true;"),
  "The Watchlist facade must not hide the selector while the lazy route core loads.",
);
invariant(
  watchlistCore.includes('const visible = state.currentPage === "watchlist" && hasWalletOptIn();')
    && watchlistCore.includes("watchlistDropdown.replaceChildren();"),
  "The lazy Watchlist core must remain the final authoritative selector-state owner after first paint.",
);
invariant(
  bootstrap.includes('const insertionAnchor = switcher instanceof HTMLElement && switcher.parentElement === container')
    && bootstrap.includes('container.insertBefore(button, insertionAnchor);'),
  "Bootstrap view ordering must remain safe while the mobile Watchlist selector is outside Views.",
);

console.log("Canonical Watchlist selector navigation, mobile first-paint, and page-transition chrome validation passed.");
