(() => {
  const VERSION = "1.119.19";
  const LABEL = `MFL Front Office v${VERSION}`;
  const DISCOUNT_TOOLTIP = "Discount Rate is the geometric mean of the last five completed seasons of MFL/USD conversion growth. Current season is 16, so it uses seasons 11-15.";
  const TOOLTIP_HIDE_DURATION = 170;
  let footerObserver = null;
  let tooltipObserver = null;
  let footerNavigationBound = false;
  let actionTooltipHideTimer = null;

  function syncFooter() {
    const footer = document.querySelector('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
    if (!footer) return false;

    if (footer.textContent !== LABEL) footer.textContent = LABEL;
    if (footer.getAttribute("href") !== "/changelog") footer.setAttribute("href", "/changelog");
    if (footer.dataset.releaseLabel !== LABEL) footer.dataset.releaseLabel = LABEL;
    const ariaLabel = `${LABEL}, open Changelog`;
    if (footer.getAttribute("aria-label") !== ariaLabel) footer.setAttribute("aria-label", ariaLabel);
    if (footer.style.cursor !== "pointer") footer.style.cursor = "pointer";

    if (!footerObserver) {
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

  function bindFooterNavigation() {
    if (footerNavigationBound) return;
    footerNavigationBound = true;
    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      const footer = event.target.closest('.siteFooter a[href="/changelog"], .siteFooter a[data-page="changelog"]');
      if (!footer || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (window.location.pathname !== "/changelog") {
        window.location.assign("/changelog");
      }
    }, true);
  }

  function syncDiscountTooltip() {
    const metric = document.querySelector(".evaluationMetric.evaluationDiscountRate");
    if (!metric) return false;

    if (metric.dataset.tooltip !== DISCOUNT_TOOLTIP) {
      metric.dataset.tooltip = DISCOUNT_TOOLTIP;
    }

    if (!tooltipObserver) {
      tooltipObserver = new MutationObserver(syncDiscountTooltip);
      tooltipObserver.observe(metric, {
        attributes: true,
        attributeFilter: ["data-tooltip"],
      });
    }
    return true;
  }

  function installActionTooltipTransition() {
    if (typeof hideEvaluationLoadActionTooltip !== "function") return false;
    if (hideEvaluationLoadActionTooltip.__mflTransitionedHide) return true;

    const transitionedHide = function transitionedEvaluationLoadActionTooltip() {
      if (actionTooltipHideTimer) {
        window.clearTimeout(actionTooltipHideTimer);
        actionTooltipHideTimer = null;
      }
      if (!evaluationLoadFloatingTooltip) return;

      const tooltip = evaluationLoadFloatingTooltip;
      evaluationLoadFloatingTooltip = null;
      tooltip.classList.remove("visible");
      tooltip.classList.add("tooltipHiding");
      actionTooltipHideTimer = window.setTimeout(() => {
        tooltip.remove();
        actionTooltipHideTimer = null;
      }, TOOLTIP_HIDE_DURATION);
    };
    transitionedHide.__mflTransitionedHide = true;
    hideEvaluationLoadActionTooltip = transitionedHide;
    return true;
  }

  function synchronizeReleaseUi() {
    const root = document.documentElement;
    root.classList.add("mflRelease119Ready");
    root.dataset.mflLatestReleaseVersion = VERSION;
    root.dataset.mflReleaseVersion = VERSION;
    syncFooter();
    bindFooterNavigation();
    syncDiscountTooltip();
    installActionTooltipTransition();
  }

  synchronizeReleaseUi();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", synchronizeReleaseUi, { once: true });
  }
  [0, 50, 250, 1000, 2500, 5000].forEach((delay) => {
    setTimeout(synchronizeReleaseUi, delay);
  });
})();
