(() => {
  "use strict";

  const MOBILE_LAYOUT = "(max-width: 900px)";
  const TABLE_ROUTE = /^\/(?:database(?:\/|$)|mfl(?:\/|$)|agents?(?:\/|$)|progression(?:\/|$)|watchlist(?:\/|$)|my-players(?:\/|$)|clubs?\/[^/]+(?:\/|$)|club\/[^/]+(?:\/|$))/i;
  const WIDTHS = Object.freeze({
    "col-select": 3,
    "col-id": 3,
    "col-flag": 3,
    "col-name": 13,
    "col-nationality": 7,
    "col-age": 4,
    "col-positions": 8,
    "col-seasons": 5,
    "col-stat": 6,
    "col-contract-revenue": 8,
    "col-contract-club": 19,
    "col-contract-division": 9,
    "col-agent": 9,
    "col-joined-agency": 9,
    "col-owned-since": 9,
    "col-link": 3,
  });
  const FILLER_SELECTOR = ".col-shared-width-filler, .col-stable-width-filler, .col-exact-width-filler";
  const STRUCTURE_SELECTOR = "table, colgroup, col, thead";
  const GEOMETRY_SELECTOR = "#progressionPage .tableShell, #progressionPage .tableScroller, #progressionPage .tableScroller table, #progressionPage .tableScroller col";

  window.__mflDesktopTableWidthRuntime?.destroy?.();

  let observer = null;
  let resizeFrame = 0;
  let scrollbarWidth = null;
  let destroyed = false;

  function isDesktop() {
    return !window.matchMedia(MOBILE_LAYOUT).matches;
  }

  function isTableRoute() {
    const page = String(document.body?.dataset.page || "").toLowerCase();
    return TABLE_ROUTE.test(window.location.pathname)
      || ["database", "mfl", "agents", "progression", "watchlist", "myplayers", "club"].includes(page);
  }

  function browserScrollbarWidth() {
    if (scrollbarWidth !== null) return scrollbarWidth;
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll;";
    document.body.appendChild(probe);
    scrollbarWidth = Math.max(0, probe.offsetWidth - probe.clientWidth);
    probe.remove();
    return scrollbarWidth;
  }

  function contentWidth() {
    const main = document.querySelector("main");
    if (!(main instanceof HTMLElement)) return 0;
    const styles = getComputedStyle(main);
    const viewportWidth = Math.min(
      document.documentElement.clientWidth,
      Math.max(0, window.innerWidth - browserScrollbarWidth()),
    );
    const rail = document.getElementById("menuRail");
    const sidebarWidth = rail instanceof HTMLElement && !rail.hidden ? 190 : 0;
    return Math.max(
      0,
      viewportWidth
        - sidebarWidth
        - (Number.parseFloat(styles.paddingLeft) || 0)
        - (Number.parseFloat(styles.paddingRight) || 0),
    );
  }

  function percentageForColumn(column) {
    if (!(column instanceof Element)) return null;
    const className = Object.keys(WIDTHS).find((name) => column.classList.contains(name));
    return className ? WIDTHS[className] : null;
  }

  function tableParts() {
    const page = document.getElementById("progressionPage");
    const shell = page?.querySelector(".tableShell");
    const scroller = page?.querySelector(".tableScroller");
    const table = scroller?.querySelector("table");
    return {
      page: page instanceof HTMLElement ? page : null,
      shell: shell instanceof HTMLElement ? shell : null,
      scroller: scroller instanceof HTMLElement ? scroller : null,
      table: table instanceof HTMLTableElement ? table : null,
    };
  }

  function removeFillers(table) {
    table.querySelectorAll(FILLER_SELECTOR).forEach((element) => element.remove());
  }

  function geometry(table) {
    const columns = Array.from(table.querySelectorAll("col"))
      .filter((column) => !column.matches(FILLER_SELECTOR));
    const percentages = columns.map(percentageForColumn);
    return { columns, percentages };
  }

  function closeEnough(actual, expected) {
    return Number.isFinite(actual) && Math.abs(actual - expected) < 0.2;
  }

  function layoutIntact() {
    if (!isDesktop() || !isTableRoute()) return true;
    const { page, shell, scroller, table } = tableParts();
    if (!page || page.hidden || !shell || !scroller || !table) return true;
    const width = contentWidth();
    const { columns, percentages } = geometry(table);
    if (!(width > 0)
      || !columns.length
      || percentages.some((value) => !Number.isFinite(value))) return true;

    for (const element of [shell, scroller, table]) {
      if (!closeEnough(Number.parseFloat(element.style.width), width)) return false;
    }
    for (let index = 0; index < columns.length; index += 1) {
      const expected = width * Number(percentages[index]) / 100;
      if (!closeEnough(Number.parseFloat(columns[index].style.width), expected)) return false;
    }
    return getComputedStyle(scroller).overflowX === "hidden";
  }

  function apply() {
    if (destroyed || !isDesktop() || !isTableRoute()) return false;
    const { page, shell, scroller, table } = tableParts();
    const width = contentWidth();
    if (!page || page.hidden || !shell || !scroller || !table || !(width > 0)) return false;

    removeFillers(table);
    const { columns, percentages } = geometry(table);
    if (!columns.length
      || percentages.some((value) => !Number.isFinite(value))
      || percentages.reduce((sum, value) => sum + Number(value || 0), 0) > 100.01) return false;

    const exactWidth = `${width.toFixed(4)}px`;
    for (const element of [shell, scroller]) {
      element.style.setProperty("width", exactWidth, "important");
      element.style.setProperty("min-width", exactWidth, "important");
      element.style.setProperty("max-width", exactWidth, "important");
      element.style.setProperty("box-sizing", "border-box", "important");
      element.style.setProperty("overflow", "hidden", "important");
      element.style.removeProperty("overflow-x");
      element.style.removeProperty("overflow-y");
      element.style.removeProperty("overscroll-behavior-x");
      element.style.removeProperty("touch-action");
      element.style.removeProperty("-webkit-overflow-scrolling");
    }
    delete scroller.dataset.mobileTableScroll;

    table.style.setProperty("table-layout", "fixed", "important");
    table.style.setProperty("width", exactWidth, "important");
    table.style.setProperty("min-width", exactWidth, "important");
    table.style.setProperty("max-width", exactWidth, "important");
    table.style.setProperty("box-sizing", "border-box", "important");
    table.style.setProperty("border-spacing", "0", "important");

    columns.forEach((column, index) => {
      const columnWidth = `${(width * Number(percentages[index]) / 100).toFixed(4)}px`;
      column.style.setProperty("width", columnWidth, "important");
      column.style.setProperty("min-width", columnWidth, "important");
      column.style.setProperty("max-width", columnWidth, "important");
      column.style.setProperty("transition", "none", "important");
    });

    scroller.classList.add("tableWidthsReady");
    return true;
  }

  function structuralChange(node) {
    if (!(node instanceof Element) || node.matches(FILLER_SELECTOR)) return false;
    return node.matches(STRUCTURE_SELECTOR) || Boolean(node.querySelector(STRUCTURE_SELECTOR));
  }

  function relevantMutation(records) {
    return records.some((record) => {
      if (record.type === "attributes") {
        if (record.attributeName === "hidden" || record.attributeName === "data-page") return true;
        return record.attributeName === "style"
          && record.target instanceof Element
          && record.target.matches(GEOMETRY_SELECTOR)
          && !layoutIntact();
      }
      return [...record.addedNodes, ...record.removedNodes].some(structuralChange);
    });
  }

  observer = new MutationObserver((records) => {
    if (!isDesktop() || !isTableRoute() || !relevantMutation(records)) return;
    if (!layoutIntact()) apply();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "data-page", "style"],
  });

  function schedule() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      scrollbarWidth = null;
      apply();
    });
  }

  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("popstate", schedule);
  window.addEventListener("mfl:ready", apply);

  function destroy() {
    destroyed = true;
    cancelAnimationFrame(resizeFrame);
    observer?.disconnect();
    window.removeEventListener("resize", schedule);
    window.removeEventListener("popstate", schedule);
    window.removeEventListener("mfl:ready", apply);
  }

  window.__mflDesktopTableWidthRuntime = Object.freeze({ apply, destroy });
  apply();
})();
