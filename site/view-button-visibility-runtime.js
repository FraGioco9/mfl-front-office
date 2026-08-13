(() => {
  "use strict";

  const POINTER_HOVER_ATTRIBUTE = "data-mfl-view-button-pointer-hover";
  const previous = window.__mflViewButtonVisibilityRuntime;
  previous?.destroy?.();

  let pointerHoverButton = null;

  const style = document.createElement("style");
  style.id = "mflViewButtonVisibilityGuard";
  style.textContent = `
    #progressionPage .viewButton[hidden] {
      display: none;
    }

    #progressionPage .viewButton {
      transition: background 120ms ease, border-color 120ms ease, color 120ms ease !important;
    }

    #progressionPage .viewButton:not(.active):is(:hover, [${POINTER_HOVER_ATTRIBUTE}="true"]):not(:disabled) {
      border-color: var(--primary-hover) !important;
      background: var(--row-hover) !important;
      color: var(--text) !important;
    }

    #progressionPage .viewButton.active:is(:hover, [${POINTER_HOVER_ATTRIBUTE}="true"]):not(:disabled) {
      border-color: var(--primary) !important;
      background: var(--primary) !important;
      color: #ffffff !important;
    }

    body[data-page="database"] #progressionPage .viewButton:is(
      [data-view="next"],
      [data-view="current"],
      [data-view="all"]
    ),
    body[data-page="mfl"] #progressionPage .viewButton:is(
      [data-view="next"],
      [data-view="contracts"],
      [data-view="current"],
      [data-view="all"]
    ),
    body[data-page="mflstats"] #progressionPage .viewButton:is(
      [data-view="next"],
      [data-view="contracts"],
      [data-view="current"],
      [data-view="all"]
    ),
    body[data-page="progression"] #progressionPage .viewButton:is(
      [data-view="attributes"],
      [data-view="stats"],
      [data-view="next"],
      [data-view="contracts"]
    ),
    body[data-page="agents"] #progressionPage .viewButton:is(
      [data-view="stats"],
      [data-view="current"],
      [data-view="all"]
    ),
    body[data-page="watchlist"] #progressionPage .viewButton[data-view="stats"],
    body[data-page="myplayers"] #progressionPage .viewButton[data-view="stats"],
    body[data-page="club"] #progressionPage .viewButton:is(
      [data-view="stats"],
      [data-view="next"]
    ),
    html[data-stored-progression-access="false"] body[data-page="watchlist"] #progressionPage .viewButton:is(
      [data-view="current"],
      [data-view="all"]
    ) {
      display: none;
    }
  `;
  document.head.appendChild(style);

  function clearPointerHover(button = pointerHoverButton) {
    if (!(button instanceof HTMLButtonElement)) {
      if (button === pointerHoverButton) pointerHoverButton = null;
      return;
    }

    button.removeAttribute(POINTER_HOVER_ATTRIBUTE);
    if (button.dataset.mflPointerHoverPaint === "true") {
      button.style.removeProperty("border-color");
      button.style.removeProperty("background");
      button.style.removeProperty("color");
      delete button.dataset.mflPointerHoverPaint;
    }
    if (button === pointerHoverButton) pointerHoverButton = null;
  }

  function applyPointerHover(button) {
    const root = document.documentElement;
    const unavailable = !(button instanceof HTMLButtonElement)
      || button.disabled
      || button.hidden
      || button.classList.contains("active")
      || root.classList.contains("mflInteractionBusy");

    if (unavailable) {
      clearPointerHover();
      return;
    }

    if (pointerHoverButton && pointerHoverButton !== button) clearPointerHover(pointerHoverButton);
    if (pointerHoverButton === button && button.getAttribute(POINTER_HOVER_ATTRIBUTE) === "true") return;

    pointerHoverButton = button;
    button.setAttribute(POINTER_HOVER_ATTRIBUTE, "true");
    button.dataset.mflPointerHoverPaint = "true";
    // Inline important paint is intentional here: Watchlist has accumulated
    // several route/runtime style owners. The pointer owner must win without
    // adding another selector-specificity race.
    button.style.setProperty("border-color", "var(--primary-hover)", "important");
    button.style.setProperty("background", "var(--row-hover)", "important");
    button.style.setProperty("color", "var(--text)", "important");
  }

  function viewButtonAtPoint(clientX, clientY) {
    if (typeof document.elementFromPoint !== "function") return null;
    const target = document.elementFromPoint(clientX, clientY);
    const button = target instanceof Element ? target.closest("#progressionPage .views .viewButton") : null;
    return button instanceof HTMLButtonElement ? button : null;
  }

  function syncPointerHover(event) {
    if (event.pointerType === "touch") {
      clearPointerHover();
      return;
    }
    applyPointerHover(viewButtonAtPoint(event.clientX, event.clientY));
  }

  function onPointerDown(event) {
    const target = event.target instanceof Element
      ? event.target.closest("#progressionPage .views .viewButton")
      : null;
    if (target instanceof HTMLButtonElement) clearPointerHover(target);
  }

  function onPointerOut(event) {
    if (!pointerHoverButton) return;
    if (event.relatedTarget == null) clearPointerHover();
  }

  function onWindowBlur() {
    clearPointerHover();
  }

  document.addEventListener("pointerover", syncPointerHover, true);
  document.addEventListener("pointermove", syncPointerHover, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointerout", onPointerOut, true);
  window.addEventListener("blur", onWindowBlur);

  function destroy() {
    document.removeEventListener("pointerover", syncPointerHover, true);
    document.removeEventListener("pointermove", syncPointerHover, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointerout", onPointerOut, true);
    window.removeEventListener("blur", onWindowBlur);
    document.querySelectorAll(`#progressionPage .viewButton[${POINTER_HOVER_ATTRIBUTE}="true"]`).forEach((button) => {
      clearPointerHover(button);
    });
    clearPointerHover();
    style.remove();
  }

  window.__mflViewButtonVisibilityRuntime = Object.freeze({ destroy });
})();
