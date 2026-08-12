(() => {
  "use strict";

  window.__mflLoadingToastRuntime?.destroy?.();

  const TOAST_ID = "mflLoadingToast";
  const STYLE_ID = "mflLoadingToastRuntimeStyles";
  const PLAYER_LOADING_TEXT = "Loading players...";
  const BLANK_ROW_CLASS = "staticTableBlankRow";
  const BLANK_ROW_OPACITIES = Object.freeze([0.7, 0.42, 0.2]);
  const TABLE_ROW_HEIGHT = 38;
  let destroyed = false;
  let observer = null;
  let tableObserver = null;
  let tableFrame = 0;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    html.mflInteractionBusy,
    html.mflInteractionBusy body,
    html.mflInteractionBusy body *,
    html.mflInteractionBusy body *::before,
    html.mflInteractionBusy body *::after,
    html.mflInteractionBusy body::after {
      cursor: default !important;
    }

    /* Controls remain completely non-targetable while loading, which prevents
       both clicks and hover states without freezing the page's scroll surfaces. */
    html.mflInteractionBusy body *,
    html.mflInteractionBusy body *::before,
    html.mflInteractionBusy body *::after {
      pointer-events: none !important;
      transition: none !important;
      animation: none !important;
    }

    html.mflInteractionBusy body button,
    html.mflInteractionBusy body button *,
    html.mflInteractionBusy body [role="button"],
    html.mflInteractionBusy body [role="button"] * {
      transition: none !important;
      animation: none !important;
    }

    /* Keep native scrolling available while descendants remain non-targetable.
       Wheel input lands on the nearest scroll surface rather than a control. */
    html.mflInteractionBusy body main,
    html.mflInteractionBusy body .tableScroller,
    html.mflInteractionBusy body .evaluationLoadList,
    html.mflInteractionBusy body .searchBody,
    html.mflInteractionBusy body .filterBuilder,
    html.mflInteractionBusy body .advancedSettingsBody,
    html.mflInteractionBusy body .sidebar {
      pointer-events: auto !important;
    }

    /* Older route-specific CSS hides body::after on Evaluation and Stats.
       Keep the layer present for consistent busy styling, but do not let it
       swallow wheel input now that scrolling remains available during loading. */
    html.mflInteractionBusy body::after {
      content: "" !important;
      display: block !important;
      visibility: visible !important;
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483647 !important;
      background: transparent !important;
      pointer-events: none !important;
      transition: none !important;
      animation: none !important;
    }

    #${TOAST_ID} {
      pointer-events: none !important;
      user-select: none;
    }

    /* table-loading-runtime keeps this row as its lifecycle marker. The visual
       loading state is owned by the fading blank rows below instead. */
    #tableBody > .staticTableLoadingRow {
      display: none !important;
    }

    #tableBody > .${BLANK_ROW_CLASS},
    #tableBody > .${BLANK_ROW_CLASS} > td {
      pointer-events: none !important;
      transition: none !important;
      animation: none !important;
    }

    #tableBody > .${BLANK_ROW_CLASS} > td {
      height: ${TABLE_ROW_HEIGHT}px !important;
      min-height: ${TABLE_ROW_HEIGHT}px !important;
      padding-top: 0 !important;
      padding-bottom: 0 !important;
      background: var(--surface-muted) !important;
      color: transparent !important;
      user-select: none !important;
    }

    #tableBody > .${BLANK_ROW_CLASS}:hover > td,
    #tableBody > .${BLANK_ROW_CLASS} > td:hover {
      background: var(--surface-muted) !important;
      background-image: none !important;
    }
  `;
  document.head.appendChild(style);

  function ensureToast() {
    let toast = document.getElementById(TOAST_ID);
    if (toast instanceof HTMLElement) return toast;

    toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.className = "toastMessage mflLoadingToast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.setAttribute("aria-atomic", "true");
    toast.textContent = "Loading...";
    toast.hidden = true;
    document.body.appendChild(toast);
    return toast;
  }

  function positionToast(toast) {
    if (!(toast instanceof HTMLElement)) return;
    const main = document.querySelector("main");
    if (!(main instanceof HTMLElement)) {
      toast.style.removeProperty("left");
      return;
    }

    const rect = main.getBoundingClientRect();
    if (!(rect.width > 0)) return;
    toast.style.setProperty("left", `${rect.left + rect.width / 2}px`, "important");
  }

  function interactionBusy() {
    const root = document.documentElement;
    return root.classList.contains("mflInteractionBusy")
      || root.dataset.interactionBusy === "true";
  }

  function toastSuppressed() {
    // evaluationLoadIntent is owned exclusively by the initial fetch that opens
    // the saved-evaluations popup. Keep the interaction lock active, but let
    // the popup's own "Loading saved evaluations..." state be the only feedback.
    return Boolean(document.body?.classList.contains("evaluationLoadIntent"));
  }

  function tableBody() {
    const body = document.getElementById("tableBody");
    return body instanceof HTMLTableSectionElement ? body : null;
  }

  function tableHead() {
    const head = document.getElementById("tableHead");
    return head instanceof HTMLTableSectionElement ? head : null;
  }

  function suppressLegacyPlayerLoadingMessage() {
    const empty = document.getElementById("emptyState");
    if (!(empty instanceof HTMLElement)) return;
    if (String(empty.textContent || "").trim() !== PLAYER_LOADING_TEXT) return;
    empty.textContent = "";
    empty.hidden = true;
  }

  function tableLoadingActive(body) {
    if (!(body instanceof HTMLTableSectionElement)) return false;
    return body.dataset.staticLoading === "true"
      || Boolean(body.querySelector(":scope > .staticTableLoadingRow"));
  }

  function syncTableLoadingRows() {
    tableFrame = 0;
    if (destroyed) return;
    suppressLegacyPlayerLoadingMessage();

    const body = tableBody();
    if (!body) return;
    const existing = Array.from(body.querySelectorAll(`:scope > .${BLANK_ROW_CLASS}`));
    if (!tableLoadingActive(body)) {
      existing.forEach((row) => row.remove());
      return;
    }

    const head = tableHead();
    const columnCount = Math.max(1, head?.rows[0]?.cells.length || 1);
    const alreadyReady = existing.length === BLANK_ROW_OPACITIES.length
      && existing.every((row, index) => (
        row instanceof HTMLTableRowElement
        && row.cells.length === columnCount
        && row.dataset.loadingRow === String(index + 1)
      ));
    if (alreadyReady) return;

    existing.forEach((row) => row.remove());
    const fragment = document.createDocumentFragment();
    BLANK_ROW_OPACITIES.forEach((opacity, index) => {
      const row = document.createElement("tr");
      row.className = BLANK_ROW_CLASS;
      row.dataset.loadingRow = String(index + 1);
      row.setAttribute("aria-hidden", "true");
      row.style.opacity = String(opacity);
      for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
        row.appendChild(document.createElement("td"));
      }
      fragment.appendChild(row);
    });
    body.appendChild(fragment);
  }

  function scheduleTableLoadingRows() {
    if (destroyed || tableFrame) return;
    tableFrame = window.requestAnimationFrame(syncTableLoadingRows);
  }

  function observeTableLoadingRows() {
    tableObserver?.disconnect();
    tableObserver = new MutationObserver(scheduleTableLoadingRows);
    const body = tableBody();
    const head = tableHead();
    const empty = document.getElementById("emptyState");
    if (body) {
      tableObserver.observe(body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-static-loading"],
      });
    }
    if (head) tableObserver.observe(head, { childList: true, subtree: true });
    if (empty) tableObserver.observe(empty, { childList: true, subtree: true, characterData: true });
    scheduleTableLoadingRows();
  }

  function sync() {
    if (destroyed || !document.body) return;
    const toast = ensureToast();
    positionToast(toast);
    const busy = interactionBusy();

    if (busy && !toastSuppressed()) {
      toast.hidden = false;
      toast.classList.add("visible");
    } else {
      // Hide immediately when the final busy token ends or when this busy period
      // is the saved-evaluations popup fetch, which has its own loading message.
      toast.classList.remove("visible");
      toast.hidden = true;
    }
    scheduleTableLoadingRows();
  }

  observer = new MutationObserver(sync);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-interaction-busy"],
  });
  if (document.body) {
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  function onReady() {
    observeTableLoadingRows();
    sync();
  }

  function onResize() {
    sync();
    scheduleTableLoadingRows();
  }

  window.addEventListener("mfl:ready", onReady);
  window.addEventListener("resize", onResize);
  observeTableLoadingRows();
  sync();

  function destroy() {
    destroyed = true;
    observer?.disconnect();
    tableObserver?.disconnect();
    if (tableFrame) window.cancelAnimationFrame(tableFrame);
    window.removeEventListener("mfl:ready", onReady);
    window.removeEventListener("resize", onResize);
    document.getElementById(TOAST_ID)?.remove();
    document.querySelectorAll(`#tableBody > .${BLANK_ROW_CLASS}`).forEach((row) => row.remove());
    style.remove();
  }

  window.__mflLoadingToastRuntime = Object.freeze({ sync, destroy });
})();
