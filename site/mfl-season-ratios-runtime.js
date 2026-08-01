(() => {
  const VERSION = "1.119.28";
  const LABEL = `MFL Front Office v${VERSION}`;
  const DISCOUNT_TOOLTIP = "Discount Rate is the geometric mean of the last five completed seasons of MFL/USD conversion growth. Current season is 16, so it uses seasons 11-15.";
  const TOOLTIP_HIDE_DURATION = 170;
  let footerObserver = null;
  let observedFooter = null;
  let tooltipObserver = null;
  let discountTooltip = null;
  let discountTooltipTarget = null;
  let discountTooltipHideTimer = null;

  function installReleaseStyles() {
    let style = document.getElementById("mflRelease128RuntimeStyles");
    if (!style) {
      style = document.createElement("style");
      style.id = "mflRelease128RuntimeStyles";
      document.head.appendChild(style);
    }
    style.textContent = `
      html body .siteFooter.siteFooter a[href="/changelog"],
      html body .siteFooter.siteFooter a[data-page="changelog"] {
        display: inline-block !important;
        visibility: visible !important;
        opacity: 1 !important;
        font-size: 14px !important;
        cursor: pointer !important;
        pointer-events: auto !important;
      }
    `;
  }

  function syncFooter() {
    const footer = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
    if (!footer) return false;
    if (footer.textContent !== LABEL) footer.textContent = LABEL;
    if (footer.getAttribute("href") !== "/changelog") footer.setAttribute("href", "/changelog");
    if (footer.dataset.releaseLabel !== LABEL) footer.dataset.releaseLabel = LABEL;
    const ariaLabel = `${LABEL}, open Changelog`;
    if (footer.getAttribute("aria-label") !== ariaLabel) footer.setAttribute("aria-label", ariaLabel);
    if (footer.style.cursor !== "pointer") footer.style.cursor = "pointer";

    if (observedFooter !== footer) {
      footerObserver?.disconnect();
      observedFooter = footer;
      footerObserver = new MutationObserver(syncFooter);
      footerObserver.observe(footer, {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true,
      });
    }
    return true;
  }

  function ensureDiscountTooltip() {
    const box = document.querySelector(".evaluationDiscountRate[data-tooltip]");
    if (!box) return false;

    if (!discountTooltip || !discountTooltip.isConnected) {
      discountTooltip = document.createElement("div");
      discountTooltip.id = "evaluationDiscountTooltipPortal";
      discountTooltip.className = "evaluationDiscountTooltipPortal";
      discountTooltip.setAttribute("role", "tooltip");
      discountTooltip.hidden = true;
      document.body.appendChild(discountTooltip);
    }

    if (box.dataset.mflDiscountTooltipBound === VERSION) return true;
    box.dataset.mflDiscountTooltipBound = VERSION;
    box.setAttribute("aria-describedby", discountTooltip.id);

    const show = () => {
      if (discountTooltipHideTimer) {
        window.clearTimeout(discountTooltipHideTimer);
        discountTooltipHideTimer = null;
      }
      discountTooltipTarget = box;
      discountTooltip.textContent = String(box.dataset.tooltip || DISCOUNT_TOOLTIP);
      discountTooltip.hidden = false;
      discountTooltip.classList.remove("tooltipHiding");
      positionDiscountTooltip();
      window.requestAnimationFrame(() => {
        if (discountTooltipTarget === box) discountTooltip.classList.add("visible");
      });
    };

    const hide = () => {
      if (!discountTooltip || discountTooltipTarget !== box) return;
      discountTooltipTarget = null;
      discountTooltip.classList.remove("visible");
      discountTooltip.classList.add("tooltipHiding");
      if (discountTooltipHideTimer) window.clearTimeout(discountTooltipHideTimer);
      discountTooltipHideTimer = window.setTimeout(() => {
        if (!discountTooltipTarget && discountTooltip) {
          discountTooltip.hidden = true;
          discountTooltip.classList.remove("tooltipHiding");
        }
        discountTooltipHideTimer = null;
      }, TOOLTIP_HIDE_DURATION);
    };

    box.addEventListener("mouseenter", show);
    box.addEventListener("mouseleave", hide);
    box.addEventListener("focusin", show);
    box.addEventListener("focusout", hide);
    box.addEventListener("keydown", (event) => {
      if (event.key === "Escape") hide();
    });
    return true;
  }

  function positionDiscountTooltip() {
    if (!discountTooltip || discountTooltip.hidden || !discountTooltipTarget) return;
    const targetRect = discountTooltipTarget.getBoundingClientRect();
    discountTooltip.style.left = "0px";
    discountTooltip.style.top = "0px";
    const tooltipRect = discountTooltip.getBoundingClientRect();
    const margin = 12;
    const gap = 6;
    const maxLeft = Math.max(margin, window.innerWidth - tooltipRect.width - margin);
    const left = Math.min(maxLeft, Math.max(margin, targetRect.right - tooltipRect.width));
    let top = targetRect.top - tooltipRect.height - gap;
    if (top < margin) {
      top = Math.min(window.innerHeight - tooltipRect.height - margin, targetRect.bottom + gap);
    }
    discountTooltip.style.left = `${Math.round(left)}px`;
    discountTooltip.style.top = `${Math.round(top)}px`;
  }

  function syncDiscountTooltip() {
    const metric = document.querySelector(".evaluationMetric.evaluationDiscountRate");
    if (!metric) return false;
    if (metric.dataset.tooltip !== DISCOUNT_TOOLTIP) metric.dataset.tooltip = DISCOUNT_TOOLTIP;
    ensureDiscountTooltip();

    if (!tooltipObserver) {
      tooltipObserver = new MutationObserver(() => {
        if (metric.dataset.tooltip !== DISCOUNT_TOOLTIP) metric.dataset.tooltip = DISCOUNT_TOOLTIP;
      });
      tooltipObserver.observe(metric, {
        attributes: true,
        attributeFilter: ["data-tooltip"],
      });
    }
    return true;
  }

  function synchronizeReleaseUi() {
    const root = document.documentElement;
    root.classList.add("mflRelease128Ready");
    root.dataset.mflLatestReleaseVersion = VERSION;
    root.dataset.mflReleaseVersion = VERSION;
    installReleaseStyles();
    syncFooter();
    syncDiscountTooltip();
  }

  window.addEventListener("resize", () => {
    if (discountTooltipTarget) positionDiscountTooltip();
  });
  document.addEventListener("scroll", () => {
    if (discountTooltipTarget) positionDiscountTooltip();
  }, true);

  synchronizeReleaseUi();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", synchronizeReleaseUi, { once: true });
  }
  [0, 50, 150, 400, 1000, 2000, 5000].forEach((delay) => {
    window.setTimeout(synchronizeReleaseUi, delay);
  });
})();
