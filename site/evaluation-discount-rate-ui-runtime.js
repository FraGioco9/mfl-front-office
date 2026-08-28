(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "dev");
  const MOBILE_TOOLTIP_MEDIA = window.matchMedia("(max-width: 900px), (hover: none) and (pointer: coarse)");

  function installTooltipController() {
    window.__mflDiscountTooltipController?.destroy?.();

    let portal = null;
    let activeMetric = null;
    let hoverMetric = null;
    let keyboardFocusMetric = null;
    let hideTimer = 0;
    let showFrame = 0;
    let showEpoch = 0;
    let keyboardFocusMode = false;
    let showScrollX = 0;
    let showScrollY = 0;
    let showMetricLeft = Number.NaN;
    let showMetricTop = Number.NaN;

    const metricFrom = (target) => target instanceof Element
      ? target.closest(".evaluationMetric.evaluationDiscountRate")
      : null;

    const evaluationActive = () => (
      document.body?.dataset.page === "evaluation"
      || /^\/evaluation\/?$/i.test(window.location.pathname)
    );

    function cancelPendingShow() {
      showEpoch += 1;
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
      const tooltipHeight = Number(window.__mflTooltipHeight);
      if (!Number.isFinite(tooltipHeight)) return;
      let top = rect.top - tooltipRect.height - tooltipHeight;
      if (top < 8) top = rect.bottom + tooltipHeight;
      const left = Math.min(
        window.innerWidth - tooltipRect.width - 8,
        Math.max(8, rect.left + (rect.width - tooltipRect.width) / 2),
      );
      portal.style.left = `${Math.round(left)}px`;
      portal.style.top = `${Math.round(top)}px`;
    }

    function rememberScrollAnchor(metric) {
      const rect = metric.getBoundingClientRect();
      showScrollX = window.scrollX;
      showScrollY = window.scrollY;
      showMetricLeft = rect.left;
      showMetricTop = rect.top;
    }

    function hide(immediate = false) {
      cancelPendingShow();
      activeMetric?.removeAttribute("aria-describedby");
      activeMetric = null;
      showMetricLeft = Number.NaN;
      showMetricTop = Number.NaN;
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
      if (!(metric instanceof HTMLElement) || !evaluationActive() || MOBILE_TOOLTIP_MEDIA.matches) return;
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
      rememberScrollAnchor(metric);
      tooltip.textContent = text;
      tooltip.classList.remove("tooltipHiding");
      metric.setAttribute("aria-describedby", tooltip.id);
      position();
      const epoch = showEpoch;
      showFrame = requestAnimationFrame(() => {
        showFrame = 0;
        if (epoch !== showEpoch || portal !== tooltip || activeMetric !== metric || !evaluationActive()) return;
        tooltip.classList.add("visible");
        position();
      });
    }

    function sync() {
      if (!evaluationActive() || MOBILE_TOOLTIP_MEDIA.matches) {
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
      if (MOBILE_TOOLTIP_MEDIA.matches) return;
      keyboardFocusMode = false;
      const metric = metricFrom(event.target);
      if (!metric) return;
      hoverMetric = metric;
      sync();
    }

    function onPointerMove(event) {
      if (MOBILE_TOOLTIP_MEDIA.matches) return;
      keyboardFocusMode = false;
      const metric = metricFrom(event.target);
      if (metric === hoverMetric) return;
      hoverMetric = metric;
      sync();
    }

    function onPointerOut(event) {
      if (MOBILE_TOOLTIP_MEDIA.matches) return;
      const metric = metricFrom(event.target);
      if (!metric || metric.contains(event.relatedTarget)) return;
      if (hoverMetric === metric) hoverMetric = null;
      sync();
    }

    function onFocusIn(event) {
      if (MOBILE_TOOLTIP_MEDIA.matches) return;
      const metric = metricFrom(event.target);
      if (!metric) return;
      if (keyboardFocusMode) keyboardFocusMetric = metric;
      sync();
    }

    function onFocusOut(event) {
      if (MOBILE_TOOLTIP_MEDIA.matches) return;
      const metric = metricFrom(event.target);
      if (!metric || metric.contains(event.relatedTarget)) return;
      if (keyboardFocusMetric === metric) keyboardFocusMetric = null;
      sync();
    }

    function onPointerDown(event) {
      keyboardFocusMode = false;
      if (MOBILE_TOOLTIP_MEDIA.matches) {
        clearAll(true);
        return;
      }
      const metric = metricFrom(event.target);
      if (!metric) {
        clearAll(true);
        return;
      }
      hoverMetric = metric;
      if (keyboardFocusMetric === metric) keyboardFocusMetric = null;
      sync();
    }

    function onKeyDown(event) {
      keyboardFocusMode = true;
      if (event.key === "Escape") clearAll(true);
    }

    function onScroll() {
      if (!(activeMetric instanceof HTMLElement) || !activeMetric.isConnected) return;
      const rect = activeMetric.getBoundingClientRect();
      const viewportMoved = Math.abs(window.scrollX - showScrollX) > 0.5
        || Math.abs(window.scrollY - showScrollY) > 0.5;
      const metricMoved = Math.abs(rect.left - showMetricLeft) > 0.5
        || Math.abs(rect.top - showMetricTop) > 0.5;
      if (viewportMoved || metricMoved) clearAll(true);
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

    function onPageLifecycleChange() {
      clearAll(true);
    }

    function onRateStateChange() {
      if (!document.documentElement.classList.contains("mflEvaluationRateResolved")) clearAll(true);
      else sync();
    }

    function onTooltipMediaChange() {
      clearAll(true);
    }

    window.addEventListener("pointerover", onPointerOver, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerout", onPointerOut, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("pagehide", onPageLifecycleChange);
    window.addEventListener("popstate", onPageLifecycleChange);
    window.addEventListener("hashchange", onPageLifecycleChange);
    window.addEventListener("mfl:season-ratios-ready", onRateStateChange);
    window.addEventListener("mfl:evaluation-rate-settled", onRateStateChange);
    MOBILE_TOOLTIP_MEDIA.addEventListener("change", onTooltipMediaChange);

    function destroy() {
      clearAll(true);
      window.removeEventListener("pointerover", onPointerOver, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerout", onPointerOut, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("pagehide", onPageLifecycleChange);
      window.removeEventListener("popstate", onPageLifecycleChange);
      window.removeEventListener("hashchange", onPageLifecycleChange);
      window.removeEventListener("mfl:season-ratios-ready", onRateStateChange);
      window.removeEventListener("mfl:evaluation-rate-settled", onRateStateChange);
      MOBILE_TOOLTIP_MEDIA.removeEventListener("change", onTooltipMediaChange);
    }

    window.__mflDiscountTooltipController = { version: VERSION, show, hide, destroy };
  }

  installTooltipController();
})();