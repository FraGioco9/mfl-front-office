(() => {
  "use strict";

  window.__mflEvaluationDiscountRateGuard?.destroy?.();

  let destroyed = false;
  let frame = 0;
  let observer = null;

  function evaluationDiscountRateElement() {
    const element = document.getElementById("evaluationDiscountRate");
    return element instanceof HTMLElement ? element : null;
  }

  function evaluationDiscountMetric() {
    const element = document.querySelector(".evaluationMetric.evaluationDiscountRate");
    return element instanceof HTMLElement ? element : null;
  }

  function liveLabel() {
    if (document.documentElement.dataset.mflDiscountRateSource !== "supabase-live-request") return "";
    const result = window.__mflDynamicDiscountResult;
    const label = String(result?.label || "").trim();
    return /^-?\d+(?:\.\d+)?%$/.test(label) ? label : "";
  }

  function sync() {
    frame = 0;
    if (destroyed) return;

    const value = evaluationDiscountRateElement();
    if (!value) return;

    const authoritativeLabel = liveLabel();
    const nextLabel = authoritativeLabel || "-";
    if (String(value.textContent || "").trim() !== nextLabel) {
      value.textContent = nextLabel;
    }

    if (!authoritativeLabel) {
      const metric = evaluationDiscountMetric();
      if (metric?.hasAttribute("data-tooltip")) metric.removeAttribute("data-tooltip");
      metric?.removeAttribute("aria-describedby");
    }
  }

  function schedule() {
    if (!destroyed && !frame) frame = requestAnimationFrame(sync);
  }

  observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["data-mfl-discount-rate-source"],
  });

  window.addEventListener("mfl:season-ratios-ready", schedule);
  window.addEventListener("popstate", schedule);
  sync();

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    observer?.disconnect();
    window.removeEventListener("mfl:season-ratios-ready", schedule);
    window.removeEventListener("popstate", schedule);
  }

  window.__mflEvaluationDiscountRateGuard = Object.freeze({ sync: schedule, destroy });
})();
