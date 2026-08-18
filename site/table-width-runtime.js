(() => {
  "use strict";

  if (window.__mflTableWidthRuntime?.canonical === true) {
    window.__mflTableWidthRuntime.takeOwnership?.();
    return;
  }

  const TABLE_ROUTE = /^\/(?:database(?:\/|$)|mfl(?:\/|$)|agents?(?:\/|$)|progression(?:\/|$)|watchlist(?:\/|$)|my-players(?:\/|$)|clubs?\/[^/]+(?:\/|$)|club\/[^/]+(?:\/|$))/i;
  const MOBILE_LAYOUT = "(max-width: 900px)";
  const FILLER_SELECTOR = ".col-shared-width-filler, .col-stable-width-filler, .col-exact-width-filler";

  /* Percentages are owned by styles.css. The live player table uses its own
   * scroller class, so historical .tableScroller !important rules are not part
   * of this cascade and the runtime does not need priority escalation. */
  const COLUMN_VARIABLES = Object.freeze([
    Object.freeze(["col-overall", "--mfl-table-col-overall"]),
    Object.freeze(["col-select", "--mfl-table-col-select"]),
    Object.freeze(["col-id", "--mfl-table-col-id"]),
    Object.freeze(["col-flag", "--mfl-table-col-flag"]),
    Object.freeze(["col-name", "--mfl-table-col-name"]),
    Object.freeze(["col-nationality", "--mfl-table-col-nationality"]),
    Object.freeze(["col-age", "--mfl-table-col-age"]),
    Object.freeze(["col-positions", "--mfl-table-col-positions"]),
    Object.freeze(["col-seasons", "--mfl-table-col-seasons"]),
    Object.freeze(["col-stat", "--mfl-table-col-stat"]),
    Object.freeze(["col-contract-revenue", "--mfl-table-col-contract-revenue"]),
    Object.freeze(["col-contract-club", "--mfl-table-col-contract-club"]),
    Object.freeze(["col-contract-division", "--mfl-table-col-contract-division"]),
    Object.freeze(["col-agent", "--mfl-table-col-agent"]),
    Object.freeze(["col-joined-agency", "--mfl-table-col-joined-agency"]),
    Object.freeze(["col-owned-since", "--mfl-table-col-owned-since"]),
    Object.freeze(["col-link", "--mfl-table-col-link"]),
  ]);

  function rootStyle() {
    return window.getComputedStyle(document.documentElement);
  }

  function percentageVariable(style, variableName) {
    const raw = String(style.getPropertyValue(variableName) || "").trim();
    if (!raw.endsWith("%")) {
      throw new Error(`Global table width ${variableName} must be a percentage.`);
    }
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Global table width ${variableName} is invalid.`);
    }
    return value;
  }

  function pixelVariable(style, variableName) {
    const raw = String(style.getPropertyValue(variableName) || "").trim();
    if (!raw.endsWith("px")) {
      throw new Error(`Global table width ${variableName} must be in pixels.`);
    }
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Global table width ${variableName} is invalid.`);
    }
    return value;
  }

  const style = rootStyle();
  const COLUMN_LAYOUT = Object.freeze(COLUMN_VARIABLES.map(([className, variableName]) => (
    Object.freeze([className, percentageVariable(style, variableName)])
  )));
  const MOBILE_TABLE_WIDTH = pixelVariable(style, "--mfl-table-mobile-width");
  const TABLE_WIDTH_CONFIG = Object.freeze({
    columnLayout: COLUMN_LAYOUT,
    mobileTableWidth: MOBILE_TABLE_WIDTH,
    source: "styles.css",
  });

  const widths = new Map(COLUMN_LAYOUT);
  const sharedWidth = [
    "col-select", "col-id", "col-flag", "col-name", "col-nationality", "col-age",
    "col-positions", "col-seasons", "col-overall", "col-agent", "col-link",
  ].reduce((sum, className) => sum + Number(widths.get(className) || 0), 0);
  const sixStatsWidth = Number(widths.get("col-stat") || 0) * 6;
  const contractsWidth = ["col-contract-revenue", "col-contract-club", "col-contract-division"]
    .reduce((sum, className) => sum + Number(widths.get(className) || 0), 0);
  const alternateAgentWidths = ["col-joined-agency", "col-owned-since"]
    .map((className) => Number(widths.get(className) || 0));
  const agentWidth = Number(widths.get("col-agent") || 0);
  if (Math.abs(sharedWidth + sixStatsWidth - 100) > 0.0001
    || Math.abs(sharedWidth + contractsWidth - 100) > 0.0001
    || Math.abs(sixStatsWidth - contractsWidth) > 0.0001
    || alternateAgentWidths.some((value) => Math.abs(value - agentWidth) > 0.0001)) {
    throw new Error("Global player table width contract is invalid.");
  }

  window.__mflTableWidthRuntime?.destroy?.();
  window.__mflTableWidthConfig = TABLE_WIDTH_CONFIG;

  const mobileQuery = window.matchMedia(MOBILE_LAYOUT);
  let frame = 0;
  let destroyed = false;
  let applying = false;
  let widthHookInstalled = false;
  let lastTable = null;
  let lastFirstColumn = null;
  let lastMode = "";
  let scheduledForce = false;

  function isTableRoute() {
    const page = String(document.body?.dataset.page || "").toLowerCase();
    return TABLE_ROUTE.test(window.location.pathname)
      || ["database", "mfl", "agents", "progression", "watchlist", "myplayers", "club"].includes(page);
  }

  function isMobile() {
    return mobileQuery.matches;
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
    const scroller = page?.querySelector(".playerTableScroller");
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

  function discardLegacyContainerGeometry(elements) {
    const { shell, scroller, table } = elements;
    table.querySelectorAll(FILLER_SELECTOR).forEach((element) => element.remove());

    [shell, scroller].forEach((element) => removeProperties(element, [
      "width", "min-width", "max-width", "box-sizing", "overflow", "overflow-x", "overflow-y",
      "overscroll-behavior-x", "touch-action", "-webkit-overflow-scrolling",
    ]));
    removeProperties(table, [
      "width", "min-width", "max-width", "box-sizing", "table-layout", "border-spacing",
    ]);
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
      element.style.setProperty("width", "100%");
      element.style.setProperty("min-width", "0");
      element.style.setProperty("max-width", "100%");
      element.style.setProperty("box-sizing", "border-box");
    });

    columns.forEach((column, index) => {
      column.style.setProperty("width", `${percentages[index]}%`);
      column.style.setProperty("min-width", "0");
      column.style.setProperty("max-width", "none");
      column.style.setProperty("transition", "none");
    });

    table.style.setProperty("table-layout", "fixed");
    table.style.setProperty("width", "100%");
    table.style.setProperty("min-width", "100%");
    table.style.setProperty("max-width", "100%");
    table.style.setProperty("box-sizing", "border-box");
    table.style.setProperty("border-spacing", "0");
    scroller.style.setProperty("overflow-x", "hidden");
    scroller.style.setProperty("overflow-y", "hidden");
    delete scroller.dataset.mobileTableScroll;
    scroller.classList.add("tableWidthsReady");
    return true;
  }

  function applyMobileLayout(elements, geometry) {
    const { shell, scroller, table } = elements;
    const { columns, percentages } = geometry;

    [shell, scroller].forEach((element) => {
      element.style.setProperty("width", "100%");
      element.style.setProperty("min-width", "0");
      element.style.setProperty("max-width", "100%");
      element.style.setProperty("box-sizing", "border-box");
    });

    columns.forEach((column, index) => {
      const width = `${(MOBILE_TABLE_WIDTH * percentages[index] / 100).toFixed(2)}px`;
      column.style.setProperty("width", width);
      column.style.setProperty("min-width", width);
      column.style.setProperty("max-width", width);
      column.style.setProperty("transition", "none");
    });

    const tableWidth = `${MOBILE_TABLE_WIDTH}px`;
    table.style.setProperty("table-layout", "fixed");
    table.style.setProperty("width", tableWidth);
    table.style.setProperty("min-width", tableWidth);
    table.style.setProperty("max-width", tableWidth);
    table.style.setProperty("box-sizing", "border-box");
    table.style.setProperty("border-spacing", "0");
    scroller.style.setProperty("overflow-x", "auto");
    scroller.style.setProperty("overflow-y", "hidden");
    scroller.style.setProperty("overscroll-behavior-x", "contain");
    scroller.style.setProperty("touch-action", "pan-x pan-y");
    scroller.style.setProperty("-webkit-overflow-scrolling", "touch");
    scroller.dataset.mobileTableScroll = "true";
    scroller.classList.add("tableWidthsReady");
    return true;
  }

  function apply(force = false) {
    const mobile = isMobile();
    syncMobileFlag(mobile);
    if (destroyed || applying || !isTableRoute()) return false;
    const elements = tableElements();
    if (!elements) return false;

    const geometry = canonicalColumns(elements.table);
    if (!geometry) return false;
    const mode = mobile ? "mobile" : "desktop";
    const firstColumn = geometry.columns[0] || null;

    if (!force
      && elements.table === lastTable
      && firstColumn === lastFirstColumn
      && mode === lastMode) {
      return true;
    }

    applying = true;
    try {
      discardLegacyContainerGeometry(elements);
      const applied = mobile
        ? applyMobileLayout(elements, geometry)
        : applyDesktopLayout(elements, geometry);
      if (applied) {
        lastTable = elements.table;
        lastFirstColumn = firstColumn;
        lastMode = mode;
      }
      return applied;
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

  function schedule(force = false) {
    if (destroyed) return;
    scheduledForce = scheduledForce || force;
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      const forceApply = scheduledForce;
      scheduledForce = false;
      frame = 0;
      apply(forceApply);
    });
  }

  function handleLayoutModeChange() {
    schedule(true);
  }

  function bind() {
    mobileQuery.addEventListener?.("change", handleLayoutModeChange);
    window.addEventListener("popstate", schedule);
    window.addEventListener("mfl:ready", schedule);
  }

  function destroy() {
    destroyed = true;
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    scheduledForce = false;
    mobileQuery.removeEventListener?.("change", handleLayoutModeChange);
    window.removeEventListener("popstate", schedule);
    window.removeEventListener("mfl:ready", schedule);
    lastTable = null;
    lastFirstColumn = null;
    lastMode = "";
    if (widthHookInstalled) {
      try {
        delete window.applyExactPlayerTableWidths;
      } catch {}
    }
  }

  installWidthHook();
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