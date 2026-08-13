(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "1.123.23");
  window.__mflEvaluationDiscountTooltipPointerRuntime?.destroy?.();

  let keyboardMode = false;
  let pointerX = Number.NaN;
  let pointerY = Number.NaN;
  let pointerSyncFrame = 0;

  const metricFrom = (target) => target instanceof Element
    ? target.closest(".evaluationMetric.evaluationDiscountRate")
    : null;

  const controller = () => window.__mflDiscountTooltipController;

  const evaluationActive = () => (
    document.body?.dataset.page === "evaluation"
    || /^\/evaluation\/?$/i.test(window.location.pathname)
  );

  function rememberPointer(event) {
    if (Number.isFinite(event.clientX)) pointerX = event.clientX;
    if (Number.isFinite(event.clientY)) pointerY = event.clientY;
  }

  function hitAtPointer() {
    if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) return null;
    return document.elementFromPoint(pointerX, pointerY);
  }

  function metricAtPointer() {
    return metricFrom(hitAtPointer());
  }

  function interactionBlocked() {
    const root = document.documentElement;
    return root.classList.contains("mflInteractionBusy")
      || root.dataset.interactionBusy === "true";
  }

  function cancelPointerSync() {
    if (pointerSyncFrame) cancelAnimationFrame(pointerSyncFrame);
    pointerSyncFrame = 0;
  }

  function schedulePointerSync() {
    if (pointerSyncFrame) return;
    const retry = () => {
      pointerSyncFrame = 0;
      if (!evaluationActive()) return;
      if (interactionBlocked()) {
        pointerSyncFrame = requestAnimationFrame(retry);
        return;
      }
      const metric = metricAtPointer();
      if (metric instanceof HTMLElement) controller()?.show?.(metric);
      else controller()?.hide?.(false);
    };
    pointerSyncFrame = requestAnimationFrame(retry);
  }

  function showAtPointer(event) {
    rememberPointer(event);
    keyboardMode = false;
    if (interactionBlocked()) {
      schedulePointerSync();
      return;
    }
    cancelPointerSync();
    const metric = metricFrom(event.target) || metricAtPointer();
    if (metric instanceof HTMLElement) controller()?.show?.(metric);
    else controller()?.hide?.(false);
  }

  function onMouseOver(event) {
    showAtPointer(event);
  }

  function onMouseMove(event) {
    showAtPointer(event);
  }

  function onMouseOut(event) {
    rememberPointer(event);
    const metric = metricFrom(event.target);
    if (!(metric instanceof HTMLElement) || metric.contains(event.relatedTarget)) {
      if (interactionBlocked()) schedulePointerSync();
      return;
    }
    cancelPointerSync();
    controller()?.hide?.(false);
  }

  function onMouseDown(event) {
    rememberPointer(event);
    keyboardMode = false;
    if (interactionBlocked()) {
      schedulePointerSync();
      return;
    }
    cancelPointerSync();
    const metric = metricFrom(event.target) || metricAtPointer();
    if (metric instanceof HTMLElement) {
      controller()?.show?.(metric);
      return;
    }
    controller()?.hide?.(true);
  }

  function onKeyDown(event) {
    keyboardMode = true;
    if (event.key === "Escape") {
      cancelPointerSync();
      controller()?.hide?.(true);
    }
  }

  function onFocusIn(event) {
    if (!keyboardMode) return;
    cancelPointerSync();
    const metric = metricFrom(event.target);
    if (metric instanceof HTMLElement) controller()?.show?.(metric);
  }

  function cancelForLifecycle() {
    cancelPointerSync();
  }

  function onVisibilityChange() {
    if (document.visibilityState !== "visible") cancelForLifecycle();
  }

  window.addEventListener("mouseover", onMouseOver, true);
  window.addEventListener("mousemove", onMouseMove, true);
  window.addEventListener("mouseout", onMouseOut, true);
  window.addEventListener("mousedown", onMouseDown, true);
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("focusin", onFocusIn, true);
  window.addEventListener("scroll", cancelForLifecycle, true);
  window.addEventListener("blur", cancelForLifecycle);
  window.addEventListener("pagehide", cancelForLifecycle);
  window.addEventListener("popstate", cancelForLifecycle);
  window.addEventListener("hashchange", cancelForLifecycle);
  document.addEventListener("visibilitychange", onVisibilityChange);

  function destroy() {
    cancelPointerSync();
    window.removeEventListener("mouseover", onMouseOver, true);
    window.removeEventListener("mousemove", onMouseMove, true);
    window.removeEventListener("mouseout", onMouseOut, true);
    window.removeEventListener("mousedown", onMouseDown, true);
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("focusin", onFocusIn, true);
    window.removeEventListener("scroll", cancelForLifecycle, true);
    window.removeEventListener("blur", cancelForLifecycle);
    window.removeEventListener("pagehide", cancelForLifecycle);
    window.removeEventListener("popstate", cancelForLifecycle);
    window.removeEventListener("hashchange", cancelForLifecycle);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  }

  window.__mflEvaluationDiscountTooltipPointerRuntime = Object.freeze({ version: VERSION, destroy });
})();
