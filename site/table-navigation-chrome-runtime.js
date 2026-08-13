(() => {
  "use strict";

  const TABLE_PAGES = new Set(["database", "mfl", "progression", "agents", "watchlist", "myplayers"]);
  const PAGE_SIZE_ESCAPE_CLASS = "mflPageSizeEscapeSuppressed";
  const STYLE_ID = "mflPageSizeLoadingRuntimeStyles";
  const previous = window.__mflTableNavigationChromeRuntime;
  previous?.destroy?.();

  let pendingPage = "";
  let repairFrame = 0;
  let pageSizeEscapeFrame = 0;
  let pageSizeEscapeTimer = 0;
  let pageSizeEscapeSelect = null;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    html.mflInteractionBusy #pageSizeSelect,
    html.mflInteractionBusy #pageSizeSelect:hover,
    html.mflInteractionBusy #pageSizeSelect:focus,
    html.mflInteractionBusy #pageSizeSelect:focus-visible,
    html[data-interaction-busy="true"] #pageSizeSelect,
    html[data-interaction-busy="true"] #pageSizeSelect:hover,
    html[data-interaction-busy="true"] #pageSizeSelect:focus,
    html[data-interaction-busy="true"] #pageSizeSelect:focus-visible,
    html.mflDataLoading #pageSizeSelect,
    html.mflDataLoading #pageSizeSelect:hover,
    html.mflDataLoading #pageSizeSelect:focus,
    html.mflDataLoading #pageSizeSelect:focus-visible,
    body.loading #pageSizeSelect,
    body.loading #pageSizeSelect:hover,
    body.loading #pageSizeSelect:focus,
    body.loading #pageSizeSelect:focus-visible,
    body[aria-busy="true"] #pageSizeSelect,
    body[aria-busy="true"] #pageSizeSelect:hover,
    body[aria-busy="true"] #pageSizeSelect:focus,
    body[aria-busy="true"] #pageSizeSelect:focus-visible {
      outline: none !important;
      border-color: var(--border-strong) !important;
      background: var(--surface) !important;
      color: var(--text) !important;
      box-shadow: none !important;
      transform: none !important;
      transition: none !important;
      animation: none !important;
      pointer-events: none !important;
      cursor: default !important;
    }
  `;
  document.head.appendChild(style);

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

  function blurPageSizeSelect(select) {
    if (!(select instanceof HTMLSelectElement) || !select.isConnected) return;
    select.classList.add(PAGE_SIZE_ESCAPE_CLASS);
    select.blur();
  }

  function clearPageSizeHighlightOnEscape(event) {
    if (event.key !== "Escape") return;
    const select = pageSizeSelectFromEscape(event);
    if (!select) return;

    pageSizeEscapeSelect = select;
    blurPageSizeSelect(select);

    if (pageSizeEscapeFrame) cancelAnimationFrame(pageSizeEscapeFrame);
    pageSizeEscapeFrame = requestAnimationFrame(() => {
      pageSizeEscapeFrame = 0;
      blurPageSizeSelect(select);
    });
  }

  function finishPageSizeEscape(event) {
    if (event.key !== "Escape") return;
    const select = pageSizeSelectFromEscape(event) || pageSizeEscapeSelect;
    if (!(select instanceof HTMLSelectElement)) return;

    blurPageSizeSelect(select);
    pageSizeEscapeSelect = null;

    if (pageSizeEscapeTimer) window.clearTimeout(pageSizeEscapeTimer);
    pageSizeEscapeTimer = window.setTimeout(() => {
      pageSizeEscapeTimer = 0;
      blurPageSizeSelect(select);
    }, 0);
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
  document.addEventListener("keyup", finishPageSizeEscape, true);
  window.addEventListener("popstate", onPopState);

  function destroy() {
    if (repairFrame) cancelAnimationFrame(repairFrame);
    repairFrame = 0;
    if (pageSizeEscapeFrame) cancelAnimationFrame(pageSizeEscapeFrame);
    pageSizeEscapeFrame = 0;
    if (pageSizeEscapeTimer) window.clearTimeout(pageSizeEscapeTimer);
    pageSizeEscapeTimer = 0;
    pageSizeEscapeSelect = null;
    pendingPage = "";
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", clearPageSizeHighlightOnEscape, true);
    document.removeEventListener("keyup", finishPageSizeEscape, true);
    window.removeEventListener("popstate", onPopState);
    style.remove();
  }

  window.__mflTableNavigationChromeRuntime = Object.freeze({ destroy });
})();
