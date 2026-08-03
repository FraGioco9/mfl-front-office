(() => {
  const VERSION = "1.120.8";
  const TABLE_PAGES = new Set([
    "database",
    "mfl",
    "agents",
    "progression",
    "watchlist",
    "myplayers",
    "club",
  ]);
  const previousRuntime = window.__mflTableLoadingVisibilityRuntime;

  previousRuntime?.destroy?.();

  let frame = 0;
  let interval = 0;
  let bodyObserver = null;
  let htmlObserver = null;
  let tableObserver = null;
  let loadingSnapshot = null;
  let nativeBeginInteractionBusy = null;
  let nativeEndInteractionBusy = null;
  let beginInteractionBusyWrapper = null;
  let endInteractionBusyWrapper = null;

  function tablePageActive() {
    const bodyPage = String(document.body?.dataset?.page || "");
    const statePage = typeof state === "object" && state
      ? String(state.currentPage || "")
      : "";
    return TABLE_PAGES.has(bodyPage) || TABLE_PAGES.has(statePage);
  }

  function hardLoadingStateActive() {
    if (!tablePageActive()) return false;
    const body = document.body;
    const root = document.documentElement;
    const stateBusy = typeof state === "object" && state
      ? Boolean(state.incrementalApplying) || Number(state.interactionBusyDepth || 0) > 0
      : false;

    return stateBusy
      || root.classList.contains("appBusy")
      || root.classList.contains("table-layout-pending")
      || body.classList.contains("appBusy")
      || body.classList.contains("tableLayoutPending")
      || body.classList.contains("clubViewSwitching");
  }

  function tableElements() {
    return {
      table: document.querySelector("#progressionPage table"),
      tableHead: document.querySelector("#progressionPage #tableHead"),
      tableBody: document.querySelector("#progressionPage #tableBody"),
      emptyState: document.querySelector("#progressionPage #emptyState"),
    };
  }

  function rowsReady(tableBody) {
    if (!(tableBody instanceof HTMLElement) || tableBody.children.length === 0) return false;
    return Boolean(tableBody.querySelector("tr > td, tr > th"));
  }

  function loadingStateActive(tableBody) {
    if (!tablePageActive()) return false;
    if (rowsReady(tableBody)) return false;

    const body = document.body;
    return hardLoadingStateActive()
      || body.classList.contains("tableRowsLoading")
      || body.classList.contains("mflTableDataLoading")
      || body.classList.contains("clubViewStableLoading");
  }

  function beginLoadingPresentation(table, tableHead, tableBody, emptyState) {
    if (!loadingSnapshot) {
      loadingSnapshot = {
        text: String(emptyState?.textContent || ""),
        hidden: Boolean(emptyState?.hidden),
      };
    }

    document.body.classList.add("mflPlayersLoadingOnly");
    if (table instanceof HTMLElement && table.hidden) table.hidden = false;
    if (tableHead instanceof HTMLElement) {
      if (tableHead.hidden) tableHead.hidden = false;
      tableHead.removeAttribute("aria-hidden");
    }
    if (tableBody instanceof HTMLElement && tableBody.getAttribute("aria-hidden") !== "true") {
      tableBody.setAttribute("aria-hidden", "true");
    }
    if (emptyState instanceof HTMLElement) {
      if (emptyState.hidden) emptyState.hidden = false;
      if (String(emptyState.textContent || "").trim() !== "Loading players...") {
        emptyState.textContent = "Loading players...";
      }
    }
  }

  function finishLoadingPresentation(tableBody, emptyState) {
    const hasRows = rowsReady(tableBody);
    document.body.classList.remove("mflPlayersLoadingOnly");
    if (hasRows) {
      document.body.classList.remove(
        "tableRowsLoading",
        "mflTableDataLoading",
        "clubViewStableLoading",
      );
    }

    if (tableBody instanceof HTMLElement) {
      tableBody.removeAttribute("aria-hidden");
      tableBody.style.removeProperty("visibility");
      tableBody.style.removeProperty("opacity");
      tableBody.style.removeProperty("pointer-events");
    }

    if (emptyState instanceof HTMLElement) {
      if (hasRows) {
        emptyState.hidden = true;
      } else if (String(emptyState.textContent || "").trim() === "Loading players...") {
        emptyState.hidden = false;
        emptyState.textContent = loadingSnapshot?.text || "No players found.";
      }
    }

    loadingSnapshot = null;
  }

  function applyLoadingVisibility() {
    frame = 0;
    const { table, tableHead, tableBody, emptyState } = tableElements();
    if (!(tableBody instanceof HTMLElement) || !(emptyState instanceof HTMLElement)) return;

    if (loadingStateActive(tableBody)) {
      beginLoadingPresentation(table, tableHead, tableBody, emptyState);
    } else {
      finishLoadingPresentation(tableBody, emptyState);
    }
  }

  function scheduleLoadingVisibility() {
    if (frame) window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(applyLoadingVisibility);
  }

  let style = document.getElementById("tableLoadingVisibilityStyles");
  if (!style) {
    style = document.createElement("style");
    style.id = "tableLoadingVisibilityStyles";
    document.head.appendChild(style);
  }
  style.textContent = `
    body.mflPlayersLoadingOnly #progressionPage .tableFrame,
    body.mflPlayersLoadingOnly #progressionPage .tableScroll,
    body.mflPlayersLoadingOnly #progressionPage table,
    body.mflPlayersLoadingOnly #progressionPage #tableHead {
      visibility: visible !important;
      opacity: 1 !important;
    }

    body.mflPlayersLoadingOnly #progressionPage #tableHead {
      display: table-header-group !important;
    }

    body.mflPlayersLoadingOnly #progressionPage #tableBody:empty {
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }

    body.mflPlayersLoadingOnly #progressionPage #emptyState {
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
  `;

  if (typeof beginInteractionBusy === "function") {
    nativeBeginInteractionBusy = beginInteractionBusy;
    beginInteractionBusyWrapper = function beginInteractionBusyWithHiddenRows() {
      const result = nativeBeginInteractionBusy.apply(this, arguments);
      applyLoadingVisibility();
      return result;
    };
    beginInteractionBusy = beginInteractionBusyWrapper;
  }

  if (typeof endInteractionBusy === "function") {
    nativeEndInteractionBusy = endInteractionBusy;
    endInteractionBusyWrapper = function endInteractionBusyWithLoadedRows() {
      const result = nativeEndInteractionBusy.apply(this, arguments);
      scheduleLoadingVisibility();
      return result;
    };
    endInteractionBusy = endInteractionBusyWrapper;
  }

  if (document.body) {
    bodyObserver = new MutationObserver(scheduleLoadingVisibility);
    bodyObserver.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["class", "data-page", "hidden"],
    });
  }

  htmlObserver = new MutationObserver(scheduleLoadingVisibility);
  htmlObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  const progressionPage = document.querySelector("#progressionPage");
  if (progressionPage) {
    tableObserver = new MutationObserver(scheduleLoadingVisibility);
    tableObserver.observe(progressionPage, {
      childList: true,
      subtree: true,
    });
  }

  interval = window.setInterval(scheduleLoadingVisibility, 250);

  function destroy() {
    if (frame) window.cancelAnimationFrame(frame);
    if (interval) window.clearInterval(interval);
    bodyObserver?.disconnect();
    htmlObserver?.disconnect();
    tableObserver?.disconnect();
    document.body?.classList.remove("mflPlayersLoadingOnly");

    if (
      nativeBeginInteractionBusy
      && beginInteractionBusyWrapper
      && typeof beginInteractionBusy === "function"
      && beginInteractionBusy === beginInteractionBusyWrapper
    ) {
      beginInteractionBusy = nativeBeginInteractionBusy;
    }

    if (
      nativeEndInteractionBusy
      && endInteractionBusyWrapper
      && typeof endInteractionBusy === "function"
      && endInteractionBusy === endInteractionBusyWrapper
    ) {
      endInteractionBusy = nativeEndInteractionBusy;
    }
  }

  window.__mflTableLoadingVisibilityRuntime = {
    version: VERSION,
    destroy,
    sync: scheduleLoadingVisibility,
  };

  applyLoadingVisibility();
})();
