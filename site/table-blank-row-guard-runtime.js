(() => {
  "use strict";

  const STYLE_ID = "mflTableBlankRowGuardStyles";
  const BLANK_ROW_CLASS = "staticTableBlankRow";

  window.__mflTableBlankRowGuard?.destroy?.();

  let bodyObserver = null;
  let documentObserver = null;
  let observedBody = null;
  let destroyed = false;

  function installStyles() {
    document.getElementById(STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #tableBody > .${BLANK_ROW_CLASS} > td,
      #tableBody > .${BLANK_ROW_CLASS} > td * {
        color: transparent !important;
        text-shadow: none !important;
        background-image: none !important;
      }

      #tableBody > .${BLANK_ROW_CLASS} > td > *,
      #tableBody > .${BLANK_ROW_CLASS} > td::before,
      #tableBody > .${BLANK_ROW_CLASS} > td::after,
      #tableBody > .${BLANK_ROW_CLASS} > td *::before,
      #tableBody > .${BLANK_ROW_CLASS} > td *::after {
        display: none !important;
        content: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function scrubBlankRows(body = observedBody) {
    if (!(body instanceof HTMLTableSectionElement)) return false;
    let changed = false;
    body.querySelectorAll(`:scope > .${BLANK_ROW_CLASS}`).forEach((row) => {
      Array.from(row.cells).forEach((cell) => {
        if (!cell.hasChildNodes() && !String(cell.textContent || "").trim()) return;
        cell.replaceChildren();
        changed = true;
      });
    });
    return changed;
  }

  function bindBody() {
    if (destroyed) return false;
    const body = document.getElementById("tableBody");
    if (!(body instanceof HTMLTableSectionElement)) return false;
    if (body === observedBody && bodyObserver) {
      scrubBlankRows(body);
      return true;
    }

    bodyObserver?.disconnect();
    observedBody = body;
    scrubBlankRows(body);
    bodyObserver = new MutationObserver(() => {
      if (destroyed) return;
      scrubBlankRows(body);
    });
    bodyObserver.observe(body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return true;
  }

  function ensureBound() {
    if (bindBody()) {
      documentObserver?.disconnect();
      documentObserver = null;
      return;
    }
    if (documentObserver) return;
    documentObserver = new MutationObserver(bindBody);
    documentObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function destroy() {
    destroyed = true;
    bodyObserver?.disconnect();
    documentObserver?.disconnect();
    bodyObserver = null;
    documentObserver = null;
    observedBody = null;
    document.getElementById(STYLE_ID)?.remove();
  }

  installStyles();
  ensureBound();

  window.__mflTableBlankRowGuard = Object.freeze({
    scrub: scrubBlankRows,
    destroy,
  });
})();
