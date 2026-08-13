(() => {
  "use strict";

  const TABLE_ROUTE = /^\/(?:database(?:\/|$)|mfl(?:\/|$)|agents?(?:\/|$)|progression(?:\/|$)|watchlist(?:\/|$)|my-players(?:\/|$)|clubs?\/[^/]+(?:\/|$)|club\/[^/]+(?:\/|$))/i;
  const MOBILE_LAYOUT = "(max-width: 900px)";
  const MOBILE_TABLE_MIN_WIDTH = 1240;
  const FILLER_SELECTOR = ".col-shared-width-filler, .col-stable-width-filler, .col-exact-width-filler";

  window.__mflTableWidthRuntime?.destroy?.();

  let observer = null;
  let frame = 0;
  let destroyed = false;

  function isTableRoute() {
    const page = String(document.body?.dataset.page || "").toLowerCase();
    return TABLE_ROUTE.test(window.location.pathname)
      || ["database", "mfl", "agents", "progression", "watchlist", "myplayers", "club"].includes(page);
  }

  function isMobile() {
    return window.matchMedia(MOBILE_LAYOUT).matches;
  }

  function syncMobileButtons(mobile) {
    [[".navButton", "120px"], [".viewButton", "112px"]].forEach(([selector, width]) => {
      document.querySelectorAll(selector).forEach((button) => {
        if (mobile) {
          button.style.setProperty("flex", `0 0 ${width}`, "important");
          button.style.setProperty("width", width, "important");
          button.style.setProperty("min-width", width, "important");
          button.style.setProperty("max-width", width, "important");
        } else {
          ["flex", "width", "min-width", "max-width"].forEach((property) => button.style.removeProperty(property));
        }
      });
    });
    const settings = document.querySelector(".settingsNavButton");
    if (mobile) settings?.style.setProperty("margin-left", "0", "important");
    else settings?.style.removeProperty("margin-left");
  }

  function removeInlineGeometry(element, properties) {
    if (!element?.style) return;
    properties.forEach((property) => element.style.removeProperty(property));
  }

  function applyMobileContract() {
    const page = document.querySelector("#progressionPage");
    const shell = page?.querySelector(".tableShell");
    const scroller = page?.querySelector(".tableScroller");
    const table = scroller?.querySelector("table");
    if (!(shell instanceof HTMLElement)
      || !(scroller instanceof HTMLElement)
      || !(table instanceof HTMLTableElement)) return false;

    table.querySelectorAll(FILLER_SELECTOR).forEach((element) => element.remove());

    [shell, scroller].forEach((element) => removeInlineGeometry(element, [
      "width", "min-width", "max-width", "box-sizing", "overflow", "overflow-x", "overflow-y",
      "overscroll-behavior-x", "touch-action", "-webkit-overflow-scrolling",
    ]));
    removeInlineGeometry(table, [
      "width", "min-width", "max-width", "box-sizing", "table-layout", "border-spacing",
    ]);
    table.querySelectorAll("col").forEach((column) => removeInlineGeometry(column, [
      "width", "min-width", "max-width", "transition",
    ]));

    scroller.dataset.mobileTableScroll = "true";
    scroller.classList.add("tableWidthsReady");
    return true;
  }

  function apply() {
    const mobile = isMobile();
    syncMobileButtons(mobile);
    if (destroyed || !isTableRoute()) return mobile;
    if (mobile) return applyMobileContract();

    const scroller = document.querySelector("#progressionPage .tableScroller");
    if (scroller instanceof HTMLElement) delete scroller.dataset.mobileTableScroll;
    const desktopOwner = window.applyExactPlayerTableWidths;
    return typeof desktopOwner === "function" && desktopOwner !== apply
      ? Boolean(desktopOwner())
      : false;
  }

  function schedule() {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      apply();
    });
  }

  function observe() {
    observer?.disconnect();
    observer = new MutationObserver(() => {
      if (isTableRoute()) schedule();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "data-page"],
    });
  }

  function bind() {
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("popstate", schedule);
    window.addEventListener("mfl:ready", schedule);
  }

  function destroy() {
    destroyed = true;
    window.cancelAnimationFrame(frame);
    observer?.disconnect();
    observer = null;
    window.removeEventListener("resize", schedule);
    window.removeEventListener("popstate", schedule);
    window.removeEventListener("mfl:ready", schedule);
  }

  observe();
  bind();
  window.__mflTableWidthRuntime = Object.freeze({
    mobileTableMinWidth: MOBILE_TABLE_MIN_WIDTH,
    apply,
    takeOwnership: apply,
    destroy,
  });
  apply();
})();