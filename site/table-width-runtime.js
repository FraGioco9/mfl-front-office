(() => {
  "use strict";

  const TABLE_ROUTE = /^\/(?:database(?:\/|$)|mfl(?:\/|$)|agents?(?:\/|$)|progression(?:\/|$)|watchlist(?:\/|$)|my-players(?:\/|$)|clubs?\/[^/]+(?:\/|$)|club\/[^/]+(?:\/|$))/i;
  const MOBILE_LAYOUT = "(max-width: 900px)";
  const MOBILE_TABLE_MIN_WIDTH = 1240;
  const DESKTOP_COLUMN_PERCENTAGES = Object.freeze({
    "col-select": 3,
    "col-id": 3,
    "col-flag": 3,
    "col-name": 13,
    "col-nationality": 7,
    "col-age": 6,
    "col-positions": 6,
    "col-seasons": 5,
    "col-stat": 6,
    "col-contract-revenue": 8,
    "col-contract-club": 19,
    "col-contract-division": 9,
    "col-agent": 10,
    "col-joined-agency": 10,
    "col-owned-since": 10,
    "col-link": 2,
  });
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
  const TABLE_STRUCTURE_SELECTOR = "table, colgroup, col, thead";

  const sixStatsWidth = DESKTOP_COLUMN_PERCENTAGES["col-stat"] * 6;
  const contractsWidth = DESKTOP_COLUMN_PERCENTAGES["col-contract-revenue"]
    + DESKTOP_COLUMN_PERCENTAGES["col-contract-club"]
    + DESKTOP_COLUMN_PERCENTAGES["col-contract-division"];
  if (sixStatsWidth !== contractsWidth) {
    throw new Error("Contract columns must equal the combined width of the six attribute stats.");
  }
  if (DESKTOP_COLUMN_PERCENTAGES["col-agent"] !== DESKTOP_COLUMN_PERCENTAGES["col-joined-agency"]
    || DESKTOP_COLUMN_PERCENTAGES["col-agent"] !== DESKTOP_COLUMN_PERCENTAGES["col-owned-since"]) {
    throw new Error("Agent and Joined Agency columns must have the same width.");
  }

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

  function syncMobileFlag(mobile = isMobile()) {
    document.documentElement.dataset.mflMobileLayout = mobile ? "true" : "false";
  }

  function valueForColumn(column, widths) {
    if (!(column instanceof Element)) return null;
    const className = Object.keys(widths).find((name) => column.classList.contains(name));
    return className ? widths[className] : null;
  }

  function tableElements() {
    const page = document.querySelector("#progressionPage");
    const shell = page?.querySelector(".tableShell");
    const scroller = page?.querySelector(".tableScroller");
    const table = scroller?.querySelector("table");
    if (!(shell instanceof HTMLElement)
      || !(scroller instanceof HTMLElement)
      || !(table instanceof HTMLTableElement)) return null;
    return { page, shell, scroller, table };
  }

  function mobileTableGeometry(table) {
    const columns = Array.from(table.querySelectorAll("col"));
    const widths = columns.map((column) => valueForColumn(column, MOBILE_COLUMN_WIDTHS))
      .filter((width) => Number.isFinite(width));
    return {
      columns,
      widths,
      tableWidth: Math.max(MOBILE_TABLE_MIN_WIDTH, widths.reduce((sum, width) => sum + Number(width), 0)),
    };
  }

  function removeInlineGeometry(element, properties) {
    if (!element?.style) return;
    properties.forEach((property) => element.style.removeProperty(property));
  }

  function applyDesktopContract() {
    const elements = tableElements();
    if (!elements) return false;
    const { shell, scroller, table } = elements;

    table.querySelectorAll(FILLER_SELECTOR).forEach((element) => element.remove());

    [shell, scroller].forEach((element) => removeInlineGeometry(element, [
      "width", "min-width", "max-width", "box-sizing", "overflow", "overflow-x", "overflow-y",
      "overscroll-behavior-x", "touch-action", "-webkit-overflow-scrolling",
    ]));
    removeInlineGeometry(table, [
      "width", "min-width", "max-width", "box-sizing", "table-layout", "border-spacing",
    ]);

    let validColumns = 0;
    table.querySelectorAll("col").forEach((column) => {
      const percentage = valueForColumn(column, DESKTOP_COLUMN_PERCENTAGES);
      if (!Number.isFinite(percentage)) return;
      validColumns += 1;
      column.style.setProperty("width", `${Number(percentage)}%`, "important");
      column.style.setProperty("min-width", "0", "important");
      column.style.setProperty("max-width", "none", "important");
      column.style.setProperty("transition", "none", "important");
    });

    if (!validColumns) return false;

    table.style.setProperty("table-layout", "fixed", "important");
    table.style.setProperty("width", "100%", "important");
    table.style.setProperty("min-width", "100%", "important");
    table.style.setProperty("max-width", "100%", "important");
    table.style.setProperty("box-sizing", "border-box", "important");
    table.style.setProperty("border-spacing", "0", "important");
    scroller.style.setProperty("overflow-x", "hidden", "important");
    delete scroller.dataset.mobileTableScroll;
    scroller.classList.add("tableWidthsReady");
    return true;
  }

  function applyMobileContract() {
    const elements = tableElements();
    if (!elements) return false;
    const { shell, scroller, table } = elements;

    table.querySelectorAll(FILLER_SELECTOR).forEach((element) => element.remove());

    [shell, scroller].forEach((element) => removeInlineGeometry(element, [
      "width", "min-width", "max-width", "box-sizing", "overflow", "overflow-x", "overflow-y",
      "overscroll-behavior-x", "touch-action", "-webkit-overflow-scrolling",
    ]));
    removeInlineGeometry(table, [
      "width", "min-width", "max-width", "box-sizing", "table-layout", "border-spacing",
    ]);

    const { columns, tableWidth } = mobileTableGeometry(table);
    let validColumns = 0;
    columns.forEach((column) => {
      const widthValue = valueForColumn(column, MOBILE_COLUMN_WIDTHS);
      if (!Number.isFinite(widthValue)) return;
      const width = `${Number(widthValue).toFixed(2)}px`;
      validColumns += 1;
      ["width", "min-width", "max-width"].forEach((property) => column.style.setProperty(property, width, "important"));
      column.style.setProperty("transition", "none", "important");
    });

    if (validColumns > 0) {
      const width = `${tableWidth.toFixed(2)}px`;
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

  function closeEnough(actual, expected) {
    return Number.isFinite(actual) && Math.abs(actual - expected) < 0.2;
  }

  function mobileLayoutIntact() {
    const elements = tableElements();
    if (!elements || elements.page.hidden) return true;
    const { scroller, table } = elements;
    const { columns, widths, tableWidth } = mobileTableGeometry(table);
    if (!widths.length) return true;

    let widthIndex = 0;
    for (const column of columns) {
      const expected = valueForColumn(column, MOBILE_COLUMN_WIDTHS);
      if (!Number.isFinite(expected)) continue;
      const actual = Number.parseFloat(column.style.width);
      if (!closeEnough(actual, Number(expected))) return false;
      widthIndex += 1;
    }
    if (widthIndex !== widths.length) return false;

    const actualTableWidth = Number.parseFloat(table.style.width);
    if (!closeEnough(actualTableWidth, tableWidth)) return false;
    const overflowX = window.getComputedStyle(scroller).overflowX;
    return ["auto", "scroll"].includes(overflowX)
      && scroller.scrollWidth > scroller.clientWidth + 1;
  }

  function apply() {
    const mobile = isMobile();
    syncMobileFlag(mobile);
    if (destroyed || !isTableRoute()) return false;
    return mobile ? applyMobileContract() : applyDesktopContract();
  }

  function takeOwnership() {
    if (destroyed) return false;
    window.applyExactPlayerTableWidths = apply;
    return apply();
  }

  function schedule() {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      apply();
    });
  }

  function nodeChangesTableStructure(node) {
    if (!(node instanceof Element)) return false;
    return node.matches(TABLE_STRUCTURE_SELECTOR) || Boolean(node.querySelector(TABLE_STRUCTURE_SELECTOR));
  }

  function styleMutationNeedsRepair(record) {
    if (record.type !== "attributes" || record.attributeName !== "style" || !isMobile()) return false;
    const target = record.target;
    if (!(target instanceof Element)) return false;
    const relevant = target.matches("#progressionPage .tableShell, #progressionPage .tableScroller, #progressionPage .tableScroller table, #progressionPage .tableScroller col");
    return relevant && !mobileLayoutIntact();
  }

  function shouldApplyForMutation(records) {
    return records.some((record) => {
      if (record.type === "attributes") {
        if (record.attributeName === "hidden" || record.attributeName === "data-page") return true;
        return styleMutationNeedsRepair(record);
      }
      return [...record.addedNodes, ...record.removedNodes].some(nodeChangesTableStructure);
    });
  }

  function observe() {
    observer?.disconnect();
    observer = new MutationObserver((records) => {
      if (!isTableRoute() || !shouldApplyForMutation(records)) return;
      if (isMobile()) {
        if (!mobileLayoutIntact()) applyMobileContract();
        return;
      }
      schedule();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "data-page", "style"],
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
    if (window.applyExactPlayerTableWidths === apply) delete window.applyExactPlayerTableWidths;
  }

  observe();
  bind();
  window.__mflTableWidthRuntime = Object.freeze({
    desktopColumnPercentages: DESKTOP_COLUMN_PERCENTAGES,
    mobileColumnWidths: MOBILE_COLUMN_WIDTHS,
    mobileTableMinWidth: MOBILE_TABLE_MIN_WIDTH,
    apply,
    takeOwnership,
    destroy,
  });
  apply();
})();
