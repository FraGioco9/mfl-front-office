(() => {
  "use strict";

  const previous = window.__mflFilterAddFocusRuntime;
  previous?.destroy?.();

  const NEUTRAL_ATTRIBUTE = "data-mfl-initial-filter-neutral";
  const STYLE_ID = "mflFilterAddFocusRuntimeStyles";
  let destroyed = false;

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

  function onClick(event) {
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

  function onPointerDown(event) {
    clearInitialNeutral(neutralControlFromTarget(event.target));
  }

  function onPointerOut(event) {
    const control = neutralControlFromTarget(event.target);
    if (!control) return;
    const next = event.relatedTarget;
    if (next instanceof Node && control.contains(next)) return;
    clearInitialNeutral(control);
  }

  function onKeyDown(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest("#filtersModal")) return;
    document.querySelectorAll(`#filtersModal [${NEUTRAL_ATTRIBUTE}="true"]`).forEach(clearInitialNeutral);
  }

  function onFocusIn(event) {
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
