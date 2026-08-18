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
  const ACTIVE_PAGE_VIEW_FILTER_SELECTOR = [
    "#sidebar .navButton.active[data-page]",
    ".viewButton.active[data-view]",
    ".mflStatsFilterButton.active",
    ".mflStatsDistributionModeButton.active",
  ].join(", ");
  const NAVIGATION_INTENT_SELECTOR = [
    "#sidebar .navButton[data-page]:not(.active)",
    ".viewButton[data-view]:not(.active)",
  ].join(", ");
  const NAVIGATION_PENDING_CLASS = "mflNavigationPending";
  const DRAG_ACTIVATION_THRESHOLD_PX = 6;

  let pointerFocusedControl = null;
  let gestureStartControl = null;
  let gesturePointerId = null;
  let gestureStartX = 0;
  let gestureStartY = 0;
  let gestureDragged = false;
  let suppressClickControl = null;
  let suppressClickTimer = 0;
  let navigationIntentPagerState = null;

  function addFilterSelect() {
    const select = document.getElementById("addFilterSelect");
    return select instanceof HTMLSelectElement ? select : null;
  }

  function showAddFilterButton() {
    const button = document.getElementById("showAddFilterButton");
    return button instanceof HTMLButtonElement ? button : null;
  }

  function activePageViewFilterControl(target) {
    if (!(target instanceof Element)) return null;
    const control = target.closest(ACTIVE_PAGE_VIEW_FILTER_SELECTOR);
    if (!(control instanceof HTMLElement) || control.hidden) return null;
    if (control instanceof HTMLButtonElement && control.disabled) return null;
    return control;
  }

  function consumeActivePageViewFilterEvent(event) {
    const control = activePageViewFilterControl(event.target);
    if (!control) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (document.activeElement === control) control.blur();
    return true;
  }

  function navigationIntentControl(target) {
    if (!(target instanceof Element)) return null;
    const control = target.closest(NAVIGATION_INTENT_SELECTOR);
    if (!(control instanceof HTMLElement) || control.hidden) return null;
    if (control instanceof HTMLButtonElement && control.disabled) return null;
    return control;
  }

  function beginNavigationIntent(target) {
    const control = navigationIntentControl(target);
    if (!control) return false;

    if (!(navigationIntentPagerState instanceof Map)) {
      navigationIntentPagerState = new Map();
      document.querySelectorAll("#progressionPage nav.pager").forEach((pager) => {
        if (!(pager instanceof HTMLElement)) return;
        navigationIntentPagerState.set(pager, pager.hidden);
      });
    }

    document.documentElement.classList.add(NAVIGATION_PENDING_CLASS);
    navigationIntentPagerState.forEach((_, pager) => {
      if (pager.isConnected) pager.hidden = true;
    });
    return true;
  }

  function endNavigationIntent() {
    document.documentElement.classList.remove(NAVIGATION_PENDING_CLASS);
    const pagerState = navigationIntentPagerState;
    navigationIntentPagerState = null;
    if (!(pagerState instanceof Map)) return;
    pagerState.forEach((wasHidden, pager) => {
      if (pager.isConnected) pager.hidden = wasHidden;
    });
  }

  function handOffNavigationIntent() {
    queueMicrotask(endNavigationIntent);
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
    if (consumeActivePageViewFilterEvent(event)) return;
    if (suppressDraggedClick(event)) {
      endNavigationIntent();
      return;
    }

    if (beginNavigationIntent(event.target)) handOffNavigationIntent();

    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest("#showAddFilterButton")) return;

    const select = addFilterSelect();
    if (!select) return;
    event.preventDefault();
    event.stopPropagation();
    select.hidden = !select.hidden;
    if (!select.hidden && document.activeElement === select) select.blur();

    const button = showAddFilterButton();
    if (button && document.activeElement === button) button.blur();
  }

  function onEnterBubble(event) {
    if (event.key !== "Enter" || !openSelect()) return;
    event.stopImmediatePropagation();
  }

  function onChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || target.id !== "addFilterSelect" || !target.value) return;

    const addFilterRule = window.addFilterRule;
    if (typeof addFilterRule !== "function") return;

    event.stopPropagation();
    const column = target.value;
    addFilterRule(column, { focus: false });
    target.value = "";
    target.hidden = true;
    const rules = document.querySelectorAll("#filterRules .filterRule");
    const newest = rules.item(rules.length - 1);
    newest?.querySelectorAll?.("input, select").forEach((control) => {
      if (control === document.activeElement && control instanceof HTMLElement) control.blur();
    });
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

  function onKeyDown(event) {
    if (event.key === "Enter" && visibleModalBackdrop() && !openSelect()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    if (event.key === "Escape") {
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) active.blur();
      pointerFocusedControl = null;
      endNavigationIntent();
    } else if (!event.metaKey && !event.ctrlKey && !event.altKey) {
      pointerFocusedControl = null;
    }
  }

  function onFocusIn(event) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (pointerFocusedControl && target !== pointerFocusedControl) pointerFocusedControl = null;
  }

  document.addEventListener("click", onClick, true);
  document.addEventListener("change", onChange, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointermove", onPointerMove, true);
  document.addEventListener("pointerup", onPointerUp, true);
  document.addEventListener("pointercancel", onPointerCancel, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("keydown", onEnterBubble);
  document.addEventListener("focusin", onFocusIn, true);

  function destroy() {
    pointerFocusedControl = null;
    clearGesture();
    clearClickSuppression();
    endNavigationIntent();
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("change", onChange, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("pointerup", onPointerUp, true);
    document.removeEventListener("pointercancel", onPointerCancel, true);
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("keydown", onEnterBubble);
    document.removeEventListener("focusin", onFocusIn, true);
  }

  window.__mflControlInteractionsRuntime = Object.freeze({ destroy });
})();
