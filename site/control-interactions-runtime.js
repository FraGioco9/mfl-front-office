(() => {
  "use strict";

  window.__mflControlInteractionsRuntime?.destroy?.();

  const BUTTON_GESTURE_SELECTOR = [
    "button",
    'input[type="button"]',
    'input[type="submit"]',
    'input[type="reset"]',
    '[role="button"]',
  ].join(", ");
  const POINTER_ESCAPE_CONTROL_SELECTOR = [
    BUTTON_GESTURE_SELECTOR,
    'input[type="checkbox"]',
    'input[type="radio"]',
  ].join(", ");
  const SEARCH_INPUT_SELECTOR = "#playerSearchInput, #evaluationSearchInput";
  const DRAG_ACTIVATION_THRESHOLD_PX = 6;
  const PLAYER_VIEW_SCROLL_MEDIA = window.matchMedia("(max-width: 900px)");

  let pointerFocusedControl = null;
  let gestureStartControl = null;
  let gesturePointerId = null;
  let gestureStartX = 0;
  let gestureStartY = 0;
  let gestureDragged = false;
  let suppressClickControl = null;
  let suppressClickTimer = 0;
  let navigationIntentToken = "";
  let escapeHandlerSequence = 0;
  let playerAttributeViewScrollPathname = "";
  let playerAttributeViewScrollLeft = 0;
  let playerAttributeViewRestoreFrame = 0;
  let playerAttributeViewRestoring = false;
  let playerAttributeViewMutationObserver = null;
  const escapeHandlers = new Map();

  function motionDurationMs(propertyName, fallbackMs) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(String(propertyName || "")).trim();
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) return fallbackMs;
    if (raw.endsWith("ms")) return value;
    if (raw.endsWith("s")) return value * 1000;
    return fallbackMs;
  }

  function disableSearchSpellcheck() {
    document.querySelectorAll(SEARCH_INPUT_SELECTOR).forEach((field) => {
      if (!(field instanceof HTMLInputElement)) return;
      field.spellcheck = false;
      field.setAttribute("spellcheck", "false");
    });
  }

  function normalizeAddFilterSelect(select = document.getElementById("addFilterSelect")) {
    if (!(select instanceof HTMLSelectElement)) return;
    select.hidden = false;
    const placeholder = Array.from(select.options).find((option) => option.value === "");
    if (placeholder) {
    placeholder.textContent = "Add filter...";
    placeholder.disabled = true;
    placeholder.hidden = true;
    if (!select.value) placeholder.selected = true;
  }
  }

  function initializeAddFilterControl() {
    const button = document.getElementById("showAddFilterButton");
    if (button instanceof HTMLButtonElement) {
      button.hidden = true;
      button.tabIndex = -1;
      button.setAttribute("aria-hidden", "true");
    }

    normalizeAddFilterSelect();
  }

  function scheduleAddFilterNormalization() {
    queueMicrotask(() => normalizeAddFilterSelect());
  }

  function navigationController() {
    const controller = window.__mflNavigation;
    return controller && typeof controller === "object" ? controller : null;
  }

  function navigationIntentPage(target) {
    if (!(target instanceof Element)) return "";

    const control = target.closest("#sidebar .navButton[data-page]");
    if (control instanceof HTMLElement) return String(control.dataset.page || "");

    const link = target.closest("a[href]");
    if (!(link instanceof HTMLAnchorElement)) return "";
    if (link.hasAttribute("download")) return "";
    const linkTarget = String(link.getAttribute("target") || "").toLowerCase();
    if (linkTarget && linkTarget !== "_self") return "";

    let url;
    try {
      url = new URL(link.href, window.location.href);
    } catch {
      return "";
    }
    if (url.origin !== window.location.origin) return "";

    const canonicalRequest = window.__mflAppConfig?.routes?.canonicalRequest;
    if (typeof canonicalRequest !== "function") return "";
    return String(canonicalRequest(url.pathname)?.pageName || "");
  }

  function syncWatchlistSelectorNavigationIntent(event) {
    if (!(event instanceof MouseEvent)) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const targetPage = navigationIntentPage(event.target);
    if (!targetPage) return;

    const switcher = document.getElementById("watchlistSwitcher");
    if (!(switcher instanceof HTMLElement)) return;

    const show = targetPage === "watchlist"
      && document.documentElement.dataset.storedWalletOptIn === "true";
    switcher.hidden = !show;

    if (!show) {
      const views = document.querySelector("#progressionPage .views");
      switcher.classList.remove("mflMobileWatchlistSwitcher");
      if (views instanceof HTMLElement && switcher.parentElement !== views) views.appendChild(switcher);

      const dropdown = document.getElementById("watchlistDropdown");
      if (dropdown instanceof HTMLElement) dropdown.hidden = true;
      const button = document.getElementById("watchlistButton");
      if (button instanceof HTMLButtonElement) button.setAttribute("aria-expanded", "false");
    }

    if (targetPage === "watchlist" || targetPage === "myplayers") {
      requestAnimationFrame(() => window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.());
    }
  }

  function activePageViewFilterControl(target) {
    const control = navigationController()?.activeControl?.(target);
    return control instanceof HTMLElement ? control : null;
  }

  function consumeActivePageViewFilterEvent(event) {
    const control = activePageViewFilterControl(event.target);
    if (!control) return false;
    if (control.matches('#databaseStatsOverallFilters .mflStatsFilterButton.active[data-filter="custom"]')) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (document.activeElement === control) control.blur();
    return true;
  }

  function beginNavigationIntent(target) {
    if (navigationIntentToken) return true;
    const token = navigationController()?.beginIntent?.(target, "control-intent") || "";
    navigationIntentToken = token;
    return Boolean(token);
  }

  function endNavigationIntent() {
    const token = navigationIntentToken;
    navigationIntentToken = "";
    if (token) navigationController()?.end?.(token);
  }

  function handOffNavigationIntent() {
    const token = navigationIntentToken;
    navigationIntentToken = "";
    if (token) navigationController()?.handoff?.(token);
  }

  function registerEscapeHandler(key, handler, options = {}) {
    const id = String(key || "").trim();
    if (!id || typeof handler !== "function") return () => {};
    const priorityValue = Number(options.priority);
    const priority = Number.isFinite(priorityValue) ? priorityValue : 0;
    const sequence = ++escapeHandlerSequence;
    escapeHandlers.set(id, { handler, priority, sequence });

    return () => {
      const current = escapeHandlers.get(id);
      if (current?.sequence === sequence) escapeHandlers.delete(id);
    };
  }

  function dispatchEscapeHandlers(event) {
    const ordered = Array.from(escapeHandlers.values())
      .sort((left, right) => right.priority - left.priority || left.sequence - right.sequence);

    for (const entry of ordered) {
      try {
        if (entry.handler(event) === true) return true;
      } catch (error) {
        console.warn("Global Escape handler failed.", error);
      }
    }
    return false;
  }

  function buttonGestureFromTarget(target) {
    if (!(target instanceof Element)) return null;
    const control = target.closest(BUTTON_GESTURE_SELECTOR);
    return control instanceof HTMLElement ? control : null;
  }

  function pointerControlFromTarget(target) {
    if (!(target instanceof Element)) return null;
    const direct = target.closest(POINTER_ESCAPE_CONTROL_SELECTOR);
    if (direct instanceof HTMLElement) return direct;
    const label = target.closest("label");
    const control = label instanceof HTMLLabelElement ? label.control : null;
    return control instanceof HTMLElement && control.matches(POINTER_ESCAPE_CONTROL_SELECTOR)
      ? control
      : null;
  }

  function clearGesture() {
    gestureStartControl = null;
    gesturePointerId = null;
    gestureStartX = 0;
    gestureStartY = 0;
    gestureDragged = false;
  }

  function clearClickSuppression() {
    suppressClickControl = null;
    if (suppressClickTimer) {
      window.clearTimeout(suppressClickTimer);
      suppressClickTimer = 0;
    }
  }

  function scheduleClickSuppressionClear() {
    if (suppressClickTimer) window.clearTimeout(suppressClickTimer);
    suppressClickTimer = window.setTimeout(() => {
      suppressClickTimer = 0;
      suppressClickControl = null;
    }, 0);
  }

  function draggedActivationMatches(event) {
    if (!(suppressClickControl instanceof HTMLElement)) return false;
    const target = event.target;
    return target instanceof Node && (target === suppressClickControl || suppressClickControl.contains(target));
  }

  function suppressDraggedClick(event) {
    if (!draggedActivationMatches(event)) return false;
    event.preventDefault();
    event.stopPropagation();
    clearClickSuppression();
    return true;
  }

  function isSelectOpen(select) {
    if (!(select instanceof HTMLSelectElement)) return false;
    try {
      return select.matches(":open");
    } catch {
      return false;
    }
  }

  function openSelect() {
    const active = document.activeElement;
    if (active instanceof HTMLSelectElement && isSelectOpen(active)) return active;
    return Array.from(document.querySelectorAll("select"))
      .find((select) => isSelectOpen(select)) || null;
  }

  function visibleModalBackdrop() {
    return Array.from(document.querySelectorAll("body > .modalBackdrop:not([hidden])"))
      .find((modal) => modal instanceof HTMLElement && modal.getClientRects().length > 0) || null;
  }

  function bugReportModalOwnsKeyboard(target) {
    const bugReportModal = document.getElementById("bugReportModal");
    return bugReportModal instanceof HTMLElement
      && !bugReportModal.hidden
      && target instanceof Node
      && bugReportModal.contains(target);
  }

  function currentPlayerPathname() {
    const pathname = String(window.location.pathname || "").replace(/\/+$/, "") || "/";
    return /^\/players\/\d{1,20}$/i.test(pathname) ? pathname : "";
  }

  function compactPlayerPageName(value) {
    const fullName = String(value || "").trim().replace(/\s+/g, " ");
    if (!fullName) return "";
    return fullName.replace(/^(\S)[^\s]*\s+(?:.*\s)?(\S+)$/, "$1. $2");
  }

  function syncPlayerPageDetails() {
    const detail = document.getElementById("playerDetail");
    if (!(detail instanceof HTMLElement)) return false;
    const mobile = PLAYER_VIEW_SCROLL_MEDIA.matches;

    detail.querySelectorAll(".playerTitleName").forEach((target) => {
      if (!(target instanceof HTMLElement)) return;
      const rendered = String(target.textContent || "").trim();
      const stored = String(target.dataset.playerFullName || "").trim();
      let fullName = stored;
      if (!fullName || (rendered && rendered !== fullName && rendered !== compactPlayerPageName(fullName))) {
        fullName = rendered;
        target.dataset.playerFullName = fullName;
      }
      if (!fullName) return;
      const displayName = mobile ? compactPlayerPageName(fullName) : fullName;
      if (target.textContent !== displayName) target.textContent = displayName;
      if (target.getAttribute("aria-label") !== fullName) target.setAttribute("aria-label", fullName);
    });

    const playerId = detail.querySelector("#copyPlayerIdButton");
    if (playerId instanceof HTMLElement) {
      if (mobile) playerId.removeAttribute("data-tooltip");
      else playerId.dataset.tooltip = "Click to copy";
    }

    const listing = detail.querySelector(".playerTitle .listingCellContent");
    if (listing instanceof HTMLElement) {
      listing.classList.add("playerListingBadge");
      const price = String(listing.querySelector(".listingCellPrice")?.textContent || "").trim();
      if (mobile && price) {
        listing.dataset.tooltip = price;
        listing.setAttribute("role", "button");
        listing.tabIndex = 0;
        listing.setAttribute("aria-label", `Listing price ${price}`);
      } else {
        listing.removeAttribute("data-tooltip");
        listing.removeAttribute("role");
        listing.removeAttribute("tabindex");
        if (price) listing.setAttribute("aria-label", `For Sale at ${price}`);
      }
    }
    return true;
  }

  function currentPlayerAttributeViews() {
    const views = document.querySelector("#playerDetail .playerAttributeViews");
    return views instanceof HTMLElement ? views : null;
  }

  function syncPlayerAttributeViewScrollPath() {
    const pathname = currentPlayerPathname();
    if (pathname === playerAttributeViewScrollPathname) return pathname;
    playerAttributeViewScrollPathname = pathname;
    playerAttributeViewScrollLeft = 0;
    playerAttributeViewRestoring = false;
    if (playerAttributeViewRestoreFrame) cancelAnimationFrame(playerAttributeViewRestoreFrame);
    playerAttributeViewRestoreFrame = 0;
    return pathname;
  }

  function rememberPlayerAttributeViewScroll(views = currentPlayerAttributeViews()) {
    if (!PLAYER_VIEW_SCROLL_MEDIA.matches || !(views instanceof HTMLElement)) return;
    const pathname = syncPlayerAttributeViewScrollPath();
    if (!pathname || playerAttributeViewRestoring) return;
    playerAttributeViewScrollLeft = views.scrollLeft;
  }

  function applyPlayerAttributeViewScroll() {
    const pathname = syncPlayerAttributeViewScrollPath();
    if (!PLAYER_VIEW_SCROLL_MEDIA.matches || !pathname) return false;
    const views = currentPlayerAttributeViews();
    if (!(views instanceof HTMLElement)) return false;
    const maxScroll = Math.max(0, views.scrollWidth - views.clientWidth);
    const target = Math.min(maxScroll, Math.max(0, playerAttributeViewScrollLeft));
    if (Math.abs(views.scrollLeft - target) > 1) views.scrollLeft = target;
    return true;
  }

  function schedulePlayerAttributeViewScrollRestore() {
    if (!PLAYER_VIEW_SCROLL_MEDIA.matches || !syncPlayerAttributeViewScrollPath()) return;
    playerAttributeViewRestoring = true;
    if (playerAttributeViewRestoreFrame) cancelAnimationFrame(playerAttributeViewRestoreFrame);
    playerAttributeViewRestoreFrame = requestAnimationFrame(() => {
      playerAttributeViewRestoreFrame = 0;
      window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();
      applyPlayerAttributeViewScroll();
      window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();
      playerAttributeViewRestoring = false;
    });
  }

  function capturePlayerAttributeViewScroll(target) {
    if (!(target instanceof Element)) return;
    const button = target.closest("#playerDetail [data-player-attribute-view]");
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;
    const views = button.closest(".playerAttributeViews");
    if (!(views instanceof HTMLElement)) return;
    rememberPlayerAttributeViewScroll(views);
    queueMicrotask(schedulePlayerAttributeViewScrollRestore);
  }

  function onPlayerAttributeViewScroll(event) {
    const views = event.target;
    if (!(views instanceof HTMLElement) || !views.matches("#playerDetail .playerAttributeViews")) return;
    rememberPlayerAttributeViewScroll(views);
  }

  function playerAttributeViewControlsChanged(record) {
    if (record?.type !== "childList" || !(record.target instanceof HTMLElement)) return false;

    if (record.target.matches("#playerDetail .playerAttributeViews")) {
      return [...record.addedNodes, ...record.removedNodes].some((node) => {
        if (!(node instanceof HTMLElement) || node.hasAttribute("data-mfl-view-scroll-end-spacer")) return false;
        return node.matches(".playerAttributeViewButton, [data-player-attribute-view]")
          || Boolean(node.querySelector(".playerAttributeViewButton, [data-player-attribute-view]"));
      });
    }

    if (!record.target.matches("#playerDetail")) return false;
    return Array.from(record.addedNodes).some((node) => (
      node instanceof HTMLElement
      && node.matches(".playerGrid")
      && Boolean(node.querySelector(".playerAttributeViews"))
    ));
  }

  function initialPlayerViewCuePending() {
    const root = document.documentElement;
    return root.dataset.initialEntityRoute === "player"
      && !root.classList.contains("mflInitialRouteResolved")
      && !root.classList.contains("mflInitialRouteSuperseded");
  }

  function currentPlayerViewCueReady() {
    if (!PLAYER_VIEW_SCROLL_MEDIA.matches) return true;
    const views = currentPlayerAttributeViews();
    if (!(views instanceof HTMLElement) || views.getClientRects().length === 0) return false;
    const nativeOverflow = views.scrollWidth - views.clientWidth > 2;
    if (!nativeOverflow) return true;
    if (!views.classList.contains("mflViewsOverflowing")) return false;
    const shell = views.parentElement;
    if (!(shell instanceof HTMLElement) || !shell.classList.contains("viewsScrollerShell")) return false;
    const button = shell.querySelector(":scope > .viewsScrollButton.viewsScrollButtonRight");
    return button instanceof HTMLButtonElement
      && button.classList.contains("mflViewsScrollButtonVisible")
      && button.getAttribute("aria-hidden") === "false"
      && Boolean(String(views.style.boxShadow || "").trim());
  }

  function syncInitialPlayerViewCue() {
    if (!initialPlayerViewCuePending()) return true;
    const root = document.documentElement;
    root.dataset.playerFirstPaintCuesReady = "false";
    window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();
    const ready = currentPlayerViewCueReady();
    root.dataset.playerFirstPaintCuesReady = ready ? "true" : "false";
    return ready;
  }

  function observePlayerAttributeViewRenders() {
    const detail = document.getElementById("playerDetail");
    if (!(detail instanceof HTMLElement) || typeof MutationObserver !== "function") return;
    playerAttributeViewMutationObserver?.disconnect();
    playerAttributeViewMutationObserver = new MutationObserver((records) => {
      syncPlayerPageDetails();
      if (!records.some(playerAttributeViewControlsChanged)) return;
      if (!syncInitialPlayerViewCue()) window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();
      else if (!initialPlayerViewCuePending()) window.__mflSharedTableUiRuntime?.syncRouteHorizontalCuesNow?.();
      schedulePlayerAttributeViewScrollRestore();
    });
    playerAttributeViewMutationObserver.observe(detail, { childList: true, subtree: true, characterData: true });
  }

  function onPlayerViewScrollMediaChange(event) {
    syncPlayerPageDetails();
    if (event.matches) {
      syncPlayerAttributeViewScrollPath();
      return;
    }
    playerAttributeViewScrollLeft = 0;
    playerAttributeViewRestoring = false;
  }

  function onClick(event) {
    capturePlayerAttributeViewScroll(event.target);
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("#openFiltersButton, #filtersModal")) {
      scheduleAddFilterNormalization();
    }

    if (consumeActivePageViewFilterEvent(event)) return;
    if (suppressDraggedClick(event)) {
      endNavigationIntent();
      return;
    }

    syncWatchlistSelectorNavigationIntent(event);
    if (beginNavigationIntent(event.target)) handOffNavigationIntent();
  }

  function onEnterBubble(event) {
    if (event.key !== "Enter" || !openSelect()) return;
    event.stopImmediatePropagation();
  }

  function onChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;

    if (target.id !== "addFilterSelect") {
      if (target.closest("#filterRules")) scheduleAddFilterNormalization();
      return;
    }
    if (!target.value) {
      target.blur();
      return;
    }

    const addFilterRule = window.addFilterRule;
    if (typeof addFilterRule !== "function") return;

    event.stopPropagation();
    const column = target.value;
    addFilterRule(column, { focus: false });
    target.value = "";
    normalizeAddFilterSelect(target);
    target.blur();
  }

  function onPointerDown(event) {
    clearGesture();
    clearClickSuppression();
    if (event.isPrimary === false || event.button !== 0) return;
    if (consumeActivePageViewFilterEvent(event)) {
      pointerFocusedControl = null;
      endNavigationIntent();
      return;
    }

    beginNavigationIntent(event.target);
    pointerFocusedControl = pointerControlFromTarget(event.target);
    gestureStartControl = buttonGestureFromTarget(event.target);
    gesturePointerId = event.pointerId;
    gestureStartX = event.clientX;
    gestureStartY = event.clientY;
  }

  function onPointerMove(event) {
    if (gesturePointerId === null || gestureDragged || event.pointerId !== gesturePointerId) return;
    const dx = event.clientX - gestureStartX;
    const dy = event.clientY - gestureStartY;
    if ((dx * dx) + (dy * dy) >= DRAG_ACTIVATION_THRESHOLD_PX * DRAG_ACTIVATION_THRESHOLD_PX) {
      gestureDragged = true;
    }
  }

  function onPointerUp(event) {
    if (gesturePointerId === null || event.pointerId !== gesturePointerId) return;

    const startControl = gestureStartControl;
    const dragged = gestureDragged;
    const releaseControl = buttonGestureFromTarget(event.target);
    const invalidButtonRelease = Boolean(startControl && (dragged || releaseControl !== startControl));
    clearGesture();
    if (!invalidButtonRelease) return;

    endNavigationIntent();
    suppressClickControl = releaseControl;
    event.preventDefault();
    event.stopPropagation();
    scheduleClickSuppressionClear();
  }
  function onPointerCancel(event) {
    if (gesturePointerId === null || event.pointerId !== gesturePointerId) return;
    clearGesture();
    clearClickSuppression();
    endNavigationIntent();
  }

  function onEscapeCapture(event) {
    if (event.key !== "Escape") return;
    pointerFocusedControl = null;
    endNavigationIntent();
    if (!dispatchEscapeHandlers(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function onKeyDown(event) {
    if (event.key === "Enter" && visibleModalBackdrop() && !bugReportModalOwnsKeyboard(event.target) && !openSelect()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    if (!event.metaKey && !event.ctrlKey && !event.altKey) {
      pointerFocusedControl = null;
    }
  }

  function onFocusIn(event) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (pointerFocusedControl && target !== pointerFocusedControl) pointerFocusedControl = null;
  }

  disableSearchSpellcheck();
  initializeAddFilterControl();
  syncPlayerAttributeViewScrollPath();
  syncPlayerPageDetails();
  observePlayerAttributeViewRenders();
  document.addEventListener("click", onClick, true);
  document.addEventListener("change", onChange, true);
  document.addEventListener("scroll", onPlayerAttributeViewScroll, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointermove", onPointerMove, true);
  document.addEventListener("pointerup", onPointerUp, true);
  document.addEventListener("pointercancel", onPointerCancel, true);
  window.addEventListener("keydown", onEscapeCapture, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("keydown", onEnterBubble);
  document.addEventListener("focusin", onFocusIn, true);
  PLAYER_VIEW_SCROLL_MEDIA.addEventListener("change", onPlayerViewScrollMediaChange);

  function destroy() {
    pointerFocusedControl = null;
    clearGesture();
    clearClickSuppression();
    endNavigationIntent();
    escapeHandlers.clear();
    playerAttributeViewMutationObserver?.disconnect();
    playerAttributeViewMutationObserver = null;
    if (playerAttributeViewRestoreFrame) cancelAnimationFrame(playerAttributeViewRestoreFrame);
    playerAttributeViewRestoreFrame = 0;
    playerAttributeViewRestoring = false;
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("change", onChange, true);
    document.removeEventListener("scroll", onPlayerAttributeViewScroll, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("pointerup", onPointerUp, true);
    document.removeEventListener("pointercancel", onPointerCancel, true);
    window.removeEventListener("keydown", onEscapeCapture, true);
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("keydown", onEnterBubble);
    document.removeEventListener("focusin", onFocusIn, true);
    PLAYER_VIEW_SCROLL_MEDIA.removeEventListener("change", onPlayerViewScrollMediaChange);
  }

  window.__mflControlInteractionsRuntime = Object.freeze({
    registerEscapeHandler,
    motionDurationMs,
    syncPlayerPageDetails,
    destroy,
  });
})();