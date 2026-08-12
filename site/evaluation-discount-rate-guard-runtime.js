(() => {
  "use strict";

  window.__mflEvaluationDiscountRateGuard?.destroy?.();

  let destroyed = false;
  let frame = 0;
  const observers = [];

  function discountRateElements() {
    return ["evaluationDiscountRate", "advancedDiscountRateValue"]
      .map((id) => document.getElementById(id))
      .filter((element) => element instanceof HTMLElement);
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

    const authoritativeLabel = liveLabel();
    const nextLabel = authoritativeLabel || "-";
    discountRateElements().forEach((element) => {
      if (String(element.textContent || "").trim() !== nextLabel) {
        element.textContent = nextLabel;
      }
    });

    if (!authoritativeLabel) {
      const metric = evaluationDiscountMetric();
      if (metric?.hasAttribute("data-tooltip")) metric.removeAttribute("data-tooltip");
      metric?.removeAttribute("aria-describedby");
    }
  }

  function schedule() {
    if (!destroyed && !frame) frame = requestAnimationFrame(sync);
  }

  discountRateElements().forEach((element) => {
    const observer = new MutationObserver(schedule);
    observer.observe(element, { childList: true, subtree: true, characterData: true });
    observers.push(observer);
  });

  const sourceObserver = new MutationObserver(schedule);
  sourceObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-mfl-discount-rate-source"],
  });
  observers.push(sourceObserver);

  window.addEventListener("mfl:season-ratios-ready", schedule);
  sync();

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    observers.forEach((observer) => observer.disconnect());
    window.removeEventListener("mfl:season-ratios-ready", schedule);
  }

  window.__mflEvaluationDiscountRateGuard = Object.freeze({ sync: schedule, destroy });
})();
