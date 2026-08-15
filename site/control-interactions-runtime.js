(() => {
  "use strict";

  const previous = window.__mflControlInteractionsRuntime;
  previous?.destroy?.();

  const NEUTRAL_ATTRIBUTE = "data-mfl-initial-filter-neutral";
  const VIEW_BUTTON_CLICKED_ATTRIBUTE = "data-mfl-view-clicked";
  const STYLE_ID = "mflFilterAddFocusRuntimeStyles";
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
  const DRAG_ACTIVATION_THRESHOLD_PX = 6;
  const viewButtonsContainer = document.querySelector("#progressionPage .views");
  let destroyed = false;
  let pointerFocusedControl = null;
  let gestureStartControl = null;
  let gesturePointerId = null;
  let gestureStartX = 0;
  let gestureStartY = 0;
  let gestureDragged = false;
  let suppressClickControl = null;
  let suppressClickTimer = 0;

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      button,
      button *,
      input[type="button"],
      input[type="submit"],
      input[type="reset"],
      [role="button"],
      [role="button"] *,
      #sidebar .navButton,
      #sidebar .navButton * {
        -webkit-user-select: none;
        user-select: none;
      }

      #progressionPage .views .viewButton[${VIEW_BUTTON_CLICKED_ATTRIBUTE}="true"],
      #progressionPage .views .viewButton[${VIEW_BUTTON_CLICKED_ATTRIBUTE}="true"]:hover,
      #progressionPage .views .viewButton[${VIEW_BUTTON_CLICKED_ATTRIBUTE}="true"]:active,
      #progressionPage .views .viewButton[${VIEW_BUTTON_CLICKED_ATTRIBUTE}="true"]:focus,
      #progressionPage .views .viewButton[${VIEW_BUTTON_CLICKED_ATTRIBUTE}="true"]:focus-visible {
        transition: none !important;
        animation: none !important;
      }

      #progressionPage .views .viewButton[${VIEW_BUTTON_CLICKED_ATTRIBUTE}="true"]:not(.active),
      #progressionPage .views .viewButton[${VIEW_BUTTON_CLICKED_ATTRIBUTE}="true"]:not(.active):hover,
      #progressionPage .views .viewButton[${VIEW_BUTTON_CLICKED_ATTRIBUTE}="true"]:not(.active):active,
      #progressionPage .views .viewButton[${VIEW_BUTTON_CLICKED_ATTRIBUTE}="true"]:not(.active):focus,
      #progressionPage .views .viewButton[${VIEW_BUTTON_CLICKED_ATTRIBUTE}="true"]:not(.active):focus-visible {
        outline: 0;
        border-color: var(--border-strong);
        background: var(--surface);
        color: var(--text);
        box-shadow: none;
      }

      #progressionPage .views .viewButton[${VIEW_BUTTON_CLICKED_ATTRIBUTE}="true"].active,
      #progressionPage .views .viewButton[${VIEW_BUTTON_CLICKED_ATTRIBUTE}="true"].active:hover,
      #progressionPage .views .viewButton[${VIEW_BUTTON_CLICKED_ATTRIBUTE}="true"].active:active,
      #progressionPage .views .viewButton[${VIEW_BUTTON_CLICKED_ATTRIBUTE}="true"].active:focus,
      #progressionPage .views .viewButton[${VIEW_BUTTON_CLICKED_ATTRIBUTE}="true"].active:focus-visible {
        outline: 0;
        border-color: var(--primary);
        background: var(--primary);
        color: #ffffff;
        box-shadow: none;
        transition: none !important;
        animation: none !important;
      }

      @supports (appearance: base-select) {
        select[data-mfl-dropdown-enhanced="true"]::picker(select),
        #pageSizeSelect::picker(select) {
          margin: var(--mfl-dropdown-gap) 0 0;
        }
      }

      #filtersModal [${NEUTRAL_ATTRIBUTE}="true"],
      #filtersModal [${NEUTRAL_ATTRIBUTE}="true"]:hover,
      #filtersModal [${NEUTRAL_ATTRIBUTE}="true"]:focus,
      #filtersModal [${NEUTRAL_ATTRIBUTE}="true"]:focus-visible {
        outline: none;
        border-color: var(--border-strong);
        background: var(--surface);
        color: var(--text);
        box-shadow: none;
      }

      /* Editing MFL/USD intentionally focuses and selects the value input. Keep
         that programmatic focus from adding a browser-native white focus ring. */
      .evaluationMflUsdInput:focus,
      .evaluationMflUsdInput:focus-visible {
        outline: none;
        border-color: var(--primary);
        box-shadow: none;
      }

      /* Advanced Settings uses the same selected-box treatment as the Evaluation
         MFL/USD editor instead of the browser-native white focus ring. */
      .advancedSettingsDialog input:focus,
      .advancedSettingsDialog input:focus-visible {
        outline: none;
        border-color: var(--primary);
        box-shadow: none;
      }

      /* Keep popup-header close controls geometrically stable. The shared
         popupCloseButton pseudo-elements remain the single X drawing owner. */
      .filtersHeader > .popupCloseButton {
        position: relative;
        display: inline-grid;
        place-items: center;
        flex: 0 0 36px;
        width: 36px;
        min-width: 36px;
        max-width: 36px;
        height: 36px;
        min-height: 36px;
        max-height: 36px;
        margin: 0;
        padding: 0;
        font-size: 0;
        line-height: 0;
        text-indent: 0;
      }
    `;
    document.head.appendChild(style);
  }

  function clearInitialNeutral(control) {
    if (control instanceof HTMLElement) control.removeAttribute(NEUTRAL_ATTRIBUTE);
  }

  function markInitialNeutral(control) {
    if (!(control instanceof HTMLElement)) return;
    control.setAttribute(NEUTRAL_ATTRIBUTE, "true");
    if (document.activeElement === control) control.blur();

    requestAnimationFrame(() => {
      if (destroyed || !control.isConnected) return;
      if (!control.matches(":hover") && document.activeElement !== control) {
        clearInitialNeutral(control);
      }
    });
  }

  function markNewestRuleControls() {
    const rules = document.querySelectorAll("#filterRules .filterRule");
    const rule = rules.item(rules.length - 1);
    if (!(rule instanceof HTMLElement)) return;
    rule.querySelectorAll("input, select").forEach(markInitialNeutral);
  }

  function addFilterSelect() {
    const select = document.getElementById("addFilterSelect");
    return select instanceof HTMLSelectElement ? select : null;
  }

  function showAddFilterButton() {
    const button = document.getElementById("showAddFilterButton");
    return button instanceof HTMLButtonElement ? button : null;
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

  function buttonGestureFromTarget(target) {
    if (!(target instanceof Element)) return null;
    const control = target.closest(BUTTON_GESTURE_SELECTOR);
    return control instanceof HTMLElement ? control : null;
  }

  function viewButtonFromControl(control) {
    return control instanceof HTMLButtonElement
      && control.matches("#progressionPage .views .viewButton[data-view]")
      ? control
      : null;
  }

  function markViewButtonClicked(button) {
    if (!(button instanceof HTMLButtonElement)) return;
    document.querySelectorAll(`#progressionPage .views .viewButton[${VIEW_BUTTON_CLICKED_ATTRIBUTE}="true"]`)
      .forEach((candidate) => {
        if (candidate !== button) candidate.removeAttribute(VIEW_BUTTON_CLICKED_ATTRIBUTE);
      });
    button.setAttribute(VIEW_BUTTON_CLICKED_ATTRIBUTE, "true");
  }

  function clearViewButtonClicked(button) {
    if (button instanceof HTMLElement) button.removeAttribute(VIEW_BUTTON_CLICKED_ATTRIBUTE);
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

  function onClick(event) {
    if (suppressDraggedClick(event)) return;

    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest("#showAddFilterButton")) return;

    const select = addFilterSelect();
    if (!select) return;

    event.preventDefault();
    event.stopPropagation();
    select.hidden = !select.hidden;

    if (select.hidden) clearInitialNeutral(select);
    else markInitialNeutral(select);

    const button = showAddFilterButton();
    if (button && document.activeElement === button) button.blur();
  }

  function onSharedViewButtonClick(event) {
    if (!/^\/(?:clubs|club)\/[^/]+(?:\/|$)/i.test(window.location.pathname)) return;
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest?.(".viewButton[data-view]");
    if (!(button instanceof HTMLButtonElement)) return;

    // The shared button listener on the button itself has already run by the time
    // this bubble listener fires. Stop only the obsolete club document listener
    // from processing the same click a second time. My Players and clubs now use
    // the same pointerup/click activation path.
    event.stopPropagation();
  }

  function onEnterBubble(event) {
    if (event.key !== "Enter") return;
    if (!openSelect()) return;

    // Let the open select keep its native Enter default action so the highlighted
    // option is committed. Stop only later popup-level Enter shortcuts from also
    // treating the same key press as Apply/Save/Confirm.
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
    clearInitialNeutral(target);
    markNewestRuleControls();
  }

  function neutralControlFromTarget(target) {
    if (!(target instanceof Element)) return null;
    const control = target.closest(`[${NEUTRAL_ATTRIBUTE}="true"]`);
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

  function onPointerDown(event) {
    clearInitialNeutral(neutralControlFromTarget(event.target));
    pointerFocusedControl = pointerControlFromTarget(event.target);

    clearGesture();
    clearClickSuppression();
    if (event.isPrimary === false || event.button !== 0) return;

    gestureStartControl = buttonGestureFromTarget(event.target);
    gesturePointerId = event.pointerId;
    gestureStartX = event.clientX;
    gestureStartY = event.clientY;

    const pressedViewButton = viewButtonFromControl(gestureStartControl);
    if (pressedViewButton) markViewButtonClicked(pressedViewButton);
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
    const pressedViewButton = viewButtonFromControl(startControl);
    const dragged = gestureDragged;
    const releaseControl = buttonGestureFromTarget(event.target);
    const validViewButton = !dragged && releaseControl === startControl
      ? viewButtonFromControl(releaseControl)
      : null;
    const invalidButtonRelease = Boolean(releaseControl && (dragged || releaseControl !== startControl));
    clearGesture();

    if (validViewButton) markViewButtonClicked(validViewButton);
    else if (pressedViewButton) clearViewButtonClicked(pressedViewButton);
    if (!invalidButtonRelease) return;

    // A pointer release can land on a button even when the press began somewhere
    // else. Some controls (notably table view buttons) activate directly on
    // pointerup, so require the press and release to belong to the same control
    // and reject any gesture that crossed the drag threshold.
    suppressClickControl = releaseControl;
    event.preventDefault();
    event.stopPropagation();
    scheduleClickSuppressionClear();
  }

  function onPointerCancel(event) {
    if (gesturePointerId === null || event.pointerId !== gesturePointerId) return;
    const pressedViewButton = viewButtonFromControl(gestureStartControl);
    clearGesture();
    clearClickSuppression();
    if (pressedViewButton) clearViewButtonClicked(pressedViewButton);
  }

  function onPointerOut(event) {
    const target = event.target instanceof Element ? event.target : null;
    const clickedViewButton = target?.closest?.(`[${VIEW_BUTTON_CLICKED_ATTRIBUTE}="true"]`);
    if (clickedViewButton instanceof HTMLElement) {
      const next = event.relatedTarget;
      if (!(next instanceof Node && clickedViewButton.contains(next))) {
        clearViewButtonClicked(clickedViewButton);
      }
    }

    const control = neutralControlFromTarget(event.target);
    if (!control) return;
    const next = event.relatedTarget;
    if (next instanceof Node && control.contains(next)) return;
    clearInitialNeutral(control);
  }

  function onKeyDown(event) {
    if (event.key === "Enter" && visibleModalBackdrop() && !openSelect()) {
      // Enter inside any popup is intentionally inert. An actually open select is
      // the exception: it receives Enter normally so its highlighted option can
      // be committed, including when that dropdown lives inside the popup.
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    if (event.key === "Escape") {
      const active = document.activeElement;
      if (pointerFocusedControl && active === pointerFocusedControl) {
        pointerFocusedControl.blur();
        pointerFocusedControl = null;
      }
    } else if (!event.metaKey && !event.ctrlKey && !event.altKey) {
      // Once the user deliberately returns to keyboard navigation, leave native
      // focus-visible behavior intact for accessibility.
      pointerFocusedControl = null;
    }

    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest("#filtersModal")) return;
    document.querySelectorAll(`#filtersModal [${NEUTRAL_ATTRIBUTE}="true"]`).forEach(clearInitialNeutral);
  }

  function onFocusIn(event) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (pointerFocusedControl && target !== pointerFocusedControl) pointerFocusedControl = null;

    const control = neutralControlFromTarget(event.target);
    if (control && document.activeElement === control) control.blur();
  }

  installStyles();
  document.addEventListener("click", onClick, true);
  document.addEventListener("change", onChange, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointermove", onPointerMove, true);
  document.addEventListener("pointerup", onPointerUp, true);
  document.addEventListener("pointercancel", onPointerCancel, true);
  document.addEventListener("pointerout", onPointerOut, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("keydown", onEnterBubble);
  document.addEventListener("focusin", onFocusIn, true);
  viewButtonsContainer?.addEventListener("click", onSharedViewButtonClick);

  function destroy() {
    destroyed = true;
    pointerFocusedControl = null;
    clearGesture();
    clearClickSuppression();
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("change", onChange, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("pointerup", onPointerUp, true);
    document.removeEventListener("pointercancel", onPointerCancel, true);
    document.removeEventListener("pointerout", onPointerOut, true);
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("keydown", onEnterBubble);
    document.removeEventListener("focusin", onFocusIn, true);
    viewButtonsContainer?.removeEventListener("click", onSharedViewButtonClick);
    document.querySelectorAll(`[${NEUTRAL_ATTRIBUTE}="true"]`).forEach(clearInitialNeutral);
    document.querySelectorAll(`[${VIEW_BUTTON_CLICKED_ATTRIBUTE}="true"]`).forEach(clearViewButtonClicked);
    document.getElementById(STYLE_ID)?.remove();
  }

  window.__mflControlInteractionsRuntime = Object.freeze({ destroy });
})();