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
    if (placeholder) placeholder.textContent = "Add filter...";
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

  function syncWatchlistSelectorNavigationIntent(target) {
    if (!(target instanceof Element)) return;
    const control = target.closest("#sidebar .navButton[data-page]");
    if (!(control instanceof HTMLElement)) return;

    const switcher = document.getElementById("watchlistSwitcher");
    if (!(switcher instanceof HTMLElement)) return;

    const show = String(control.dataset.page || "") === "watchlist"
      && document.documentElement.dataset.storedWalletOptIn === "true";
    switcher.hidden = !show;
    if (show) return;

    const dropdown = document.getElementById("watchlistDropdown");
    if (dropdown instanceof HTMLElement) dropdown.hidden = true;
    const button = document.getElementById("watchlistButton");
    if (button instanceof HTMLButtonElement) button.setAttribute("aria-expanded", "false");
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

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("#openFiltersButton, #filtersModal")) {
      scheduleAddFilterNormalization();
    }

    if (consumeActivePageViewFilterEvent(event)) return;
    if (suppressDraggedClick(event)) {
      endNavigationIntent();
      return;
    }

    syncWatchlistSelectorNavigationIntent(event.target);
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
    if (event.key === "Enter" && visibleModalBackdrop() && !openSelect()) {
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
  document.addEventListener("click", onClick, true);
  document.addEventListener("change", onChange, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointermove", onPointerMove, true);
  document.addEventListener("pointerup", onPointerUp, true);
  document.addEventListener("pointercancel", onPointerCancel, true);
  window.addEventListener("keydown", onEscapeCapture, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("keydown", onEnterBubble);
  document.addEventListener("focusin", onFocusIn, true);

  function destroy() {
    pointerFocusedControl = null;
    clearGesture();
    clearClickSuppression();
    endNavigationIntent();
    escapeHandlers.clear();
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("change", onChange, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("pointerup", onPointerUp, true);
    document.removeEventListener("pointercancel", onPointerCancel, true);
    window.removeEventListener("keydown", onEscapeCapture, true);
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("keydown", onEnterBubble);
    document.removeEventListener("focusin", onFocusIn, true);
  }

  window.__mflControlInteractionsRuntime = Object.freeze({
    registerEscapeHandler,
    motionDurationMs,
    destroy,
  });
})();