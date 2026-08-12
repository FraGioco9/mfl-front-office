(() => {
  "use strict";

  const previous = window.__mflFilterAddFocusRuntime;
  previous?.destroy?.();

  const NEUTRAL_ATTRIBUTE = "data-mfl-initial-filter-neutral";
  const STYLE_ID = "mflFilterAddFocusRuntimeStyles";
  const POINTER_ESCAPE_CONTROL_SELECTOR = [
    "button",
    'input[type="button"]',
    'input[type="submit"]',
    'input[type="reset"]',
    'input[type="checkbox"]',
    'input[type="radio"]',
    '[role="button"]',
  ].join(", ");
  let destroyed = false;
  let pointerFocusedControl = null;

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
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

      /* One canonical close control for every popup header. Keep the button
         geometry and the drawn X independent from surrounding popup styles. */
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

      .filtersHeader > .popupCloseButton::before,
      .filtersHeader > .popupCloseButton::after,
      .evaluationSearchClearButton::before,
      .evaluationSearchClearButton::after {
        content: "";
        position: absolute;
        display: block;
        top: 50%;
        left: 50%;
        right: auto;
        bottom: auto;
        width: 12px;
        height: 2px;
        margin: 0;
        padding: 0;
        border: 0;
        border-radius: 999px;
        background: currentColor;
        transform-origin: 50% 50%;
        pointer-events: none;
      }

      .filtersHeader > .popupCloseButton::before,
      .evaluationSearchClearButton::before {
        transform: translate(-50%, -50%) rotate(45deg);
      }

      .filtersHeader > .popupCloseButton::after,
      .evaluationSearchClearButton::after {
        transform: translate(-50%, -50%) rotate(-45deg);
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

  function clearEvaluationSearchFromButton(event, target) {
    const button = target?.closest?.("#evaluationSearchClearButton");
    if (!(button instanceof HTMLButtonElement)) return false;

    const input = document.getElementById("evaluationSearchInput");
    if (!(input instanceof HTMLInputElement)) return false;

    event.preventDefault();
    event.stopImmediatePropagation();

    input.value = "";
    button.hidden = true;

    // Let the authoritative Evaluation search owner cancel any pending query,
    // clear the selected player, and restore its recent-result state.
    input.dispatchEvent(new Event("input", { bubbles: true }));

    // Focus before the final render so the empty Evaluation search explicitly
    // qualifies for recent results even while route state is being reset.
    input.focus({ preventScroll: true });
    try {
      if (typeof window.renderEvaluationSearchResults === "function") {
        window.renderEvaluationSearchResults();
      } else {
        window.eval("if (typeof renderEvaluationSearchResults === 'function') renderEvaluationSearchResults();");
      }
    } catch {
      // The input event above still restores the normal recent-results path.
    }
    return true;
  }

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (clearEvaluationSearchFromButton(event, target)) return;
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
  }

  function onPointerOut(event) {
    const control = neutralControlFromTarget(event.target);
    if (!control) return;
    const next = event.relatedTarget;
    if (next instanceof Node && control.contains(next)) return;
    clearInitialNeutral(control);
  }

  function onKeyDown(event) {
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
  document.addEventListener("pointerout", onPointerOut, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("focusin", onFocusIn, true);

  function destroy() {
    destroyed = true;
    pointerFocusedControl = null;
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("change", onChange, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointerout", onPointerOut, true);
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("focusin", onFocusIn, true);
    document.querySelectorAll(`[${NEUTRAL_ATTRIBUTE}="true"]`).forEach(clearInitialNeutral);
    document.getElementById(STYLE_ID)?.remove();
  }

  window.__mflFilterAddFocusRuntime = Object.freeze({ destroy });
})();
