(() => {
  "use strict";

  const STYLE_ID = "mflTableViewRuntimeStyles";
  const HOVER_ATTRIBUTE = "data-mfl-view-button-pointer-hover";

  window.__mflTableViewRuntime?.destroy?.();

  let hovered = null;

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #progressionPage .viewButton {
        transition: background 120ms ease, border-color 120ms ease, color 120ms ease !important;
      }
      #progressionPage .viewButton:not(.active):is(:hover, [${HOVER_ATTRIBUTE}="true"]):not(:disabled) {
        border-color: var(--primary-hover) !important;
        background: var(--row-hover) !important;
        color: var(--text) !important;
      }
      main .views .viewButton.active:is(:hover, :focus, :focus-visible, [${HOVER_ATTRIBUTE}="true"]):not(:disabled) {
        outline: none !important;
        border-color: var(--primary) !important;
        background: var(--primary) !important;
        color: #ffffff !important;
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function clearHover() {
    if (hovered instanceof HTMLElement) hovered.removeAttribute(HOVER_ATTRIBUTE);
    hovered = null;
  }

  function viewButtonFromEvent(event) {
    if (event.isPrimary === false || event.button !== 0 || !(event.target instanceof Element)) return null;
    const button = event.target.closest("main .views .viewButton[data-view]");
    if (!(button instanceof HTMLButtonElement) || button.disabled || button.hidden) return null;
    return button;
  }

  function activatePressedView(button) {
    const container = button.closest(".views");
    if (!(container instanceof HTMLElement)) return;
    container.querySelectorAll(".viewButton[data-view]").forEach((candidate) => {
      candidate.classList.toggle("active", candidate === button);
    });
  }

  function onPointerDown(event) {
    const button = viewButtonFromEvent(event);
    if (!button) return;
    activatePressedView(button);
    clearHover();
  }

  function onPointerCancel() {
    window.__mflStaticUiRuntime?.sync?.();
  }

  function onPointerMove(event) {
    if (event.pointerType === "touch" || document.documentElement.classList.contains("mflInteractionBusy")) {
      clearHover();
      return;
    }
    const target = document.elementFromPoint?.(event.clientX, event.clientY);
    const button = target instanceof Element ? target.closest("main .views .viewButton") : null;
    if (!(button instanceof HTMLButtonElement) || button.disabled || button.hidden || button.classList.contains("active")) {
      clearHover();
      return;
    }
    if (hovered === button) return;
    clearHover();
    hovered = button;
    button.setAttribute(HOVER_ATTRIBUTE, "true");
  }

  function onPointerLeave() {
    clearHover();
  }

  function destroy() {
    clearHover();
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointercancel", onPointerCancel, true);
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("pointerleave", onPointerLeave, true);
    document.getElementById(STYLE_ID)?.remove();
  }

  installStyles();
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointercancel", onPointerCancel, true);
  document.addEventListener("pointermove", onPointerMove, true);
  document.addEventListener("pointerleave", onPointerLeave, true);
  window.__mflTableViewRuntime = Object.freeze({ destroy });
})();