(() => {
  "use strict";

  const TITLE_SELECTOR = "#tablePageTitle";
  const MOBILE_TABLE_MEDIA = window.matchMedia("(max-width: 900px)");
  const LISTING_COMPACT_CLASS = "mflListingPricesCompact";
  const LISTING_STYLE_ID = "mflListingWidthStyle";
  const LISTING_OVERFLOW_EPSILON = 1;
  const LISTING_PRICE_SELECTOR = "#tableBody td.col-listing .listingCellPrice";
  const PLAYER_TABLE_SCROLLER_SELECTOR = "#progressionPage .playerTableScroller";

  window.__mflDesktopTableStyleRuntime?.destroy?.();

  let destroyed = false;
  let routeFrame = 0;
  let listingResizeObserver = null;
  let listingMutationObserver = null;
  let observedListingScroller = null;
  let observedListingTable = null;
  let observedListingBody = null;

  function normalizeAgentAddress(value) {
    const address = String(value || "").trim().toLowerCase();
    return address ? (address.startsWith("0x") ? address : `0x${address}`) : "";
  }

  function agentAddressFromPath() {
    const match = String(window.location.pathname || "").match(/^\/agents\/([^/?#]+)(?:\/|$)/i);
    if (!match) return "";
    try {
      return normalizeAgentAddress(decodeURIComponent(match[1] || ""));
    } catch {
      return normalizeAgentAddress(match[1] || "");
    }
  }

  function titleElement() {
    const title = document.querySelector(TITLE_SELECTOR);
    return title instanceof HTMLElement ? title : null;
  }

  function clearAgentCopyTarget(target) {
    if (!(target instanceof HTMLElement)) return;
    target.removeAttribute("data-agent-wallet-copy");
    target.removeAttribute("data-note-tooltip");
    target.removeAttribute("role");
    target.removeAttribute("tabindex");
    target.removeAttribute("aria-label");
  }

  function syncAgentTitleInteraction() {
    const title = titleElement();
    if (!title) return;
    const addressTarget = title.querySelector("[data-agent-wallet-copy]");
    const address = agentAddressFromPath();
    if (!(addressTarget instanceof HTMLElement) || !address) {
      clearAgentCopyTarget(addressTarget);
      clearAgentCopyTarget(title);
      return;
    }

    addressTarget.dataset.agentWalletCopy = address;
    addressTarget.dataset.noteTooltip = "Click to copy wallet address";
    addressTarget.setAttribute("role", "button");
    addressTarget.setAttribute("tabindex", "0");
    addressTarget.setAttribute("aria-label", "Click to copy wallet address");
  }

  function ensureListingStyle() {
    let style = document.getElementById(LISTING_STYLE_ID);
    if (!(style instanceof HTMLStyleElement)) {
      style = document.createElement("style");
      style.id = LISTING_STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = `
#progressionPage .playerTableScroller.${LISTING_COMPACT_CLASS} #tableBody td.col-listing .listingCellPrice {
  display: none;
}
#progressionPage .playerTableScroller.${LISTING_COMPACT_CLASS} #tableBody td.col-listing .listingCellContent {
  justify-content: center;
  gap: 0;
}
#progressionPage .playerTableScroller.${LISTING_COMPACT_CLASS} #tableBody td.col-listing .listingCellTableHost {
  justify-content: center;
}
`;
    return style;
  }

  function playerTableScroller() {
    const scroller = document.querySelector(PLAYER_TABLE_SCROLLER_SELECTOR);
    return scroller instanceof HTMLElement ? scroller : null;
  }

  function listingPrices(scroller) {
    if (!(scroller instanceof HTMLElement)) return [];
    return Array.from(scroller.querySelectorAll(LISTING_PRICE_SELECTOR))
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
      cell.clientWidth - cssPixels(cellStyle.paddingLeft) - cssPixels(cellStyle.paddingRight),
    );
  }

  function fiveDigitPriceWouldOverflow(price) {
    if (!(price instanceof HTMLElement)) return false;
    if (numericDigitCount(price.textContent) < 5) return false;
    if (price.getClientRects().length === 0) return false;

    const requiredWidth = listingBadgeRequiredWidth(price);
    const availableWidth = listingCellAvailableWidth(price);
    if (requiredWidth > 0 && availableWidth > 0
      && requiredWidth - availableWidth > LISTING_OVERFLOW_EPSILON) {
      return true;
    }

    return price.clientWidth > 0
      && price.scrollWidth - price.clientWidth > LISTING_OVERFLOW_EPSILON;
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

  function syncListingWidth() {
    ensureListingStyle();
    const scroller = playerTableScroller();
    if (!(scroller instanceof HTMLElement)) return;

    scroller.classList.remove(LISTING_COMPACT_CLASS);
    const prices = listingPrices(scroller);
    if (!prices.length) return;

    const compact = MOBILE_TABLE_MEDIA.matches || prices.some(fiveDigitPriceWouldOverflow);
    scroller.classList.toggle(LISTING_COMPACT_CLASS, compact);
    prices.forEach((price) => syncListingTooltip(price, compact));
  }

  function bindListingObservers() {
    const scroller = playerTableScroller();
    const table = scroller?.querySelector("table");
    const body = scroller?.querySelector("#tableBody");
    const normalizedTable = table instanceof HTMLElement ? table : null;
    const normalizedBody = body instanceof HTMLElement ? body : null;

    if (scroller === observedListingScroller
      && normalizedTable === observedListingTable
      && normalizedBody === observedListingBody) return;

    listingResizeObserver?.disconnect();
    listingMutationObserver?.disconnect();
    observedListingScroller = scroller;
    observedListingTable = normalizedTable;
    observedListingBody = normalizedBody;

    if (!(scroller instanceof HTMLElement)) return;

    if (typeof ResizeObserver === "function") {
      listingResizeObserver ||= new ResizeObserver(scheduleRouteSync);
      listingResizeObserver.observe(scroller);
      if (normalizedTable) listingResizeObserver.observe(normalizedTable);
      if (normalizedBody) listingResizeObserver.observe(normalizedBody);
    }

    if (typeof MutationObserver === "function" && normalizedBody) {
      listingMutationObserver ||= new MutationObserver(scheduleRouteSync);
      listingMutationObserver.observe(normalizedBody, { childList: true, subtree: true });
    }
  }

  function syncRouteUi() {
    routeFrame = 0;
    if (destroyed) return;
    syncAgentTitleInteraction();
    bindListingObservers();
    syncListingWidth();
  }

  function scheduleRouteSync() {
    if (destroyed || routeFrame) return;
    routeFrame = requestAnimationFrame(syncRouteUi);
  }

  function copyTargetFromEvent(event) {
    const target = event.target instanceof Element ? event.target.closest("[data-agent-wallet-copy]") : null;
    if (!(target instanceof HTMLElement)) return null;
    const address = normalizeAgentAddress(target.dataset.agentWalletCopy);
    return address && address === agentAddressFromPath() ? target : null;
  }

  async function copyWalletAddress(target, event) {
    const address = normalizeAgentAddress(target?.dataset?.agentWalletCopy);
    if (!address) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    window.__mflStaticUiRuntime?.hideTooltips?.({ immediate: true });
    target.blur?.();

    try {
      await navigator.clipboard.writeText(address);
      if (typeof showToast === "function") showToast("Wallet address copied.");
    } catch {
      if (typeof showToast === "function") showToast("Could not copy wallet address.");
    }
  }

  function onClick(event) {
    const target = copyTargetFromEvent(event);
    if (target) void copyWalletAddress(target, event);
    scheduleRouteSync();
  }

  function onKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = copyTargetFromEvent(event);
    if (target) void copyWalletAddress(target, event);
  }

  function destroy() {
    destroyed = true;
    if (routeFrame) cancelAnimationFrame(routeFrame);
    routeFrame = 0;
    listingResizeObserver?.disconnect();
    listingMutationObserver?.disconnect();
    listingResizeObserver = null;
    listingMutationObserver = null;
    observedListingScroller = null;
    observedListingTable = null;
    observedListingBody = null;
    document.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("resize", scheduleRouteSync);
    window.removeEventListener("mfl:ready", scheduleRouteSync);
    window.removeEventListener("mfl:route-ready", scheduleRouteSync);
    window.removeEventListener("pageshow", scheduleRouteSync);
    window.removeEventListener("popstate", scheduleRouteSync);
    MOBILE_TABLE_MEDIA.removeEventListener("change", scheduleRouteSync);
    const scroller = playerTableScroller();
    if (scroller instanceof HTMLElement) scroller.classList.remove(LISTING_COMPACT_CLASS);
    listingPrices(scroller).forEach((price) => syncListingTooltip(price, false));
  }

  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", scheduleRouteSync, { passive: true });
  window.addEventListener("mfl:ready", scheduleRouteSync);
  window.addEventListener("mfl:route-ready", scheduleRouteSync);
  window.addEventListener("pageshow", scheduleRouteSync);
  window.addEventListener("popstate", scheduleRouteSync);
  MOBILE_TABLE_MEDIA.addEventListener("change", scheduleRouteSync);
  syncRouteUi();

  window.__mflDesktopTableStyleRuntime = Object.freeze({
    sync: scheduleRouteSync,
    destroy,
  });
})();
