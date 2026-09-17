(() => {
  "use strict";

  const MOBILE_TABLE_MEDIA = window.matchMedia("(max-width: 900px)");
  const COMPACT_CLASS = "mflListingPricesCompact";
  const STYLE_ID = "mflListingWidthStyle";
  const OVERFLOW_EPSILON = 1;
  const PRICE_SELECTOR = "#tableBody td.col-listing .listingCellPrice";
  const SCROLLER_SELECTOR = "#progressionPage .playerTableScroller";

  window.__mflListingWidthRuntime?.destroy?.();

  let destroyed = false;
  let syncFrame = 0;
  let resizeObserver = null;
  let mutationObserver = null;

  function ensureStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!(style instanceof HTMLStyleElement)) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = `
#progressionPage .playerTableScroller.${COMPACT_CLASS} #tableBody td.col-listing .listingCellPrice {
  display: none;
}
#progressionPage .playerTableScroller.${COMPACT_CLASS} #tableBody td.col-listing .listingCellContent {
  justify-content: center;
  gap: 0;
}
#progressionPage .playerTableScroller.${COMPACT_CLASS} #tableBody td.col-listing .listingCellTableHost {
  justify-content: center;
}
`;
    return style;
  }

  function playerTableScroller() {
    const scroller = document.querySelector(SCROLLER_SELECTOR);
    return scroller instanceof HTMLElement ? scroller : null;
  }

  function listingPrices(scroller) {
    return Array.from(scroller.querySelectorAll(PRICE_SELECTOR))
      .filter((price) => price instanceof HTMLElement);
  }

  function numericDigitCount(value) {
    return (String(value || "").match(/\d/g) || []).length;
  }

  function cssPixels(value) {
    const parsed = Number.parseFloat(String(value || ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function listingBadgeRequiredWidth(price) {
    if (!(price instanceof HTMLElement)) return 0;
    const badge = price.closest(".listingCellContent");
    if (!(badge instanceof HTMLElement)) return 0;

    const badgeStyle = getComputedStyle(badge);
    const icon = badge.querySelector(".listingCellIcon");
    const iconWidth = icon instanceof HTMLElement
      ? Math.max(icon.scrollWidth, icon.getBoundingClientRect().width)
      : 0;
    const priceWidth = Math.max(price.scrollWidth, price.getBoundingClientRect().width);
    const gap = iconWidth > 0 && priceWidth > 0
      ? cssPixels(badgeStyle.columnGap || badgeStyle.gap)
      : 0;

    return cssPixels(badgeStyle.paddingLeft)
      + iconWidth
      + gap
      + priceWidth
      + cssPixels(badgeStyle.paddingRight);
  }

  function listingCellAvailableWidth(price) {
    if (!(price instanceof HTMLElement)) return 0;
    const cell = price.closest("td.col-listing");
    if (!(cell instanceof HTMLTableCellElement)) return 0;
    const cellStyle = getComputedStyle(cell);
    return Math.max(
      0,
      cell.clientWidth
        - cssPixels(cellStyle.paddingLeft)
        - cssPixels(cellStyle.paddingRight),
    );
  }

  function syncListingTooltip(price, compact) {
    if (!(price instanceof HTMLElement)) return;
    const badge = price.closest(".listingCellContent");
    if (!(badge instanceof HTMLElement)) return;
    const text = String(price.textContent || "").trim();

    if (compact && text) {
      if (!badge.dataset.tooltip) {
        badge.dataset.tooltip = text;
        badge.dataset.mflListingWidthTooltip = "true";
      }
      if (!badge.hasAttribute("tabindex")) {
        badge.tabIndex = 0;
        badge.dataset.mflListingWidthTabindex = "true";
      }
      return;
    }

    if (badge.dataset.mflListingWidthTooltip === "true") {
      delete badge.dataset.mflListingWidthTooltip;
      delete badge.dataset.tooltip;
    }
    if (badge.dataset.mflListingWidthTabindex === "true") {
      delete badge.dataset.mflListingWidthTabindex;
      badge.removeAttribute("tabindex");
    }
  }

  function fiveDigitPriceWouldOverflow(price) {
    if (!(price instanceof HTMLElement)) return false;
    if (numericDigitCount(price.textContent) < 5) return false;
    if (price.getClientRects().length === 0) return false;

    const requiredWidth = listingBadgeRequiredWidth(price);
    const availableWidth = listingCellAvailableWidth(price);
    if (requiredWidth > 0 && availableWidth > 0) {
      return requiredWidth - availableWidth > OVERFLOW_EPSILON;
    }

    return price.clientWidth > 0
      && price.scrollWidth - price.clientWidth > OVERFLOW_EPSILON;
  }

  function sync() {
    if (destroyed) return;
    ensureStyle();
    const scroller = playerTableScroller();
    if (!(scroller instanceof HTMLElement)) return;

    scroller.classList.remove(COMPACT_CLASS);
    const prices = listingPrices(scroller);
    if (!prices.length) return;

    const compact = MOBILE_TABLE_MEDIA.matches || prices.some(fiveDigitPriceWouldOverflow);
    scroller.classList.toggle(COMPACT_CLASS, compact);
    prices.forEach((price) => syncListingTooltip(price, compact));
  }

  function scheduleSync() {
    if (destroyed || syncFrame) return;
    syncFrame = requestAnimationFrame(() => {
      syncFrame = 0;
      sync();
    });
  }

  function observeTable() {
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();

    const scroller = playerTableScroller();
    if (!(scroller instanceof HTMLElement)) return;

    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver(scheduleSync);
      resizeObserver.observe(scroller);
      const table = scroller.querySelector("table");
      const body = scroller.querySelector("#tableBody");
      if (table instanceof HTMLElement) resizeObserver.observe(table);
      if (body instanceof HTMLElement) resizeObserver.observe(body);
    }

    if (typeof MutationObserver === "function") {
      mutationObserver = new MutationObserver(scheduleSync);
      const body = scroller.querySelector("#tableBody");
      if (body instanceof HTMLElement) {
        mutationObserver.observe(body, { childList: true, subtree: true });
      }
    }
  }

  function syncAndObserve() {
    if (destroyed) return;
    observeTable();
    sync();
  }

  function destroy() {
    destroyed = true;
    if (syncFrame) cancelAnimationFrame(syncFrame);
    syncFrame = 0;
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();
    window.removeEventListener("resize", scheduleSync);
    MOBILE_TABLE_MEDIA.removeEventListener("change", scheduleSync);
    window.removeEventListener("mfl:route-ready", syncAndObserve);
    playerTableScroller()?.classList.remove(COMPACT_CLASS);
  }

  ensureStyle();
  window.addEventListener("resize", scheduleSync, { passive: true });
  MOBILE_TABLE_MEDIA.addEventListener("change", scheduleSync);
  window.addEventListener("mfl:route-ready", syncAndObserve);
  syncAndObserve();

  window.__mflListingWidthRuntime = Object.freeze({
    sync,
    syncAndObserve,
    destroy,
  });
})();
