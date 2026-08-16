(() => {
  "use strict";

  const STYLE_ID = "mflPageSizeLoadingRuntimeStyles";

  window.__mflTableNavigationChromeRuntime?.destroy?.();

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #sidebar .navButton.active { pointer-events: none; cursor: default; }
      html.mflInteractionBusy #pageSizeSelect,
      html.mflDataLoading #pageSizeSelect,
      body[aria-busy="true"] #pageSizeSelect {
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
  }

  function destroy() {
    document.getElementById(STYLE_ID)?.remove();
  }

  installStyles();
  window.__mflTableNavigationChromeRuntime = Object.freeze({ destroy });
})();