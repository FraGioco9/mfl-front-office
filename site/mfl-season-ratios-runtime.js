(() => {
  const VERSION = "1.119.17";
  const LABEL = `MFL Front Office v${VERSION}`;
  const DISCOUNT_TOOLTIP = "Discount Rate is the geometric mean of the last five completed seasons of MFL/USD conversion growth. Current season is 15, so it uses seasons 10-14.";
  let footerObserver = null;
  let tooltipObserver = null;

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

  function synchronizeReleaseUi() {
    const root = document.documentElement;
    root.classList.add("mflRelease117Ready");
    root.dataset.mflLatestReleaseVersion = VERSION;
    root.dataset.mflReleaseVersion = VERSION;
    syncFooter();
    syncDiscountTooltip();
  }

  synchronizeReleaseUi();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", synchronizeReleaseUi, { once: true });
  }
  [0, 50, 250, 1000, 2500, 5000].forEach((delay) => {
    setTimeout(synchronizeReleaseUi, delay);
  });
})();
