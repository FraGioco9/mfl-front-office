(() => {
  "use strict";

  const TABLE_PAGES = new Set(["database", "mfl", "progression", "agents", "watchlist", "myplayers"]);
  const PAGE_SIZE_ESCAPE_CLASS = "mflPageSizeEscapeSuppressed";
  const previous = window.__mflTableNavigationChromeRuntime;
  previous?.destroy?.();

  let pendingPage = "";
  let repairFrame = 0;
  let pageSizeEscapeFrame = 0;

  function normalizePage(value) {
    const page = String(value || "").toLowerCase();
    if (page === "my-players") return "myplayers";
    return page;
  }

  function tablePageFromTarget(target) {
    if (!(target instanceof Element)) return "";
    const nav = target.closest("#sidebar .navButton[data-page]");
    if (!(nav instanceof HTMLElement)) return "";
    const page = normalizePage(nav.dataset.page);
    return TABLE_PAGES.has(page) ? page : "";
  }

  function primeDestination(page) {
    if (!TABLE_PAGES.has(page)) return;
    window.__mflSharedTableUiRuntime?.prime?.(page);
  }

  function showDestinationChrome(page) {
    pendingPage = page;
    if (document.body && document.body.dataset.page !== page) {
      document.body.dataset.page = page;
    }
    primeDestination(page);
  }

  function finishDestinationChrome(page) {
    queueMicrotask(() => {
      if (pendingPage !== page) return;
      primeDestination(page);
      if (repairFrame) cancelAnimationFrame(repairFrame);
      repairFrame = requestAnimationFrame(() => {
        repairFrame = 0;
        if (pendingPage !== page) return;
        primeDestination(page);
        pendingPage = "";
      });
    });
  }

  function pageSizeSelectFromEscape(event) {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.id === "pageSizeSelect") return target;
    const active = document.activeElement;
    return active instanceof HTMLSelectElement && active.id === "pageSizeSelect" ? active : null;
  }

  function clearPageSizeHighlightOnEscape(event) {
    if (event.key !== "Escape") return;
    const select = pageSizeSelectFromEscape(event);
    if (!select) return;

    select.classList.add(PAGE_SIZE_ESCAPE_CLASS);
    select.blur();

    if (pageSizeEscapeFrame) cancelAnimationFrame(pageSizeEscapeFrame);
    pageSizeEscapeFrame = requestAnimationFrame(() => {
      pageSizeEscapeFrame = 0;
      if (select.isConnected && document.activeElement === select) select.blur();
    });
  }

  function onPointerDown(event) {
    const page = tablePageFromTarget(event.target);
    if (page) {
      showDestinationChrome(page);
      return;
    }
    if (event.target instanceof Element && event.target.closest("#sidebar .navButton[data-page]")) {
      pendingPage = "";
    }
  }

  function onClick(event) {
    const page = tablePageFromTarget(event.target);
    if (!page) return;
    if (pendingPage !== page) showDestinationChrome(page);
    finishDestinationChrome(page);
  }

  function onPopState() {
    pendingPage = "";
    if (repairFrame) cancelAnimationFrame(repairFrame);
    repairFrame = 0;
  }

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", clearPageSizeHighlightOnEscape, true);
  window.addEventListener("popstate", onPopState);

  function destroy() {
    if (repairFrame) cancelAnimationFrame(repairFrame);
    repairFrame = 0;
    if (pageSizeEscapeFrame) cancelAnimationFrame(pageSizeEscapeFrame);
    pageSizeEscapeFrame = 0;
    pendingPage = "";
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", clearPageSizeHighlightOnEscape, true);
    window.removeEventListener("popstate", onPopState);
  }

  window.__mflTableNavigationChromeRuntime = Object.freeze({ destroy });
})();
