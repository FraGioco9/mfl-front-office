(() => {
  "use strict";

  const VERSION = String(window.__mflReleaseVersion || "1.123.26");
  const LOADING_TEXT = "Loading players...";
  const previous = window.__mflTableLoadingRuntime;
  previous?.destroy?.();

  let observer = null;
  let frame = 0;
  let destroyed = false;

  function isPlayerTableRoute(pathname = window.location.pathname) {
    const path = String(pathname || "/");
    return /^\/(?:database|mfl|progression|watchlist|my-players|agents|clubs?|club)(?:\/|$)/i.test(path)
      && !/^\/(?:database|mfl)\/stats\/?$/i.test(path);
  }

  function tableElements() {
    const head = document.getElementById("tableHead");
    const body = document.getElementById("tableBody");
    const empty = document.getElementById("emptyState");
    return {
      head: head instanceof HTMLTableSectionElement ? head : null,
      body: body instanceof HTMLTableSectionElement ? body : null,
      empty: empty instanceof HTMLElement ? empty : null,
    };
  }

  function show() {
    if (!isPlayerTableRoute()) return false;
    const { head, body, empty } = tableElements();
    if (!head || !body) return false;

    const existingCell = body.querySelector(":scope > .staticTableLoadingRow > .staticTableLoadingCell");
    if (existingCell instanceof HTMLTableCellElement) {
      existingCell.colSpan = Math.max(1, head.rows[0]?.cells.length || 1);
      existingCell.textContent = LOADING_TEXT;
      body.dataset.staticLoading = "true";
      if (empty) {
        empty.hidden = true;
        empty.textContent = "";
      }
      return true;
    }

    const row = document.createElement("tr");
    const cell = document.createElement("td");
    row.className = "staticTableLoadingRow";
    cell.className = "staticTableLoadingCell";
    cell.colSpan = Math.max(1, head.rows[0]?.cells.length || 1);
    cell.textContent = LOADING_TEXT;
    row.appendChild(cell);
    body.replaceChildren(row);
    body.dataset.staticLoading = "true";
    if (empty) {
      empty.hidden = true;
      empty.textContent = "";
    }
    return true;
  }

  function sync() {
    frame = 0;
    if (destroyed || !isPlayerTableRoute()) return;
    const { body, empty } = tableElements();
    if (!body) return;

    const legacyLoadingVisible = Boolean(
      empty
      && !empty.hidden
      && String(empty.textContent || "").trim() === LOADING_TEXT,
    );
    if (legacyLoadingVisible) show();
  }

  function schedule() {
    if (!frame && !destroyed) frame = requestAnimationFrame(sync);
  }

  function installLegacyBridge() {
    try {
      window.eval(`(() => {
        if (typeof showTableBusyState !== "function" || showTableBusyState.__mflSingleLoadingState) return;
        const original = showTableBusyState;
        const wrapped = function (message = "${LOADING_TEXT}") {
          if (String(message || "") === "${LOADING_TEXT}" && window.__mflTableLoadingRuntime?.show?.()) {
            return;
          }
          return original.apply(this, arguments);
        };
        wrapped.__mflSingleLoadingState = true;
        wrapped.__mflOriginal = original;
        showTableBusyState = wrapped;
      })();`);
    } catch {
      // The observer still collapses a legacy loading state before it can paint
      // if a future core stops exposing the binding used by the bridge.
    }
    sync();
  }

  observer = new MutationObserver(() => {
    // MutationObserver callbacks run before paint. Collapse the legacy empty
    // state immediately rather than waiting one animation frame and flashing a
    // second visual version of "Loading players...".
    sync();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
    attributeFilter: ["hidden", "data-page"],
  });
  window.addEventListener("popstate", schedule);

  function destroy() {
    destroyed = true;
    if (frame) cancelAnimationFrame(frame);
    observer?.disconnect();
    window.removeEventListener("popstate", schedule);
  }

  window.__mflTableLoadingRuntime = Object.freeze({
    version: VERSION,
    show,
    sync,
    installLegacyBridge,
    destroy,
  });
  sync();
})();
