(() => {
  "use strict";

  const MOBILE_TABLE_MEDIA = window.matchMedia("(max-width: 900px)");
  const PHONE_TABLE_MEDIA = window.matchMedia("(max-width: 520px)");
  const TINY_TABLE_MEDIA = window.matchMedia("(max-width: 380px)");
  const MOBILE_PAGE_SIZE = "100";
  const VIEW_SCROLL_BUTTON_CLASS = "viewsScrollButton";
  const VIEW_SCROLL_VISIBLE_CLASS = "mflViewsScrollButtonVisible";
  const VIEW_SCROLL_CLASS = "mflViewsOverflowing";
  const VIEW_SCROLL_SHELL_CLASS = "viewsScrollerShell";
  const QUICK_FILTERS_SHELL_CLASS = "quickFiltersScrollerShell";
  const PLAYER_TABLE_FADE_LEFT_CLASS = "mflPlayerTableCanScrollLeft";
  const PLAYER_TABLE_FADE_RIGHT_CLASS = "mflPlayerTableCanScrollRight";
  const VIEW_SCROLL_EPSILON = 2;
  const PLAYER_TABLE_SCROLL_EPSILON = 2;
  const MOBILE_STYLE_ID = "mflInitialMobileTableStyle";
  const CONTROL_SELECTOR = `#pageSizeSelect, #watchlistButton, #openFiltersButton, .quickFilters input, .${VIEW_SCROLL_BUTTON_CLASS}, #sidebar .navButton[data-page], #filtersModal button`;
  const FILTERED_TABLE_PAGES = new Set(["database", "mfl", "progression", "watchlist", "agents", "myplayers"]);

  window.__mflSharedTableUiRuntime?.destroy?.();

  let destroyed = false;
  let pointerControl = null;
  let restoreBridgeInstalled = false;
  let coreLoadedBridgeInstalled = false;
  let viewSyncFrame = 0;
  let playerSyncFrame = 0;
  let viewResizeObserver = null;
  let playerResizeObserver = null;
  let boundPlayerScroller = null;
  let boundPlayerScrollHandler = null;
  const pendingViewScrollers = new Set();
  const boundViewScrollers = new Map();
  const scrollContainer = document.querySelector("main");

  function ensureMobileStyle() {
    const style = document.getElementById(MOBILE_STYLE_ID);
    if (!(style instanceof HTMLStyleElement)) return null;
    style.textContent = `
@media (max-width: 900px) {
  #progressionPage {
    --mfl-table-header-height: 28px;
    --mfl-table-row-height: 28px;
    --mfl-table-row-outer-height: 32px;
  }
  #progressionPage .tableShell {
    position: relative;
  }
  #progressionPage .tableShell::before,
  #progressionPage .tableShell::after {
    content: "";
    position: absolute;
    top: var(--mfl-table-header-height);
    bottom: 0;
    z-index: 2;
    width: 54px;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 140ms ease, visibility 0s linear 140ms;
  }
  #progressionPage .tableShell::before {
    left: 0;
    background: linear-gradient(90deg, var(--page-bg) 0%, color-mix(in srgb, var(--page-bg) 92%, transparent) 34%, color-mix(in srgb, var(--page-bg) 55%, transparent) 68%, transparent 100%);
  }
  #progressionPage .tableShell::after {
    right: 0;
    background: linear-gradient(270deg, var(--page-bg) 0%, color-mix(in srgb, var(--page-bg) 92%, transparent) 34%, color-mix(in srgb, var(--page-bg) 55%, transparent) 68%, transparent 100%);
  }
  #progressionPage .tableShell.${PLAYER_TABLE_FADE_LEFT_CLASS}::before,
  #progressionPage .tableShell.${PLAYER_TABLE_FADE_RIGHT_CLASS}::after {
    opacity: 0.94;
    visibility: visible;
    transition-delay: 0s;
  }
  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .tableShell::before,
  html:not(.mflInitialRouteResolved):not(.mflInitialRouteSuperseded)[data-initial-table-page] #progressionPage .tableShell::after {
    transition: none;
  }
  #progressionPage .playerTableScroller {
    display: block;
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
    touch-action: auto;
    -webkit-mask-image: none;
    mask-image: none;
  }
  #progressionPage .playerTableScroller table {
    width: 100%;
    min-width: 820px;
    max-width: none;
  }
  #progressionPage .playerTableScroller :is(th, td) {
    padding-inline: 2px;
  }
  #progressionPage .playerTableScroller :is(th, td).col-listing {
    padding-inline: 0;
    text-align: center;
  }
  #progressionPage #tableBody .listingCellTableHost {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    margin-inline: auto;
  }
  #progressionPage .playerTableScroller .listingCellContent {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    min-width: 18px;
    max-width: 18px;
    height: 18px;
    min-height: 18px;
    max-height: 18px;
    margin-inline: auto;
    gap: 0;
    padding: 0;
  }
  #progressionPage .playerTableScroller .listingCellPrice {
    display: none;
  }
  #progressionPage .playerTableScroller :is(th, td).selectionCell input,
  #progressionPage .quickFilters input[type="checkbox"] {
    box-sizing: border-box;
    flex: 0 0 13px;
    width: 13px;
    min-width: 13px;
    max-width: 13px;
    height: 13px;
    min-height: 13px;
    max-height: 13px;
    aspect-ratio: 1 / 1;
    background-size: 8px 6px;
    border-radius: 3px;
  }
  #progressionPage .playerTableScroller td.col-age .tableControlCellContent {
    gap: 1px;
  }
  #progressionPage .playerTableScroller .playerTableActionsButton {
    width: 18px;
    min-width: 18px;
    max-width: 18px;
    height: 18px;
    min-height: 18px;
    max-height: 18px;
    padding: 0;
  }
  #progressionPage .playerTableScroller .playerTableActionsButton svg {
    width: 12px;
    height: 12px;
  }
  #progressionPage .playerTableScroller .flagImage {
    width: 14px;
    height: 14px;
  }
  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) {
    flex: 0 0 11px;
    width: 11px;
    min-width: 11px;
    max-width: 11px;
    height: 11px;
    min-height: 11px;
    max-height: 11px;
    margin: 0;
    transform: none;
  }
  #progressionPage .playerTableScroller .retirementMarker::before,
  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) img {
    width: 11px;
    height: 11px;
  }
  #progressionPage .playerTableScroller .newMintMarker .newMintIcon {
    width: 11px;
    height: 11px;
  }
  #progressionPage .playerTableScroller .retirementMarker::before {
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
  }
  #progressionPage .playerTableScroller .playerNoteIcon {
    font-size: 9px;
    line-height: 1;
  }
  #progressionPage .playerTableScroller .listingCellIcon {
    flex: 0 0 9px;
    width: 9px;
    height: 9px;
  }
  #progressionPage #tableBody .tableOverallRarityCircle {
    flex: 0 0 5px;
    width: 5px;
    height: 5px;
    margin-right: 1px;
  }
  #progressionPage .playerTableScroller .sortArrow {
    transform: scale(0.75);
    transform-origin: center;
  }
  #progressionPage nav.pager {
    --mfl-mobile-pager-button-width: clamp(60px, calc(43.923px + 4.231vw), 82px);
    --mfl-mobile-pager-button-height: clamp(32px, calc(26.154px + 1.538vw), 40px);
    --mfl-mobile-pager-font-size: clamp(10px, calc(8.538px + 0.385vw), 12px);
    --mfl-mobile-pager-inline-padding: clamp(5px, calc(1.346px + 0.962vw), 10px);
    --mfl-mobile-pager-page-gap: clamp(5px, calc(-0.115px + 1.346vw), 12px);
    --mfl-mobile-pager-block-padding: clamp(5px, calc(2.077px + 0.769vw), 9px);
    gap: 0;
    padding-block: var(--mfl-mobile-pager-block-padding);
    font-size: var(--mfl-mobile-pager-font-size);
  }
  #progressionPage nav.pager > :is(#prevButton, #nextButton) {
    flex: 0 0 var(--mfl-mobile-pager-button-width);
    width: var(--mfl-mobile-pager-button-width);
    min-width: var(--mfl-mobile-pager-button-width);
    max-width: var(--mfl-mobile-pager-button-width);
    height: var(--mfl-mobile-pager-button-height);
    min-height: var(--mfl-mobile-pager-button-height);
    max-height: var(--mfl-mobile-pager-button-height);
    padding-inline: var(--mfl-mobile-pager-inline-padding);
    font-size: var(--mfl-mobile-pager-font-size);
  }
  #progressionPage nav.pager > span#pageText {
    flex: 0 0 auto;
    width: auto;
    min-width: 0;
    max-width: none;
    margin-inline: var(--mfl-mobile-pager-page-gap);
    padding: 0;
    font-size: var(--mfl-mobile-pager-font-size);
    white-space: nowrap;
  }
  #progressionPage .viewsScrollButton.mflViewsScrollButtonVisible {
    opacity: 0.92;
  }
  #progressionPage #tableHead th.col-listing > span:first-child {
    font-size: 0;
  }
}
@media (min-width: 521px) and (max-width: 900px) {
  #progressionPage #tableHead th:nth-child(6) > span:first-child,
  #progressionPage #tableHead th:nth-child(n+9):nth-child(-n+15) > span:first-child {
    font-size: 10px;
  }
  #progressionPage #tableHead th:nth-child(6) > span:first-child::after,
  #progressionPage #tableHead th:nth-child(n+9):nth-child(-n+15) > span:first-child::after {
    content: none;
    display: none;
  }
}
@media (max-width: 700px) {
  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) {
    flex-basis: 10px;
    width: 10px;
    min-width: 10px;
    max-width: 10px;
    height: 10px;
    min-height: 10px;
    max-height: 10px;
  }
  #progressionPage .playerTableScroller .retirementMarker::before,
  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) img {
    width: 10px;
    height: 10px;
  }
  #progressionPage .playerTableScroller .newMintMarker .newMintIcon {
    width: 10px;
    height: 10px;
  }
}
@media (max-width: 520px) {
  #progressionPage {
    --mfl-table-header-height: 25px;
    --mfl-table-row-height: 24px;
    --mfl-table-row-outer-height: 28px;
  }
  #progressionPage .tableShell::before,
  #progressionPage .tableShell::after {
    width: 46px;
  }
  #progressionPage .playerTableScroller table {
    min-width: 680px;
  }
  #progressionPage .playerTableScroller :is(th, td).selectionCell input,
  #progressionPage .quickFilters input[type="checkbox"] {
    flex-basis: 11px;
    width: 11px;
    min-width: 11px;
    max-width: 11px;
    height: 11px;
    min-height: 11px;
    max-height: 11px;
    background-size: 7px 5px;
  }
  #progressionPage .playerTableScroller .playerTableActionsButton {
    width: 15px;
    min-width: 15px;
    max-width: 15px;
    height: 15px;
    min-height: 15px;
    max-height: 15px;
  }
  #progressionPage .playerTableScroller .playerTableActionsButton svg {
    width: 9px;
    height: 9px;
  }
  #progressionPage .playerTableScroller .flagImage {
    width: 11px;
    height: 11px;
  }
  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) {
    flex-basis: 9px;
    width: 9px;
    min-width: 9px;
    max-width: 9px;
    height: 9px;
    min-height: 9px;
    max-height: 9px;
  }
  #progressionPage .playerTableScroller .retirementMarker::before,
  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) img {
    width: 9px;
    height: 9px;
  }
  #progressionPage .playerTableScroller .newMintMarker .newMintIcon {
    width: 9px;
    height: 9px;
  }
  #progressionPage .playerTableScroller .playerNoteIcon {
    font-size: 7px;
  }
  #progressionPage .playerTableScroller .listingCellContent {
    width: 15px;
    min-width: 15px;
    max-width: 15px;
    height: 15px;
    min-height: 15px;
    max-height: 15px;
  }
  #progressionPage .playerTableScroller .listingCellIcon {
    flex-basis: 7px;
    width: 7px;
    height: 7px;
  }
  #progressionPage #tableBody .tableOverallRarityCircle {
    flex-basis: 4px;
    width: 4px;
    height: 4px;
  }
  #progressionPage .playerTableScroller .sortArrow {
    transform: scale(0.62);
  }
}
@media (max-width: 380px) {
  #progressionPage {
    --mfl-table-header-height: 23px;
    --mfl-table-row-height: 22px;
    --mfl-table-row-outer-height: 26px;
  }
  #progressionPage .tableShell::before,
  #progressionPage .tableShell::after {
    width: 40px;
  }
  #progressionPage .playerTableScroller table {
    min-width: 600px;
  }
  #progressionPage .playerTableScroller :is(th, td).selectionCell input,
  #progressionPage .quickFilters input[type="checkbox"] {
    flex-basis: 10px;
    width: 10px;
    min-width: 10px;
    max-width: 10px;
    height: 10px;
    min-height: 10px;
    max-height: 10px;
    background-size: 6px 4px;
  }
  #progressionPage .playerTableScroller .playerTableActionsButton {
    width: 13px;
    min-width: 13px;
    max-width: 13px;
    height: 13px;
    min-height: 13px;
    max-height: 13px;
  }
  #progressionPage .playerTableScroller .playerTableActionsButton svg {
    width: 8px;
    height: 8px;
  }
  #progressionPage .playerTableScroller .flagImage {
    width: 10px;
    height: 10px;
  }
  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) {
    flex-basis: 8px;
    width: 8px;
    min-width: 8px;
    max-width: 8px;
    height: 8px;
    min-height: 8px;
    max-height: 8px;
  }
  #progressionPage .playerTableScroller .retirementMarker::before,
  #progressionPage .playerTableScroller :is(.retirementMarker, .newMintMarker) img {
    width: 8px;
    height: 8px;
  }
  #progressionPage .playerTableScroller .newMintMarker .newMintIcon {
    width: 8px;
    height: 8px;
  }
  #progressionPage .playerTableScroller .listingCellContent {
    width: 13px;
    min-width: 13px;
    max-width: 13px;
    height: 13px;
    min-height: 13px;
    max-height: 13px;
  }
  #progressionPage .playerTableScroller .listingCellIcon {
    flex-basis: 6px;
    width: 6px;
    height: 6px;
  }
  #progressionPage #tableBody .tableOverallRarityCircle {
    flex-basis: 3px;
    width: 3px;
    height: 3px;
  }
  #progressionPage .playerTableScroller .sortArrow {
    transform: scale(0.54);
  }
}`;
    document.head.appendChild(style);
    return style;
  }

  function controlFromTarget(target) {
    if (!(target instanceof Element)) return null;
    const control = target.closest(CONTROL_SELECTOR);
    return control instanceof HTMLElement ? control : null;
  }

  function releaseFocus(control) {
    if (!(control instanceof HTMLElement)) return;
    queueMicrotask(() => {
      if (!destroyed && document.activeElement === control) control.blur();
    });
  }

  function filterRuleIsActive(rule) {
    if (!(rule instanceof HTMLElement)) return false;
    const operator = String(rule.querySelector("[data-filter-operator]")?.value || "");
    const values = Array.from(rule.querySelectorAll("[data-filter-value]"));
    const value = String(values[0]?.value || "").trim();
    const valueTo = String(values[1]?.value || "").trim();
    return operator === "between" || operator === "during" ? Boolean(value && valueTo) : Boolean(value);
  }

  function activeFilterCountFromDialog() {
    return Array.from(document.querySelectorAll("#filterRules .filterRule")).filter(filterRuleIsActive).length;
  }

  function syncFilterSummaryNow() {
    const count = activeFilterCountFromDialog();
    const canonicalUpdater = Reflect.get(window, "updateFilterSummary");
    if (typeof canonicalUpdater === "function") {
      canonicalUpdater(count);
      return;
    }
    const summary = document.getElementById("filterSummary");
    if (summary instanceof HTMLElement) summary.textContent = String(count);
  }

  function syncFilterSummaryAfterClose() {
    queueMicrotask(() => {
      if (!destroyed) syncFilterSummaryNow();
    });
  }

  function filtersModalIsOpen() {
    const modal = document.getElementById("filtersModal");
    return modal instanceof HTMLElement && !modal.hidden;
  }

  function markInitialTableFiltersForReset() {
    const page = String(document.documentElement.dataset.initialTablePage || "").toLowerCase();
    if (FILTERED_TABLE_PAGES.has(page)) document.documentElement.dataset.mflResetTableFilters = page;
  }

  function clearTableHoverState() {
    const body = document.getElementById("tableBody");
    if (body instanceof HTMLElement) body.dispatchEvent(new Event("pointerleave"));
  }

  function installRestoreBridge() {
    if (destroyed || restoreBridgeInstalled) return restoreBridgeInstalled;
    try {
      restoreBridgeInstalled = Boolean(window.eval(`(() => {
        if (typeof restoreSavedTableState !== "function") return false;
        if (restoreSavedTableState.__mflMobilePageSize) return true;
        const originalRestoreSavedTableState = restoreSavedTableState;
        const restoreWithMobilePageSize = function() {
          const result = originalRestoreSavedTableState.apply(this, arguments);
          if (window.__mflMobileTablePageSizeActive && typeof state === "object" && state) {
            state.pageSize = 100;
            state.page = 1;
            const select = document.getElementById("pageSizeSelect");
            if (select instanceof HTMLSelectElement) select.value = "100";
          }
          return result;
        };
        Object.defineProperty(restoreWithMobilePageSize, "__mflMobilePageSize", { value: true });
        restoreSavedTableState = restoreWithMobilePageSize;
        return true;
      })()`));
    } catch (error) {
      console.warn("Could not install mobile table page-size bridge.", error);
      restoreBridgeInstalled = false;
    }
    return restoreBridgeInstalled;
  }

  function installCoreLoadedBridge() {
    if (destroyed || coreLoadedBridgeInstalled || restoreBridgeInstalled) return restoreBridgeInstalled || coreLoadedBridgeInstalled;
    const marker = window.__mflMarkApplicationCoreLoaded;
    if (typeof marker !== "function") return false;
    if (marker.__mflMobilePageSizeBridge) {
      coreLoadedBridgeInstalled = true;
      return true;
    }
    const bridgedMarker = function() {
      const result = marker.apply(this, arguments);
      installRestoreBridge();
      schedulePlayerTableSync();
      return result;
    };
    Object.defineProperty(bridgedMarker, "__mflMobilePageSizeBridge", { value: true });
    window.__mflMarkApplicationCoreLoaded = bridgedMarker;
    coreLoadedBridgeInstalled = true;
    return true;
  }

  function enforceMobilePageSize() {
    if (destroyed || !MOBILE_TABLE_MEDIA.matches) return false;
    const select = document.getElementById("pageSizeSelect");
    if (!(select instanceof HTMLSelectElement) || select.value === MOBILE_PAGE_SIZE) return false;
    select.value = MOBILE_PAGE_SIZE;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function ensureMobilePageSizeOwnership() {
    window.__mflMobileTablePageSizeActive = MOBILE_TABLE_MEDIA.matches;
    if (!installRestoreBridge()) installCoreLoadedBridge();
    if (MOBILE_TABLE_MEDIA.matches) enforceMobilePageSize();
  }

  function tableViews() {
    const views = document.querySelector("#progressionPage .views");
    return views instanceof HTMLElement ? views : null;
  }

  function tableQuickFilters() {
    const filters = document.querySelector("#progressionPage .quickFilters");
    return filters instanceof HTMLElement ? filters : null;
  }

  function tableHorizontalScrollers() {
    return [tableViews(), tableQuickFilters()].filter((scroller) => scroller instanceof HTMLElement);
  }

  function playerTableScroller() {
    const scroller = document.querySelector("#progressionPage .playerTableScroller");
    return scroller instanceof HTMLElement ? scroller : null;
  }

  function playerTableShell(scroller = playerTableScroller()) {
    const shell = scroller instanceof HTMLElement ? scroller.closest("#progressionPage .tableShell") : null;
    return shell instanceof HTMLElement ? shell : null;
  }

  function setPlayerTableFadeDirections(scroller, canScrollLeft, canScrollRight) {
    const shell = playerTableShell(scroller);
    if (!(shell instanceof HTMLElement)) return;
    shell.classList.toggle(PLAYER_TABLE_FADE_LEFT_CLASS, canScrollLeft);
    shell.classList.toggle(PLAYER_TABLE_FADE_RIGHT_CLASS, canScrollRight);
  }

  function quickFiltersPlayerCount(views) {
    if (!(views instanceof HTMLElement) || !views.matches("#progressionPage .quickFilters")) return null;
    const count = document.getElementById("watchlistPlayerCount");
    return count instanceof HTMLElement ? count : null;
  }

  function viewScrollShell(views, create = false) {
    if (!(views instanceof HTMLElement)) return null;
    const parent = views.parentElement;
    if (parent instanceof HTMLElement && parent.classList.contains(VIEW_SCROLL_SHELL_CLASS)) return parent;
    if (!create) return null;
    const shell = document.createElement("div");
    shell.className = VIEW_SCROLL_SHELL_CLASS;
    if (views.matches("#progressionPage .quickFilters")) shell.classList.add(QUICK_FILTERS_SHELL_CLASS);
    views.insertAdjacentElement("beforebegin", shell);
    shell.appendChild(views);
    const count = quickFiltersPlayerCount(views);
    if (count?.parentElement === views) shell.insertAdjacentElement("afterend", count);
    return shell;
  }

  function removeViewScrollShell(views) {
    const shell = viewScrollShell(views);
    if (!(shell instanceof HTMLElement) || !(shell.parentElement instanceof HTMLElement)) return;
    const count = quickFiltersPlayerCount(views);
    shell.replaceWith(views);
    if (count instanceof HTMLElement && count.parentElement !== views) views.appendChild(count);
  }

  function mobileWatchlistRouteActive() {
    if (!MOBILE_TABLE_MEDIA.matches) return false;
    if (/^\/watchlist(?:\/|$)/i.test(window.location.pathname)) return true;
    if (String(document.body.dataset.page || "").toLowerCase() === "watchlist") return true;
    const root = document.documentElement;
    return !root.classList.contains("mflInitialRouteResolved")
      && !root.classList.contains("mflInitialRouteSuperseded")
      && String(root.dataset.initialTablePage || "").toLowerCase() === "watchlist";
  }

  function syncWatchlistSwitcherPlacement() {
    const views = tableViews();
    const switcher = document.getElementById("watchlistSwitcher");
    if (!(views instanceof HTMLElement) || !(switcher instanceof HTMLElement)) return;
    if (mobileWatchlistRouteActive()) {
      if (switcher.parentElement === views) {
        const shell = viewScrollShell(views);
        (shell || views).insertAdjacentElement("afterend", switcher);
      }
      switcher.classList.add("mflMobileWatchlistSwitcher");
      return;
    }
    switcher.classList.remove("mflMobileWatchlistSwitcher");
    if (switcher.parentElement !== views) views.appendChild(switcher);
  }

  function setViewScrollButtonVisible(button, visible) {
    if (!(button instanceof HTMLButtonElement)) return;
    button.classList.toggle(VIEW_SCROLL_VISIBLE_CLASS, visible);
    button.setAttribute("aria-hidden", visible ? "false" : "true");
    button.tabIndex = visible ? 0 : -1;
  }

  function scrollerLabel(views) {
    return views.matches("#progressionPage .quickFilters") ? "quick filters" : "views";
  }

  function viewScrollButton(views) {
    const shell = viewScrollShell(views, true);
    if (!(shell instanceof HTMLElement)) return null;
    const existing = shell.querySelector(`:scope > .${VIEW_SCROLL_BUTTON_CLASS}.viewsScrollButtonRight`);
    if (existing instanceof HTMLButtonElement) return existing;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `${VIEW_SCROLL_BUTTON_CLASS} viewsScrollButtonRight`;
    button.setAttribute("aria-label", `Scroll ${scrollerLabel(views)} right`);
    button.setAttribute("aria-hidden", "true");
    button.tabIndex = -1;
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>';
    button.addEventListener("click", () => {
      const maxScroll = viewMaxScroll(views);
      const distance = Math.max(96, Math.floor(views.clientWidth * 0.72));
      const target = Math.min(maxScroll, views.scrollLeft + distance);
      views.scrollTo({ left: target, behavior: "smooth" });
    });
    shell.appendChild(button);
    return button;
  }

  function viewScrollLeftButton(views) {
    const shell = viewScrollShell(views, true);
    if (!(shell instanceof HTMLElement)) return null;
    const existing = shell.querySelector(`:scope > .${VIEW_SCROLL_BUTTON_CLASS}.viewsScrollButtonLeft`);
    if (existing instanceof HTMLButtonElement) return existing;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `${VIEW_SCROLL_BUTTON_CLASS} viewsScrollButtonLeft`;
    button.setAttribute("aria-label", `Scroll ${scrollerLabel(views)} left`);
    button.setAttribute("aria-hidden", "true");
    button.tabIndex = -1;
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>';
    button.addEventListener("click", () => {
      const distance = Math.max(96, Math.floor(views.clientWidth * 0.72));
      const target = Math.max(0, views.scrollLeft - distance);
      views.scrollTo({ left: target, behavior: "smooth" });
    });
    shell.appendChild(button);
    return button;
  }

  function renderedViewItems(views) {
    return Array.from(views.children).filter((child) => {
      if (!(child instanceof HTMLElement) || child.hidden) return false;
      const style = getComputedStyle(child);
      return style.display !== "none" && style.position !== "absolute" && child.getClientRects().length > 0;
    });
  }

  function viewContentWidth(views) {
    const items = renderedViewItems(views);
    if (!items.length) return 0;
    const viewStyle = getComputedStyle(views);
    const gap = Number.parseFloat(viewStyle.columnGap || viewStyle.gap) || 0;
    const itemWidth = items.reduce((total, item) => {
      const style = getComputedStyle(item);
      return total + item.getBoundingClientRect().width
        + (Number.parseFloat(style.marginLeft) || 0)
        + (Number.parseFloat(style.marginRight) || 0);
    }, 0);
    return itemWidth + gap * Math.max(0, items.length - 1);
  }

  function viewMaxScroll(views) {
    return Math.max(0, views.scrollWidth - views.clientWidth);
  }

  function clampViewScroll(views, maxScroll = viewMaxScroll(views)) {
    const clamped = Math.min(maxScroll, Math.max(0, views.scrollLeft));
    if (Math.abs(views.scrollLeft - clamped) > VIEW_SCROLL_EPSILON) views.scrollLeft = clamped;
    return clamped;
  }

  function fadeShadow(canScrollLeft, canScrollRight, strength = 56) {
    const shadows = [];
    if (canScrollLeft) shadows.push(`inset ${strength}px 0 ${strength}px -${Math.round(strength * 0.72)}px var(--page-bg)`);
    if (canScrollRight) shadows.push(`inset -${strength}px 0 ${strength}px -${Math.round(strength * 0.72)}px var(--page-bg)`);
    return shadows.join(", ");
  }

  function applyFadeShadow(scroller, canScrollLeft, canScrollRight, strength) {
    if (!(scroller instanceof HTMLElement)) return;
    const shadow = fadeShadow(canScrollLeft, canScrollRight, strength);
    if (shadow) scroller.style.boxShadow = shadow;
    else scroller.style.removeProperty("box-shadow");
  }

  function syncViewScroller(views) {
    if (!(views instanceof HTMLElement) || !views.isConnected) return;
    if (!MOBILE_TABLE_MEDIA.matches || views.getClientRects().length === 0) {
      views.classList.remove(VIEW_SCROLL_CLASS);
      applyFadeShadow(views, false, false, 0);
      if (views.scrollLeft) views.scrollLeft = 0;
      removeViewScrollShell(views);
      return;
    }
    const button = viewScrollButton(views);
    const leftButton = viewScrollLeftButton(views);
    if (!(button instanceof HTMLButtonElement) || !(leftButton instanceof HTMLButtonElement)) return;
    setViewScrollButtonVisible(button, false);
    setViewScrollButtonVisible(leftButton, false);
    const overflowing = viewContentWidth(views) - views.clientWidth > VIEW_SCROLL_EPSILON;
    views.classList.toggle(VIEW_SCROLL_CLASS, overflowing);
    if (!overflowing) {
      applyFadeShadow(views, false, false, 0);
      if (views.scrollLeft) views.scrollLeft = 0;
      return;
    }
    const maxScroll = viewMaxScroll(views);
    const scrollLeft = clampViewScroll(views, maxScroll);
    const canScrollLeft = scrollLeft > VIEW_SCROLL_EPSILON;
    const canScrollRight = maxScroll - scrollLeft > VIEW_SCROLL_EPSILON;
    setViewScrollButtonVisible(leftButton, canScrollLeft);
    setViewScrollButtonVisible(button, canScrollRight);
    applyFadeShadow(views, canScrollLeft, canScrollRight, views.matches(".quickFilters") ? 72 : 96);
  }

  function syncMobileColumnWidths() {
    const page = document.getElementById("progressionPage");
    if (!(page instanceof HTMLElement)) return;
    page.style.removeProperty("--mfl-table-col-listing");
    page.style.removeProperty("--mfl-table-col-name");
    page.style.removeProperty("--mfl-table-col-contract-render-name");
    page.style.removeProperty("--mfl-table-col-positions");
    if (!MOBILE_TABLE_MEDIA.matches) return;

    const baseStyle = getComputedStyle(page);
    const baseListing = Number.parseFloat(baseStyle.getPropertyValue("--mfl-table-col-listing")) || 6.3904569176696135;
    const basePositions = Number.parseFloat(baseStyle.getPropertyValue("--mfl-table-col-positions")) || 7.508786878261796;
    const targetListing = TINY_TABLE_MEDIA.matches ? 3.6 : PHONE_TABLE_MEDIA.matches ? 3.8 : 4.2;
    const reclaimed = Math.max(0, baseListing - targetListing);
    page.style.setProperty("--mfl-table-col-listing", `${targetListing}%`);
    page.style.setProperty("--mfl-table-col-positions", `${basePositions + reclaimed}%`);
  }

  function syncWidthAwareHeaderLabels() {
    const compact = PHONE_TABLE_MEDIA.matches;
    const mobile = MOBILE_TABLE_MEDIA.matches;
    document.querySelectorAll("#progressionPage #tableHead th > span:first-child").forEach((label) => {
      if (!(label instanceof HTMLElement)) return;
      const header = label.closest("th");
      if (!(header instanceof HTMLTableCellElement)) return;
      const full = String(label.dataset.mflFullTableLabel || "").trim();
      const short = String(label.dataset.mflCompactTableLabel || "").trim();
      if (!full) return;
      const column = String(header.dataset.tableColumn || "");
      const desired = mobile && column === "listing_price"
        ? ""
        : mobile && column === "positions"
          ? "POSITIONS"
          : compact && short
            ? short
            : full;
      if (label.textContent !== desired) label.textContent = desired;
    });
  }

  function syncPlayerTableFadeState(scroller = playerTableScroller()) {
    if (!(scroller instanceof HTMLElement)) return;
    scroller.style.removeProperty("box-shadow");
    if (!MOBILE_TABLE_MEDIA.matches || scroller.getClientRects().length === 0) {
      setPlayerTableFadeDirections(scroller, false, false);
      return;
    }
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const scrollLeft = Math.min(maxScroll, Math.max(0, scroller.scrollLeft));
    const overflowing = maxScroll > PLAYER_TABLE_SCROLL_EPSILON;
    const canScrollLeft = overflowing && scrollLeft > PLAYER_TABLE_SCROLL_EPSILON;
    const canScrollRight = overflowing && maxScroll - scrollLeft > PLAYER_TABLE_SCROLL_EPSILON;
    setPlayerTableFadeDirections(scroller, canScrollLeft, canScrollRight);
  }

  function syncPlayerTableScroller() {
    const scroller = playerTableScroller();
    syncMobileColumnWidths();
    syncWidthAwareHeaderLabels();
    if (!(scroller instanceof HTMLElement)) return;
    syncPlayerTableFadeState(scroller);
  }

  function schedulePlayerTableSync() {
    if (destroyed) return;
    syncPlayerTableFadeState();
    if (playerSyncFrame) return;
    playerSyncFrame = requestAnimationFrame(() => {
      playerSyncFrame = 0;
      syncPlayerTableScroller();
    });
  }

  function ensurePlayerResizeObserver() {
    if (playerResizeObserver || typeof ResizeObserver !== "function") return playerResizeObserver;
    playerResizeObserver = new ResizeObserver(() => schedulePlayerTableSync());
    return playerResizeObserver;
  }

  function ensurePlayerScroller() {
    const scroller = playerTableScroller();
    if (!(scroller instanceof HTMLElement)) return;
    if (boundPlayerScroller !== scroller) {
      if (boundPlayerScroller && boundPlayerScrollHandler) boundPlayerScroller.removeEventListener("scroll", boundPlayerScrollHandler);
      boundPlayerScroller = scroller;
      boundPlayerScrollHandler = () => {
        clearTableHoverState();
        window.__mflStaticUiRuntime?.hideTooltips?.({ immediate: true });
        schedulePlayerTableSync();
      };
      scroller.addEventListener("scroll", boundPlayerScrollHandler, { passive: true });
    }
    const observer = ensurePlayerResizeObserver();
    observer?.disconnect();
    observer?.observe(scroller);
    const table = scroller.querySelector("table");
    if (table instanceof HTMLElement) observer?.observe(table);
    const head = document.getElementById("tableHead");
    const body = document.getElementById("tableBody");
    if (head instanceof HTMLElement) observer?.observe(head);
    if (body instanceof HTMLElement) observer?.observe(body);
    schedulePlayerTableSync();
  }

  function syncRouteHorizontalCuesNow() {
    if (destroyed) return;
    syncWatchlistSwitcherPlacement();
    tableHorizontalScrollers().forEach(syncViewScroller);
    syncPlayerTableScroller();
  }

  function scheduleViewScrollerSync(views = null) {
    if (destroyed) return;
    syncWatchlistSwitcherPlacement();
    if (views instanceof HTMLElement) pendingViewScrollers.add(views);
    else tableHorizontalScrollers().forEach((candidate) => pendingViewScrollers.add(candidate));
    if (viewSyncFrame) return;
    viewSyncFrame = requestAnimationFrame(() => {
      viewSyncFrame = 0;
      const scrollers = Array.from(pendingViewScrollers);
      pendingViewScrollers.clear();
      scrollers.forEach(syncViewScroller);
    });
  }

  function ensureViewResizeObserver() {
    if (viewResizeObserver || typeof ResizeObserver !== "function") return viewResizeObserver;
    viewResizeObserver = new ResizeObserver((entries) => {
      const scrollers = new Set();
      entries.forEach((entry) => {
        const target = entry.target;
        const views = target instanceof Element && target.matches("#progressionPage .views, #progressionPage .quickFilters")
          ? target
          : target instanceof Element
            ? target.closest("#progressionPage .views, #progressionPage .quickFilters")
            : null;
        if (views instanceof HTMLElement) scrollers.add(views);
      });
      scrollers.forEach((views) => scheduleViewScrollerSync(views));
    });
    return viewResizeObserver;
  }

  function observeViewScroller(views) {
    const observer = ensureViewResizeObserver();
    if (!observer) return;
    observer.observe(views);
    Array.from(views.children).forEach((child) => {
      if (child instanceof HTMLElement) observer.observe(child);
    });
  }

  function ensureViewScrollers() {
    tableHorizontalScrollers().forEach((candidate) => {
      if (MOBILE_TABLE_MEDIA.matches) {
        viewScrollButton(candidate);
        viewScrollLeftButton(candidate);
      }
      observeViewScroller(candidate);
      if (!boundViewScrollers.has(candidate)) {
        const onViewScroll = () => {
          clampViewScroll(candidate);
          scheduleViewScrollerSync(candidate);
        };
        candidate.addEventListener("scroll", onViewScroll, { passive: true });
        boundViewScrollers.set(candidate, onViewScroll);
      }
      scheduleViewScrollerSync(candidate);
    });
  }

  function onMobileTableMediaChange(event) {
    window.__mflMobileTablePageSizeActive = event.matches;
    if (event.matches) enforceMobilePageSize();
    syncWatchlistSwitcherPlacement();
    ensureViewScrollers();
    ensurePlayerScroller();
    scheduleViewScrollerSync();
    schedulePlayerTableSync();
  }

  function onResponsiveSizeChange() {
    scheduleViewScrollerSync();
    schedulePlayerTableSync();
  }

  function onPointerDown(event) {
    pointerControl = controlFromTarget(event.target);
  }

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("#applyFiltersButton")) syncFilterSummaryNow();
    else if (target?.closest("#closeFiltersButton") || target?.id === "filtersModal") syncFilterSummaryAfterClose();
    const control = controlFromTarget(event.target);
    if (control && control === pointerControl) releaseFocus(control);
    pointerControl = null;
  }

  function onChange(event) {
    const control = controlFromTarget(event.target);
    if (control?.id === "pageSizeSelect") releaseFocus(control);
  }

  function onKeyDown(event) {
    if (event.key === "Enter" && filtersModalIsOpen()) syncFilterSummaryNow();
    if (event.key !== "Escape") return;
    if (filtersModalIsOpen()) syncFilterSummaryAfterClose();
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.matches(CONTROL_SELECTOR)) releaseFocus(active);
  }

  function onScroll() {
    clearTableHoverState();
  }

  function sync() {
    ensureMobileStyle();
    markInitialTableFiltersForReset();
    syncFilterSummaryNow();
    ensureMobilePageSizeOwnership();
    syncWatchlistSwitcherPlacement();
    ensureViewScrollers();
    ensurePlayerScroller();
    syncRouteHorizontalCuesNow();
  }

  function destroy() {
    destroyed = true;
    window.__mflMobileTablePageSizeActive = false;
    const views = tableViews();
    const switcher = document.getElementById("watchlistSwitcher");
    if (views instanceof HTMLElement && switcher instanceof HTMLElement && switcher.parentElement !== views) {
      switcher.classList.remove("mflMobileWatchlistSwitcher");
      views.appendChild(switcher);
    }
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("change", onChange, true);
    document.removeEventListener("keydown", onKeyDown, true);
    scrollContainer?.removeEventListener("scroll", onScroll);
    MOBILE_TABLE_MEDIA.removeEventListener("change", onMobileTableMediaChange);
    PHONE_TABLE_MEDIA.removeEventListener("change", onResponsiveSizeChange);
    TINY_TABLE_MEDIA.removeEventListener("change", onResponsiveSizeChange);
    boundViewScrollers.forEach((handler, scroller) => scroller.removeEventListener("scroll", handler));
    boundViewScrollers.clear();
    if (boundPlayerScroller && boundPlayerScrollHandler) boundPlayerScroller.removeEventListener("scroll", boundPlayerScrollHandler);
    boundPlayerScroller = null;
    boundPlayerScrollHandler = null;
    viewResizeObserver?.disconnect();
    playerResizeObserver?.disconnect();
    viewResizeObserver = null;
    playerResizeObserver = null;
    pendingViewScrollers.clear();
    if (viewSyncFrame) cancelAnimationFrame(viewSyncFrame);
    if (playerSyncFrame) cancelAnimationFrame(playerSyncFrame);
    viewSyncFrame = 0;
    playerSyncFrame = 0;
    tableHorizontalScrollers().forEach((scroller) => {
      scroller.classList.remove(VIEW_SCROLL_CLASS);
      applyFadeShadow(scroller, false, false, 0);
      removeViewScrollShell(scroller);
    });
    const player = playerTableScroller();
    if (player) {
      player.style.removeProperty("box-shadow");
      setPlayerTableFadeDirections(player, false, false);
    }
    syncMobileColumnWidths();
  }

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("change", onChange, true);
  document.addEventListener("keydown", onKeyDown, true);
  scrollContainer?.addEventListener("scroll", onScroll, { passive: true });
  MOBILE_TABLE_MEDIA.addEventListener("change", onMobileTableMediaChange);
  PHONE_TABLE_MEDIA.addEventListener("change", onResponsiveSizeChange);
  TINY_TABLE_MEDIA.addEventListener("change", onResponsiveSizeChange);

  sync();
  window.__mflSharedTableUiRuntime = Object.freeze({ sync, syncRouteHorizontalCuesNow, destroy });
})();