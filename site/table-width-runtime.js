(() => {
  "use strict";

  if (window.__mflTableWidthRuntime?.canonical === true) {
    window.__mflTableWidthRuntime.takeOwnership?.();
    return;
  }

  const TABLE_ROUTE = /^\/(?:database(?:\/|$)|mfl(?:\/|$)|agents?(?:\/|$)|progression(?:\/|$)|watchlist(?:\/|$)|my-players(?:\/|$)|clubs?\/[^/]+(?:\/|$)|club\/[^/]+(?:\/|$))/i;
  const MOBILE_LAYOUT = "(max-width: 900px)";
  const MOBILE_TABLE_WIDTH = 1560;
  const FILLER_SELECTOR = ".col-shared-width-filler, .col-stable-width-filler, .col-exact-width-filler";
  const TABLE_STRUCTURE_SELECTOR = "table, colgroup, col, thead, tbody";
  const WIDTH_STYLE_SELECTOR = "#progressionPage .tableShell, #progressionPage .tableScroller, #progressionPage .tableScroller table, #progressionPage .tableScroller col, #progressionPage .tableScroller th, #progressionPage .tableScroller td";
  const COLUMN_GEOMETRY_PROPERTIES = ["width", "min-width", "max-width"];

  const COLUMN_LAYOUT = Object.freeze([
    Object.freeze(["col-overall", 5.5]),
    Object.freeze(["col-select", 2.75]),
    Object.freeze(["col-id", 3.75]),
    Object.freeze(["col-flag", 2.5]),
    Object.freeze(["col-name", 15]),
    Object.freeze(["col-nationality", 8.5]),
    Object.freeze(["col-age", 4.5]),
    Object.freeze(["col-positions", 7]),
    Object.freeze(["col-seasons", 5.5]),
    Object.freeze(["col-stat", 32 / 6]),
    Object.freeze(["col-contract-revenue", 7.5]),
    Object.freeze(["col-contract-club", 16]),
    Object.freeze(["col-contract-division", 8.5]),
    Object.freeze(["col-agent", 10.5]),
    Object.freeze(["col-joined-agency", 10.5]),
    Object.freeze(["col-owned-since", 10.5]),
    Object.freeze(["col-link", 2.5]),
  ]);
  const TABLE_WIDTH_CONFIG = Object.freeze({
    columnLayout: COLUMN_LAYOUT,
    mobileTableWidth: MOBILE_TABLE_WIDTH,
  });

  const SHARED_WIDTH = 68;
  const SIX_STATS_WIDTH = 32;
  const CONTRACTS_WIDTH = 7.5 + 16 + 8.5;
  if (Math.abs(SHARED_WIDTH + SIX_STATS_WIDTH - 100) > 0.0001
    || Math.abs(SHARED_WIDTH + CONTRACTS_WIDTH - 100) > 0.0001
    || Math.abs(SIX_STATS_WIDTH - CONTRACTS_WIDTH) > 0.0001) {
    throw new Error("Player table width contract is invalid.");
  }

  window.__mflTableWidthRuntime?.destroy?.();
  window.__mflTableWidthConfig = TABLE_WIDTH_CONFIG;

  let observer = null;
  let frame = 0;
  let destroyed = false;
  let applying = false;
  let widthHookInstalled = false;

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

  function percentageForColumn(column) {
    if (!(column instanceof Element)) return null;
    const match = COLUMN_LAYOUT.find(([className]) => column.classList.contains(className));
    return match ? Number(match[1]) : null;
  }

  function tableElements() {
    const page = document.querySelector("#progressionPage");
    const shell = page?.querySelector(".tableShell");
    const scroller = page?.querySelector(".tableScroller");
    const table = scroller?.querySelector("table");
    if (!(page instanceof HTMLElement)
      || !(shell instanceof HTMLElement)
      || !(scroller instanceof HTMLElement)
      || !(table instanceof HTMLTableElement)) return null;
    return { page, shell, scroller, table };
  }

  function removeProperties(element, properties) {
    if (!element?.style) return;
    properties.forEach((property) => element.style.removeProperty(property));
  }

  function discardLegacyGeometry(elements) {
    const { shell, scroller, table } = elements;
    table.querySelectorAll(FILLER_SELECTOR).forEach((element) => element.remove());

    [shell, scroller].forEach((element) => removeProperties(element, [
      "width", "min-width", "max-width", "box-sizing", "overflow", "overflow-x", "overflow-y",
      "overscroll-behavior-x", "touch-action", "-webkit-overflow-scrolling",
    ]));
    removeProperties(table, [
      "width", "min-width", "max-width", "box-sizing", "table-layout", "border-spacing",
    ]);
    table.querySelectorAll("col, th, td").forEach((element) => {
      removeProperties(element, COLUMN_GEOMETRY_PROPERTIES);
    });
  }

  function canonicalColumns(table) {
    const columns = Array.from(table.querySelectorAll("col"));
    const percentages = columns.map(percentageForColumn);
    if (!columns.length || percentages.some((value) => !Number.isFinite(value))) return null;
    const total = percentages.reduce((sum, value) => sum + Number(value), 0);
    if (Math.abs(total - 100) > 0.02) return null;
    return { columns, percentages };
  }

  function applyDesktopLayout(elements, geometry) {
    const { shell, scroller, table } = elements;
    const { columns, percentages } = geometry;

    [shell, scroller].forEach((element) => {
      element.style.setProperty("width", "100%", "important");
      element.style.setProperty("min-width", "0", "important");
      element.style.setProperty("max-width", "100%", "important");
      element.style.setProperty("box-sizing", "border-box", "important");
    });

    columns.forEach((column, index) => {
      column.style.setProperty("width", `${percentages[index]}%`, "important");
      column.style.setProperty("min-width", "0", "important");
      column.style.setProperty("max-width", "none", "important");
      column.style.setProperty("transition", "none", "important");
    });

    table.style.setProperty("table-layout", "fixed", "important");
    table.style.setProperty("width", "100%", "important");
    table.style.setProperty("min-width", "100%", "important");
    table.style.setProperty("max-width", "100%", "important");
    table.style.setProperty("box-sizing", "border-box", "important");
    table.style.setProperty("border-spacing", "0", "important");
    scroller.style.setProperty("overflow-x", "hidden", "important");
    scroller.style.setProperty("overflow-y", "hidden", "important");
    delete scroller.dataset.mobileTableScroll;
    scroller.classList.add("tableWidthsReady");
    return true;
  }

  function applyMobileLayout(elements, geometry) {
    const { shell, scroller, table } = elements;
    const { columns, percentages } = geometry;

    [shell, scroller].forEach((element) => {
      element.style.setProperty("width", "100%", "important");
      element.style.setProperty("min-width", "0", "important");
      element.style.setProperty("max-width", "100%", "important");
      element.style.setProperty("box-sizing", "border-box", "important");
    });

    columns.forEach((column, index) => {
      const width = `${(MOBILE_TABLE_WIDTH * percentages[index] / 100).toFixed(2)}px`;
      column.style.setProperty("width", width, "important");
      column.style.setProperty("min-width", width, "important");
      column.style.setProperty("max-width", width, "important");
      column.style.setProperty("transition", "none", "important");
    });

    const tableWidth = `${MOBILE_TABLE_WIDTH}px`;
    table.style.setProperty("table-layout", "fixed", "important");
    table.style.setProperty("width", tableWidth, "important");
    table.style.setProperty("min-width", tableWidth, "important");
    table.style.setProperty("max-width", tableWidth, "important");
    table.style.setProperty("box-sizing", "border-box", "important");
    table.style.setProperty("border-spacing", "0", "important");
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
    return Number.isFinite(actual) && Math.abs(actual - expected) < 0.03;
  }

  function cellHasLegacyGeometry(table) {
    return Array.from(table.querySelectorAll("th, td")).some((cell) =>
      COLUMN_GEOMETRY_PROPERTIES.some((property) => Boolean(cell.style.getPropertyValue(property))));
  }

  function layoutIntact() {
    const elements = tableElements();
    if (!elements || elements.page.hidden) return true;
    const geometry = canonicalColumns(elements.table);
    if (!geometry || cellHasLegacyGeometry(elements.table)) return false;

    const mobile = isMobile();
    const { scroller, table } = elements;
    for (let index = 0; index < geometry.columns.length; index += 1) {
      const actual = Number.parseFloat(geometry.columns[index].style.width);
      const expected = mobile
        ? MOBILE_TABLE_WIDTH * geometry.percentages[index] / 100
        : geometry.percentages[index];
      if (!closeEnough(actual, expected)) return false;
    }

    const actualTableWidth = Number.parseFloat(table.style.width);
    const expectedTableWidth = mobile ? MOBILE_TABLE_WIDTH : 100;
    if (!closeEnough(actualTableWidth, expectedTableWidth)) return false;

    const overflowX = window.getComputedStyle(scroller).overflowX;
    return mobile ? ["auto", "scroll"].includes(overflowX) : overflowX === "hidden";
  }

  function apply() {
    syncMobileFlag();
    if (destroyed || applying || !isTableRoute()) return false;
    const elements = tableElements();
    if (!elements || elements.page.hidden) return false;

    applying = true;
    try {
      discardLegacyGeometry(elements);
      const geometry = canonicalColumns(elements.table);
      if (!geometry) return false;
      return isMobile()
        ? applyMobileLayout(elements, geometry)
        : applyDesktopLayout(elements, geometry);
    } finally {
      applying = false;
    }
  }

  function installWidthHook() {
    if (destroyed) return false;
    Object.defineProperty(window, "applyExactPlayerTableWidths", {
      configurable: true,
      enumerable: true,
      get: () => apply,
      set: () => {},
    });
    widthHookInstalled = true;
    return true;
  }

  function takeOwnership() {
    if (destroyed) return false;
    installWidthHook();
    return apply();
  }

  function schedule() {
    if (destroyed || frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      apply();
    });
  }

  function nodeChangesTableStructure(node) {
    if (!(node instanceof Element)) return false;
    return node.matches(TABLE_STRUCTURE_SELECTOR) || Boolean(node.querySelector(TABLE_STRUCTURE_SELECTOR));
  }

  function shouldApplyForMutation(records) {
    return records.some((record) => {
      if (record.type === "attributes") {
        if (record.attributeName === "hidden" || record.attributeName === "data-page") return true;
        if (record.attributeName !== "style") return false;
        const target = record.target;
        return target instanceof Element && target.matches(WIDTH_STYLE_SELECTOR) && !layoutIntact();
      }
      return [...record.addedNodes, ...record.removedNodes].some(nodeChangesTableStructure);
    });
  }

  function observe() {
    observer?.disconnect();
    observer = new MutationObserver((records) => {
      if (applying || !isTableRoute() || !shouldApplyForMutation(records)) return;
      apply();
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
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    observer?.disconnect();
    observer = null;
    window.removeEventListener("resize", schedule);
    window.removeEventListener("popstate", schedule);
    window.removeEventListener("mfl:ready", schedule);
    if (widthHookInstalled) {
      try {
        delete window.applyExactPlayerTableWidths;
      } catch {}
    }
  }

  installWidthHook();
  observe();
  bind();
  window.__mflTableWidthRuntime = Object.freeze({
    canonical: true,
    config: TABLE_WIDTH_CONFIG,
    columnLayout: COLUMN_LAYOUT,
    mobileTableWidth: MOBILE_TABLE_WIDTH,
    apply,
    takeOwnership,
    destroy,
  });
  apply();
})();