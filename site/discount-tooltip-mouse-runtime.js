(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "1.123.23");
  window.__mflDiscountTooltipMouseRuntime?.destroy?.();

  let keyboardMode = false;

  const metricFrom = (target) => target instanceof Element
    ? target.closest(".evaluationMetric.evaluationDiscountRate")
    : null;

  const controller = () => window.__mflDiscountTooltipController;

  function onMouseOver(event) {
    keyboardMode = false;
    const metric = metricFrom(event.target);
    if (metric instanceof HTMLElement) controller()?.show?.(metric);
  }

  function onMouseMove(event) {
    keyboardMode = false;
    const metric = metricFrom(event.target);
    if (metric instanceof HTMLElement) {
      controller()?.show?.(metric);
      return;
    }
    controller()?.hide?.(false);
  }

  function onMouseOut(event) {
    const metric = metricFrom(event.target);
    if (!(metric instanceof HTMLElement) || metric.contains(event.relatedTarget)) return;
    controller()?.hide?.(false);
  }

  function onMouseDown(event) {
    keyboardMode = false;
    const metric = metricFrom(event.target);
    if (metric instanceof HTMLElement) {
      controller()?.show?.(metric);
      return;
    }
    controller()?.hide?.(true);
  }

  function onKeyDown(event) {
    keyboardMode = true;
    if (event.key === "Escape") controller()?.hide?.(true);
  }

  function onFocusIn(event) {
    if (!keyboardMode) return;
    const metric = metricFrom(event.target);
    if (metric instanceof HTMLElement) controller()?.show?.(metric);
  }

  window.addEventListener("mouseover", onMouseOver, true);
  window.addEventListener("mousemove", onMouseMove, true);
  window.addEventListener("mouseout", onMouseOut, true);
  window.addEventListener("mousedown", onMouseDown, true);
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("focusin", onFocusIn, true);

  function destroy() {
    window.removeEventListener("mouseover", onMouseOver, true);
    window.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("mouseout", onMouseOut, true);
    window.removeEventListener("mousedown", onMouseDown, true);
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("focusin", onFocusIn, true);
  }

  window.__mflDiscountTooltipMouseRuntime = Object.freeze({ version: VERSION, destroy });
})();
