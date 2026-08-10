(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "1.123.23");
  window.__mflDiscountTooltipController?.destroy?.();
  window.__mflDiscountTooltipStabilityRuntime?.destroy?.();

  let portal = null;
  let activeMetric = null;
  let hoverMetric = null;
  let keyboardFocusMetric = null;
  let hideTimer = 0;
  let showFrame = 0;
  let epoch = 0;
  let keyboardFocusMode = false;
  let observer = null;

  const metricFrom = (target) => target instanceof Element
    ? target.closest(".evaluationMetric.evaluationDiscountRate")
    : null;

  const evaluationActive = () => (
    document.body?.dataset.page === "evaluation"
    || /^\/evaluation\/?$/i.test(window.location.pathname)
  );

  function cancelPendingShow() {
    epoch += 1;
    if (showFrame) cancelAnimationFrame(showFrame);
    showFrame = 0;
  }

  function ensurePortal() {
    if (portal?.isConnected) return portal;
    if (!document.body) return null;
    document.querySelectorAll(".evaluationDiscountTooltipPortal").forEach((element) => element.remove());
    portal = document.createElement("div");
    portal.id = "evaluationDiscountTooltipPortal";
    portal.className = "evaluationDiscountTooltipPortal";
    portal.setAttribute("role", "tooltip");
    document.body.appendChild(portal);
    return portal;
  }

  function position() {
    if (!portal || !activeMetric?.isConnected || !evaluationActive()) return;
    const rect = activeMetric.getBoundingClientRect();
    const tooltipRect = portal.getBoundingClientRect();
    const gap = 8;
    let top = rect.top - tooltipRect.height - gap;
    if (top < 8) top = rect.bottom + gap;
    const left = Math.min(
      window.innerWidth - tooltipRect.width - 8,
      Math.max(8, rect.left + (rect.width - tooltipRect.width) / 2),
    );
    portal.style.left = `${Math.round(left)}px`;
    portal.style.top = `${Math.round(top)}px`;
  }

  function hide(immediate = false) {
    cancelPendingShow();
    activeMetric?.removeAttribute("aria-describedby");
    activeMetric = null;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = 0;
    }
    if (!portal) return;
    portal.classList.remove("visible");
    if (immediate) {
      portal.remove();
      portal = null;
      return;
    }
    portal.classList.add("tooltipHiding");
    const hidingPortal = portal;
    hideTimer = window.setTimeout(() => {
      if (portal === hidingPortal) {
        portal.remove();
        portal = null;
      }
      hideTimer = 0;
    }, 170);
  }

  function show(metric) {
    if (!(metric instanceof HTMLElement) || !evaluationActive()) {
      hide(true);
      return;
    }
    const text = String(metric.dataset.tooltip || "").trim();
    if (!text) {
      hide(true);
      return;
    }

    cancelPendingShow();
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = 0;
    }
    const tooltip = ensurePortal();
    if (!tooltip) return;
    activeMetric?.removeAttribute("aria-describedby");
    activeMetric = metric;
    tooltip.textContent = text;
    tooltip.classList.remove("tooltipHiding");
    metric.setAttribute("aria-describedby", tooltip.id);
    position();

    const showEpoch = epoch;
    showFrame = requestAnimationFrame(() => {
      showFrame = 0;
      if (showEpoch !== epoch || portal !== tooltip || activeMetric !== metric || !evaluationActive()) return;
      tooltip.classList.add("visible");
      position();
    });
  }

  function sync() {
    if (!evaluationActive()) {
      hoverMetric = null;
      keyboardFocusMetric = null;
      hide(true);
      return;
    }
    const next = keyboardFocusMetric || hoverMetric;
    if (next instanceof HTMLElement && next.isConnected) show(next);
    else hide(false);
  }

  function clearAll(immediate = true) {
    hoverMetric = null;
    keyboardFocusMetric = null;
    hide(immediate);
  }

  function onPointerOver(event) {
    keyboardFocusMode = false;
    const metric = metricFrom(event.target);
    if (!metric) return;
    hoverMetric = metric;
    sync();
  }

  function onPointerMove(event) {
    keyboardFocusMode = false;
    const metric = metricFrom(event.target);
    if (metric === hoverMetric) return;
    hoverMetric = metric;
    sync();
  }

  function onPointerOut(event) {
    const metric = metricFrom(event.target);
    if (!metric || metric.contains(event.relatedTarget)) return;
    if (hoverMetric === metric) hoverMetric = null;
    sync();
  }

  function onPointerDown(event) {
    keyboardFocusMode = false;
    const metric = metricFrom(event.target);
    if (!metric) {
      clearAll(true);
      return;
    }
    hoverMetric = metric;
    // Pointer-created focus must not pin the tooltip after the pointer leaves.
    if (keyboardFocusMetric === metric) keyboardFocusMetric = null;
    sync();
  }

  function onKeyDown(event) {
    keyboardFocusMode = true;
    if (event.key === "Escape") clearAll(true);
  }

  function onFocusIn(event) {
    const metric = metricFrom(event.target);
    if (!metric) return;
    if (keyboardFocusMode) keyboardFocusMetric = metric;
    sync();
  }

  function onFocusOut(event) {
    const metric = metricFrom(event.target);
    if (!metric || metric.contains(event.relatedTarget)) return;
    if (keyboardFocusMetric === metric) keyboardFocusMetric = null;
    sync();
  }

  function onScroll() {
    clearAll(true);
  }

  function onResize() {
    if (activeMetric) position();
  }

  function onWindowBlur() {
    clearAll(true);
  }

  function onVisibilityChange() {
    if (document.visibilityState !== "visible") clearAll(true);
  }

  function onPageHide() {
    clearAll(true);
  }

  document.addEventListener("pointerover", onPointerOver, true);
  document.addEventListener("pointermove", onPointerMove, true);
  document.addEventListener("pointerout", onPointerOut, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("focusout", onFocusOut, true);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", onResize);
  window.addEventListener("blur", onWindowBlur);
  window.addEventListener("pagehide", onPageHide);

  observer = new MutationObserver(() => {
    if (!evaluationActive() || activeMetric?.closest("[hidden]")) clearAll(true);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-page", "hidden"],
  });

  function destroy() {
    clearAll(true);
    observer?.disconnect();
    observer = null;
    document.removeEventListener("pointerover", onPointerOver, true);
    document.removeEventListener("pointermove", onPointerMove, true);
    document.removeEventListener("pointerout", onPointerOut, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("focusin", onFocusIn, true);
    document.removeEventListener("focusout", onFocusOut, true);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("blur", onWindowBlur);
    window.removeEventListener("pagehide", onPageHide);
  }

  const controller = Object.freeze({ version: VERSION, show, hide, destroy });
  window.__mflDiscountTooltipController = controller;
  window.__mflDiscountTooltipStabilityRuntime = controller;
})();
