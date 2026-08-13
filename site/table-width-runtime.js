(() => {
  "use strict";

  const TABLE_ROUTE = /^\/(?:database(?:\/|$)|mfl(?:\/|$)|agents?(?:\/|$)|progression(?:\/|$)|watchlist(?:\/|$)|my-players(?:\/|$)|clubs?\/[^/]+(?:\/|$)|club\/[^/]+(?:\/|$))/i;
  const MOBILE_LAYOUT = "(max-width: 900px)";
  const MOBILE_TABLE_MIN_WIDTH = 1240;
  const MOBILE_COLUMN_WIDTHS = Object.freeze({
    "col-select": 51.09,
    "col-id": 68.13,
    "col-flag": 45.41,
    "col-name": 212.89,
    "col-nationality": 141.92,
    "col-age": 65.28,
    "col-positions": 119.22,
    "col-seasons": 82.31,
    "col-stat": 107.86,
    "col-contract-revenue": 140,
    "col-contract-club": 227.16,
    "col-contract-division": 280,
    "col-agent": 187.34,
    "col-joined-agency": 187.34,
    "col-owned-since": 187.34,
    "col-link": 48.39,
  });
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
    document.querySelectorAll(".navButton").forEach((button) => {
      const icon = button.querySelector(".navEmoji");
      const text = button.querySelector(".navText");
      if (mobile) {
        button.style.setProperty("display", "grid", "important");
        button.style.setProperty("grid-template-columns", "24px minmax(0, 1fr)", "important");
        button.style.setProperty("align-items", "center", "important");
        button.style.setProperty("gap", "0", "important");
        button.style.setProperty("flex", "0 0 148px", "important");
        button.style.setProperty("width", "148px", "important");
        button.style.setProperty("min-width", "148px", "important");
        button.style.setProperty("max-width", "148px", "important");
        button.style.setProperty("padding", "0 8px", "important");
        if (icon) {
          icon.style.setProperty("grid-column", "1", "important");
          icon.style.setProperty("justify-self", "center", "important");
        }
        if (text) {
          text.style.setProperty("grid-column", "2", "important");
          text.style.setProperty("justify-self", "stretch", "important");
          text.style.setProperty("text-align", "center", "important");
          text.style.setProperty("margin-left", "0", "important");
          text.style.setProperty("max-width", "none", "important");
        }
      } else {
        ["display", "grid-template-columns", "align-items", "gap", "flex", "width", "min-width", "max-width", "padding"].forEach((property) => button.style.removeProperty(property));
        ["grid-column", "justify-self"].forEach((property) => icon?.style.removeProperty(property));
        ["grid-column", "justify-self", "text-align", "margin-left", "max-width"].forEach((property) => text?.style.removeProperty(property));
      }
    });

    document.querySelectorAll(".viewButton").forEach((button) => {
      if (mobile) {
        button.style.setProperty("flex", "0 0 112px", "important");
        button.style.setProperty("width", "112px", "important");
        button.style.setProperty("min-width", "112px", "important");
        button.style.setProperty("max-width", "112px", "important");
      } else {
        ["flex", "width", "min-width", "max-width"].forEach((property) => button.style.removeProperty(property));
      }
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

    let tableWidth = 0;
    let validColumns = 0;
    table.querySelectorAll("col").forEach((column) => {
      const className = Object.keys(MOBILE_COLUMN_WIDTHS).find((name) => column.classList.contains(name));
      if (!className) return;
      const widthValue = MOBILE_COLUMN_WIDTHS[className];
      const width = `${widthValue.toFixed(2)}px`;
      tableWidth += widthValue;
      validColumns += 1;
      ["width", "min-width", "max-width"].forEach((property) => column.style.setProperty(property, width, "important"));
      column.style.setProperty("transition", "none", "important");
    });

    if (validColumns > 0) {
      const width = `${Math.max(MOBILE_TABLE_MIN_WIDTH, tableWidth).toFixed(2)}px`;
      table.style.setProperty("table-layout", "fixed", "important");
      table.style.setProperty("width", width, "important");
      table.style.setProperty("min-width", width, "important");
      table.style.setProperty("max-width", width, "important");
      table.style.setProperty("box-sizing", "border-box", "important");
      table.style.setProperty("border-spacing", "0", "important");
    }

    scroller.style.setProperty("overflow-x", "auto", "important");
    scroller.style.setProperty("overflow-y", "hidden", "important");
    scroller.style.setProperty("overscroll-behavior-x", "contain", "important");
    scroller.style.setProperty("touch-action", "pan-x pan-y", "important");
    scroller.style.setProperty("-webkit-overflow-scrolling", "touch");
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