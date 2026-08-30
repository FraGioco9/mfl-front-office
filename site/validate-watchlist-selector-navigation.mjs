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

console.log("Canonical mobile first-paint and page-transition chrome validation passed.");
