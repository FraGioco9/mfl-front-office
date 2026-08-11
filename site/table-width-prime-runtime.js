(() => {
  "use strict";

  const TABLE_ROUTE = /^\/(?:database(?:\/|$)|mfl(?:\/attributes)?\/?$|agents?(?:\/|$)|progression(?:\/|$)|watchlist(?:\/|$)|my-players(?:\/|$)|clubs?\/[^/]+(?:\/|$)|club\/[^/]+(?:\/|$))/i;
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

  const previous = window.__mflTableWidthPrimeRuntime;
  previous?.destroy?.();

  let observer = null;
  let cachedScrollbarWidth = null;
  let destroyed = false;

  function tableRouteActive() {
    const page = String(document.body?.dataset.page || "").toLowerCase();
    return TABLE_ROUTE.test(window.location.pathname)
      || ["database", "mfl", "agents", "progression", "watchlist", "myplayers", "club"].includes(page);
  }

  function pinnedSidebarWidth() {
    const rail = document.querySelector("#menuRail");
    return rail && !rail.hidden ? 190 : 0;
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

    const exactWidth = `${contentWidth.toFixed(4)}px`;
    table.style.setProperty("width", exactWidth, "important");
    table.style.setProperty("min-width", exactWidth, "important");
    table.style.setProperty("max-width", exactWidth, "important");
    table.style.setProperty("box-sizing", "border-box", "important");
    table.style.setProperty("border-spacing", "0", "important");

    let assignedWidth = 0;
    columns.forEach((column, index) => {
      const pixelWidth = contentWidth * percentages[index] / 100;
      assignedWidth += pixelWidth;
      const width = `${pixelWidth.toFixed(4)}px`;
      column.style.setProperty("width", width, "important");
      column.style.setProperty("min-width", width, "important");
      column.style.setProperty("max-width", width, "important");
      column.style.setProperty("transition", "none", "important");
    });
    appendFiller(table, Math.max(0, contentWidth - assignedWidth));
    page.querySelector(".tableScroller")?.classList.add("tableWidthsReady");
    return true;
  }

  function apply() {
    if (destroyed || !tableRouteActive()) return false;
    if (typeof window.applyExactPlayerTableWidths === "function") {
      return Boolean(window.applyExactPlayerTableWidths());
    }
    return applyFallbackWidths();
  }

  observer = new MutationObserver(() => {
    // Child-list callbacks run before the next paint. When the loading runtime
    // swaps the colgroup for a new view, give it the settled widths immediately.
    apply();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["hidden", "data-page"],
  });

  window.addEventListener("resize", apply, { passive: true });
  window.addEventListener("popstate", apply);
  window.addEventListener("mfl:ready", apply);

  function destroy() {
    destroyed = true;
    observer?.disconnect();
    observer = null;
    window.removeEventListener("resize", apply);
    window.removeEventListener("popstate", apply);
    window.removeEventListener("mfl:ready", apply);
  }

  window.__mflTableWidthPrimeRuntime = Object.freeze({
    widths: WIDTHS,
    apply,
    destroy,
  });

  apply();
})();