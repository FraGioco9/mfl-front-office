import { invariant } from "./validation/assertions.mjs";
import { readValidationText } from "./validation-text.mjs";
import { readCanonicalCoreSource } from "./validate-core-sources.mjs";

const read = (path) => readValidationText(path, import.meta.url);

const [controls, releaseProjection, sharedSource, generatedCore, index, bootstrap, sharedUi, watchlistSource, watchlistCore] = await Promise.all([
  read("./control-interactions-runtime.js"),
  read("./sync-release-projections.mjs"),
  Promise.resolve(readCanonicalCoreSource("shared")),
  read("./modules/app-core-runtime.js"),
  read("./index.html"),
  read("./bootstrap.js"),
  read("./shared-table-ui-runtime.js"),
  read("./modules/core-sources/watchlist.js"),
  read("./modules/app-core-watchlist-runtime.js"),
]);

invariant(!controls.includes("primeInitialTableNavigationChrome") && !controls.includes("resetTableHorizontalScrollForNavigation") && !controls.includes("pendingTableScrollRestore"), "Mobile first-paint and page-transition behavior must not be owned by late pointer/click runtime hooks.");
invariant(controls.includes("function navigationIntentPage(target) {"), "Immediate Watchlist selector visibility must resolve the destination page.");
invariant(controls.includes('target.closest("#sidebar .navButton[data-page]")') && controls.includes('target.closest("a[href]")'), "Watchlist selector intent must support sidebar and internal entity navigation.");
invariant(controls.includes("window.__mflAppConfig?.routes?.canonicalRequest"), "Internal navigation intent must reuse the canonical route classifier.");
invariant(controls.includes("function syncWatchlistSelectorNavigationIntent(event) {") && controls.includes('const show = targetPage === "watchlist"'), "Watchlist selector visibility must synchronize from navigation intent.");
invariant(controls.includes("switcher.hidden = !show;") && controls.includes('button.setAttribute("aria-expanded", "false")'), "Leaving Watchlist must hide and close the selector synchronously.");

invariant(releaseProjection.includes('#progressionPage .views > #openFiltersButton { order: -2; }') && releaseProjection.includes('#progressionPage .views > #viewControlsSeparator { order: -1; }'), "Zero-request mobile first-paint CSS must place Filters and its separator before view buttons.");
invariant(releaseProjection.includes("function normalizeIndexMobileWatchlistFirstPaintProjection(source)") && releaseProjection.includes('root.dataset.initialTablePage !== "watchlist"') && releaseProjection.includes("switcher.hidden = false;"), "Direct mobile Watchlist visits must expose the selector during HTML parsing.");
invariant(index.includes("BEGIN GENERATED MOBILE WATCHLIST FIRST PAINT") && index.includes('views.insertAdjacentElement("afterend", switcher);'), "Generated index must contain the synchronous mobile Watchlist first-paint handoff.");

for (const source of [sharedSource, generatedCore]) {
  invariant(source.includes("function syncMobileTablePageTransitionChrome(pageName)") && source.includes('if (!window.matchMedia("(max-width: 900px)").matches) return;'), "Canonical shared core must own mobile-only page-transition chrome.");
  invariant(source.includes("if (targetPage && currentPage && targetPage !== currentPage) {") && source.includes("scroller.scrollLeft = 0;"), "Changing mobile pages must reset table horizontal scrolling while same-page view changes preserve it.");
  invariant(source.includes('const showWatchlistSelector = targetPage === "watchlist"') && source.includes('switcher.classList.add("mflMobileWatchlistSwitcher");'), "Mobile Watchlist navigation must move its selector before the route becomes visible.");
}

const transitionStart = generatedCore.indexOf("async function runPageTransition(pageName, updateHash = true, options = {}, loader = null) {");
const transitionConfirm = generatedCore.indexOf("if (!settingsConfirmNavigation(pageName, updateHash)) return null;", transitionStart);
const transitionSync = generatedCore.indexOf("syncMobileTablePageTransitionChrome(pageName);", transitionStart);
const navigationLookup = generatedCore.indexOf('const navigation = Reflect.get(window, "__mflNavigation");', transitionStart);
invariant(transitionStart >= 0 && transitionConfirm > transitionStart && transitionSync > transitionConfirm && navigationLookup > transitionSync, "Mobile table chrome must synchronize after navigation permission and before transition ownership begins.");

invariant(sharedUi.includes('(shell || views).insertAdjacentElement("afterend", switcher);') && sharedUi.includes('switcher.classList.add("mflMobileWatchlistSwitcher");'), "Hydrated mobile Watchlist presentation must preserve the selector outside Views.");
invariant(!watchlistSource.includes("if (watchlistSwitcher) watchlistSwitcher.hidden = true;"), "Canonical Watchlist source must not hide the selector while route core loads.");
invariant(watchlistCore.includes('const visible = state.currentPage === "watchlist" && hasWalletOptIn();') && watchlistCore.includes("watchlistDropdown.replaceChildren();"), "Watchlist core must remain the final authoritative selector-state owner.");
invariant(bootstrap.includes('const insertionAnchor = switcher instanceof HTMLElement && switcher.parentElement === container') && bootstrap.includes('container.insertBefore(button, insertionAnchor);'), "Bootstrap view ordering must remain safe while the mobile selector is outside Views.");

console.log("Canonical Watchlist selector navigation, mobile first-paint, and page-transition chrome validation passed.");
