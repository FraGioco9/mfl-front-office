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

(() => {
  "use strict";

  let captured = false;
  let armed = document.documentElement.dataset.mflReady === "true";
  let canonical = [];
  const input = () => document.getElementById("evaluationSearchInput");
  const results = () => document.getElementById("evaluationSearchResults");

  function currentButtons() {
    const container = results();
    if (!(container instanceof HTMLElement) || container.hidden) return [];
    return Array.from(container.querySelectorAll(":scope > .evaluationSearchResult"))
      .filter((button) => button instanceof HTMLButtonElement)
      .slice(0, 5);
  }

  function playerId(button) {
    return String(button?.textContent || "").match(/#(\d+)/)?.[1] || "";
  }

  function prepend(button) {
    if (!(button instanceof HTMLButtonElement)) return;
    const id = playerId(button);
    canonical = [button, ...canonical.filter((candidate) => playerId(candidate) !== id)].slice(0, 5);
  }

  function onResultClick(event) {
    if (!captured || !(event.target instanceof Element)) return;
    const button = event.target.closest("#evaluationSearchResults .evaluationSearchResult");
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;
    prepend(button);
  }

  function syncCanonical() {
    const field = input();
    const container = results();
    if (!(field instanceof HTMLInputElement) || !(container instanceof HTMLElement)) return;

    if (!captured && armed && !field.value.trim()) {
      const rendered = currentButtons();
      if (rendered.length) {
        canonical = rendered;
        captured = true;
      }
      return;
    }

    if (!captured || field.value.trim()) return;

    queueMicrotask(() => {
      if (field.value.trim() || !canonical.length) return;
      const current = Array.from(container.children);
      const alreadyCanonical = current.length === canonical.length
        && current.every((node, index) => node === canonical[index]);
      if (alreadyCanonical && !container.hidden) return;
      container.replaceChildren(...canonical);
      container.hidden = false;
    });
  }

  document.addEventListener("click", onResultClick, true);
  window.addEventListener("mfl:ready", () => { armed = true; });
  const container = results();
  if (container instanceof HTMLElement) {
    new MutationObserver(syncCanonical).observe(container, {
      childList: true,
      attributes: true,
      attributeFilter: ["hidden"],
    });
  }
})();
