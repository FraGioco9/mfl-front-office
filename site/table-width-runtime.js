(() => {
  "use strict";

  const TABLE_ROUTE = /^\/(?:database(?:\/|$)|mfl(?:\/attributes)?\/?$|agents?(?:\/|$)|progression(?:\/|$)|watchlist(?:\/|$)|my-players(?:\/|$)|clubs?\/[^/]+(?:\/|$)|club\/[^/]+(?:\/|$))/i;
  const MOBILE_LAYOUT = "(max-width: 900px)";
  const MOBILE_TABLE_MIN_WIDTH = 1240;
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
  const FILLER_CLASS = "col-shared-width-filler";

  const previous = window.__mflTableWidthRuntime;
  previous?.destroy?.();

  let observer = null;
  let applyFrame = 0;
  let cachedScrollbarWidth = null;
  let destroyed = false;

  function tableRouteActive() {
    const page = String(document.body?.dataset.page || "").toLowerCase();
    return TABLE_ROUTE.test(window.location.pathname)
      || ["database", "mfl", "agents", "progression", "watchlist", "myplayers", "club"].includes(page);
  }

  function mobileLayoutActive() {
    return window.matchMedia(MOBILE_LAYOUT).matches;
  }

  function pinnedSidebarWidth() {
    const rail = document.querySelector("#menuRail");
    if (!rail || rail.hidden) return 0;
    const value = parseFloat(
      window.getComputedStyle(document.documentElement).getPropertyValue("--pinned-sidebar-width"),
    );
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  function browserScrollbarWidth() {
    if (cachedScrollbarWidth !== null) return cachedScrollbarWidth;
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll;visibility:hidden;";
    document.body.appendChild(probe);
    cachedScrollbarWidth = Math.max(0, probe.offsetWidth - probe.clientWidth);
    probe.remove();
    return cachedScrollbarWidth;
  }

  function sharedContentWidth() {
    const main = document.querySelector("main");
    if (!(main instanceof HTMLElement)) return 0;
    const styles = window.getComputedStyle(main);
    const clientWidth = document.documentElement.clientWidth;
    const reservedViewportWidth = Math.max(0, window.innerWidth - browserScrollbarWidth());
    const viewportWidth = Math.min(clientWidth, reservedViewportWidth);
    const paddingLeft = parseFloat(styles.paddingLeft) || 0;
    const paddingRight = parseFloat(styles.paddingRight) || 0;
    return Math.max(0, viewportWidth - pinnedSidebarWidth() - paddingLeft - paddingRight);
  }

  function widthForColumn(column) {
    const className = Object.keys(WIDTHS).find((name) => column.classList.contains(name));
    return className ? WIDTHS[className] : null;
  }

  function removeFiller(table, colGroup) {
    colGroup.querySelectorAll(`.${FILLER_CLASS}`).forEach((column) => column.remove());
    table.querySelectorAll(`thead .${FILLER_CLASS}, tbody .${FILLER_CLASS}`).forEach((cell) => cell.remove());
  }

  function appendFiller(table, width) {
    if (!(width > 0.01)) return;
    const colGroup = table.querySelector("colgroup");
    if (!(colGroup instanceof HTMLTableColElement)) return;
    const col = document.createElement("col");
    col.className = FILLER_CLASS;
    const pixelWidth = `${width.toFixed(4)}px`;
    col.style.setProperty("width", pixelWidth, "important");
    col.style.setProperty("min-width", pixelWidth, "important");
    col.style.setProperty("max-width", pixelWidth, "important");
    colGroup.appendChild(col);

    table.querySelectorAll("thead > tr, tbody > tr").forEach((row) => {
      const cell = document.createElement(row.parentElement?.tagName === "THEAD" ? "th" : "td");
      cell.className = FILLER_CLASS;
      cell.setAttribute("aria-hidden", "true");
      cell.style.setProperty("width", pixelWidth, "important");
      cell.style.setProperty("min-width", pixelWidth, "important");
      cell.style.setProperty("max-width", pixelWidth, "important");
      row.appendChild(cell);
    });
  }

  function applyMobileContainers(page, visibleWidth) {
    const exactVisibleWidth = `${visibleWidth.toFixed(4)}px`;
    const shell = page.querySelector(".tableShell");
    const scroller = page.querySelector(".tableScroller");

    if (shell instanceof HTMLElement) {
      shell.style.setProperty("width", exactVisibleWidth, "important");
      shell.style.setProperty("min-width", exactVisibleWidth, "important");
      shell.style.setProperty("max-width", exactVisibleWidth, "important");
      shell.style.setProperty("box-sizing", "border-box", "important");
      shell.style.setProperty("overflow", "hidden", "important");
    }

    if (scroller instanceof HTMLElement) {
      scroller.style.setProperty("width", exactVisibleWidth, "important");
      scroller.style.setProperty("min-width", exactVisibleWidth, "important");
      scroller.style.setProperty("max-width", exactVisibleWidth, "important");
      scroller.style.setProperty("box-sizing", "border-box", "important");
      scroller.style.setProperty("overflow-x", "auto", "important");
      scroller.style.setProperty("overflow-y", "hidden", "important");
      scroller.style.setProperty("-webkit-overflow-scrolling", "touch");
    }
  }

  function mobileLayoutIntact() {
    const page = document.querySelector("#progressionPage");
    const scroller = page?.querySelector(".tableScroller");
    const table = scroller?.querySelector("table");
    if (!page || page.hidden || !(scroller instanceof HTMLElement) || !(table instanceof HTMLTableElement)) {
      return true;
    }
    const overflowX = window.getComputedStyle(scroller).overflowX;
    return ["auto", "scroll"].includes(overflowX)
      && table.getBoundingClientRect().width >= MOBILE_TABLE_MIN_WIDTH - 1;
  }

  function applyFallbackWidths() {
    const page = document.querySelector("#progressionPage");
    const table = page?.querySelector(".tableScroller table");
    const colGroup = table?.querySelector("colgroup");
    const contentWidth = sharedContentWidth();
    if (!page || page.hidden || !(table instanceof HTMLTableElement) || !(colGroup instanceof HTMLTableColElement) || !(contentWidth > 0)) {
      return false;
    }

    removeFiller(table, colGroup);
    const columns = Array.from(colGroup.children);
    const percentages = columns.map(widthForColumn);
    if (!percentages.length || percentages.some((width) => !Number.isFinite(width))) return false;
    const totalPercentage = percentages.reduce((sum, width) => sum + width, 0);
    if (totalPercentage > 100.01) return false;

    const mobile = mobileLayoutActive();
    const tableWidth = mobile ? Math.max(MOBILE_TABLE_MIN_WIDTH, contentWidth) : contentWidth;
    if (mobile) applyMobileContainers(page, contentWidth);

    const exactWidth = `${tableWidth.toFixed(4)}px`;
    table.style.setProperty("table-layout", "fixed", "important");
    table.style.setProperty("width", exactWidth, "important");
    table.style.setProperty("min-width", exactWidth, "important");
    table.style.setProperty("max-width", exactWidth, "important");
    table.style.setProperty("box-sizing", "border-box", "important");
    table.style.setProperty("border-spacing", "0", "important");

    let assignedWidth = 0;
    columns.forEach((column, index) => {
      const pixelWidth = tableWidth * percentages[index] / 100;
      assignedWidth += pixelWidth;
      const width = `${pixelWidth.toFixed(4)}px`;
      column.style.setProperty("width", width, "important");
      column.style.setProperty("min-width", width, "important");
      column.style.setProperty("max-width", width, "important");
      column.style.setProperty("transition", "none", "important");
    });
    appendFiller(table, Math.max(0, tableWidth - assignedWidth));
    page.querySelector(".tableScroller")?.classList.add("tableWidthsReady");
    return true;
  }

  function apply() {
    if (destroyed || !tableRouteActive()) return false;
    // Mobile has one authoritative owner: this early runtime. The legacy desktop
    // table layout still runs for wide screens, but must never collapse or hide
    // the phone scroller after startup.
    if (mobileLayoutActive()) return applyFallbackWidths();
    if (typeof window.applyExactPlayerTableWidths === "function") {
      return Boolean(window.applyExactPlayerTableWidths());
    }
    return applyFallbackWidths();
  }

  function scheduleApply() {
    window.cancelAnimationFrame(applyFrame);
    applyFrame = window.requestAnimationFrame(() => {
      applyFrame = 0;
      apply();
    });
  }

  function mobileStyleMutation(records) {
    return records.some((record) => {
      if (record.type !== "attributes" || record.attributeName !== "style") return false;
      const target = record.target;
      return target instanceof Element && Boolean(target.closest("#progressionPage .tableShell"));
    });
  }

  function observe() {
    observer?.disconnect();
    observer = new MutationObserver((records) => {
      if (mobileLayoutActive()) {
        // Legacy desktop rendering still owns wide-screen exact widths. If it
        // writes inline table styles on a phone, repair that mutation in the
        // same microtask checkpoint so no later task can observe the conflict.
        if (mobileStyleMutation(records)) {
          if (!mobileLayoutIntact()) applyFallbackWidths();
          return;
        }
        scheduleApply();
        return;
      }
      apply();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "data-page", "style"],
    });
  }

  function onResize() {
    cachedScrollbarWidth = null;
    if (mobileLayoutActive()) scheduleApply();
    else apply();
  }

  function onPopState() {
    apply();
  }

  function onReady() {
    takeOwnership();
  }

  function bindWindowEvents() {
    window.removeEventListener("resize", onResize);
    window.removeEventListener("popstate", onPopState);
    window.removeEventListener("mfl:ready", onReady);
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("popstate", onPopState);
    window.addEventListener("mfl:ready", onReady);
  }

  function takeOwnership() {
    if (destroyed) return false;
    // Re-register after legacy-core so its resize/mutation callbacks run first;
    // the canonical mobile result is therefore the final result before paint.
    observe();
    bindWindowEvents();
    return apply();
  }

  observe();
  bindWindowEvents();

  function destroy() {
    destroyed = true;
    window.cancelAnimationFrame(applyFrame);
    applyFrame = 0;
    observer?.disconnect();
    observer = null;
    window.removeEventListener("resize", onResize);
    window.removeEventListener("popstate", onPopState);
    window.removeEventListener("mfl:ready", onReady);
  }

  window.__mflTableWidthRuntime = Object.freeze({
    widths: WIDTHS,
    apply,
    takeOwnership,
    destroy,
  });

  apply();
})();