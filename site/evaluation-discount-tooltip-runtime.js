(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "1.123.20");
  const RUNTIME_KEY = "__mflEvaluationDiscountTooltip";

  window[RUNTIME_KEY]?.destroy?.();

  let tooltip = null;
  let activeTarget = null;

  function ensureStyles() {
    if (document.getElementById("evaluationDiscountTooltipPortalStyles")) return;
    const style = document.createElement("style");
    style.id = "evaluationDiscountTooltipPortalStyles";
    style.textContent = `
      .evaluationDiscountRate[data-tooltip]::after {
        display: none !important;
      }
      #evaluationDiscountTooltipPortal {
        position: fixed;
        z-index: 2147483640;
        width: max-content;
        max-width: min(320px, calc(100vw - 24px));
        padding: 9px 12px;
        border: 1px solid var(--border-strong);
        border-radius: 5px;
        background: #171717;
        color: #ffffff;
        box-shadow: 0 10px 26px rgba(0, 0, 0, 0.28);
        font-size: 12px;
        font-weight: 600;
        line-height: 1.35;
        text-align: left;
        white-space: normal;
        overflow-wrap: anywhere;
        pointer-events: none;
      }
      #evaluationDiscountTooltipPortal[hidden] {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureTooltip() {
    if (tooltip?.isConnected) return tooltip;
    if (!document.body) return null;
    tooltip = document.createElement("div");
    tooltip.id = "evaluationDiscountTooltipPortal";
    tooltip.hidden = true;
    tooltip.setAttribute("role", "tooltip");
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function discountTarget(node) {
    return node instanceof Element
      ? node.closest(".evaluationDiscountRate[data-tooltip]")
      : null;
  }

  function position() {
    const panel = ensureTooltip();
    if (!panel || panel.hidden || !(activeTarget instanceof HTMLElement)) return;

    const targetRect = activeTarget.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const viewportPadding = 12;
    const gap = 10;
    let left = targetRect.left + (targetRect.width - panelRect.width) / 2;
    left = Math.max(viewportPadding, Math.min(left, innerWidth - panelRect.width - viewportPadding));

    let top = targetRect.top - panelRect.height - gap;
    if (top < viewportPadding) top = targetRect.bottom + gap;
    top = Math.max(viewportPadding, Math.min(top, innerHeight - panelRect.height - viewportPadding));

    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
  }

  function show(target) {
    if (!(target instanceof HTMLElement) || document.body?.dataset.page !== "evaluation") return;
    const copy = String(target.dataset.tooltip || "").trim();
    if (!copy) return;

    ensureStyles();
    const panel = ensureTooltip();
    if (!panel) return;
    activeTarget = target;
    panel.textContent = copy;
    panel.hidden = false;
    target.setAttribute("aria-describedby", panel.id);
    position();
  }

  function hide() {
    if (activeTarget instanceof HTMLElement) activeTarget.removeAttribute("aria-describedby");
    activeTarget = null;
    if (tooltip) tooltip.hidden = true;
  }

  function onPointerOver(event) {
    const target = discountTarget(event.target);
    if (target && target !== activeTarget) show(target);
  }

  function onPointerOut(event) {
    if (!(activeTarget instanceof HTMLElement)) return;
    const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
    if (related && activeTarget.contains(related)) return;
    if (discountTarget(event.target) === activeTarget) hide();
  }

  function onFocusIn(event) {
    const target = discountTarget(event.target);
    if (target) show(target);
  }

  function onFocusOut(event) {
    if (discountTarget(event.target) === activeTarget) hide();
  }

  function onRouteChange() {
    if (document.body?.dataset.page !== "evaluation") hide();
    else position();
  }

  ensureStyles();
  document.addEventListener("pointerover", onPointerOver, true);
  document.addEventListener("pointerout", onPointerOut, true);
  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("focusout", onFocusOut, true);
  window.addEventListener("resize", position);
  window.addEventListener("scroll", position, true);
  window.addEventListener("popstate", onRouteChange);

  const observer = new MutationObserver(onRouteChange);
  observer.observe(document.body, { attributes: true, attributeFilter: ["data-page"] });

  function destroy() {
    hide();
    observer.disconnect();
    document.removeEventListener("pointerover", onPointerOver, true);
    document.removeEventListener("pointerout", onPointerOut, true);
    document.removeEventListener("focusin", onFocusIn, true);
    document.removeEventListener("focusout", onFocusOut, true);
    window.removeEventListener("resize", position);
    window.removeEventListener("scroll", position, true);
    window.removeEventListener("popstate", onRouteChange);
    tooltip?.remove();
    document.getElementById("evaluationDiscountTooltipPortalStyles")?.remove();
  }

  window[RUNTIME_KEY] = { version: VERSION, show, hide, destroy };
})();
