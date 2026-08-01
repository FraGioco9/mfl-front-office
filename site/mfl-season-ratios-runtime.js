(() => {
  const VERSION = "1.119.18";
  const LABEL = `MFL Front Office v${VERSION}`;
  const DISCOUNT_TOOLTIP = "Discount Rate is the geometric mean of the last five completed seasons of MFL/USD conversion growth. Current season is 15, so it uses seasons 10-14.";
  const HIDE_DURATION = 170;
  let activeTarget = null;
  let tooltip = null;
  let hideTimer = null;

  function syncReleaseUi() {
    const root = document.documentElement;
    root.classList.add("mflRelease118Ready");
    root.dataset.mflLatestReleaseVersion = VERSION;
    root.dataset.mflReleaseVersion = VERSION;

    const footer = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
    if (footer) {
      footer.textContent = LABEL;
      footer.setAttribute("href", "/changelog");
      footer.dataset.releaseLabel = LABEL;
      footer.setAttribute("aria-label", `${LABEL}, open Changelog`);
    }

    const metric = document.querySelector(".evaluationMetric.evaluationDiscountRate");
    if (metric) metric.dataset.tooltip = DISCOUNT_TOOLTIP;
  }

  function tooltipTarget(node) {
    if (!(node instanceof Element)) return null;
    const target = node.closest("[data-tooltip], [data-note-tooltip], [title]");
    if (!target) return null;
    if (target.hasAttribute("title") && !target.dataset.tooltip) {
      target.dataset.tooltip = target.getAttribute("title") || "";
      target.removeAttribute("title");
    }
    return target;
  }

  function tooltipText(target) {
    return String(target?.dataset?.noteTooltip || target?.dataset?.tooltip || "").trim();
  }

  function ensureTooltip() {
    if (tooltip?.isConnected) return tooltip;
    tooltip = document.createElement("div");
    tooltip.className = "mflUnifiedTooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.hidden = true;
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function positionTooltip(target) {
    if (!tooltip || !target?.isConnected) return;
    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const margin = 8;
    let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin));
    let top = rect.top - tooltipRect.height - 9;
    if (top < margin) top = rect.bottom + 9;
    if (top + tooltipRect.height > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - tooltipRect.height - margin);
    }
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  }

  function showTooltip(target) {
    const text = tooltipText(target);
    if (!text) return;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    activeTarget = target;
    const element = ensureTooltip();
    element.textContent = text;
    element.hidden = false;
    element.classList.remove("is-hiding");
    positionTooltip(target);
    requestAnimationFrame(() => {
      if (activeTarget === target) element.classList.add("visible");
    });
  }

  function hideTooltip(target = activeTarget) {
    if (!tooltip || (target && activeTarget && target !== activeTarget)) return;
    activeTarget = null;
    tooltip.classList.remove("visible");
    tooltip.classList.add("is-hiding");
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!activeTarget && tooltip) {
        tooltip.hidden = true;
        tooltip.classList.remove("is-hiding");
      }
      hideTimer = null;
    }, HIDE_DURATION);
  }

  document.addEventListener("pointerover", (event) => {
    const target = tooltipTarget(event.target);
    if (!target || target.contains(event.relatedTarget)) return;
    showTooltip(target);
  }, true);

  document.addEventListener("pointerout", (event) => {
    const target = tooltipTarget(event.target);
    if (!target || target.contains(event.relatedTarget)) return;
    hideTooltip(target);
  }, true);

  document.addEventListener("focusin", (event) => {
    const target = tooltipTarget(event.target);
    if (target) showTooltip(target);
  }, true);

  document.addEventListener("focusout", (event) => {
    const target = tooltipTarget(event.target);
    if (target) hideTooltip(target);
  }, true);

  window.addEventListener("resize", () => {
    if (activeTarget) positionTooltip(activeTarget);
  });
  window.addEventListener("scroll", () => {
    if (activeTarget) positionTooltip(activeTarget);
  }, true);

  syncReleaseUi();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", syncReleaseUi, { once: true });
  }
  [0, 50, 250, 1000, 2500, 5000].forEach((delay) => setTimeout(syncReleaseUi, delay));
})();
